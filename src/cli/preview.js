import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { registry } from '../synth/registry.js';
import { mixEvents } from '../synth/mixer.js';
import { normalizeAudio, encodeWav, audioStats } from './render.js';

// D dorian: D E F G A B C D, descending to D. Each event uses one plugin.
export const PREVIEW_NOTES = Object.freeze([62,65,67,69,71,72,74,72,69,67,65,64,62]);
const DRUMS = ['kick','snare','closedHat','openHat','clap','tom'];
export function previewEvents(instrumentId) {
  if (!registry[instrumentId]) throw new RangeError(`Unknown instrument: ${instrumentId}`);
  return PREVIEW_NOTES.map((midi, index) => ({time:index*300,kind:instrumentId==='drums'?'drum':'note',instrument:instrumentId,midi,drum:instrumentId==='drums'?DRUMS[index%DRUMS.length]:undefined,gain:.8,pan:0,duration:360}));
}
export function renderPreview(instrumentId,{sampleRate=44100}={}) {
  const events=previewEvents(instrumentId), durationMs=events.at(-1).time+1600;
  const audio=mixEvents(events,{sampleRate,durationMs,wet:.12});
  return normalizeAudio(audio);
}
async function main() {
  const [instrumentId,output]=process.argv.slice(2);
  if(!instrumentId||!output){console.error('Usage: npm run preview -- <instrument-id> <out.wav>');process.exitCode=1;return;}
  const audio=renderPreview(instrumentId), stats=audioStats(audio);
  await writeFile(output,encodeWav(audio));
  console.log(`Rendered ${instrumentId}: ${stats.duration.toFixed(2)} s, peak ${stats.peak.toFixed(4)}, RMS ${stats.rms.toFixed(4)} -> ${output}`);
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(error=>{console.error(error.message);process.exitCode=1;});
