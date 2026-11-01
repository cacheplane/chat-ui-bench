import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {runFunctionalCase} from './run.mjs';

const out=process.argv[2];
if(process.argv.length!==3||!out||!path.isAbsolute(out)||path.resolve(out)!==out)throw Error('functional-verification-fresh-absolute-directory-required');
await fs.mkdir(out,{mode:0o700});
const results=[];
for(const profile of ['threadplane','copilotkit','assistant-ui','vercel-ai-sdk']){
 for(const journey of ['follow','history-reading']){
  const result=await runFunctionalCase({profile,journey,out:path.join(out,profile+'-'+journey)});
  console.log(JSON.stringify({profile,journey,status:result.status,failure:result.failure,FPS:null}));
  results.push(result);
  if(result.unsafeOutstanding)throw Error('functional-original-ownership-unsettled');
 }
}
const negativeDirectory=path.join(out,'omitted-delta-negative');
const negative=await runFunctionalCase({profile:'vercel-ai-sdk',journey:'follow',out:negativeDirectory,omitDelta:100});
console.log(JSON.stringify({control:'omitted-delta',status:negative.status,failure:negative.failure,FPS:null}));
const evidence=JSON.parse(await fs.readFile(path.join(negativeDirectory,'evidence.json'),'utf8'));
assert.equal(negative.unsafeOutstanding,false);
assert.equal(negative.status,'invalid');
assert.equal(negative.failure?.message,'competitor-response-content');
assert.equal(evidence.server.sourceEmissions.filter(event=>event.kind==='continuation'&&event.eventType==='TEXT_MESSAGE_CONTENT').length,199);
assert.equal(evidence.server.playbacks.continuation.completed,true);
assert.equal(evidence.cleanup.publicDispose.fulfilled,true);
assert.equal(evidence.cleanup.browserClosed,true);
assert.deepEqual(evidence.cleanup.serverExit,{code:0,signal:null});
assert.deepEqual(evidence.cleanup.serverClose,{code:0,signal:null});
assert.deepEqual(evidence.network.failed,[]);
assert.ok(evidence.network.finished.includes('/stream/ui'));
const summary={schema:'four-stack-functional-verification-v2',results:results.map(({profile,journey,status,failure})=>({profile,journey,status,failure})),negativeControl:'omitted-delta-rejected-with-original-closure',performance:false,scoringEligibility:false,FPS:null};
await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx',mode:0o600});
assert.ok(results.every(result=>result.status==='functional-pass'),'all eight functional cases must pass');
