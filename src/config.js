import { readFile } from 'node:fs/promises';
import path from 'node:path';
/** Load simple KEY=value lines without overwriting the process environment. */
export async function loadEnv(file='.env',env=process.env) {
  if(env.CHOIR_SKIP_ENV==='1')return env;
  let content; try { content=await readFile(file,'utf8'); } catch(e) { if(e.code==='ENOENT') return env; throw e; }
  for(const line of content.split(/\r?\n/)) {const m=/^\s*(?:export\s+)?([A-Za-z_][\w]*)\s*=\s*(.*?)\s*$/.exec(line);if(!m || Object.hasOwn(env,m[1]))continue;let value=m[2];if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);else value=value.replace(/\s+#.*$/,'');env[m[1]]=value;}
  return env;
}
export function getConfig(env=process.env,{live=true}={}) {
  const port=Number(env.PORT ?? 3000);if(!Number.isInteger(port)||port<0||port>65535)throw Error('PORT must be between 0 and 65535');
  const voteText=String(env.CHOIR_VOTES ?? '3').trim(), votesRequired=Number(voteText);if(!/^\d+$/.test(voteText)||!Number.isInteger(votesRequired)||votesRequired<1||votesRequired>20)throw Error('CHOIR_VOTES must be an integer between 1 and 20');
  const windowText=String(env.CHOIR_VOTE_WINDOW_SECONDS ?? '60').trim(), voteWindowSeconds=Number(windowText);if(!windowText||!Number.isFinite(voteWindowSeconds)||voteWindowSeconds<=0||voteWindowSeconds>Number.MAX_SAFE_INTEGER/1000)throw Error('CHOIR_VOTE_WINDOW_SECONDS must be a positive finite number of seconds');
  const clientId=env.TWITCH_CLIENT_ID?.trim() || '';if(live&&!clientId)throw Error('TWITCH_CLIENT_ID is required for live mode');
  const binary=(name,def)=>{const value=env[name] ?? def;if(!['0','1'].includes(value))throw Error(`${name} must be 0 or 1`);return value==='1';};
  const endpoint=(name,fallback,protocols)=>{const value=env[name]||fallback;let url;try{url=new URL(value);}catch{throw Error(`${name} is not a valid URL`);}if(!protocols.includes(url.protocol))throw Error(`${name} has an invalid protocol`);return value.replace(/\/$/,'');};
  return {clientId,votesRequired,voteWindowMs:voteWindowSeconds*1000,channel:(env.TWITCH_CHANNEL||'').toLowerCase().replace(/^#/,''),port,replies:binary('CHOIR_REPLIES','1'),noTest:binary('CHOIR_NO_TEST','0'),ignoreUsers:(env.IGNORE_USERS ?? 'nightbot,streamelements,streamlabs,moobot,fossabot').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),sessionDir:env.SESSION_DIR||'.data/sessions',tokenFile:path.join('.data','tokens.json'),seenFile:path.join('.data','seen-users.json'),idBase:endpoint('TWITCH_ID_BASE','https://id.twitch.tv',['http:','https:']),apiBase:endpoint('TWITCH_API_BASE','https://api.twitch.tv',['http:','https:']),eventsubUrl:endpoint('TWITCH_EVENTSUB_URL','wss://eventsub.wss.twitch.tv/ws',['ws:','wss:'])};
}
