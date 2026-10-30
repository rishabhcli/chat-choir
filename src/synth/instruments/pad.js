import { frequency, durationOf, envelope, sine, lowPass } from '../dsp.js';
export const id='pad', name='Pad', role='pad';
export function render(note,sampleRate) {const d=durationOf(note),out=new Float32Array(Math.ceil((d+.5)*sampleRate)),f=frequency(note.midi);let state=0;for(let i=0;i<out.length;i++){const t=i/sampleRate,raw=(sine(f*t)+sine(f*1.006*t)+.35*sine(f*2*t))/2.35;state=lowPass(raw,state,.08);out[i]=.19*envelope(t,d,.25,.5)*state;}return out;}
