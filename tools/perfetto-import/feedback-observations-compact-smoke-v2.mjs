// Official processor diagnostics on newly generated authored fixtures only.
// This tool never loads a captured cohort or establishes feedback/FPS evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {isAbsolute,resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {types} from 'node:util';
import {authoredTargetFixture,authoredScopeFixture} from './smoke.mjs';
import {runTargetFeedbackCompactExportV2,runScopeFeedbackCompactExportV2,inspectFeedbackCompactExportV2,verifyFeedbackCompactExportV2,EXPECTED_VERSION,PROCESSOR_PINS} from './feedback-observations-compact-export-v2.mjs';
import model from './feedback-observations-compact-source-model-v2.json' with {type:'json'};

const SELF=fileURLToPath(import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const identity=s=>Object.fromEntries(['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].map(k=>[k,String(s[k])]));
const pathOK=p=>typeof p==='string'&&p.isWellFormed()&&Buffer.byteLength(p)<=4096&&isAbsolute(p)&&resolve(p)===p&&!/[\x00-\x1f\x7f-\x9f]/.test(p);
const authority=()=>({diagnosticOnly:true,authoredInput:true,nativeSupported:false,captureQualified:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false,fps:null});
function optionsOf(value){
 assert.ok(value&&typeof value==='object'&&!types.isProxy(value)&&Object.getPrototypeOf(value)===Object.prototype,'closed smoke options');assert.deepEqual(Reflect.ownKeys(value).sort(),['out','processor']);
 const copy={};for(const key of ['processor','out']){const d=Object.getOwnPropertyDescriptor(value,key);assert.ok(d&&Object.hasOwn(d,'value'),'own smoke option');copy[key]=d.value;assert.ok(pathOK(copy[key]),'canonical smoke path');}
 assert.ok(copy.out!==copy.processor&&!copy.out.startsWith(copy.processor+'/')&&!copy.processor.startsWith(copy.out+'/'),'smoke path alias');return copy;
}
async function snapshot(path,cap,expected){
 assert.equal(await fs.realpath(path),path,'canonical original file');const named=await fs.lstat(path,{bigint:true});assert.ok(named.isFile()&&named.nlink===1n&&named.size<=BigInt(cap));
 const file=await fs.open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK),parts=[],hash=createHash('sha256');let bytes=0;
 try{const first=await file.stat({bigint:true}),id=identity(first);assert.deepEqual(id,identity(named));const buffer=Buffer.alloc(65536);for(;;){const n=(await file.read(buffer,0,Math.min(buffer.length,cap+1-bytes),bytes)).bytesRead;if(!n)break;bytes+=n;assert.ok(bytes<=cap);hash.update(buffer.subarray(0,n));if(cap<=262144)parts.push(Buffer.from(buffer.subarray(0,n)));}assert.equal(BigInt(bytes),first.size);assert.deepEqual(id,identity(await file.stat({bigint:true})));assert.deepEqual(id,identity(await fs.lstat(path,{bigint:true})));const fact={path,bytes,sha256:hash.digest('hex'),identity:id};if(expected){assert.equal(fact.bytes,expected.bytes);assert.equal(fact.sha256,expected.sha256);if(expected.identity)assert.deepEqual(fact.identity,expected.identity);}return{fact,contents:cap<=262144?Buffer.concat(parts):null};}finally{await file.close();}
}
function tableRows(raw,role){
 assert.ok(raw.length<=262144);const text=new TextDecoder('utf-8',{fatal:true}).decode(raw),records=[];assert.ok(!text.startsWith('\uFEFF'));
 let row=[],cell='',quoted=false,closed=false,start=true;
 const pushCell=()=>{assert.ok(Buffer.byteLength(cell)<=16384);row.push(cell);assert.ok(row.length<=25);cell='';closed=false;start=true;};
 const pushRow=()=>{if(start&&!closed&&row.length===0&&cell==='')return;pushCell();records.push(row);assert.ok(records.length<=24576);row=[];};
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}if(c==='"'){assert.ok(start&&!closed);quoted=true;start=false;}else if(c===',')pushCell();else if(c==='\n')pushRow();else if(c==='\r'){assert.equal(text[++i],'\n');pushRow();}else{assert.ok(!closed);cell+=c;start=false;}}
 assert.equal(quoted,false);if(row.length||cell||closed||!start)pushRow();const headers=model.sql[role].headers,tables=headers.map(()=>[]);let index=-1;
 for(const r of records){if(index+1<headers.length&&r.length===headers[index+1].length&&r.every((v,i)=>v===headers[index+1][i])){index++;continue;}assert.ok(index>=0);assert.equal(r.length,headers[index].length);assert.ok(!headers.some(h=>h.length===r.length&&h.every((v,i)=>v===r[i])));tables[index].push(r);assert.ok(tables[index].length<=model.limits.compactTableRows[index]);}
 assert.equal(index,8,'all nine compact tables');return{tables,counts:tables.map(t=>t.length)};
}
function originalClosure(manifest){
 assert.equal(manifest.status,'success',manifest.error);assert.equal(manifest.officialProcessor,true);assert.equal(manifest.authoredFixture,false);assert.equal(manifest.rawRowsExported,false);assert.equal(manifest.compactWholeGraph,true);assert.equal(manifest.sourceBookends.stable,true);assert.deepEqual(manifest.before,manifest.after);assert.deepEqual(manifest.sourceBookends.before,manifest.sourceBookends.after);assert.deepEqual(manifest.runtime.before,manifest.runtime.after);assert.equal(manifest.observedVersion.trim(),EXPECTED_VERSION);
 for(const key of ['nativeSupported','captureQualified','evaluationEligibility','scoringEligibility','rankingEligibility'])assert.equal(manifest[key],false);assert.equal(manifest.fps,null);
 assert.deepEqual(Object.keys(manifest.processes).sort(),['query','version']);
 for(const process of Object.values(manifest.processes)){assert.equal(process.code,0);assert.equal(process.signal,null);assert.equal(process.closed,true);assert.equal(process.error,null);assert.equal(process.timedOut,false);assert.equal(process.groupAbsent,true);assert.ok(Number.isSafeInteger(process.original.pid)&&process.original.pid>0);assert.equal(process.original.pgid,process.original.pid);
  for(const [name,cap]of [['stdout',262144],['stderr',65536]]){const s=process.streams[name];assert.equal(s.eof,true);assert.equal(s.closed,true);assert.equal(s.error,null);assert.equal(s.forcedDestroy,false);assert.ok(Number.isSafeInteger(s.bytes)&&s.bytes>=0&&s.bytes<=cap);assert.equal(s.bytes,s.observedBytes);}
 }
}
export async function runFeedbackCompactSmokeV2(options){
 const {processor,out}=optionsOf(options);assert.equal(await fs.realpath(dirname(out)),dirname(out));try{await fs.lstat(out);throw Error('smoke output already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
 const pin=PROCESSOR_PINS[process.platform+'-'+process.arch];assert.ok(pin,'unsupported official processor platform');const processorFact=(await snapshot(processor,67108864)).fact;assert.equal(processorFact.sha256,pin,'official processor pin');await fs.mkdir(out,{mode:0o700});
 const summary={schema:'browser-feedback-compact-official-authored-smoke-v2',status:'failure',inputOrigin:'new-local-authored-protobuf-only',processor:processorFact,expectedVersion:EXPECTED_VERSION,cases:[],...authority()};
 try{
  for(const [role,make,bytes,expectedSHA,phases,run]of [
   ['target',authoredTargetFixture,1238,'ed2b0047fdc87b33174d23cce2d34c21e9cdf900df66db403315d848bd311de0',['target-"start','target-end'],runTargetFeedbackCompactExportV2],
   ['scope',authoredScopeFixture,1927,'8e5fa01db67d7c2ea70f955d86ba8d36f333a850bee964b275d621e173d84726',['scope-"phase','MainFrame.Draw'],runScopeFeedbackCompactExportV2]
  ]){
   const fixture=make();assert.equal(fixture.length,bytes);assert.equal(sha(fixture),expectedSHA);const path=join(out,'new-authored-'+role+'.pftrace');await fs.writeFile(path,fixture,{flag:'wx',mode:0o600});
   const original=await run({trace:{path,bytes,sha256:expectedSHA},processor:{path:processor,sha256:pin},phases,out:join(out,role),deadlineMs:30000});originalClosure(original);assert.equal(original.queryPolicy,role+'-feedback-compact-v2');
   const facts=inspectFeedbackCompactExportV2(original);assert.equal(facts.manifest,original);assert.equal(await verifyFeedbackCompactExportV2(original),facts);for(const copied of [structuredClone(original),JSON.parse(JSON.stringify(original)),{},null])assert.throws(()=>inspectFeedbackCompactExportV2(copied));
   assert.deepEqual(Object.keys(facts.files).sort(),['manifest','query.stderr','query.stdout','sql','version.stderr','version.stdout']);
   const contents={};for(const [key,fact]of Object.entries(facts.files)){assert.equal(fact.path,join(out,role,key==='sql'?'diagnostic.sql':key==='manifest'?'manifest.json':key));contents[key]=(await snapshot(fact.path,key==='sql'?16384:key.endsWith('stderr')?65536:262144,fact)).contents;}
   const parsed=tableRows(contents['query.stdout'],role),dictionary=new Set(parsed.tables[0].map(r=>r[1]));for(const name of phases)assert.ok(dictionary.has(Buffer.from(name).toString('hex').toUpperCase()),'phase name dictionary');assert.equal(await verifyFeedbackCompactExportV2(original),facts);
   // Mutation is confined to this newly authored output. Retain the failed
   // bookend deliberately; no parsed/copy object can recover original custody.
   const changed=Buffer.concat([contents['query.stdout'],Buffer.from('\n# authored mutation probe\n')]);const handle=await fs.open(facts.files['query.stdout'].path,constants.O_WRONLY|constants.O_NOFOLLOW);try{assert.equal((await handle.write(changed,0,changed.length,0)).bytesWritten,changed.length);await handle.sync();}finally{await handle.close();}await assert.rejects(verifyFeedbackCompactExportV2(original));
   summary.cases.push({role,queryPolicy:original.queryPolicy,fixture:{path,bytes,sha256:expectedSHA},tableRows:parsed.counts,originalClosed:true,sourceBookendsStable:true,originalPrivateInspection:true,sameVerifiedFacts:true,copiesRejected:true,postExportMutationRefused:true,mutatedOwnOutput:facts.files['query.stdout'].path,originalOutputBytes:facts.files['query.stdout'].bytes,originalOutputSha256:facts.files['query.stdout'].sha256,processes:original.processes,...authority()});
  }
  summary.status='success';
 }catch(error){summary.error=String(error?.message??'compact smoke unavailable').slice(0,512);}
 const payload=Buffer.from(JSON.stringify(summary,null,2)+'\n');assert.ok(payload.length<=65536);const result=join(out,'smoke.json');await fs.writeFile(result,payload,{flag:'wx',mode:0o600});const publication=(await snapshot(result,65536,{bytes:payload.length,sha256:sha(payload)})).fact;return{...summary,publication};
}
if(process.argv[1]&&resolve(process.argv[1])===SELF){
 try{const args=process.argv.slice(2);assert.ok(args.length===4&&args[0]==='--processor'&&args[2]==='--out','usage: --processor /absolute/pinned-processor --out /absolute/fresh-output');const result=await runFeedbackCompactSmokeV2({processor:args[1],out:args[3]});process.stdout.write(JSON.stringify(result)+'\n');if(result.status!=='success')process.exitCode=1;}catch(error){process.stderr.write(String(error?.message??'compact smoke unavailable')+'\n');process.exitCode=1;}
}
