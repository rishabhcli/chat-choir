import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { ChoirSession } from '../music/session.js';
import { mixEvents } from '../synth/mixer.js';

/** Replay an ordered session. Commands and deletions use the same live APIs. */
export function arrangeSession(session,options={}) {
  if (!Array.isArray(session)) throw new TypeError('Session must be a JSON array');
  const state=new ChoirSession(options), entries=session.map((e,i)=>({...e,_i:i})).sort((a,b)=>a.t-b.t || a._i-b._i);
  for(const e of entries) {
    if(!Number.isFinite(e.t) || e.t<0) throw new RangeError('Session timestamps must be nonnegative milliseconds');
    state.apply(e);
  }
  const transport=state.transport;
  return {transport,firstTime:entries[0]?.t ?? 0,lastTime:entries.at(-1)?.t ?? 0};
}
export function renderSession(session,{sampleRate=44100,normalize=true,...options}={}) {
  const {transport,firstTime,lastTime}=arrangeSession(session,options);
  const endBar=transport.phrases.reduce((n,p)=>Math.max(n,p.startBar+p.phrase.bars*transport.config.loops),1);
  const end=Math.max(lastTime+1000,transport.ensureBar(endBar).start+1500);
  const events=transport.eventsBetween(0,end), startMs=firstTime;
  const audio=mixEvents(events,{sampleRate,startMs,durationMs:end-startMs,wet:.12});
  if(normalize) normalizeAudio(audio);
  return {...audio,transport,startMs};
}
/** Peak normalization with a gentle saturating knee, followed by peak calibration. */
export function normalizeAudio(audio,target=10**(-1/20)-1e-6) {
  let peak=0; for(const channel of [audio.left,audio.right]) for(const sample of channel) peak=Math.max(peak,Math.abs(sample));
  if(!peak)return audio;
  const gain=target/peak, knee=target*.8, span=target-knee; let finalPeak=0;
  for(const channel of [audio.left,audio.right]) for(let i=0;i<channel.length;i++){const x=channel[i]*gain, a=Math.abs(x); channel[i]=Math.sign(x)*(a<=knee?a:knee+span*Math.tanh((a-knee)/span));finalPeak=Math.max(finalPeak,Math.abs(channel[i]));}
  const correction=target/finalPeak;for(const channel of [audio.left,audio.right])for(let i=0;i<channel.length;i++)channel[i]*=correction;
  return audio;
}
export function parseSessionFile(content) { const trimmed=content.trim(); if(!trimmed)return []; return trimmed.startsWith('[') ? JSON.parse(trimmed) : trimmed.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line)); }
export function encodeWav({left,right,sampleRate}) {
  if(left.length!==right.length) throw new RangeError('Stereo channels differ in length');
  const buffer=new ArrayBuffer(44+left.length*4), view=new DataView(buffer); const str=(pos,s)=>[...s].forEach((c,i)=>view.setUint8(pos+i,c.charCodeAt(0)));
  str(0,'RIFF');view.setUint32(4,36+left.length*4,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,left.length*4,true);
  for(let i=0;i<left.length;i++)for(let ch=0;ch<2;ch++){const v=Math.max(-1,Math.min(1,ch?right[i]:left[i]));view.setInt16(44+i*4+ch*2,Math.round(v*(v<0?32768:32767)),true);}
  return new Uint8Array(buffer);
}
export function audioStats({left,right,sampleRate}) { let peak=0,sum=0;for(let i=0;i<left.length;i++){peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));sum+=left[i]**2+right[i]**2;}return {peak,rms:Math.sqrt(sum/(left.length*2)),duration:left.length/sampleRate}; }
async function main() {
  const args=process.argv.slice(2), normalize=!args.includes('--no-normalize'), [input,output]=args.filter(x=>x!=='--no-normalize');
  if(!input || input==='--help' || !output) {console.log('Chat Choir offline core\nUsage: npm run render -- <session.json|session.jsonl> <out.wav> [--no-normalize]'); if(input!=='--help') process.exitCode=1;return;}
  const session=parseSessionFile(await readFile(input,'utf8')), audio=renderSession(session,{normalize}), stats=audioStats(audio);
  await writeFile(output,encodeWav(audio)); console.log(`Rendered ${output}: ${stats.duration.toFixed(2)} s, peak ${stats.peak.toFixed(4)}, RMS ${stats.rms.toFixed(4)}`);
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(error=>{console.error(error.message);process.exitCode=1;});
