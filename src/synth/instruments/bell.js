import { frequency, durationOf, envelope } from '../dsp.js';
export const id='bell', name='Bell', role='melodic';
export function render(note,sampleRate) { const d=durationOf(note), out=new Float32Array(Math.ceil((d+.4)*sampleRate)), f=frequency(note.midi); for(let i=0;i<out.length;i++){const t=i/sampleRate,e=envelope(t,d,.003,.4)*Math.exp(-t*1.8); out[i]=.28*e*Math.sin(2*Math.PI*f*t+2*Math.exp(-t*5)*Math.sin(2*Math.PI*f*2.01*t));} return out; }
