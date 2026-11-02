import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./aimock-trace-run-v2.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
test('semantic trace V2 declares six fresh identities without replacing V1 attempts',()=>{
 assert.equal(typeof api.aimockTraceRosterV2,'function');const rows=api.aimockTraceRosterV2();assert.equal(rows.length,6);assert.equal(new Set(rows.map(r=>r.id)).size,6);
 assert.deepEqual(rows.map(r=>r.round),[1,1,2,2,3,3]);assert.deepEqual(rows.map(r=>r.selection.journey),['follow','history-reading','follow','history-reading','follow','history-reading']);
 for(const r of rows){assert.match(r.id,/-aimock-trace-v2-round-[123]$/);assert.equal(r.kind,'positive');assert.equal(r.selection.profile,'threadplane');assert.equal(r.selection.historyCount,100);assert.equal(r.selection.responseBytes,6400);}
 assert.throws(()=>api.parseAimockTraceArgumentsV2(['--out','/tmp/new','--rounds','1']));assert.throws(()=>api.parseAimockTraceArgumentsV2(['--out','/tmp/new','--profile','v1']));
});
