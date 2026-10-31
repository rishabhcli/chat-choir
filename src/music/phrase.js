import { hash, userColor } from './hash.js';
import { instruments } from '../synth/registry.js';
import { selectMelodicVoice } from './voice.js';
import { SCALES, normalizeScale, parseKey, degreeToMidi, chordTones, snapMidi } from './theory.js';
export const MELODIC_VOICES = instruments.filter(instrument => instrument.role === 'melodic').map(instrument => instrument.id);
const DRUMS = ['kick','snare','closedHat','openHat','clap','tom'];
function badgeSet(badges) {
  if (Array.isArray(badges)) return new Set(badges.map(x => typeof x === 'string' ? x.toLowerCase() : String(x.name ?? x.id ?? '').toLowerCase()));
  return new Set(Object.keys(badges || {}).map(x => x.toLowerCase()));
}
function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g,'').replace(/(?:e|es)$/,'');
  return Math.max(1, (w.match(/[aeiouy]+/g) || []).length);
}
/** Convert words into a bounded, stepwise melody. Durations are 2/4/6 sixteenth
 * steps by syllable count; long words split that duration into two notes.
 * Commas rest one step, periods/ellipses two. Emotes produce eighth-grid drums.
 * Strong beats and endings use bar chord tones; questions rise to degree 2/5,
 * exclamations jump an octave. The first-message arpeggio uses remaining budget. */
export function textToPhrase(message, context = {}) {
  const key = parseKey(context.key || 'C'), scale = normalizeScale(context.scale || key.scale || 'major');
  const mood = context.mood || 'chill', startBar = context.startBar ?? 0, stepsPerBar = context.stepsPerBar ?? 16;
  if (stepsPerBar !== 16) throw new RangeError('Only 16 steps per bar are supported');
  const id = String(message.id ?? `${message.userId}:${hash(message.text ?? '')}`), userId = String(message.userId ?? 'anonymous');
  const badges = badgeSet(message.badges);
  const voice = badges.has('broadcaster') ? 'lead' : badges.has('moderator') ? 'bass' : badges.has('vip') ? 'bell' : badges.has('subscriber') ? 'pad' : selectMelodicVoice(userId, MELODIC_VOICES);
  const emotes = new Set(['kappa','lul','pogchamp','<3', ...(message.emotes || []).map(e => (typeof e === 'string' ? e : e.name || '').toLowerCase())]);
  const text = String(message.text ?? ''), clean = text.replace(/https?:\/\/\S+|www\.\S+/gi,' ').replace(/@[\w-]+/g,' ');
  const tokens = clean.match(/<3|[\p{L}\p{M}\p{N}_']+|\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic})*|[,.!?]+/gu) || [];
  let step = 0, degree = 0, first = true; const notes = [], drums = [], lyrics = []; const melodyLimit=message.isFirstMessage ? 13 : 16;
  for (const token of tokens) {
    if (/^[,.!?]+$/.test(token)) { if (token.includes('.')) step += 2; else if (token.includes(',')) step++; continue; }
    if (emotes.has(token.toLowerCase())) { if (step < 32) drums.push({step: Math.min(30,Math.round(step/2)*2), drum: DRUMS[hash(token.toLowerCase()) % DRUMS.length], emote: token, velocity: 0.75}); continue; }
    if (step >= 32 || notes.length >= melodyLimit) break;
    const length = syllables(token) === 1 ? 2 : syllables(token) === 2 ? 4 : 6;
    const count = token.length >= 8 ? 2 : 1;
    lyrics.push({word: token, step});
    for (let part = 0; part < count && notes.length < melodyLimit && step < 32; part++) {
      if (first) { degree = hash(token.toLowerCase()) % SCALES[scale].length; first = false; }
      else { const moves = [-2,-1,-1,0,0,0,1,1,2]; degree += moves[hash(`${token.toLowerCase()}:${part}`) % moves.length]; }
      const max = SCALES[scale].length + 3;
      if (degree < 0) degree = -degree; if (degree > max) degree = 2*max-degree;
      let midi = degreeToMidi(degree,key,scale, voice === 'bass' ? 2 : 4);
      if (step % 4 === 0) midi = snapMidi(midi,chordTones(key.name,scale,mood,startBar+Math.floor(step/16)));
      const dur = Math.min(count === 2 ? Math.max(1,Math.ceil(length/2)) : length,32-step);
      notes.push({step,length:dur,midi,velocity: /^[A-Z]{2,}$/.test(token) ? 0.95 : 0.7,voice}); step += dur;
    }
  }
  if (notes.length) {
    const last = notes.at(-1), chord = chordTones(key.name,scale,mood,startBar+Math.floor(last.step/16));
    if (/\?\s*$/.test(clean)) {
      const options = [degreeToMidi(1,key,scale, voice === 'bass' ? 2 : 4), degreeToMidi(4,key,scale, voice === 'bass' ? 2 : 4)];
      const previous = notes.at(-2)?.midi ?? last.midi; let choices = options.flatMap(n => [n,n+12,n+24]).filter(n => n > previous && n <= 127);
      last.midi = choices.sort((a,b) => a-b)[0] ?? options[1];
    } else { last.midi = snapMidi(last.midi,chord); if (/!\s*$/.test(clean)) { last.midi = Math.min(127,last.midi+12); last.velocity = 1; } }
  }
  if (voice === 'pad' && notes.length) {
    // Subscriber plays the bar's triad alongside its lyric melody.
    for (let bar = 0; bar <= Math.floor(Math.max(0,step-1)/16); bar++) {
      const chord = chordTones(key.name,scale,mood,startBar+bar);
      for (const pitch of chord) if (notes.length < melodyLimit) notes.push({step:bar*16,length:Math.min(16,32-bar*16),midi:48+pitch,velocity:0.38,voice:'pad'});
    }
  }
  if (message.isFirstMessage && notes.length) for (let i = 0; i < 3 && notes.length < 16; i++) notes.push({step:i*2,length:2,midi:60+chordTones(key.name,scale,mood,startBar)[i],velocity:0.5,voice:'bell'});
  const end = Math.max(step,...notes.map(n => n.step+n.length),...drums.map(d => d.step+1),1);
  return {id,userId,userName:String(message.userName ?? userId),text,color:message.color || userColor(userId),voice,notes,drums,bars:Math.min(2,Math.max(1,Math.ceil(end/16))),lyrics};
}
