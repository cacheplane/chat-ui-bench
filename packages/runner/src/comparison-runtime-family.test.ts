import {afterEach, expect, it} from 'vitest';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {comparisonSchemasForVersionPair, createLongThreadFixture} from '@chat-ui-bench/contract';
import {parseLongThreadArgs} from './long-thread-cli.js';
import {createLongThreadLedger, runLongThreadInvocation, type ComparisonSlotDriver} from './long-thread-run.js';
import {createComparisonProvenanceSession} from './comparison-provenance.js';
import {createComparisonNativeInput} from './comparison-native-input.js';
import {createComparisonTraceCaptureForProtocolFixture, type ComparisonTraceProtocolBoundary} from './comparison-trace.js';
import {runComparisonAssemblyWorker} from './comparison-assembly-worker.js';
import {preOptions, mainOptions} from './comparison-page.test-helper.mts';
import {canonicalSerialize} from '@chat-ui-bench/contract';
import {PassThrough, Writable} from 'node:stream';
import {assembleComparisonInstaller} from './comparison-installer.js';

const roots:string[]=[];
const pendingFamilyBodies=new Set<Promise<void>>();
async function settlePendingFamilyBodiesThen(remove:()=>Promise<unknown>):Promise<void>{
 // A Vitest execution timeout does not cancel the original12-slot invocation.
 // Join its complete test body, including invocation/finalization and reads,
 // before removing its output; allSettled preserves the original test failure.
 await Promise.allSettled([...pendingFamilyBodies]);await remove();
}
afterEach(()=>settlePendingFamilyBodiesThen(()=>Promise.all(roots.splice(0).map(path=>rm(path,{recursive:true,force:true})))));
async function config(){const out=await mkdtemp(join(tmpdir(),'comparison-family-'));roots.push(out);const value=parseLongThreadArgs(['--out',out,'--rounds','1','--mode','headless']);if(value.help)throw new Error('unexpected help');return value;}
const fresh=comparisonSchemasForVersionPair({collectorVersion:'2.1.0',analyzerVersion:'2.1.0'});
const legacy=comparisonSchemasForVersionPair({collectorVersion:'2.0.0',analyzerVersion:'2.0.0'});
async function json(path:string){return JSON.parse(await readFile(path,'utf8'));}
it('selects one explicit closed ledger family while retaining the legacy default',async()=>{
 const c=await config();
 expect(createLongThreadLedger(c).collectorVersion).toBe('2.0.0');
 const selected=Reflect.apply(createLongThreadLedger,undefined,[c,'2.1.0']);
 expect(fresh.comparisonCaptureInvocationSchema.parse(selected).collectorVersion).toBe('2.1.0');
 expect(legacy.comparisonCaptureInvocationSchema.safeParse(selected).success).toBe(false);
});
it.each(['setup failure','replay validation'] as const)('retains the fresh family through %s, finalization and the checked dataset seal',async mode=>{
 const body=(async()=>{
 const c=await config(),contexts:string[]=[];
 const driver:ComparisonSlotDriver<null>={
  async setup(ctx){contexts.push(ctx.identity.collectorVersion);if(mode==='setup failure')throw false;return null;},
  async replay(ctx){return {validation:Reflect.apply(fresh.comparisonValidationSchema.parse,fresh.comparisonValidationSchema,[{...ctx.identity,status:'invalid',checks:[{name:'Controlled no-browser measurement',passed:false,reason:'Controlled no-browser measurement',evidencePaths:[]}],reasons:['Controlled no-browser measurement']}])};},
  async finalize(ctx){contexts.push(ctx.identity.collectorVersion);},
 };
 const result=await Reflect.apply(runLongThreadInvocation,undefined,[c,driver,{version:'2.1.0'}]);
 expect(result.invocation.collectorVersion).toBe('2.1.0');expect(result.finalized).toBe(true);
 expect(contexts).toHaveLength(24);expect(contexts.every(version=>version==='2.1.0')).toBe(true);
 const ledger=fresh.comparisonCaptureInvocationSchema.parse(await json(join(c.out,'invocation.json')));
 const seal=fresh.comparisonDatasetInventorySchema.parse(await json(join(c.out,'dataset-seal.json')));
 expect(seal.invocationLedger).toEqual(ledger);expect(seal.collectorVersion).toBe('2.1.0');
 for(const slot of ledger.runs){
  const directory=join(c.out,slot.artifactDirectory);
  fresh.comparisonScheduledRunSchema.parse(await json(join(directory,'descriptor.json')));
  fresh.comparisonExceptionsSchema.parse(await json(join(directory,'exceptions.json')));
  const validation=fresh.comparisonValidationSchema.parse(await json(join(directory,'validation.json')));
  expect(validation.status).toBe(mode==='setup failure'?'failed':'invalid');
  fresh.comparisonCaptureStatusSchema.parse(await json(join(directory,'capture-status.json')));
  fresh.comparisonRawInventorySchema.parse(await json(join(directory,'raw-inventory.json')));
 }
 })();pendingFamilyBodies.add(body);
 try{await body;}finally{pendingFamilyBodies.delete(body);}
},15000);
it('rejects a crossed replay verdict instead of accepting matching version-free identity fields',async()=>{
 const c=await config();
 const result=await Reflect.apply(runLongThreadInvocation,undefined,[c,{async setup(){return null;},async replay(ctx:Parameters<ComparisonSlotDriver<null>['replay']>[0]){return {validation:legacy.comparisonValidationSchema.parse({...ctx.identity,collectorVersion:'2.0.0',analyzerVersion:'2.0.0',status:'invalid',checks:[{name:'Crossed verdict',passed:false,reason:'Crossed verdict',evidencePaths:[]}],reasons:['Crossed verdict']})};}},{version:'2.1.0'}]);
 expect(result.invocation.collectorVersion).toBe('2.1.0');
 expect(result.invocation.runs.every((slot:{status:string})=>slot.status==='failed')).toBe(true);
 expect(result.finalized).toBe(true);
});
it('rejects unknown or structural version choices before any artifact creation or driver call',async()=>{
 const c=await config();let calls=0;
 const driver={async setup(){calls++;return null;},async replay(){throw new Error('unreachable');}};
 for(const version of ['2.2.0','2.0.0/2.1.0',null,{collectorVersion:'2.1.0',analyzerVersion:'2.1.0'}])await expect(Reflect.apply(runLongThreadInvocation,undefined,[c,driver,{version}])).rejects.toThrow('Unsupported comparison runtime version');
 expect(calls).toBe(0);expect(await readdir(c.out)).toEqual([]);
});
it('retains the explicitly selected family in original provenance, native and trace snapshots',async()=>{
 const identity=fresh.comparisonIdentitySchema.parse({schemaVersion:2,suite:'long-thread-prose-v1',suiteVersion:'1.0.0',collectorVersion:'2.1.0',analyzerVersion:'2.1.0',repetition:'r',scenarioId:'case',round:1,caseIndex:0,adapterProfile:'threadplane-langgraph-custom-transport'});
 const ownership={signal:new AbortController().signal,generation:1,stage:'replay' as const,startedAtHostMs:0,deadlineAtHostMs:30000,remainingMs:()=>30000,assertActive(){},async adopt(){}};
 const context={comparisonVersion:'2.1.0' as const,comparisonSchemas:fresh,identity,descriptor:fresh.comparisonScheduledRunSchema.parse({...identity,seed:1,mode:'headless',artifactDirectory:'runs/one'}),fixture:createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:'follow'}),ownership,writer:{async text(){throw Error('unexpected I/O');},async json(){throw Error('unexpected I/O');},async append(){throw Error('unexpected I/O');},async appendSerialized(){throw Error('unexpected I/O');},async stream(){throw Error('unexpected I/O');}}};
 const session=createComparisonProvenanceSession(context,'/must-not-read');
 expect(fresh.comparisonProvenanceAcquisitionSchema.parse(session.snapshotAcquisition().acquisition).collectorVersion).toBe('2.1.0');
 const recipe=fresh.comparisonInputRecipeSchema.parse({wheel:{recipeId:'comparison-wheel-up-v1',deltasCssPx:[-100,-100,-100,-100],cadenceMs:50},composer:{recipeId:'comparison-composer-calibrate-v1',text:'calibrate',cadenceMs:35,submit:false}});
 const controls={mouse:{async move(){throw Error('unexpected command');},async wheel(){throw Error('unexpected command');}},keyboard:{async press(){throw Error('unexpected command');},async up(){}},scroller:{async boundingBox(){throw Error('unexpected command');}},composer:{async click(){throw Error('unexpected command');}},returnControl:null};
 const native=Reflect.apply(createComparisonNativeInput,undefined,[{...context,recipe,controls}]);
 try {expect(fresh.comparisonNativeDispatchResultsSchema.parse(native.snapshot()).collectorVersion).toBe('2.1.0');}finally{await native.close();}
 const protocol={async send(){throw Error('unexpected command');},on(){},off(){},async detach(){}} as ComparisonTraceProtocolBoundary;
 const trace=createComparisonTraceCaptureForProtocolFixture({context,protocol,isolatedBrowserProcess:true,singleWorkloadPage:true});
 try {expect(fresh.comparisonTraceAuxiliarySchema.parse(trace.snapshot().auxiliary).collectorVersion).toBe('2.1.0');}finally{await trace.close();}
});
it('passes an explicit fresh primitive through the worker while preserving the exact installer pair',async()=>{
 const pre=canonicalSerialize(preOptions),main=canonicalSerialize({...mainOptions,scoredScrollSampling:{mode:'fresh-page-acquisition',minimumPostToLaterPageMs:800,maxWaitCallbacks:64}});
 const input=new PassThrough(),chunks:Buffer[]=[];
 const output=new Writable({write(chunk,_encoding,callback){chunks.push(Buffer.from(chunk));callback();}});
 input.end(JSON.stringify([pre,main,'2.1.0']));
 await runComparisonAssemblyWorker(input,output);
 expect(Buffer.concat(chunks).equals(Buffer.from(JSON.stringify(assembleComparisonInstaller(pre,main,'2.1.0'))))).toBe(true);
});
it('keeps fresh finalizer failures and not-started retention in the same family without a usable seal',async()=>{
 const c=await config();let setups=0,finalizers=0;
 const result=await runLongThreadInvocation(c,{async setup(){setups++;return null;},async replay(ctx){return {validation:fresh.comparisonValidationSchema.parse({...ctx.identity,status:'invalid',checks:[{name:'No browser measurement',passed:false,reason:'No browser measurement',evidencePaths:[]}],reasons:['No browser measurement']})};},async finalize(ctx){finalizers++;expect(ctx.comparisonVersion).toBe('2.1.0');expect(ctx.comparisonSchemas).toBe(fresh);throw false;}},{version:'2.1.0'});
 expect(setups).toBe(1);expect(finalizers).toBe(1);expect(result.finalized).toBe(false);
 await expect(result.finalize()).rejects.toThrow('false');
 const ledger=fresh.comparisonCaptureInvocationSchema.parse(await json(join(c.out,'invocation.json')));
 expect(ledger.runs.every(slot=>slot.status==='failed')).toBe(true);
 fresh.comparisonFinalizationStatusSchema.parse(await json(join(c.out,ledger.runs[0]!.artifactDirectory,'finalization-status.json')));
 for(const slot of ledger.runs.slice(1))fresh.comparisonRawInventorySchema.parse(await json(join(c.out,slot.artifactDirectory,'raw-inventory.json')));
 await expect(readFile(join(c.out,'dataset-seal.json'))).rejects.toMatchObject({code:'ENOENT'});
});
it.each(['2.2.0','2.0.0/2.1.0',null,{},4])('worker rejects an unknown primitive choice %s without emitting installer bytes',async version=>{
 const input=new PassThrough();let writes=0;
 const output=new Writable({write(_chunk,_encoding,callback){writes++;callback();}});
 input.end(JSON.stringify([canonicalSerialize(preOptions),canonicalSerialize(mainOptions),version]));
 await expect(runComparisonAssemblyWorker(input,output)).rejects.toThrow('worker-input-grammar');expect(writes).toBe(0);
});

it.each(['fulfill','reject false'] as const)('original pending family body %s blocks actual root removal until settlement',async outcome=>{
 const c=await config();let resolve!:()=>void,reject!:(error:unknown)=>void,removalStarted=0,removed=0;
 const original=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});let originalError:unknown,failed=false;
 void original.catch(error=>{failed=true;originalError=error;});pendingFamilyBodies.add(original);
 const cleanup=settlePendingFamilyBodiesThen(async()=>{removalStarted++;await rm(c.out,{recursive:true,force:true});removed++;});
 try{
  await Promise.resolve();await Promise.resolve();expect(removalStarted).toBe(0);expect(removed).toBe(0);expect(await readdir(c.out)).toEqual([]);
  if(outcome==='fulfill')resolve();else reject(false);
  await cleanup;expect(removed).toBe(1);await expect(readdir(c.out)).rejects.toMatchObject({code:'ENOENT'});
  expect(failed).toBe(outcome==='reject false');if(failed)expect(originalError).toBe(false);
 }finally{resolve();await cleanup;pendingFamilyBodies.delete(original);}
});
