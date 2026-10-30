import { frequency, durationOf, envelope, sine, lowPass, saw } from '../dsp.js';
export const id='bass', name='Bass', role='bass';
export function render(note,sampleRate) {const d=durationOf(note),out=new Float32Array(Math.ceil((d+.18)*sampleRate)),f=frequency(note.midi);let state=0;for(let i=0;i<out.length;i++){const t=i/sampleRate;state=lowPass(saw(f*t),state,.06);out[i]=.28*envelope(t,d,.008,.18)*(sine(f*t)*.7+state*.3);}return out;}
