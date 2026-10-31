import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import {instruments} from '../synth/registry.js';
import {scaleTones} from '../music/theory.js';
import {previewEvents,renderPreview} from './preview.js';

test('every plugin can preview a deterministic D dorian phrase',()=>{
  const allowed=scaleTones('D','dorian');
  for(const instrument of instruments){const events=previewEvents(instrument.id);assert.ok(events.every(e=>allowed.includes(e.midi%12)&&e.instrument===instrument.id));const a=renderPreview(instrument.id,{sampleRate:8000}),b=renderPreview(instrument.id,{sampleRate:8000});assert.deepEqual(a,b);assert.ok(a.left.some(x=>Math.abs(x)>.001));assert.ok(a.left.every(Number.isFinite));}
  assert.throws(()=>previewEvents('missing'),/Unknown instrument/);
});
test('preview CLI writes a playable stereo WAV',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'choir-preview-'));
  try{const out=path.join(dir,'preview.wav');const result=await promisify(execFile)(process.execPath,[new URL('./preview.js',import.meta.url).pathname,'steelpan',out]);assert.match(result.stdout,/peak .*RMS/);const bytes=await readFile(out);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');assert.equal(bytes.readUInt16LE(22),2);assert.equal(bytes.readUInt32LE(24),44100);assert.ok(bytes.length>44);}finally{await rm(dir,{recursive:true,force:true});}
});
