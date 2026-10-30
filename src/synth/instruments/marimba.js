import { frequency, durationOf, envelope, sine } from '../dsp.js';
export const id='marimba', name='Marimba', role='melodic';
export function render(note,sampleRate) { const d=durationOf(note), out=new Float32Array(Math.ceil((d+.18)*sampleRate)), f=frequency(note.midi); for(let i=0;i<out.length;i++){const t=i/sampleRate, e=envelope(t,d,.003,.18)*Math.exp(-t*3.2); out[i]=.34*e*(sine(f*t)+.24*sine(f*3.99*t)*Math.exp(-t*8));} return out; }
