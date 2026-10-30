import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const api=await import('./feedback-observations-capacity-smoke-v3.mjs').catch(()=>({}));
test('capacity smoke uses a primitive closed option boundary and never inspects hostile input properties',async()=>{
 assert.equal(typeof api.runFeedbackCapacitySmokeV3,'function');let touched=0;
 for(const v of[null,{},new Proxy({},{get(){touched++;throw Error();},ownKeys(){touched++;throw Error();}})])await assert.rejects(api.runFeedbackCapacitySmokeV3(v));assert.equal(touched,0);
});
test('capacity smoke rejects aliases and existing output without overwriting evidence',async()=>{
 const root=await mkdtemp(join(tmpdir(),'compact-smoke-options-')),out=join(root,'out');await mkdir(out);await writeFile(join(out,'keep'),'original');
 await assert.rejects(api.runFeedbackCapacitySmokeV3({processor:join(root,'processor'),out}));assert.equal(await readFile(join(out,'keep'),'utf8'),'original');assert.deepEqual(await readdir(out),['keep']);
 for(const options of[{processor:out,out},{processor:out,out:root},{processor:out,out:join(root,'fresh'),extra:true},{processor:out,out:'relative'}])await assert.rejects(api.runFeedbackCapacitySmokeV3(options));
});
test('capacity smoke imports only maintained authored fixture functions and new official exporters',async()=>{
 const source=await readFile(new URL('./feedback-observations-capacity-smoke-v3.mjs',import.meta.url),'utf8');
 assert.match(source,/authoredTargetFixture/);assert.match(source,/authoredScopeFixture/);assert.match(source,/runTargetFeedbackCapacityExportV3/);assert.match(source,/runScopeFeedbackCapacityExportV3/);assert.match(source,/inspectFeedbackCapacityExportV3/);assert.match(source,/verifyFeedbackCapacityExportV3/);assert.doesNotMatch(source,/runTargetInventoryDiagnostic|runScopeInventoryDiagnostic|runSmoke\(/);
});
