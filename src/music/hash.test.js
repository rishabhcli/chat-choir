import {test} from 'node:test';import assert from 'node:assert/strict';import {hash,userPan,userColor} from './hash.js';
test('stable hash and identity styling',()=>{assert.equal(hash('hello'),1335831723);assert.equal(userPan('x'),userPan('x'));assert.match(userColor('x'),/^hsl\(/);});
