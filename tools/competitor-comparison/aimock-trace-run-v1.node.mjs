import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./aimock-trace-run-v1.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
test('fixed Aimock trace cohort has six distinct declared stock Threadplane attempts',()=>{
 assert.equal(typeof api.aimockTraceRosterV1,'function');const rows=api.aimockTraceRosterV1();
 assert.equal(rows.length,6);assert.equal(new Set(rows.map(r=>r.id)).size,6);
 assert.deepEqual(rows.map(r=>r.round),[1,1,2,2,3,3]);
 assert.deepEqual(rows.map(r=>r.selection.journey),['follow','history-reading','follow','history-reading','follow','history-reading']);
 for(const row of rows){assert.equal(row.kind,'positive');assert.deepEqual({...row.selection,journey:undefined},{profile:'threadplane',historyCount:100,responseBytes:6400,journey:undefined});assert.ok(Object.isFrozen(row));}
});
test('trace CLI accepts only one fresh absolute output and has no filters or repeat override',()=>{
 assert.equal(typeof api.parseAimockTraceArgumentsV1,'function');assert.deepEqual(api.parseAimockTraceArgumentsV1(['--out','/private/tmp/new-trace']),{out:'/private/tmp/new-trace'});
 for(const args of [[],['--out','relative'],['--out','/tmp/a/../b'],['--out','/tmp/a','--rounds','1'],['--out','/tmp/a','--profile','assistant-ui'],['--out','/tmp/a','--out','/tmp/b']])assert.throws(()=>api.parseAimockTraceArgumentsV1(args));
});
test('trace completion requires both functional admission and independently qualified trace on every exact attempt',()=>{
 assert.equal(typeof api.admitAimockTraceCohortV1,'function');const rows=api.aimockTraceRosterV1();
 const good=rows.map(row=>({id:row.id,status:'matrix-pass',unsafeOutstanding:false,stopInvocation:false,traceDiagnostic:{status:'complete'},performance:false,scoringEligibility:false,FPS:null}));
 assert.equal(api.admitAimockTraceCohortV1(good),true);
 for(const mutate of [r=>r.pop(),r=>r.reverse(),r=>r[1]=r[0],r=>r[0].unsafeOutstanding=true,r=>r[0].stopInvocation=true,r=>r[0].status='invalid',r=>r[0].traceDiagnostic.status='unavailable',r=>r[0].performance=true,r=>r[0].FPS=60]){const r=structuredClone(good);mutate(r);assert.equal(api.admitAimockTraceCohortV1(r),false);}
});
