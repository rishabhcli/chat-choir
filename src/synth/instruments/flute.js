import { frequency, durationOf, envelope, noiseGenerator, sine, lowPass } from '../dsp.js';
export const id='flute', name='Flute', role='melodic';
export function render(note,sampleRate) { const d=durationOf(note),out=new Float32Array(Math.ceil((d+.2)*sampleRate)),f=frequency(note.midi),noise=noiseGenerator(`flute:${note.midi}:${d}`); let breath=0; for(let i=0;i<out.length;i++){const t=i/sampleRate; breath=lowPass(noise(),breath,.12); out[i]=.25*envelope(t,d,.06,.2)*(sine(f*t)+.09*breath+.08*sine(2*f*t));} return out; }
