import { hash } from '../music/hash.js';
export const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
export const sine = phase => Math.sin(phase * 2 * Math.PI);
export const saw = phase => 2 * (phase - Math.floor(phase + .5));
export const softClip = x => x / (1 + Math.abs(x));
export function envelope(t, duration, attack=.01, release=.2) {
  if (t < 0 || t >= duration+release) return 0;
  const a = Math.min(1,t/Math.max(.0001,attack));
  return a * (t < duration ? 1 : Math.max(0,1-(t-duration)/release)) ** 2;
}
export function noiseGenerator(seed) {
  let state=hash(seed) || 1;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return ((state >>> 0) / 2147483648)-1; };
}
export function lowPass(sample, state, coefficient) { return state + coefficient * (sample-state); }
export function durationOf(note) { return Math.max(.02,Math.min(8, Number(note.duration) || .25)); }
/** Tiny deterministic stereo Schroeder-style parallel comb reverb. */
export function reverb(left,right,sampleRate,wet=.12) {
  const lengths=[.0297,.0371,.0411,.0437].map(x=>Math.max(1,Math.round(x*sampleRate)));
  const lines=lengths.map(n=>new Float32Array(n)); const positions=lengths.map(()=>0);
  for (let i=0;i<left.length;i++) {
    const input=(left[i]+right[i])*.5; let l=0,r=0;
    for (let j=0;j<lines.length;j++) { const v=lines[j][positions[j]]; lines[j][positions[j]]=input+v*.68; positions[j]=(positions[j]+1)%lines[j].length; if (j%2) r+=v; else l+=v; }
    left[i]+=l*wet*.5; right[i]+=r*wet*.5;
  }
  return {left,right};
}
