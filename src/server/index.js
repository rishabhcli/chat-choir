import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';
import {loadEnv,getConfig} from '../config.js';
import {TwitchAuth} from '../twitch/auth.js';
import {Helix} from '../twitch/helix.js';
import {EventSub} from '../twitch/eventsub.js';
import {ChoirSession} from '../music/session.js';
import {exportMidi,exportLyricSheet} from '../music/midi.js';
import {parseKey,normalizeScale,MOODS} from '../music/theory.js';
import {ChatPolicy} from './policy.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
function cleanSettings(input) {
  const patch={};for(const [k,v] of Object.entries(input)){if(k==='key')patch.key=parseKey(String(v)).name;else if(k==='scale')patch.scale=normalizeScale(String(v));else if(k==='mood'){if(!Object.hasOwn(MOODS,v))throw Error('Invalid mood');patch.mood=v;}else if(k==='bpm'||k==='tempo'){const n=Number(v);if(!Number.isFinite(n)||n<60||n>160)throw Error('Invalid tempo');patch.bpm=n;}else if(k==='volume'){const n=Number(v);if(!Number.isFinite(n)||n<0||n>1)throw Error('Invalid volume');patch.volume=n;}else if(k==='replies'){if(typeof v!=='boolean')throw Error('Invalid replies');patch.replies=v;}else if(k==='mutedUsers'){if(!Array.isArray(v)||v.length>1000||v.some(x=>typeof x!=='string'||x.length>100))throw Error('Invalid muted users');patch.mutedUsers=v;}else throw Error(`Unknown setting: ${k}`);}return patch;
}
export async function createChoirServer({config,mode='live',speed=1,log=console.log,auth,helix}={}) {
  if(!config)config=getConfig(process.env,{live:mode==='live'});if(!Number.isFinite(speed)||speed<=0||speed>1000)throw Error('Invalid replay speed');
  await mkdir(config.sessionDir,{recursive:true,mode:0o700});const filename=path.join(config.sessionDir,`${new Date().toISOString().replace(/[:.]/g,'-')}-${process.pid}.jsonl`),stream=createWriteStream(filename,{flags:'wx',mode:0o600});
  const state=new ChoirSession({replies:config.replies}),policy=new ChatPolicy({ignoreUsers:config.ignoreUsers}),events=[];let start=Date.now(),lastT=0,eventsub,identity=null,channel=null,connected=false,lastReply=-Infinity,serial=0,replayTimers=[],closing=false;
  const now=()=>Math.max(lastT,Math.floor((Date.now()-start)*speed));
  const status=()=>({mode,speed,connected,user:identity?.login||null,channel:channel?.login||null,clients:wss.clients.size,noTest:config.noTest});
  const settings=()=>({...state.transport.getSettings(now()),volume:state.volume,replies:state.replies,mutedUsers:state.mutedUsers});
  const send=(socket,data)=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data));};
  const broadcast=data=>{for(const socket of wss.clients)send(socket,data);};
  const publishStatus=()=>broadcast({type:'status',status:status()});
  function append(input) {const event={...input,t:Math.max(lastT,Math.floor(input.t??now()))};lastT=event.t;state.apply(event);events.push(event);stream.write(`${JSON.stringify(event)}\n`);broadcast({type:'event',event});return event;}
  async function handleEvent(input,t=now()) {
    if(input.type==='chat') {const decision=policy.classify(input,t,state.mutedUsers);if(decision.kind==='skip')return;
      if(decision.kind==='command'){const result=state.commands.process({...decision.event,t});if(result.type==='apply')append({type:'settings',t,patch:result.patch,source:'chat-command'});if(result.reply && state.replies && mode==='live' && helix && t-lastReply>=3000){lastReply=t;try{const sent=await helix.sendChatMessage(channel.id,identity.userId,result.reply);if(!sent.isSent)log(`Chat reply dropped (${sent.dropReason?.code||'unknown'})`);}catch(e){log(`Chat reply failed (${e.status||'network error'})`);}}return;}
      return append({...decision.event,t});
    }
    if(input.type==='command'){const result=state.commands.process({...input,t});if(result.type==='apply')return append({type:'settings',t,patch:result.patch,source:'chat-command'});return;}
    if(input.type==='delete'||input.type==='clear')return append({type:'remove',t,...(input.messageId?{messageId:input.messageId}:{}),...(input.userId?{userId:input.userId}:{})});
    if(['settings','remove','celebration'].includes(input.type))return append({...input,t});
  }
  const server=http.createServer(async(req,res)=>{try {
    const url=new URL(req.url,'http://localhost');const respond=(code,data,type='application/json; charset=utf-8')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);};
    const json=data=>respond(200,JSON.stringify(data));
    if(req.method==='GET'&&url.pathname==='/api/state')return json({now:now(),settings:settings(),status:status(),snapshot:state.transport.snapshot(now()),events});
    if(req.method==='GET'&&url.pathname==='/export.mid')return respond(200,exportMidi(state.transport),'audio/midi');
    if(req.method==='GET'&&url.pathname==='/export-lyrics.txt')return respond(200,exportLyricSheet(state.transport),'text/plain; charset=utf-8');
    if(req.method==='GET'&&url.pathname==='/export-session.jsonl')return respond(200,events.map(e=>JSON.stringify(e)).join('\n')+'\n','application/x-ndjson');
    if(req.method==='POST'&&['/api/settings','/api/test-message','/api/remove'].includes(url.pathname)) {
      const origin=req.headers.origin;if(origin){const o=new URL(origin);if(!['localhost','127.0.0.1','[::1]'].includes(o.hostname)||o.port!==String(server.address().port))return respond(403,'Forbidden','text/plain');}
      if(!(req.headers['content-type']||'').startsWith('application/json'))return respond(415,'JSON required','text/plain');let body='';for await(const chunk of req){body+=chunk;if(body.length>16384)throw Error('Request too large');}const data=JSON.parse(body||'{}');
      if(url.pathname==='/api/settings'){const patch=cleanSettings(data);append({type:'settings',patch,source:'dashboard'});return json({ok:true,settings:settings()});}
      if(url.pathname==='/api/remove'){if(typeof data.messageId!=='string'&&typeof data.userId!=='string')throw Error('Missing message or user ID');append({type:'remove',...(data.messageId?{messageId:data.messageId}:{userId:data.userId}),source:'dashboard'});return json({ok:true});}
      if(config.noTest)return respond(403,'Local test messages are disabled','text/plain');const text=String(data.text||'').trim();if(!text)throw Error('Enter a test message');await handleEvent({type:'chat',id:`local-${++serial}`,userId:'local-test',userName:'Local test',text,source:'local-test',badges:[]});return json({ok:true});
    }
    if(req.method!=='GET')return respond(405,'Method not allowed','text/plain');const relative=url.pathname==='/'?'public/dashboard.html':url.pathname==='/overlay'?'public/overlay.html':url.pathname.startsWith('/src/')?url.pathname.slice(1):`public${url.pathname}`;const file=path.resolve(root,relative);if(!file.startsWith(path.join(root,'public')+path.sep)&&!file.startsWith(path.join(root,'src')+path.sep))return respond(403,'Forbidden','text/plain');const data=await readFile(file);return respond(200,data,types[path.extname(file)]||'application/octet-stream');
  }catch(e){const status=e.code==='ENOENT'?404:400;res.writeHead(status,{'content-type':'text/plain; charset=utf-8'});res.end(status===404?'Not found':e.message);}});
  const wss=new WebSocketServer({noServer:true});server.on('upgrade',(req,socket,head)=>{const origin=req.headers.origin;try {if(new URL(req.url,'http://localhost').pathname!=='/ws'||(origin&&(!['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname)||new URL(origin).port!==String(server.address().port)))){socket.destroy();return;}}catch{socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
  wss.on('connection',socket=>{send(socket,{type:'hello',now:now(),settings:settings(),initialSettings:{replies:config.replies,volume:.8},events,status:status()});publishStatus();socket.on('close',publishStatus);});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.port,'127.0.0.1',resolve);});log(`Chat Choir ${mode} listening at http://127.0.0.1:${server.address().port}`);
  async function connectTwitch() {
    auth ||= new TwitchAuth(config);helix ||= new Helix({...config,auth});identity=await auth.validate();const login=config.channel||identity.login;channel=(await helix.getUsers({login}))[0];if(!channel)throw Error(`Twitch channel ${login} was not found`);log(`Twitch authenticated as ${identity.login}; channel ${channel.login}`);
    let seen=new Set();try{seen=new Set(JSON.parse(await readFile(config.seenFile,'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;}
    let saving=Promise.resolve();const firstSeen=id=>{if(seen.has(id))return false;seen.add(id);saving=saving.then(async()=>{await mkdir(path.dirname(config.seenFile),{recursive:true,mode:0o700});await writeFile(config.seenFile,JSON.stringify([...seen]),{mode:0o600});}).catch(()=>log('Could not save seen users'));return true;};
    eventsub=new EventSub({url:config.eventsubUrl,helix,broadcasterId:channel.id,userId:identity.userId,firstSeen,onEvent:e=>{handleEvent(e).catch(()=>log('Could not process Twitch event'));},onStatus:value=>{connected=value;publishStatus();},log});eventsub.start();publishStatus();
  }
  function replay(entries) {for(const input of entries){const delay=Math.max(0,input.t/speed-(Date.now()-start));replayTimers.push(setTimeout(()=>{handleEvent(input,input.t).catch(()=>log('Could not process replay event'));},delay));}}
  async function close(){if(closing)return;closing=true;eventsub?.stop();for(const timer of replayTimers)clearTimeout(timer);for(const socket of wss.clients)socket.terminate();await new Promise(resolve=>wss.close(resolve));await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>stream.end(resolve));}
  return {server,wss,events,state,filename,now,status,handleEvent,append,connectTwitch,replay,close};
}
async function main(){await loadEnv();const config=getConfig();const app=await createChoirServer({config});try{await app.connectTwitch();}catch(e){await app.close();throw e;}for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{app.close().then(()=>process.exit(0));});}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
