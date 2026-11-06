// Fictional NANP test; never contacts external lookup providers.
import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeNanp,formatNanp,buildLookupLinks} from '../app.js';
test('fictional North American number is validated locally',()=>{
 assert.equal(normalizeNanp('(202) 555-0147'),'2025550147');
 assert.equal(formatNanp('2025550147'),'(202) 555-0147');
 assert.equal(buildLookupLinks('2025550147').display,'(202) 555-0147');
 assert.equal(normalizeNanp('not a phone number'),null);
});
