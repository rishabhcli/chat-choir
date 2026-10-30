import { noiseGenerator, sine } from '../dsp.js';
export const id='drums', name='Synthesized Drums', role='percussion';
export function render(note,sampleRate) {
  const drum=note.drum || 'kick', durations={kick:.48,snare:.28,closedHat:.10,openHat:.42,clap:.30,tom:.40}, d=durations[drum] || .3, out=new Float32Array(Math.ceil(d*sampleRate)),noise=noiseGenerator(`drum:${drum}:${note.midi ?? 0}`); let previous=0;
  for(let i=0;i<out.length;i++){const t=i/sampleRate,n=noise(),high=n-previous*.8;previous=n;let s=0;
    if(drum==='kick') s=.52*sine(45*t+70*(1-Math.exp(-t*30))/30)*Math.exp(-t*9);
    else if(drum==='tom') s=.36*sine(95*t+80*(1-Math.exp(-t*20))/20)*Math.exp(-t*9);
    else if(drum==='snare') s=(.17*high+.19*sine(185*t))*Math.exp(-t*15);
    else if(drum==='clap') s=.15*high*(Math.exp(-t*24)+Math.exp(-Math.abs(t-.025)*45)+Math.exp(-Math.abs(t-.05)*45));
    else s=.13*high*Math.exp(-t*(drum==='closedHat'?55:12));
    out[i]=s*Math.min(1,(d-t)*100);
  } return out;
}
