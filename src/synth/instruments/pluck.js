import { frequency, durationOf, noiseGenerator, envelope } from '../dsp.js';
export const id='pluck', name='Pluck', role='melodic';
export function render(note,sampleRate) {
  const duration=durationOf(note), out=new Float32Array(Math.ceil((duration+.25)*sampleRate)), size=Math.max(2,Math.round(sampleRate/frequency(note.midi))), buffer=new Float32Array(size), noise=noiseGenerator(`pluck:${note.midi}:${duration}`);
  for (let i=0;i<size;i++) buffer[i]=noise()*.55;
  for (let i=0;i<out.length;i++) { const p=i%size, next=(p+1)%size, value=buffer[p]; buffer[p]=(value+buffer[next])*.497; out[i]=value*envelope(i/sampleRate,duration,.003,.25)*.45; }
  return out;
}
