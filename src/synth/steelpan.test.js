import {test} from 'node:test';
import assert from 'node:assert/strict';
import {render,role} from './instruments/steelpan.js';
import {frequency} from './dsp.js';

/** Windowed correlation measures a partial without needing any audio assets. */
function amplitude(samples, sampleRate, hz, startSeconds=.02) {
  const start=Math.round(startSeconds*sampleRate), count=Math.round(.2*sampleRate);
  let real=0, imaginary=0, sum=0;
  for(let i=0;i<count;i++) {const window=.5-.5*Math.cos(2*Math.PI*i/(count-1)), phase=2*Math.PI*hz*(start+i)/sampleRate, value=samples[start+i]*window;real+=value*Math.cos(phase);imaginary-=value*Math.sin(phase);sum+=window;}
  return 2*Math.hypot(real,imaginary)/sum;
}
test('steel pan has decaying inharmonic upper partials and a deterministic strike',()=>{
  const sampleRate=22050,note={midi:62,duration:.6},samples=render(note,sampleRate),f=frequency(note.midi);
  assert.equal(role,'melodic');assert.deepEqual(samples,render(note,sampleRate));
  for(const [ratio,off] of [[2.01,2.35],[3.03,3.4],[4.2,4.5]]) {
    const partial=amplitude(samples,sampleRate,f*ratio),background=amplitude(samples,sampleRate,f*off);
    assert.ok(partial>.003,`partial ${ratio} is ${partial}`);assert.ok(partial>background*4,`partial ${ratio} not distinct from ${off}`);
  }
  assert.ok(amplitude(samples,sampleRate,f*4.2,.02)>3*amplitude(samples,sampleRate,f*4.2,.32));
});
