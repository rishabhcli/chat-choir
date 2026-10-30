import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Transport } from '../music/transport.js';
import { textToPhrase } from '../music/phrase.js';
import { CommandProcessor } from '../music/commands.js';
import { mixEvents } from '../synth/mixer.js';

/** Replay an ordered session. Commands and deletions use the same live APIs. */
export function arrangeSession(session,options={}) {
  if (!Array.isArray(session)) throw new TypeError('Session must be a JSON array');
  const transport=new Transport(options), commands=new CommandProcessor(options), entries=session.map((e,i)=>({...e,_i:i})).sort((a,b)=>a.t-b.t || a._i-b._i);
  for(const e of entries) {
    if(!Number.isFinite(e.t) || e.t<0) throw new RangeError('Session timestamps must be nonnegative milliseconds');
    if(e.type==='chat') transport.enqueue(textToPhrase(e,transport.getNextBarSettings(e.t)),e.t);
    else if(e.type==='command') {const result=commands.process(e);if(result.type==='apply')transport.settings(result.patch,e.t);}
    else if(e.type==='delete') transport.remove(e.messageId ?? e.userId,e.t);
    else throw new Error(`Unknown session entry type: ${e.type}`);
  }
  return {transport,lastTime:entries.at(-1)?.t ?? 0};
}
export function renderSession(session,{sampleRate=44100,...options}={}) {
  const {transport,lastTime}=arrangeSession(session,options);
  const endBar=transport.phrases.reduce((n,p)=>Math.max(n,p.startBar+p.phrase.bars*transport.config.loops),1);
  const end=Math.max(lastTime+1000,transport.ensureBar(endBar).start+1500);
  return {...mixEvents(transport.eventsBetween(0,end),{sampleRate,durationMs:end,wet:.12}),transport};
}
export function encodeWav({left,right,sampleRate}) {
  if(left.length!==right.length) throw new RangeError('Stereo channels differ in length');
  const buffer=new ArrayBuffer(44+left.length*4), view=new DataView(buffer); const str=(pos,s)=>[...s].forEach((c,i)=>view.setUint8(pos+i,c.charCodeAt(0)));
  str(0,'RIFF');view.setUint32(4,36+left.length*4,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,left.length*4,true);
  for(let i=0;i<left.length;i++)for(let ch=0;ch<2;ch++){const v=Math.max(-1,Math.min(1,ch?right[i]:left[i]));view.setInt16(44+i*4+ch*2,Math.round(v*(v<0?32768:32767)),true);}
  return new Uint8Array(buffer);
}
export function audioStats({left,right,sampleRate}) { let peak=0,sum=0;for(let i=0;i<left.length;i++){peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));sum+=left[i]**2+right[i]**2;}return {peak,rms:Math.sqrt(sum/(left.length*2)),duration:left.length/sampleRate}; }
async function main() {
  const [input,output]=process.argv.slice(2);
  if(!input || input==='--help' || !output) {console.log('Chat Choir offline core\nUsage: npm run render -- <session.json> <out.wav>'); if(input!=='--help') process.exitCode=1;return;}
  const session=JSON.parse(await readFile(input,'utf8')), audio=renderSession(session), stats=audioStats(audio);
  await writeFile(output,encodeWav(audio)); console.log(`Rendered ${output}: ${stats.duration.toFixed(2)} s, peak ${stats.peak.toFixed(4)}, RMS ${stats.rms.toFixed(4)}`);
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(error=>{console.error(error.message);process.exitCode=1;});
