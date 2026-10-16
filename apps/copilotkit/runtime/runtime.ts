import { CopilotRuntime, InMemoryAgentRunner, type AgentRunnerRunRequest, type AgentRunnerConnectRequest } from '@copilotkit/runtime/v2';
import { createCopilotHonoHandler } from '@copilotkit/runtime/v2/hono';
import { PROTOCOL_VERSION, type BaseEvent, type RunAgentInput } from '@ag-ui/core';
import { RunAgentInputSchema } from '@ag-ui/core/schemas';
import { Observable } from 'rxjs';
import { validateCanonicalLongThreadFixture } from '../../../packages/contract/src/long-thread.js';
import { createStoreDomain, ownHistory, validateResponse, type CaseIds } from '../src/controls.js';
import { AGENT_ID, RUNTIME_URL, CONTEXT_URL, MOUNTED_URL, COMPLETED_URL, CONTINUATION_URL, dataRecord, parseCaseContext, type CaseContext } from '../src/context.js';
import { ProducerAgent, type BridgeSpec } from './producer-agent.js';
import { OwnedOperations, claimApplicationDomain, SettlementBudget, notifyNativeCase, type NativeCaseHooks, type NativeCaseObservation } from './ownership.js';
import { readBoundedJson, consumeNativeSeed, isSuccessfulTerminal, MAX_NATIVE_BYTES, createNativeFixtureSelection } from './wire.js';

interface PublicRunOutcome { readonly runId:string; eventCount:number;terminalSuccess:boolean;settled:boolean }
export interface MountedOwner { closeAdmission():void;dispose():Promise<void> }

function fixtureArrayItem(array:readonly unknown[],index:number):unknown {
  const descriptor=Object.getOwnPropertyDescriptor(array,String(index));
  if(!descriptor || !('value' in descriptor)) throw new Error('Fixture requires owned array data');
  return descriptor.value;
}
function boundedFixtureArray(value:unknown,length:number):asserts value is unknown[] {
  if(!Array.isArray(value) || value.length!==length || Object.getPrototypeOf(value)!==Array.prototype || Reflect.ownKeys(value).length!==length+1) throw new Error('Fixture array profile differs');
}
/** Preflight finite scalar/data bounds before the canonical validator allocates
 * encoded bytes or regenerates its expected fixture. This is only this profile. */
function preflightFixture(input:unknown):void {
  const raw=dataRecord(input,['schemaVersion','scenarioId','workload','history','events']);
  const workload=dataRecord(raw.workload,['suite','generator','seed','historyCount','historyMessageBytes','totalHistoryBytes','responseBytes','deltaCount','deltaIntervalMs','journey','chunkBytes']);
  if(raw.schemaVersion!==2 || typeof raw.scenarioId!=='string' || raw.scenarioId.length>128 || workload.suite!=='long-thread-prose-v1' || workload.generator!=='long-thread-prose-v1' || typeof workload.seed!=='number' || !Number.isSafeInteger(workload.seed) || workload.seed<0 || workload.historyCount!==100 || workload.historyMessageBytes!==512 || workload.totalHistoryBytes!==51200 || workload.responseBytes!==6400 || workload.deltaCount!==200 || workload.deltaIntervalMs!==50 || (workload.journey!=='follow' && workload.journey!=='history-reading')) throw new Error('Only bounded canonical H100/R6400 fixture profile is admitted');
  boundedFixtureArray(raw.history,100);boundedFixtureArray(raw.events,202);boundedFixtureArray(workload.chunkBytes,200);
  for(let index=0;index<100;index++) {
    const message=dataRecord(fixtureArrayItem(raw.history,index),['id','role','text','status']);
    if(typeof message.id!=='string' || message.id.length>128 || new TextEncoder().encode(message.id).byteLength>128 || (message.role!=='user' && message.role!=='assistant') || message.status!=='complete' || typeof message.text!=='string' || message.text.length!==512 || !/^[\x20-\x7e]+$/.test(message.text)) throw new Error('History preflight differs from admitted bytes');
  }
  for(let index=0;index<202;index++) {
    const event=dataRecord(fixtureArrayItem(raw.events,index),['sequence','scheduledMs','messageId','type','text']);
    const type=index===0?'assistant-start':index===201?'assistant-complete':'text-delta';
    if(event.sequence!==index || event.scheduledMs!==Math.min(index,200)*50 || event.type!==type || typeof event.messageId!=='string' || event.messageId.length>128 || new TextEncoder().encode(event.messageId).byteLength>128 || typeof event.text!=='string' || (type==='text-delta' ? event.text.length!==32 || !/^[\x20-\x7e]+$/.test(event.text) : event.text!=='')) throw new Error('Producer event preflight differs');
    if(index>0 && index<=200 && fixtureArrayItem(workload.chunkBytes,index-1)!==32) throw new Error('Chunk byte preflight differs');
  }
}

class OwnedRunner extends InMemoryAgentRunner {
  readonly controls;
  readonly operations: OwnedOperations;
  readonly outcomes=new Map<string,PublicRunOutcome>();
  activeRunId:string|null=null;
  connectAdmitted=false;
  constructor(readonly spec:BridgeSpec) {
    // Retained history limits only: active SDK buffers are excluded and a
    // dominant thread is not byte-trimmed. Owned H100/R6400/wire bounds apply too.
    super({maxThreads:1,maxRunsPerThread:2,maxBytes:8*1024*1024,onConcurrentRun:'throw'});
    this.controls=createStoreDomain().beginCase(spec.ids,spec.history,this.listThreads());
    this.operations=new OwnedOperations(this.controls);
  }
  requireAdmitted(input:RunAgentInput): void {
    if(!this.outcomes.has(input.runId) || input.threadId!==this.spec.ids.threadId) throw new Error('Bridge run was not admitted by its owning public runner');
    if(input.runId===this.spec.ids.seedRunId) {if(input.messages.length!==0) throw new Error('Seed messages changed');}
    else {
      const actual=ownHistory(input.messages);
      if(actual.length!==this.spec.history.length || actual.some((message,index)=> {const expected=this.spec.history[index];return !expected || message.id!==expected.id || message.role!==expected.role || message.content!==expected.content;})) throw new Error('Bridge full H changed after admission');
    }
  }
  override run(request:AgentRunnerRunRequest): Observable<BaseEvent> {
    if(request.threadId!==this.spec.ids.threadId || request.threadId!==request.input.threadId || request.agent.agentId!==AGENT_ID) throw new Error('Public runner outer ownership differs');
    const envelope={threadId:request.input.threadId,runId:request.input.runId,messages:request.input.messages};
    const allocate=(owned:{readonly threadId:string;readonly runId:string;readonly messages:readonly {readonly id:string;readonly role:'user'|'assistant';readonly content:string}[]})=> {
      const operation=this.operations.start('public-operation',`original-run-observable:${owned.runId}`);
      const outcome:PublicRunOutcome={runId:owned.runId,eventCount:0,terminalSuccess:false,settled:false};this.outcomes.set(owned.runId,outcome);this.activeRunId=owned.runId;
      try {
        const original=super.run({...request,input:{...request.input,messages:owned.messages.map(message=>({...message}))}});
        // Keep an observer on this ORIGINAL public multicast outcome even if its
        // HTTP consumer detaches. No hidden runner finalization promise is read.
        original.subscribe({next:event=> {
          outcome.eventCount++;
          if(outcome.eventCount>(owned.runId===this.spec.ids.seedRunId?3:204)) {if(!operation.settled) operation.fail('Original public event count exceeded');return;}
          if(isSuccessfulTerminal(event) && 'threadId' in event && event.threadId===owned.threadId && 'runId' in event && event.runId===owned.runId) {outcome.terminalSuccess=true;if(owned.runId===this.spec.ids.continuationRunId)notifyNativeCase(this.spec.hooks,this.operations,{kind:'witness',label:'successfulTerminal',status:'fulfilled'});}
        },error:error=> {outcome.settled=true;if(!operation.settled) operation.fail(error);},complete:()=> {
          outcome.settled=true;this.activeRunId=null;
          if(!operation.settled) {
            if(outcome.terminalSuccess && outcome.eventCount===(owned.runId===this.spec.ids.seedRunId?3:204)) {operation.succeed();if(owned.runId===this.spec.ids.continuationRunId)notifyNativeCase(this.spec.hooks,this.operations,{kind:'witness',label:'publicRun',status:'fulfilled'});}
            else operation.fail('Original public run completed without exact successful lifecycle');
          }
        }});
        return original;
      } catch(error) {if(!operation.settled) operation.fail(error);throw error;}
    };
    return envelope.runId===this.spec.ids.seedRunId ? this.controls.admitSeed(envelope,allocate) : this.controls.admitContinuation(envelope,allocate);
  }
  override connect(request:AgentRunnerConnectRequest): Observable<BaseEvent> {
    if(!this.connectAdmitted || request.threadId!==this.spec.ids.threadId || request.agentId!==AGENT_ID) throw new Error('Only admitted native cold connect is permitted');
    this.connectAdmitted=false;
    const operation=this.operations.start('native-connect','original-runner-connect');
    try {
      const original=super.connect(request);
      original.subscribe({error:error=>operation.fail(error),complete:()=>operation.succeed()});
      return original;
    } catch(error) {if(!operation.settled) operation.fail(error);throw error;}
  }
}

/** Only explicit case allocation; no runtime, producer, listener or request is
 * constructed at import. Hosted entry must own one worker/store domain and serial
 * cases. This module lease alone does not prove no other runner is imported. */
export function createCaseRuntime(input:unknown,ids:CaseIds,repetition:string,hooks?:NativeCaseHooks) {
  preflightFixture(input);
  if(!repetition || repetition.length>128 || new TextEncoder().encode(repetition).byteLength>128) throw new Error('Invalid repetition');
  const fixture=validateCanonicalLongThreadFixture(input);
  const history=ownHistory(fixture.history.map(message=>({id:message.id,role:message.role,content:message.text})));
  const identity=dataRecord(ids,['threadId','seedRunId','continuationRunId','responseId']);
  const admittedContext=parseCaseContext({agentId:AGENT_ID,ids:identity,history,response:{id:identity.responseId,role:'assistant',content:fixture.events.filter(event=>event.type==='text-delta').map(event=>event.text).join('')},seedCommitted:true,continuationUrl:CONTINUATION_URL});
  ids=admittedContext.ids;const response=admittedContext.response;
  if(fixture.events[0]?.messageId!==ids.responseId) throw new Error('Canonical response ID differs');
  validateResponse(response,response);
  const fixtureSelection=createNativeFixtureSelection(fixture,ids);
  const releaseDomain=claimApplicationDomain();
  const spec:BridgeSpec={fixture,ids,history,response,repetition,fixtureSelection,hooks};
  const runner=new OwnedRunner(spec);
  const observe=(event:NativeCaseObservation)=>notifyNativeCase(hooks,runner.operations,event);
  const bridge=new ProducerAgent(spec,runner.operations,input=>runner.requireAdmitted(input));
  const runtime=new CopilotRuntime({agents:{[AGENT_ID]:bridge},runner});
  const native=createCopilotHonoHandler({runtime,basePath:RUNTIME_URL});
  const serverDisposal=runner.operations.start('server-disposal','owned-node-server-disposal');
  const harnessDisposal=runner.operations.start('harness-disposal','owned-mounted-harness-disposal');
  let mountedOwner:MountedOwner|undefined;
  let context:CaseContext|undefined,seedPromise:Promise<CaseContext>|undefined;
  let mountReleased=false,completed=false,closed=false;
  const incoming:{original:Promise<Response>;settled:boolean;cancel:()=>void}[]=[];
  const nativeEof=new Set<string>();
  const nativeControllers=new Set<AbortController>();

  async function nativeResponse(request:Request,label:string,operationKind:'http'|'native-connect'):Promise<Response> {
    const cancellation=new AbortController();nativeControllers.add(cancellation);
    let reader:ReadableStreamDefaultReader<Uint8Array>|undefined,cancelled=false,finished=false;
    const cancel=async()=> {cancelled=true;cancellation.abort();await reader?.cancel();};
    const http=runner.operations.start(operationKind,`${label}:original-http`,cancel);
    const read=runner.operations.start('reader',`${label}:original-response-reader`,cancel);
    const abort=()=> {cancelled=true;cancellation.abort(request.signal.reason);};request.signal.addEventListener('abort',abort,{once:true});
    try {
      const original=await native.fetch(new Request(request,{signal:cancellation.signal}));
      if(!original.ok || !original.body) {await original.body?.cancel();throw new Error(`Native response failure ${original.status}`);}
      reader=original.body.getReader();const ownedReader=reader;let bytes=0;
      const finish=(success:boolean,error?:unknown)=> {
        if(finished) return;finished=true;request.signal.removeEventListener('abort',abort);nativeControllers.delete(cancellation);ownedReader.releaseLock();
        if(!success || cancelled) {const failure=error??'Native response cancelled before original EOF';read.fail(failure);http.fail(failure);}
        else {nativeEof.add(label);read.succeed();http.succeed();if(label==='native-connect')observe({kind:'witness',label:'coldReaderEOF',status:'fulfilled'});}
      };
      return new Response(new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {const item=await ownedReader.read();if(item.done) {finish(true);controller.close();return;}bytes+=item.value.byteLength;if(bytes>MAX_NATIVE_BYTES) throw new Error('Native original response byte bound exceeded');controller.enqueue(item.value);}
          catch(error) {try {await ownedReader.cancel();}finally {finish(false,error);}controller.error(error);}
        },async cancel(reason) {cancelled=true;try {await ownedReader.cancel(reason);}finally {finish(false,reason??'Native reader cancelled');}},
      }),{status:original.status,statusText:original.statusText,headers:original.headers});
    } catch(error) {if(!read.settled) read.fail(error);if(!http.settled) http.fail(error);request.signal.removeEventListener('abort',abort);nativeControllers.delete(cancellation);throw error;}
  }
  async function seed(baseUrl:string):Promise<CaseContext> {
    if(seedPromise) throw new Error('Original seed request is once-only');
    seedPromise=(async()=> {
      const cancellation=new AbortController();
      const receipt=await runner.operations.run('http','original-seed-client-http',async()=> {
        const body:RunAgentInput={threadId:ids.threadId,runId:ids.seedRunId,messages:[],state:{},tools:[],context:[],forwardedProps:{benchmarkMode:'seed'},protocolVersion:PROTOCOL_VERSION};
        observe({kind:'origin',role:'native-case',action:'request',origin:new URL(baseUrl).origin,path:`${RUNTIME_URL}/agent/${AGENT_ID}/run`,method:'POST'});
        const original=await fetch(new URL(`${RUNTIME_URL}/agent/${AGENT_ID}/run`,baseUrl),{method:'POST',headers:{'content-type':'application/json','accept':'text/event-stream'},body:JSON.stringify(body),signal:cancellation.signal});
        return runner.operations.run('reader','original-seed-client-reader',()=>consumeNativeSeed(original,ids.threadId,ids.seedRunId),async()=> {cancellation.abort();});
      },async()=> {cancellation.abort();});
      observe({kind:'witness',label:'seedReaderEOF',status:'fulfilled'});
      await runner.operations.awaitOriginals();
      const publicOutcome=runner.outcomes.get(ids.seedRunId),bridgeOutcome=bridge.receipt(ids.seedRunId);
      const idle=!await runner.isRunning({threadId:ids.threadId});
      runner.controls.observeSeed({terminalSuccess:receipt.terminalSuccess && publicOutcome?.terminalSuccess===true,eof:receipt.eof && nativeEof.has(ids.seedRunId),bridgeSettled:bridgeOutcome?.successful===true,publicSettled:publicOutcome?.settled===true,idle,messages:runner.getThreadMessages(ids.threadId)});
      context=parseCaseContext({agentId:AGENT_ID,ids,history,response,seedCommitted:true,continuationUrl:CONTINUATION_URL});return context;
    })();return seedPromise;
  }
  async function fetchOwned(request:Request):Promise<Response> {
    if(closed) return Response.json({error:'Case admission closed'},{status:409});
    const path=new URL(request.url).pathname;
    if(path===CONTEXT_URL && request.method==='GET') {
      if(!context || !mountedOwner || mountReleased) return Response.json({error:'Original committed seed and mounted owner required once'},{status:409});
      runner.controls.admitMount();runner.connectAdmitted=true;mountReleased=true;return Response.json(context,{headers:{'cache-control':'no-store'}});
    }
    if(path===MOUNTED_URL && request.method==='POST') {
      const body=dataRecord(await readBoundedJson(request),['threadId','messages','idle','error']);
      if(body.threadId!==ids.threadId || body.idle!==true || body.error!==null) throw new Error('Mounted receipt differs');
      await runner.operations.awaitOriginals();
      runner.controls.observeMounted({idle:body.idle,error:body.error,messages:body.messages});return Response.json({admitted:true});
    }
    if(path===COMPLETED_URL && request.method==='POST') {
      const body=dataRecord(await readBoundedJson(request),['threadId','messages','idle','publicSettled','outcome']);
      if(body.threadId!==ids.threadId || body.idle!==true || body.publicSettled!==true || body.outcome!=='success') throw new Error('Original page operation not settled successfully');
      await runner.operations.awaitOriginals();
      const publicOutcome=runner.outcomes.get(ids.continuationRunId),bridgeOutcome=bridge.receipt(ids.continuationRunId);
      const idle=!await runner.isRunning({threadId:ids.threadId});
      // Validate the independently supplied mounted final state as well as the
      // public persisted state. Metadata is recognized/bounded, never stripped.
      const messages=body.messages;
      if(!Array.isArray(messages) || messages.length!==history.length+1) throw new Error('Mounted final length differs');
      const actual=ownHistory(messages.slice(0,history.length));
      if(actual.some((message,index)=> {const expected=history[index];return !expected || message.id!==expected.id || message.role!==expected.role || message.content!==expected.content;})) throw new Error('Mounted final H differs');
      validateResponse(messages[history.length],response);
      runner.controls.observeContinuation({terminalSuccess:publicOutcome?.terminalSuccess===true,eof:nativeEof.has(ids.continuationRunId) && bridgeOutcome?.eof===true,bridgeSettled:bridgeOutcome?.successful===true,publicSettled:publicOutcome?.settled===true,producerSettled:bridgeOutcome?.producerSettled===true,readerSettled:bridgeOutcome?.readerSettled===true,idle,messages:runner.getThreadMessages(ids.threadId)},response);
      completed=true;return Response.json({settled:true});
    }
    if(path===`${RUNTIME_URL}/info` && request.method==='GET') return nativeResponse(request,'info','http');
    if(path===`${RUNTIME_URL}/agent/${AGENT_ID}/run` && request.method==='POST') {
      const body=await readBoundedJson(request);
      const runId:unknown=typeof body==='object' && body!==null ? Object.getOwnPropertyDescriptor(body,'runId')?.value : undefined;
      if(runId!==ids.seedRunId && runId!==ids.continuationRunId) throw new Error('Unowned native run');
      const headers=new Headers(request.headers);headers.delete('content-length');
      return nativeResponse(new Request(request,{headers,body:JSON.stringify(body)}),runId,'http');
    }
    if(path===`${RUNTIME_URL}/agent/${AGENT_ID}/connect` && request.method==='POST') {
      // Default CopilotKit sends the full public RunAgentInput shape for connect;
      // preserve it for the native handler, while admitting only this empty-input
      // cold connection. This is not a run or the bridge's connect override.
      const body=RunAgentInputSchema.parse(await readBoundedJson(request));
      if(body.threadId!==ids.threadId || body.messages.length!==0) throw new Error('Unowned or non-cold native connection');
      const headers=new Headers(request.headers);headers.delete('content-length');
      return nativeResponse(new Request(request,{headers,body:JSON.stringify(body)}),'native-connect','native-connect');
    }
    if(path===`${RUNTIME_URL}/agent/${AGENT_ID}/stop/${encodeURIComponent(ids.threadId)}` && request.method==='POST') {
      const body=dataRecord(await readBoundedJson(request),['runId']);
      if(body.runId!==ids.seedRunId && body.runId!==ids.continuationRunId) throw new Error('Unowned native stop');
      const headers=new Headers(request.headers);headers.delete('content-length');
      // The default public agent issues this exact-run request. Native stop may
      // publish idle early; its HTTP result is never original-run settlement.
      return nativeResponse(new Request(request,{headers,body:JSON.stringify(body)}),'native-stop','http');
    }
    // Thread clear/delete, wildcard stop and other runtime routes are not exposed
    // as benchmark harness admission. Cleanup also owns an exact public stop.
    return Response.json({error:'Route not admitted by this source profile'},{status:404});
  }
  function fetchTracked(request:Request):Promise<Response> {
    if(closed || incoming.length>=32) return Promise.resolve(Response.json({error:'Incoming owned request admission closed or full'},{status:409}));
    const cancellation=new AbortController();
    const abort=()=>cancellation.abort(request.signal.reason);request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted) abort();
    const original=fetchOwned(new Request(request,{signal:cancellation.signal}));
    const entry={original,settled:false,cancel:()=>cancellation.abort()};incoming.push(entry);
    // Retain the original handler promise, including bounded JSON body parsing.
    // Native response-reader outcomes are tracked separately through their EOF.
    original.then(()=> {entry.settled=true;request.signal.removeEventListener('abort',abort);},error=> {entry.settled=true;request.signal.removeEventListener('abort',abort);runner.operations.cleanupFailure(error);});
    return original;
  }
  return {seed,fetch:fetchTracked,observe,context:()=>context,completed:()=>completed,
    bindMountedOwner(owner:MountedOwner) {if(mountedOwner || mountReleased || closed) throw new Error('Mounted original owner is once-only');mountedOwner=owner;},
    async dispose(closeServer:()=>Promise<void>):Promise<void> {
      const budget=new SettlementBudget();
      if(closed) throw new Error('Cleanup/retry is not admitted');closed=true;runner.operations.closeAdmission();mountedOwner?.closeAdmission();
      let originalServerClose:Promise<void>|undefined;
      const closeOriginalServer=()=> {
        if(originalServerClose) return originalServerClose;
        originalServerClose=(async()=>closeServer())();
        // Observe the actual callback outcome even if the shared bounded wait
        // expires. A late close does not release failed case/store ownership.
        originalServerClose.then(()=> {if(!serverDisposal.settled) serverDisposal.succeed();},error=> {if(!serverDisposal.settled) serverDisposal.fail(error);});
        return originalServerClose;
      };
      try {
      const active=runner.activeRunId;if(active) {bridge.cancelOwned(active);await budget.wait(runner.stop({threadId:ids.threadId,runId:active}),'Owned exact stop');}
      for(const request of incoming) {if(!request.settled) request.cancel();}
      await runner.operations.cancelOriginals(budget);
      if(!mountedOwner) throw new Error('Original mounted harness owner is absent');
      try {await budget.wait(mountedOwner.dispose(),'Original mounted harness disposal');harnessDisposal.succeed();}
      catch(error) {harnessDisposal.fail(error);throw error;}
      const handlers=await budget.wait(Promise.allSettled(incoming.map(request=>request.original)),'Original incoming handlers');
      if(handlers.some(result=>result.status==='rejected')) throw new Error('Original incoming handler failed; ownership retained');
      await runner.operations.awaitOriginals(false,budget);
      const idle=!await budget.wait(runner.isRunning({threadId:ids.threadId}),'Owned public idle');runner.controls.observeIdle(idle);
      if(!completed) throw new Error('Incomplete owned case retains state; global clear and reuse forbidden');
      await runner.controls.clearStore(()=>runner.clearThreads());observe({kind:'witness',label:'storeClear',status:'fulfilled'});runner.controls.observeEmptyAfterClear(runner.listThreads());observe({kind:'witness',label:'publicStoreEmpty',status:'fulfilled'});
      await budget.wait(closeOriginalServer(),'Owned server disposal');
      await runner.operations.awaitOriginals(true,budget);runner.controls.finishDisposal();releaseDomain();observe({kind:'witness',label:'caseDomainRelease',status:'fulfilled'});
      // A final recorder failure cannot turn into a successful disposal result.
      await runner.operations.awaitOriginals(true,budget);
      } catch(primary) {
        // Failure closes this owned listener when possible, but never clears
        // retained SDK state, releases the lease, retries, or invents settlement.
        try {await budget.wait(closeOriginalServer(),'Failed-case original server close');}
        catch(cleanup) {runner.operations.cleanupFailure(cleanup);}
        throw new Error('Owned case cleanup failed; state/evidence retained and reuse forbidden',{cause:{primary,failures:runner.operations.failures()}});
      }
    },evidence:()=>({publicRuns:[...runner.outcomes.values()],incoming:incoming.map(request=>({settled:request.settled})),bridge:bridge.evidence(),failures:runner.operations.failures(),scope:'source algorithms only; hosted exclusive ownership and original outcomes unqualified'}),
  };
}
