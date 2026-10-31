import { frequency, durationOf, envelope, noiseGenerator, sine } from '../dsp.js';

export const id = 'steelpan', name = 'Steel Pan', role = 'melodic';

/** A struck pan's fundamental and independently decaying, slightly detuned partials. */
export function render(note, sampleRate) {
  const duration = durationOf(note), fundamental = frequency(note.midi);
  const out = new Float32Array(Math.ceil((duration + .45) * sampleRate));
  const noise = noiseGenerator(`steelpan:${note.midi}:${duration}`);
  const partials = [[1, .72, 1.25], [2.01, .23, 3.1], [3.03, .15, 4.4], [4.2, .10, 6.2]]
    .filter(([ratio]) => fundamental * ratio < sampleRate / 2);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    let tone = 0;
    for (const [ratio, weight, decay] of partials) tone += weight * Math.exp(-decay * t) * sine(fundamental * ratio * t);
    const strike = .018 * noise() * Math.exp(-90 * t);
    out[i] = .38 * envelope(t, duration, .003, .45) * (tone + strike);
  }
  return out;
}
