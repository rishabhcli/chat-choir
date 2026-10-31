import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hash} from './hash.js';
import {LEGACY_MELODIC_VOICES,selectMelodicVoice} from './voice.js';
import {textToPhrase,MELODIC_VOICES} from './phrase.js';

test('adding voices preserves existing assignments except users assigned the new voice',()=>{
  const legacy=[...LEGACY_MELODIC_VOICES], withPan=[...legacy,'steelpan'], withAnother=[...withPan,'another-plugin'];let moved=0,secondMoved=0;
  for(let i=0;i<10000;i++){
    const userId=`user-${i}`, before=selectMelodicVoice(userId,legacy), after=selectMelodicVoice(userId,withPan), next=selectMelodicVoice(userId,withAnother);
    assert.equal(before,legacy[hash(userId)%legacy.length]);
    assert.equal(after,selectMelodicVoice(userId,[...withPan].reverse()));
    if(before!==after){moved++;assert.equal(after,'steelpan');}
    if(after!==next){secondMoved++;assert.equal(next,'another-plugin');}
    assert.equal(textToPhrase({userId,text:'hello'},{}).voice,after);
  }
  assert.ok(moved>1000 && moved<2400,`steel pan reassigned ${moved}/10000`);
  assert.ok(secondMoved>900 && secondMoved<2200,`next plugin reassigned ${secondMoved}/10000`);
  assert.ok(MELODIC_VOICES.includes('steelpan'));
});
