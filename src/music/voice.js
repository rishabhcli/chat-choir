import { hash } from './hash.js';

// Preserve the exact ordering used by the original modulo-based assignment.
export const LEGACY_MELODIC_VOICES = Object.freeze(['bell', 'flute', 'lead', 'marimba', 'pluck']);

/** Avalanche the stable hash so related IDs receive independent rendezvous scores. */
function score(userId, voice) {
  let value = hash(`${String(userId).length}:${userId}:${voice}`);
  value ^= value >>> 16; value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15; value = Math.imul(value, 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

/**
 * Highest-random-weight selection with a legacy compatibility group. Its score
 * is the maximum of the five original voices' scores, but its winner is the
 * user's original modulo assignment. New voices compete against that maximum.
 * Adding a voice can therefore move a user only to that voice, without an
 * initial reshuffle when migrating the old modulo mapping.
 */
export function selectMelodicVoice(userId, voices) {
  const available = new Set(voices);
  if (!available.size) throw new RangeError('At least one melodic voice is required');
  const legacy = LEGACY_MELODIC_VOICES.filter(id => available.has(id));
  let winner, best = -1;
  for (const id of legacy) {
    const weight = score(userId, id);
    if (weight > best || (weight === best && id < winner)) { best = weight; winner = id; }
  }
  const previous = LEGACY_MELODIC_VOICES[hash(userId) % LEGACY_MELODIC_VOICES.length];
  if (available.has(previous)) winner = previous;
  for (const id of available) {
    if (LEGACY_MELODIC_VOICES.includes(id)) continue;
    const weight = score(userId, id);
    if (weight > best || (weight === best && id < winner)) { best = weight; winner = id; }
  }
  return winner;
}
