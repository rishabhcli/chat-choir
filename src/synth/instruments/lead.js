import { frequency, durationOf, envelope, sine, saw, lowPass } from '../dsp.js';
export const id='lead', name='Lead', role='melodic';
export function render(note,sampleRate) {const d=durationOf(note),out=new Float32Array(Math.ceil((d+.2)*sampleRate)),f=frequency(note.midi);let state=0;for(let i=0;i<out.length;i++){const t=i/sampleRate, phase=f*t+0.8*Math.sin(2*Math.PI*5*t)/5;state=lowPass(saw(phase),state,.12);out[i]=.24*envelope(t,d,.025,.2)*(state*.55+sine(phase)*.45);}return out;}
