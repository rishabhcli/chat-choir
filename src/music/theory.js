/** Pitch classes and scales use semitone offsets from the tonic. */
export const SCALES = Object.freeze({
  major: [0,2,4,5,7,9,11], 'natural minor': [0,2,3,5,7,8,10],
  dorian: [0,2,3,5,7,9,10], mixolydian: [0,2,4,5,7,9,10],
  'pentatonic major': [0,2,4,7,9], 'pentatonic minor': [0,3,5,7,10],
  blues: [0,3,5,6,7,10]
});
export const MOODS = Object.freeze({chill: [0,5,3,4], hype: [0,4,5,3], spooky: [0,5,3,4], bright: [0,3,4,3]});
const NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const mod = (n,m) => ((n % m) + m) % m;
export function normalizeScale(scale = 'major') {
  const name = String(scale).trim().toLowerCase().replace(/[-_]+/g,' ').replace(/\s+/g,' ');
  const normalized = name === 'minor' ? 'natural minor' : name;
  if (!SCALES[normalized]) throw new RangeError(`Unknown scale: ${scale}`);
  return normalized;
}
export function parseKey(key = 'C') {
  const match = /^\s*([a-g])([#b]?)(?:\s+(major|minor))?\s*$/i.exec(key);
  if (!match) throw new RangeError(`Invalid key: ${key}`);
  const base = {C:0,D:2,E:4,F:5,G:7,A:9,B:11}[match[1].toUpperCase()];
  const tonic = mod(base + (match[2] === '#' ? 1 : match[2].toLowerCase() === 'b' ? -1 : 0),12);
  return {tonic, name: NAMES[tonic], scale: match[3] ? normalizeScale(match[3]) : undefined};
}
export function degreeToMidi(degree, key = 'C', scale = 'major', octave = 4) {
  const k = typeof key === 'string' ? parseKey(key) : key;
  const intervals = SCALES[normalizeScale(scale)];
  return (octave + 1) * 12 + k.tonic + intervals[mod(degree, intervals.length)] + 12 * Math.floor(degree / intervals.length);
}
/** Return MIDI pitch classes for a bar's triad; spooky uses i bVI iv V. */
export function chordTones(key = 'C', scale = 'major', mood = 'chill', bar = 0) {
  if (!MOODS[mood]) throw new RangeError(`Unknown mood: ${mood}`);
  const root = parseKey(key).tonic;
  if (mood === 'spooky') return [[0,3,7],[8,0,3],[5,8,0],[7,11,2]][mod(bar,4)].map(x => mod(root+x,12));
  const intervals = SCALES[normalizeScale(scale)], d = MOODS[mood][mod(bar,4)];
  // Progressions are diatonic seven-degree triads, even for pentatonic melodies.
  const harmony = intervals.length === 7 ? intervals : (scale.includes('minor') || scale === 'blues' ? SCALES['natural minor'] : SCALES.major);
  return [0,2,4].map(i => mod(root + harmony[mod(d+i,7)],12));
}
export function chordName(key, scale, mood, bar) {
  const tones = chordTones(key,scale,mood,bar), third = mod(tones[1]-tones[0],12);
  return NAMES[tones[0]] + (third === 3 ? 'm' : third === 4 ? '' : 'dim');
}
export function snapMidi(midi, pitchClasses) {
  const allowed = new Set(pitchClasses.map(x => mod(x,12)));
  if (!allowed.size) throw new RangeError('Cannot snap to an empty set');
  for (let d = 0; d <= 12; d++) {
    if (midi-d >= 0 && allowed.has(mod(midi-d,12))) return midi-d;
    if (midi+d <= 127 && allowed.has(mod(midi+d,12))) return midi+d;
  }
  throw new RangeError('MIDI note outside range');
}
export function scaleTones(key, scale) { return SCALES[normalizeScale(scale)].map(x => mod(x + parseKey(key).tonic,12)); }
