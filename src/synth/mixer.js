import { registry } from './registry.js';
import { reverb, softClip } from './dsp.js';
/** Mix pre-rendered pure instrument buffers. Times and durations are milliseconds. */
export function mixEvents(events,{sampleRate=44100,startMs=0,durationMs,wet=0,master=.40}={}) {
  if (durationMs === undefined) durationMs=Math.max(0,...events.map(e=>e.time+e.duration+1000))-startMs;
  const length=Math.ceil(durationMs*sampleRate/1000), left=new Float32Array(length),right=new Float32Array(length);
  for (const event of events) {
    const instrument=registry[event.instrument]; if (!instrument) throw new Error(`Unknown instrument: ${event.instrument}`);
    const samples=instrument.render({midi:event.midi ?? 60,duration:event.duration/1000,drum:event.drum},sampleRate), offset=Math.round((event.time-startMs)*sampleRate/1000), pan=Math.max(-1,Math.min(1,event.pan ?? 0));
    const l=Math.cos((pan+1)*Math.PI/4)*event.gain*master, r=Math.sin((pan+1)*Math.PI/4)*event.gain*master;
    for(let i=Math.max(0,-offset);i<samples.length && i+offset<length;i++) {
      const t=event.time+i*1000/sampleRate, fade=event.fadeAt===undefined ? 1 : Math.max(0,Math.min(1,1-(t-event.fadeAt)/100));
      left[i+offset]+=samples[i]*l*fade; right[i+offset]+=samples[i]*r*fade;
    }
  }
  if (wet) reverb(left,right,sampleRate,wet);
  for(let i=0;i<length;i++){left[i]=softClip(left[i]);right[i]=softClip(right[i]);}
  return {left,right,sampleRate};
}
