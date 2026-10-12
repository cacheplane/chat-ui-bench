import {beforeAll, expect, test} from 'vitest';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium,type Route,type BrowserContext,type CDPSession,type Page,type Locator} from 'playwright';
import {pathToFileURL} from 'node:url';
import type {ComparisonPageState} from './comparison-observations.js';
import {createComparisonTraceCapture} from './comparison-trace.js';
import {createLongThreadReplayServer,type LongThreadReplayServer} from '@chat-ui-bench/producer';
import {
  comparisonTraceAuxiliarySchema, comparisonCheckpointsSchema,comparisonScheduledRunSchema,adapterBuildSchema,comparisonInstrumentationBuildSchema,
  comparisonEvidenceSchema,comparisonExceptionsSchema,canonicalSerialize,longThreadFixtureSchema,createLongThreadFixture,
  comparisonFinalRuntimeSchema,comparisonVisibleValidationSchema,comparisonValidationSchema,type ComparisonCheckpoints,
  validateRuntimeTranscript,comparisonSchemasForVersionPair,COMPARISON_CAPTURE_LIMITS,type LongThreadCaptureHost,
} from '@chat-ui-bench/contract';
import {
  directCase, forwardingFactory, healthyRaw, readiness, json, digest, deferred, intercept, slotRaw, rootCase, checkedDataset,
  retainOriginalCapture,deriveAdmittedLifecycle,writeRootControl,writeComparisonCiSnapshot,traceCausalReceipt,originalRoot,type OriginalCaptureBucket,
  type BrowserControl, type TestWindow, type Resources,
} from './comparison-browser.test-helper.js';

beforeAll(readiness, 180000);

function completeDelivery(raw: Awaited<ReturnType<typeof healthyRaw>>, fixture: Parameters<typeof validateRuntimeTranscript>[0]) {
  expect(raw.acquisition.status).toBe('complete');
  expect(raw.runtime.snapshot.delivery).toBe('complete');
  expect(raw.runtime.snapshot.outcome).toBe('success');
  expect(raw.runtime.snapshot.loading).toBe(false);
  expect(raw.runtime.snapshot.error).toBeNull();
  expect(validateRuntimeTranscript(fixture, raw.runtime.snapshot)).toEqual([]);
  expect(raw.producer.filter(row => row.kind === 'producer-emission')).toHaveLength(202);
  expect(raw.producer.filter(row => row.kind === 'producer-failure')).toEqual([]);
  expect(raw.page.filter(row => row.kind === 'receipt')).toHaveLength(202);
  expect(raw.page.filter(row => row.kind === 'translation')).toHaveLength(202);
  expect(raw.page.filter(row => row.kind === 'failure')).toEqual([]);
  expect(raw.status.terminalPageDrain.status).toBe('available');
  expect(raw.status.terminalProducerDrain.status).toBe('available');
  expect(raw.status.traceEof.status).toBe('available');
  expect(raw.native.status).toBe('complete');
  expect(raw.native.results.every(row => row.completion.status === 'acknowledged')).toBe(true);
}
function sampledVisibility(geometry:ComparisonCheckpoints['scroll'][number]['geometry']):boolean|null{
  if(geometry.status==='unavailable')return null;
  const g=geometry.value;
  let left=Math.max(g.viewportRect.left,g.scrollerRect.left),right=Math.min(g.viewportRect.right,g.scrollerRect.right),top=Math.max(g.viewportRect.top,g.scrollerRect.top),bottom=Math.min(g.viewportRect.bottom,g.scrollerRect.bottom);
  for(let index=0;index<g.clippingAncestorRects.length;index++){const rect=g.clippingAncestorRects[index]!,axes=g.clippingAncestorAxes[index]!;if(axes.clipX){left=Math.max(left,rect.left);right=Math.min(right,rect.right);}if(axes.clipY){top=Math.max(top,rect.top);bottom=Math.min(bottom,rect.bottom);}}
  const clip=right>left&&bottom>top?{left,top,right,bottom}:null;
  expect(g.effectiveClipRect).toEqual(clip);
  return clip!==null&&g.contentRects.some(rect=>rect.right>rect.left&&rect.bottom>rect.top&&Math.min(rect.right,right)>Math.max(rect.left,left)&&Math.min(rect.bottom,bottom)>Math.max(rect.top,top));
}

type ExpectedOriginalSlot={identity:OriginalCaptureBucket['identity'];provenance:{role:string;key:string;path:string;originalSha256?:string}[];fixture:ReturnType<typeof createLongThreadFixture>;mode:'headless'|'headed';caseOrder:string[]};
function assertSlotIdentity(value:object,identity:OriginalCaptureBucket['identity']){for(const key of Object.keys(identity))expect(Reflect.get(value,key)).toEqual(Reflect.get(identity,key));}
function originalSlotOracle(raw:Awaited<ReturnType<typeof healthyRaw>>,fixture:ReturnType<typeof createLongThreadFixture>,bucket:OriginalCaptureBucket,validation:ReturnType<typeof comparisonValidationSchema.parse>,evidence:ReturnType<typeof comparisonEvidenceSchema.parse>,auxiliary:ReturnType<typeof comparisonTraceAuxiliarySchema.parse>,expectedOriginal:ExpectedOriginalSlot){
  completeDelivery(raw,fixture);expect(evidence.trace.status).toBe('available');if(evidence.trace.status!=='available')throw new Error('Required trace is unavailable');expect(evidence.trace.complete).toBe(true);expect(evidence.trace.tracingComplete.status).toBe('available');if(evidence.trace.tracingComplete.status==='available')expect(evidence.trace.tracingComplete.value.dataLossOccurred).toBe(false);expect(auxiliary.status).toBe('complete');expect(auxiliary.completion.status).toBe('available');if(auxiliary.completion.status==='available')expect(auxiliary.completion.value.dataLossOccurred).toBe(false);
  expect(fixture).toEqual(expectedOriginal.fixture);expect(bucket.identity).toEqual(expectedOriginal.identity);for(const role of [raw.runtime,raw.visible,raw.checkpoints,raw.native,raw.status,raw.acquisition,validation,evidence,auxiliary])assertSlotIdentity(role,expectedOriginal.identity);for(const row of [...raw.page,...raw.producer]){expect(row.schemaVersion).toBe(expectedOriginal.identity.schemaVersion);expect(row.repetition).toBe(expectedOriginal.identity.repetition);}for(const key of Object.keys(expectedOriginal.identity).filter(key=>key!=='adapterProfile'))expect(Reflect.get(raw.manifest,key)).toEqual(Reflect.get(expectedOriginal.identity,key));expect(raw.manifest.adapter.profile).toBe(expectedOriginal.identity.adapterProfile);expect(raw.manifest.workload).toEqual(expectedOriginal.fixture.workload);expect(raw.manifest.mode).toBe(expectedOriginal.mode);expect(raw.manifest.caseOrder).toEqual(expectedOriginal.caseOrder);if(raw.status.captureMetadata.status==='available')assertSlotIdentity(raw.status.captureMetadata.value,expectedOriginal.identity);
  expect(raw.acquisition.members.map(({role,key,path,originalSha256})=>({role,key,path,...(originalSha256===undefined?{}:{originalSha256})}))).toEqual(expectedOriginal.provenance);expect(raw.acquisition.members.length).toBeGreaterThan(0);expect(raw.acquisition.members.every(member=>member.status==='complete')).toBe(true);for(const member of raw.acquisition.members){expect(member.beforeCopy.status).toBe('available');expect(member.copied).toEqual(member.beforeCopy);expect(member.afterCopy).toEqual(member.beforeCopy);if(member.originalSha256!==undefined&&member.copied.status==='available')expect(member.copied.value.sha256).toBe(member.originalSha256);}
  expect(bucket.counts.full).toBe(2);const full=bucket.receipts.filter(row=>row.kind==='full');expect(full).toHaveLength(2);
  expect(new Set(bucket.receipts.map(row=>row.pageAssociation)).size).toBe(1);
  for(const receipt of bucket.receipts){expect(receipt.identity).toEqual(bucket.identity);expect(receipt.status).toBe('fulfilled');expect(receipt.clockDomain).toBe('host-performance-ms');expect(receipt.settledAtHostMs).not.toBeNull();expect(receipt.settledAtHostMs!).toBeGreaterThanOrEqual(receipt.admittedAtHostMs);}
  const responseId=fixture.events[0]!.messageId,text=fixture.events.filter(event=>event.type==='text-delta').map(event=>event.text).join(''),expectedHistory=fixture.history.map(({id,role,text})=>({id,role,text})),expected=[...expectedHistory,{id:responseId,role:'assistant',text}];
  expect(raw.runtime.snapshot.transcript.map(({id,role,text})=>({id,role,text}))).toEqual(expected);
  for(const [index,receipt] of full.entries()){
    expect(receipt.stage).toBe(index===0?'setup':'replay');expect(receipt.args[1]).toEqual({responseId:index===0?null:responseId,candidateLimit:64});
    const result=receipt.result as {timestampMs:number;clockDomain:string;snapshot:{transcript:{id:string;role:string;text:string}[]};coverage:{mode:string;messages:{id:string;text:string}[]};geometry:{available:boolean;contradiction:string|null;reason:string|null}};
    expect(result.geometry).toEqual({available:true,contradiction:null,reason:null});expect(result.coverage.mode).toBe('all-mounted');
    const transcript=index===0?expectedHistory:expected;
    expect(result.snapshot.transcript.map(({id,role,text})=>({id,role,text}))).toEqual(transcript);expect(result.coverage.messages).toEqual(transcript.map(({id,text})=>({id,text})));
    if(index===1){expect(comparisonFinalRuntimeSchema.parse({...bucket.identity,timestampMs:result.timestampMs,clockDomain:result.clockDomain,snapshot:result.snapshot})).toEqual(raw.runtime);expect(comparisonVisibleValidationSchema.parse({...bucket.identity,timestampMs:result.timestampMs,clockDomain:result.clockDomain,coverage:result.coverage})).toEqual(raw.visible);}
  }
  let historyScheduling:unknown;const history=fixture.workload.journey==='history-reading',facts=deriveAdmittedLifecycle(bucket,history,raw.manifest.adapter.configuration.pinThresholdCssPx);
  expect(raw.checkpoints.scroll).toEqual(facts.rows);
  for(const row of facts.rows){if(row.anchorId!==null)expect(fixture.history.some(message=>message.id===row.anchorId),'Remembered anchor must resolve to canonical fixture history').toBe(true);const visible=sampledVisibility(row.geometry);if(visible!==null){expect(row.geometry.status==='available'&&row.geometry.value.messageId).toBe(responseId);expect(row.geometry.status==='available'&&row.geometry.value.role).toBe('assistant');expect(row.activeVisible).toBe(visible);}sampledVisibility(row.anchorGeometry);if(row.anchorGeometry.status==='available'){const anchor=fixture.history.find(message=>message.id===row.anchorId);expect(anchor,'Available anchor must resolve to canonical fixture history').toBeDefined();expect(row.anchorGeometry.value.messageId).toBe(anchor!.id);expect(row.anchorGeometry.value.role,'Available anchor role must match canonical historical role').toBe(anchor!.role);expect(row.anchorTopCssPx).toBe(row.anchorGeometry.value.hostRect.top-row.anchorGeometry.value.scrollerRect.top);}expect(row.pinThresholdCssPx).toBe(raw.manifest.adapter.configuration.pinThresholdCssPx);expect(row.followArmed).toBeNull();}
  expect(validation.status).toBe(facts.reasons.length?'failed':'valid');expect(validation.reasons).toEqual(facts.uniqueReasons);
  expect(validation.checks).toEqual([{name:'actual-runtime-content',passed:true,reason:null,evidencePaths:['final-runtime.json','visible-validation.json']},{name:'independent-candidate-content-geometry',passed:true,reason:null,evidencePaths:['visible-validation.json','page.jsonl']},{name:'capture-lifecycle',passed:facts.reasons.length===0,reason:facts.reasons.length?facts.reasons.join('; '):null,evidencePaths:['page.jsonl','producer.jsonl','trace.json']}]);
  expect(raw.status.status).toBe(facts.reasons.length?'partial':'complete');expect(raw.status.reasons).toEqual(facts.uniqueReasons.length?[...new Set([...facts.uniqueReasons,facts.uniqueReasons.join('; ').slice(0,4096)])]:[]);
  const producer=raw.producer.filter(row=>row.kind==='producer-emission'),receipts=raw.page.filter(row=>row.kind==='receipt'),translations=raw.page.filter(row=>row.kind==='translation');let accumulated='';
  for(const [index,event] of fixture.events.entries()){
    const emitted=producer[index]!,received=receipts[index]!,translated=translations[index]!;
    expect(emitted.kind==='producer-emission'&&emitted.data.event).toEqual(event);expect(received.kind==='receipt'&&received.data.event).toEqual(event);expect(emitted.sequence).toBe(event.sequence);expect(received.sequence).toBe(event.sequence);expect(translated.sequence).toBe(event.sequence);
    if(event.type==='text-delta')accumulated+=event.text;
    expect(translated.kind==='translation'&&translated.data).toEqual({protocolEvent:event.type==='assistant-complete'?'values':'messages',messageId:event.messageId,text:event.type==='assistant-complete'?accumulated:event.text});
  }
  const composers=raw.native.hostDispatches.filter(row=>row.kind==='composer');expect(composers.map(row=>row.requestedOffsetMs)).toEqual([0,35,70,105,140,175,210,245,280]);expect(raw.native.results.filter(row=>row.kind==='composer')).toHaveLength(9);
  const inputs=raw.page.filter(row=>row.kind==='native-input'&&row.data.type==='input'&&row.data.targetRole==='composer');expect(inputs.map(row=>row.kind==='native-input'&&row.data.value)).toEqual(Array.from({length:9},(_,index)=>'calibrate'.slice(0,index+1)));expect(inputs.every(row=>row.kind==='native-input'&&row.data.isTrusted&&row.data.recipeId==='comparison-composer-calibrate-v1')).toBe(true);
  expect(raw.native.hostDispatches.filter(row=>row.kind==='wheel').map(row=>row.requestedOffsetMs)).toEqual(history?[0,50,100,150]:[]);expect(raw.native.results.filter(row=>row.kind==='wheel')).toHaveLength(history?4:0);if(history){const dispatch=raw.native.hostDispatches.find(row=>row.kind==='wheel'&&row.index===0)!;const origin=dispatch.hostMonotonicMs-dispatch.actualOffsetMs,reads=bucket.receipts.filter(row=>row.kind==='scroll');expect(reads[0]!.settledAtHostMs!).toBeLessThanOrEqual(dispatch.hostMonotonicMs);expect(reads[1]!.admittedAtHostMs).toBeGreaterThan(dispatch.hostMonotonicMs);expect(reads[2]!.admittedAtHostMs).toBeGreaterThan(reads[1]!.settledAtHostMs!);expect(Number.isFinite(origin)).toBe(true);historyScheduling={originAtHostMs:origin,clockDomain:'host-performance-ms',requestedReadOffsetsMs:[200,1000],reads:reads.slice(0,3).map((receipt,index)=>({index,admittedOffsetMs:receipt.admittedAtHostMs-origin,settledOffsetMs:receipt.settledAtHostMs!-origin,...(index>0?{requestedOffsetMs:index===1?200:1000,signedAdmissionLatenessMs:receipt.admittedAtHostMs-origin-(index===1?200:1000)}:{})}))};}
  const wheelEvents=raw.page.filter(row=>row.kind==='native-input'&&row.data.type==='wheel');if(history){expect(wheelEvents.length).toBeGreaterThan(0);let totalY=0;for(const row of wheelEvents){if(row.kind!=='native-input')throw new Error('Original wheel observation differs');expect(row.data.isTrusted).toBe(true);expect(row.data.recipeId).toBe('comparison-wheel-up-v1');expect(row.data.targetRole).toBe('scroller');expect(row.data.deltaX).toBe(0);expect(row.data.deltaMode).toBe(0);expect(row.data.deltaY).toBeLessThan(0);expect(row.data.deltaY!%100===0).toBe(true);totalY+=row.data.deltaY!;}expect(totalY).toBe(-400);}else expect(wheelEvents).toEqual([]);
  const returns=history&&facts.visible?1:0;expect(raw.native.hostDispatches.filter(row=>row.kind==='return-control')).toHaveLength(returns);expect(raw.native.results.filter(row=>row.kind==='return-control'),'Visible return requires original native ACK').toHaveLength(returns);expect(raw.native.results).toHaveLength(9+(history?4:0)+returns);
  const recipeProjection=(rows:typeof raw.native.hostDispatches)=>rows.map(({recipeId,index,kind,requestedOffsetMs})=>({recipeId,index,kind,requestedOffsetMs}));
  const expectedDispatches=[...(history?Array.from({length:4},(_,index)=>({recipeId:'comparison-wheel-up-v1',index,kind:'wheel',requestedOffsetMs:index*50})):[]),...(returns?[{recipeId:'comparison-return-control-v1',index:0,kind:'return-control',requestedOffsetMs:0}]:[]),...Array.from({length:9},(_,index)=>({recipeId:'comparison-composer-calibrate-v1',index,kind:'composer',requestedOffsetMs:index*35}))];
  expect(recipeProjection(raw.native.hostDispatches)).toEqual(expectedDispatches);expect(raw.checkpoints.hostDispatches).toEqual(raw.native.hostDispatches);
  expect(raw.native.results.map(({recipeId,index,kind})=>({recipeId,index,kind}))).toEqual(expectedDispatches.map(({recipeId,index,kind})=>({recipeId,index,kind})));
  for(const [index,ack] of raw.native.results.entries()){expect(ack.invocationAtHostMs).toBe(raw.native.hostDispatches[index]!.hostMonotonicMs);expect(ack.completion.status).toBe('acknowledged');}
  const clicks=raw.page.filter(row=>row.kind==='native-input'&&row.data.type==='click'&&row.data.targetRole==='return-control');expect(clicks).toHaveLength(returns);for(const click of clicks){if(click.kind!=='native-input')throw new Error('Original click differs');expect(click.data.recipeId).toBe('comparison-return-control-v1');expect(click.data.isTrusted).toBe(true);expect(click.data.targetRole).toBe('return-control');}
  expect(raw.checkpoints.hostFrameGuards).toHaveLength(1);const guard=raw.checkpoints.hostFrameGuards[0]!;expect(guard.messageId).toBe(responseId);expect(guard.hostObservation.hostMounted).toBe(true);expect(guard.frames[0]!.timestampMs).toBeGreaterThanOrEqual(guard.hostObservation.timestampMs);expect(guard.frames[1]!.timestampMs).toBeGreaterThan(guard.frames[0]!.timestampMs);
  if(raw.status.finalPageInstrumentation.status!=='available')throw new Error('Original final instrumentation missing');expect(evidence.instrumentation).toEqual(raw.status.finalPageInstrumentation.value);expect(raw.status.finalPageInstrumentation.value.buffers.map(buffer=>buffer.name)).toEqual(['transport','page-observations','pre-navigation-errors']);for(const buffer of raw.status.finalPageInstrumentation.value.buffers){expect(buffer.status).toBe('complete');expect(buffer.overflowCount).toBe(0);expect(buffer.rejectedRecordCount).toBe(0);}
  return {...facts,historyScheduling};
}

function negativeSlotOracle(raw:Parameters<typeof originalSlotOracle>[0],fixture:Parameters<typeof originalSlotOracle>[1],bucket:OriginalCaptureBucket,validation:Parameters<typeof originalSlotOracle>[3],evidence:Parameters<typeof originalSlotOracle>[4],auxiliary:Parameters<typeof originalSlotOracle>[5],expectedOriginal:ExpectedOriginalSlot){
  const reject=(change:(copies:{raw:typeof raw;bucket:OriginalCaptureBucket;validation:typeof validation;evidence:typeof evidence;auxiliary:typeof auxiliary})=>void,expectedError?:string)=>{
    const copies={raw:structuredClone(raw),bucket:{...bucket,identity:{...bucket.identity},counts:{...bucket.counts},receipts:bucket.receipts.map(receipt=>({...receipt,args:[...receipt.args],result:structuredClone(receipt.result)}))},validation:structuredClone(validation),evidence:structuredClone(evidence),auxiliary:structuredClone(auxiliary)};
    change(copies);expect(()=>originalSlotOracle(copies.raw,fixture,copies.bucket,copies.validation,copies.evidence,copies.auxiliary,expectedOriginal)).toThrow(expectedError);
  };
  reject(copy=>{copy.validation.reasons.push('Unexplained diagnostic reason');});
  reject(copy=>{const full=copy.bucket.receipts.find(receipt=>receipt.kind==='full'&&receipt.stage==='replay')!;const result=full.result as {geometry:{available:boolean;contradiction:string|null;reason:string|null}};result.geometry={available:false,contradiction:'Controlled contradictory candidate',reason:'Controlled unknown geometry'};copy.validation.status='failed';});
  reject(copy=>{const full=copy.bucket.receipts.find(receipt=>receipt.kind==='full'&&receipt.stage==='replay')!;Reflect.set(full.result as object,'clockDomain','host-performance-ms');});
  reject(copy=>{copy.raw.native.results.pop();});
  reject(copy=>{if(copy.evidence.trace.status==='available')copy.evidence.trace.complete=false;});
  reject(copy=>{copy.bucket.identity={...copy.bucket.identity,repetition:'wrong-slot'};});
  reject(copy=>{copy.raw.runtime.snapshot.transcript[0]!.text+='corruption';});
  reject(copy=>{copy.raw.native.results[0]!.recipeId='wrong-original-recipe';});
  reject(copy=>{copy.raw.manifest.workload.seed++;});
  reject(copy=>{copy.raw.status.reasons.push('Wrong root joined summary');});
  reject(copy=>{copy.raw.acquisition.members=[];});
  reject(copy=>{copy.raw.page[0]!.repetition='wrong-page-slot';});
  reject(copy=>{if(copy.evidence.instrumentation)copy.evidence.instrumentation.buffers=[];});
  reject(copy=>{if(copy.evidence.instrumentation){const buffer=copy.evidence.instrumentation.buffers[0]!;buffer.status='partial';buffer.overflowCount=1;}});
  if(fixture.workload.journey==='history-reading'){
    const mutateScroll=(copy:Parameters<Parameters<typeof reject>[0]>[0],change:(value:ComparisonCheckpoints['scroll'][number])=>void,project=true)=>{
      // This deterministic rectangle belongs only to cloned oracle controls, never native evidence.
      const receipt=copy.bucket.receipts.find(row=>row.kind==='scroll')!,rect={left:0,top:0,right:1,bottom:1};
      const geometry=(id:string,role:'assistant'|'user')=>({status:'available' as const,value:{messageId:id,role,hostRect:rect,contentRects:[rect],viewportRect:rect,scrollerRect:rect,clippingAncestorRects:[],clippingAncestorAxes:[],effectiveClipRect:rect}}),anchor=fixture.history[0]!;
      const value=comparisonCheckpointsSchema.shape.scroll.element.parse({timestampMs:0,clockDomain:'page-performance-ms',scrollTop:0,scrollHeight:1,clientHeight:1,anchorId:anchor.id,anchorTopCssPx:0,activeVisible:true,geometry:geometry(fixture.events[0]!.messageId,'assistant'),anchorGeometry:geometry(anchor.id,anchor.role),pinThresholdCssPx:copy.raw.manifest.adapter.configuration.pinThresholdCssPx,followArmed:null});
      change(value);receipt.result={status:'available',value};if(project)copy.raw.checkpoints.scroll=deriveAdmittedLifecycle(copy.bucket,true,copy.raw.manifest.adapter.configuration.pinThresholdCssPx).rows;
    };
    reject(copy=>mutateScroll(copy,value=>{value.anchorId='invented-anchor-id';if(value.anchorGeometry.status==='available')value.anchorGeometry.value.messageId='invented-anchor-id';}),'Remembered anchor must resolve to canonical fixture history');
    reject(copy=>mutateScroll(copy,value=>{if(value.anchorGeometry.status==='available')value.anchorGeometry.value.role=value.anchorGeometry.value.role==='assistant'?'user':'assistant';}),'Available anchor role must match canonical historical role');
    reject(copy=>mutateScroll(copy,value=>{value.geometry={status:'unavailable',reason:'Historical anchor unavailable'};},false));
    reject(copy=>mutateScroll(copy,value=>{value.anchorGeometry={status:'unavailable',reason:'Unadmitted historical anchor literal'};},false));
    reject(copy=>{copy.bucket.receipts.find(row=>row.kind==='scroll')!.result={status:'unavailable',reason:'Historical anchor unavailable'};});
    reject(copy=>{const wheel=copy.raw.page.find(row=>row.kind==='native-input'&&row.data.type==='wheel');if(!wheel||wheel.kind!=='native-input')throw new Error('Original wheel negative seed absent');wheel.data.deltaY=100;});
    reject(copy=>{const query=copy.bucket.receipts.find(row=>row.kind==='return-visible')!;query.result=true;const facts=deriveAdmittedLifecycle(copy.bucket,true,copy.raw.manifest.adapter.configuration.pinThresholdCssPx);copy.raw.checkpoints.scroll=facts.rows;copy.validation.status=facts.reasons.length?'failed':'valid';copy.validation.reasons=facts.uniqueReasons;const lifecycle=copy.validation.checks.find(check=>check.name==='capture-lifecycle')!;lifecycle.passed=facts.reasons.length===0;lifecycle.reason=facts.reasons.length?facts.reasons.join('; '):null;copy.raw.status.status=facts.reasons.length?'partial':'complete';copy.raw.status.reasons=facts.uniqueReasons.length?[...new Set([...facts.uniqueReasons,facts.uniqueReasons.join('; ').slice(0,4096)])]:[];copy.evidence.status=facts.reasons.length?'partial':'complete';if(facts.reasons.length)copy.evidence.reason=facts.uniqueReasons.join('; ').slice(0,4096);else delete copy.evidence.reason;
      // Controlled missing-ACK input only; no dispatch occurs and actual receipts stay untouched.
      if(!copy.raw.native.hostDispatches.some(row=>row.kind==='return-control')){const composer=copy.raw.native.hostDispatches.find(row=>row.kind==='composer')!;copy.raw.native.hostDispatches.splice(4,0,{recipeId:'comparison-return-control-v1',index:0,kind:'return-control',hostMonotonicMs:composer.hostMonotonicMs,requestedOffsetMs:0,actualOffsetMs:0});}copy.raw.checkpoints.hostDispatches=structuredClone(copy.raw.native.hostDispatches);copy.raw.native.results=copy.raw.native.results.filter(row=>row.kind!=='return-control');},'Visible return requires original native ACK');
    reject(copy=>{if(copy.raw.status.reasons.length)copy.raw.status.reasons.pop();else copy.raw.status.reasons.push('Missing original finite reason');});
    reject(copy=>{const reads=copy.bucket.receipts.filter(row=>row.kind==='scroll');for(const read of reads.slice(0,3))read.result={status:'unavailable',reason:'Active visibility not established: Prose rectangle budget exhausted before range query'};const facts=deriveAdmittedLifecycle(copy.bucket,true,copy.raw.manifest.adapter.configuration.pinThresholdCssPx);copy.raw.checkpoints.scroll=facts.rows;copy.validation.status='failed';copy.validation.reasons=facts.uniqueReasons;const lifecycle=copy.validation.checks.find(check=>check.name==='capture-lifecycle')!;lifecycle.passed=false;lifecycle.reason=facts.reasons.join('; ');copy.raw.status.reasons=facts.uniqueReasons;copy.raw.status.status='complete';});
    reject(copy=>{
      // Controlled oracle mutation only: these rectangles are never native/scored evidence.
      const rect={left:0,top:0,right:1,bottom:1},geometry=(id:string,role:'assistant'|'user')=>({status:'available',value:{messageId:id,role,hostRect:rect,contentRects:[rect],viewportRect:rect,scrollerRect:rect,clippingAncestorRects:[],clippingAncestorAxes:[],effectiveClipRect:rect}}),reads=copy.bucket.receipts.filter(row=>row.kind==='scroll');
      for(const [index,read] of reads.slice(0,3).entries())read.result={status:'available',value:{timestampMs:index===0?0:1,clockDomain:'page-performance-ms',scrollTop:0,scrollHeight:1,clientHeight:1,anchorId:fixture.history[0]!.id,anchorTopCssPx:0,activeVisible:true,geometry:geometry(fixture.events[0]!.messageId,'assistant'),anchorGeometry:geometry(fixture.history[0]!.id,fixture.history[0]!.role)}};
      const facts=deriveAdmittedLifecycle(copy.bucket,true,copy.raw.manifest.adapter.configuration.pinThresholdCssPx);expect(facts.windowAvailable).toBe(false);expect(facts.reasons).toContain('Actual cached samples do not cover the required 800ms window');copy.raw.checkpoints.scroll=facts.rows;copy.validation.status='valid';copy.validation.reasons=[];copy.raw.status.status='complete';
    });
  }
}

test('H01 retains an empty real host through two subsequent frames before original text', async () => {
  const control: BrowserControl = {closeInvocations: []};
  let forwarding: ReturnType<typeof forwardingFactory> | undefined;
  let observation: Promise<{messageId: string; empty: boolean; retained: boolean; frames: number[]; observedAt: number}> | undefined;
  let resources: Resources | undefined;
  control.evaluate = (page, args, invoke) => {
    const actual = invoke();
    if (typeof args[0] === 'function' && args[0].toString().includes('host.connectReplay')) {
      observation = (async () => {
        await forwarding!.start;
        await page.waitForFunction(id => (window as TestWindow).benchHost?.readProgress().activeMessage?.id === id,
          control.context!.fixture.events[0]!.messageId, {timeout: 8000});
        const observed = await page.evaluate(async id => {
          const host = (window as TestWindow).benchHost!;
          const element = document.querySelector<HTMLElement>(`chat-message[data-bench-message-id="${id}"]`);
          if (!element) throw new Error('Actual assistant host is absent');
          const body=element.querySelector('.chat-message__assistant-body');
          if(!body||!body.isConnected||!element.contains(body))throw new Error('Actual assistant body is absent');
          const observedAt = performance.now();
          const empty = () => host.readProgress().activeMessage?.id === id && host.readProgress().activeMessage?.text === '' && element.textContent === '' && body.textContent === '' && body.isConnected && element.contains(body) && element.querySelector('.chat-message__assistant-body')===body;
          const snapshot=()=>{const content=document.querySelector(host.locators.messageContent(id));return {at:performance.now(),active:host.readProgress().activeMessage,selector:host.locators.messageContent(id),contentPresent:content!==null,contentConnected:content?.isConnected??null,contentText:content?.textContent??null,hostText:element.textContent,bodyText:body.textContent,outerHTML:element.outerHTML};};
          const snapshots=[snapshot()];let allEmpty = empty(), retained = element.isConnected;
          const frames: number[] = [];
          for (let i = 0; i < 2; i++) {
            frames.push(await new Promise<number>(done => requestAnimationFrame(done)));
            allEmpty &&= empty();
            retained &&= element.isConnected && document.querySelector(`chat-message[data-bench-message-id="${id}"]`) === element;
            snapshots.push(snapshot());
          }
          return {messageId: id, empty: allEmpty, retained, frames, observedAt,snapshots};
        }, control.context!.fixture.events[0]!.messageId);
        forwarding!.release(); return observed;
      })();
      resources!.observe(observation);
    }
    return actual;
  };
  await directCase(0, control, async result => {
    expect(result.setup.status).toBe('complete'); expect(result.replay?.status).toBe('complete');
    expect(result.disposal.status).toBe('complete'); expect(result.operationFailures).toEqual([]);
    expect(result.cleanupFailures).toEqual([]);
    const observed = await observation!;
    await writeFile(join(result.directory,'..','h01-control.json'),JSON.stringify({observed,forwarding:forwarding!.facts},null,2)+'\n');
    expect(observed.messageId).toBe(result.fixture.events[0]!.messageId);
    expect(observed.empty).toBe(true); expect(observed.retained).toBe(true);
    expect(observed.frames[0]).toBeGreaterThanOrEqual(observed.observedAt);
    expect(observed.frames[1]).toBeGreaterThan(observed.frames[0]!);
    expect(forwarding!.facts.fallbackUsed).toBe(false);
    expect(forwarding!.facts.upstreamConnections).toBe(1); expect(forwarding!.facts.downstreamConnections).toBe(1);
    expect(forwarding!.facts.firstTextAdmitted).toBeGreaterThanOrEqual(forwarding!.facts.released!);
    const raw = await healthyRaw(result.directory); completeDelivery(raw, result.fixture);
    expect(raw.checkpoints.hostFrameGuards).toHaveLength(1);
    const trace = await readFile(join(result.directory, 'trace.json'));
    expect(trace.length).toBeGreaterThan(0); expect(digest(trace)).toMatch(/^[a-f0-9]{64}$/);
  }, owned => {resources = owned; forwarding = forwardingFactory(owned, true); control.replayServer = forwarding.factory;});
}, 130000);

test('H02 retains native acknowledgements and actual history-reading evidence with immediate original text', async () => {
  const control: BrowserControl = {closeInvocations: []};
  let retainedFull:unknown,resources:Resources|undefined;
  const originalScrollReads:{atHostMs:number;result:unknown}[]=[],returnVisibility:{selector:unknown;visible:boolean}[]=[];
  control.wrapContext=context=>intercept<BrowserContext>(context,{newPage:async(_args,invoke)=>intercept<Page>(await(invoke() as Promise<Page>),{locator:(args,call)=>intercept<Locator>(call() as Locator,{isVisible:(_options,visible)=>{const observed=(visible() as Promise<boolean>).then(value=>{returnVisibility.push({selector:args[0],visible:value});return value;});resources!.observe(observed);return observed;}})})});
  control.evaluate=(_page,args,invoke)=>{const actual=invoke();if(typeof args[0]==='function'){
    const source=args[0].toString();
    if(source.includes('capture.readScroll()')){const observed=(actual as Promise<unknown>).then(result=>{originalScrollReads.push({atHostMs:performance.now(),result});return result;});resources!.observe(observed);return observed;}
    if(source.includes('Actual host unavailable for full validation')&&args[1]&&typeof args[1]==='object'&&Reflect.get(args[1],'responseId')!==null){const observed=(actual as Promise<unknown>).then(value=>{retainedFull=value;return value;});resources!.observe(observed);return observed;}
  }return actual;};
  let forwarding: ReturnType<typeof forwardingFactory> | undefined;
  await directCase(11, control, async result => {
    expect(result.setup.status).toBe('complete'); expect(result.replay?.status).toBe('complete');
    expect(result.disposal.status).toBe('complete'); expect(result.operationFailures).toEqual([]);
    expect(result.cleanupFailures).toEqual([]);
    const raw = await healthyRaw(result.directory); completeDelivery(raw, result.fixture);
    expect(forwarding!.facts.upstreamConnections).toBe(1); expect(forwarding!.facts.downstreamConnections).toBe(1);
    expect(forwarding!.facts.firstTextAdmitted).toBeGreaterThanOrEqual(forwarding!.facts.startAdmitted!);
    const wheels = raw.native.hostDispatches.filter(row => row.kind === 'wheel');
    expect(wheels.map(row => row.requestedOffsetMs)).toEqual([0, 50, 100, 150]);
    expect(wheels.every(row => Number.isFinite(row.actualOffsetMs))).toBe(true);
    expect(raw.native.results.filter(row => row.kind === 'wheel')).toHaveLength(4);
    const events = raw.page.filter(row => row.kind === 'native-input' && row.data.type === 'wheel');
    expect(events.length).toBeGreaterThan(0);
    expect(events.every(row => row.kind === 'native-input' && row.data.isTrusted)).toBe(true);
    expect(raw.native.hostDispatches.filter(row => row.kind === 'composer').map(row=>row.requestedOffsetMs)).toEqual([0,35,70,105,140,175,210,245,280]);
    const composerInputs=raw.page.filter(row=>row.kind==='native-input'&&row.data.type==='input'&&row.data.targetRole==='composer');
    expect(composerInputs.map(row=>row.kind==='native-input'&&row.data.value)).toEqual(Array.from({length:9},(_,index)=>'calibrate'.slice(0,index+1)));
    expect(composerInputs.every(row=>row.kind==='native-input'&&row.data.isTrusted&&row.data.recipeId==='comparison-composer-calibrate-v1')).toBe(true);
    expect(returnVisibility).toHaveLength(1);expect(typeof returnVisibility[0]!.visible).toBe('boolean');
    expect(raw.native.hostDispatches.filter(row => row.kind === 'return-control')).toHaveLength(returnVisibility[0]!.visible?1:0);
    const checkpoints = raw.checkpoints.scroll;
    expect(originalScrollReads).toHaveLength(5);
    const availableReads:ComparisonCheckpoints['scroll'][number][]=[],unavailableReasons:string[]=[];
    for(const read of originalScrollReads){if(!read.result||typeof read.result!=='object')throw new Error('Original scroll result absent');
      if(Reflect.get(read.result,'status')==='available')availableReads.push(comparisonCheckpointsSchema.shape.scroll.element.parse({...Reflect.get(read.result,'value'),pinThresholdCssPx:raw.manifest.adapter.configuration.pinThresholdCssPx,followArmed:null}));
      else{expect(Reflect.get(read.result,'status')).toBe('unavailable');const reason=Reflect.get(read.result,'reason');expect(typeof reason).toBe('string');expect(reason.length).toBeGreaterThan(0);unavailableReasons.push(reason);}}
    expect(checkpoints).toEqual(availableReads);
    const firstThree=originalScrollReads.slice(0,3).map(read=>read.result as {status:string;value?:ComparisonCheckpoints['scroll'][number]});
    const cachedWindowAvailable=firstThree.every(read=>read.status==='available')&&firstThree[1]!.value!.timestampMs>firstThree[0]!.value!.timestampMs&&firstThree[2]!.value!.timestampMs-firstThree[1]!.value!.timestampMs>=800;
    if(cachedWindowAvailable){expect(firstThree[1]!.value!.timestampMs).toBeGreaterThan(firstThree[0]!.value!.timestampMs);expect(firstThree[2]!.value!.timestampMs-firstThree[1]!.value!.timestampMs).toBeGreaterThanOrEqual(800);}
    for (const row of checkpoints) {
      const visible=sampledVisibility(row.geometry);if(visible!==null){expect(row.geometry.status==='available'&&row.geometry.value.messageId).toBe(result.fixture.events[0]!.messageId);expect(row.activeVisible).toBe(visible);}
      sampledVisibility(row.anchorGeometry);if(row.anchorGeometry.status==='available'){expect(row.anchorGeometry.value.messageId).toBe(row.anchorId);expect(row.anchorTopCssPx).toBe(row.anchorGeometry.value.hostRect.top-row.anchorGeometry.value.scrollerRect.top);}
      expect(row.pinThresholdCssPx).toBe(raw.manifest.adapter.configuration.pinThresholdCssPx);expect(row.followArmed).toBeNull();
    }
    if(!retainedFull||typeof retainedFull!=='object')throw new Error('Genuine final full-page result was not retained');
    const timestampMs=Reflect.get(retainedFull,'timestampMs'),clockDomain=Reflect.get(retainedFull,'clockDomain'),snapshot=Reflect.get(retainedFull,'snapshot'),coverage=Reflect.get(retainedFull,'coverage'),geometry=Reflect.get(retainedFull,'geometry');
    expect(comparisonFinalRuntimeSchema.parse({...result.identity,timestampMs,clockDomain,snapshot})).toEqual(raw.runtime);expect(comparisonVisibleValidationSchema.parse({...result.identity,timestampMs,clockDomain,coverage})).toEqual(raw.visible);
    if(!geometry||typeof geometry!=='object'||typeof Reflect.get(geometry,'available')!=='boolean')throw new Error('Actual full geometry availability was not retained');
    const contradiction=Reflect.get(geometry,'contradiction'),unavailable=Reflect.get(geometry,'reason');expect(contradiction===null||typeof contradiction==='string').toBe(true);expect(unavailable===null||typeof unavailable==='string').toBe(true);
    const expected=[...result.fixture.history,{id:result.fixture.events[0]!.messageId,role:'assistant',text:result.fixture.events.filter(event=>event.type==='text-delta').map(event=>event.text).join('')}];
    const runtimeContradiction=raw.runtime.snapshot.transcript.length!==expected.length||raw.runtime.snapshot.transcript.some((message,index)=>message.id!==expected[index]?.id||message.role!==expected[index]?.role||message.text!==expected[index]?.text);
    expect(raw.visible.coverage.mode).toBe('all-mounted');if(raw.visible.coverage.mode==='all-mounted')expect(raw.visible.coverage.messages).toEqual(expected.map(({id,text})=>({id,text})));
    const validation=comparisonValidationSchema.parse(await json(join(result.directory,'validation.json'))),checks=new Map(validation.checks.map(check=>[check.name,check]));
    for(const reason of unavailableReasons){expect(validation.reasons).toContain(reason);expect(raw.status.reasons).toContain(reason);}
    if(!cachedWindowAvailable){expect(validation.reasons).toContain('Actual cached samples do not cover the required 800ms window');expect(raw.status.reasons).toContain('Actual cached samples do not cover the required 800ms window');}
    if(!returnVisibility[0]!.visible){expect(validation.reasons).toContain('Declared return control did not dispatch');expect(raw.status.reasons).toContain('Declared return control did not dispatch');}
    const actualContradiction=runtimeContradiction||contradiction!==null,available=Reflect.get(geometry,'available')===true;
    expect(checks.get('actual-runtime-content')?.passed).toBe(!actualContradiction);expect(checks.get('independent-candidate-content-geometry')?.passed).toBe(available&&contradiction===null);
    const lifecycle=checks.get('capture-lifecycle');expect(lifecycle).toBeDefined();
    if(unavailableReasons.length>0||!cachedWindowAvailable||!returnVisibility[0]!.visible){expect(lifecycle!.passed).toBe(false);expect(raw.status.status).toBe('partial');}
    expect(validation.status).toBe(actualContradiction?'invalid':!available||!lifecycle!.passed?'failed':'valid');
    await writeFile(join(result.directory,'..','h02-control.json'),JSON.stringify({retainedFull,originalScrollReads,returnVisibility,scroll:checkpoints,validation},null,2)+'\n');
  }, owned => {resources=owned;forwarding = forwardingFactory(owned, false); control.replayServer = forwarding.factory;});
}, 130000);
test('H03 overflows the genuine sixty-four pending route continuations during active replay', async () => {
  const control: BrowserControl = {closeInvocations: [],traceCausal:true}, gate = deferred<void>();
  let forwarding:ReturnType<typeof forwardingFactory>|undefined;const canonicalAck=deferred<void>();let canonicalUrl:string|undefined,canonicalAckAt:number|undefined;
  let resources: Resources | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  let burstStarted = false, replayAdmission: {stage: string; generation: number; nonburstPending: number} | undefined;
  let nonburstPending = 0, entries = 0, held = 0, continued = 0, handlersSettled = 0,burstBoundaryPending:number|undefined,firstBurstPending:number|undefined,burstAdmissionOpen=false;
  const overlaps:{at:number;pending:number;entries:number;held:number}[]=[];
  const requests: Promise<unknown>[] = [], continuations: Promise<unknown>[] = [];
  let removalStarted = false, removalSettled = false, registrationDisposed = false;
  let actualProducer:LongThreadReplayServer|undefined,diagnosticTimer:ReturnType<typeof setInterval>|undefined,fallbackReleased=false;
  const nonburstRoutes:{url:string;enteredAt:number;continueAt:number|null;settledAt:number|null}[]=[],taskStates=new Map<Promise<unknown>,{id:number;status:string;error?:string}>();
  function diagnostic(event:string){for(const task of resources?.tasks??[])if(!taskStates.has(task)){const state={id:taskStates.size,status:'pending'};taskStates.set(task,state);void task.then(()=>{state.status='fulfilled';},error=>{state.status='rejected';Reflect.set(state,'error',String(error));});}
    const authority=control.context?.ownership;console.error('H03 host control',JSON.stringify({event,at:performance.now(),entries,held,continued,handlersSettled,nonburstPending,burstBoundaryPending,firstBurstPending,burstAdmissionOpen,fallbackReleased,removalStarted,removalSettled,registrationDisposed,producerState:actualProducer?.state,nonburstRoutes,overlaps,ownership:authority&&{stage:authority.stage,generation:authority.generation,startedAtHostMs:authority.startedAtHostMs,deadlineAtHostMs:authority.deadlineAtHostMs,aborted:authority.signal.aborted},closeInvocations:control.closeInvocations,nativeSessions:control.nativeSessions,tasks:[...taskStates.values()]}));}
  control.replayServer=async options=>{actualProducer=await forwarding!.factory(options);return actualProducer;};
  const release = (event='cleanup-release') => {burstAdmissionOpen=false;gate.resolve(); if (timer !== undefined) clearTimeout(timer);diagnostic(event);};
  control.wrapContext = context => intercept<BrowserContext>(context, {
    route: (args, invoke) => {
      const original = args[1]; if (typeof original !== 'function') throw new Error('Actual route callback required');
      const handler = async (route: Route) => {
        const burst = new URL(route.request().url()).searchParams.has('h03-burst');
        const routeFact=burst?null:{url:route.request().url(),enteredAt:performance.now(),continueAt:null as number|null,settledAt:null as number|null};if(routeFact)nonburstRoutes.push(routeFact);
        if (burst) {if(entries===0)firstBurstPending=nonburstPending;entries++;}
        const wrapped = intercept(route, {continue: (_args, call) => {
          if (burst) {
            held++;
            const task = gate.promise.then(() => {continued++; return call() as Promise<void>;});
            continuations.push(task); resources!.observe(task); return task;
          }
          nonburstPending++;
          if(routeFact)routeFact.continueAt=performance.now();
          if(burstAdmissionOpen)overlaps.push({at:performance.now(),pending:nonburstPending,entries,held});
          const task = (call() as Promise<void>).finally(() => {nonburstPending--;if(routeFact)routeFact.settledAt=performance.now();}).then(()=>{if(routeFact?.url===canonicalUrl){canonicalAckAt=performance.now();canonicalAck.resolve();}});
          resources!.observe(task); return task;
        }});
        let task: Promise<void>;
        try {task = Reflect.apply(original, undefined, [wrapped]) as Promise<void>;}
        catch (error) {task = Promise.reject(error);}
        resources!.observe(task);
        if (burst && entries === 65) release('entry-65-release');
        try {await task;} finally {if (burst) handlersSettled++;}
      };
      const registration = invoke([args[0], handler, ...args.slice(2)]) as ReturnType<BrowserContext['route']>;
      return registration.then(actual => intercept(actual, {dispose: (_args, call) => {
        const task = call() as Promise<void>; return task.then(() => {registrationDisposed = true;});
      }}));
    },
    unrouteAll: (_args, invoke) => {
      removalStarted = true; const task = invoke() as Promise<void>;
      return task.then(() => {removalSettled = true;});
    },
  });
  control.evaluate = (page, args, invoke) => {
    const isConnect=typeof args[0]==='function'&&args[0].toString().includes('host.connectReplay');if(isConnect){if(typeof args[1]!=='string')throw new Error('Original canonical replay URL is absent');canonicalUrl=args[1];}
    const actual = invoke();
    if (!burstStarted && typeof args[0] === 'function' && args[0].toString().includes('host.connectReplay')) {
      burstStarted = true;
      const authority = control.context!.ownership;
      let revoke!:(error:unknown)=>void;const revoked=new Promise<never>((_done,reject)=>{revoke=reject;});void revoked.catch(()=>{});const onAbort=()=>{try{authority.assertActive();}catch(error){revoke(error);}};authority.signal.addEventListener('abort',onAbort,{once:true});
      const task = Promise.race([Promise.all([actual,canonicalAck.promise,forwarding!.start]),revoked]).then(() => {
        authority.assertActive();
        replayAdmission = {stage: authority.stage, generation: authority.generation, nonburstPending};burstBoundaryPending=nonburstPending;burstAdmissionOpen=true;
        diagnostic('burst-trigger');timer = setTimeout(()=>{fallbackReleased=true;release('fallback-5000');}, 5000);
        const request = page.evaluate(async base => await Promise.all(Array.from({length: 65}, (_, index) =>
          fetch(`${base}/?h03-burst=${index}`).then(response => response.status))), new URL(page.url()).origin);
        requests.push(request); return request;
      }).finally(()=>authority.signal.removeEventListener('abort',onAbort));
      resources!.observe(task); requests.push(task);
    }
    return actual;
  };
  await directCase(0, control, async result => {
    expect(result.setup.status).toBe('complete');
    expect(replayAdmission?.stage).toBe('replay'); expect(replayAdmission?.generation).toBeGreaterThan(1);
    expect(replayAdmission?.nonburstPending).toBe(0);expect(canonicalAckAt).toBeDefined();expect(forwarding!.facts.startAdmitted).not.toBeNull();expect(forwarding!.facts.upstreamConnections).toBe(1);expect(forwarding!.facts.downstreamConnections).toBe(1);
    expect(burstBoundaryPending).toBe(0);expect(firstBurstPending).toBe(0);expect(overlaps).toEqual([]);
    expect(entries).toBe(65); expect(held).toBe(64); expect(continued).toBe(64); expect(handlersSettled).toBe(65);
    expect(removalStarted).toBe(true); expect(removalSettled).toBe(true); expect(registrationDisposed).toBe(true);
    expect(result.replay?.status).not.toBe('complete');
    const raw = await slotRaw(result.directory);
    expect(raw.status.status).toBe('partial');
    expect(raw.status.reasons.join('; ')).toContain('Route pending operation capacity exceeded');
    expect(raw.status.reasons.join('; ')).not.toContain('ownership handoff gap');
    const outcomes = await Promise.allSettled([...requests, ...continuations]);
    await writeFile(join(result.directory,'..','h03-control.json'),JSON.stringify({traceCausality:traceCausalReceipt(control),identity:result.identity,canonicalUrl,canonicalAckAt,forwarding:forwarding!.facts,replayAdmission,burstBoundaryPending,firstBurstPending,overlaps,entries,held,continued,handlersSettled,removalStarted,removalSettled,registrationDisposed,fallbackReleased,nonburstRoutes,closeInvocations:control.closeInvocations,outcomes:outcomes.map(outcome=>outcome.status==='fulfilled'?{status:'fulfilled'}:{status:'rejected',type:typeof outcome.reason,rendered:String(outcome.reason)}),captureStatus:raw.status},null,2)+'\n');
    expect(traceCausalReceipt(control).violations).toEqual([]);
    expect(outcomes.some(value => value.status === 'rejected')).toBe(true);
  }, owned => {resources = owned;forwarding=forwardingFactory(owned,false);diagnosticTimer=setInterval(()=>diagnostic('tick'),5000);owned.release(()=>{diagnostic('before-resource-settle');if(diagnosticTimer!==undefined)clearInterval(diagnosticTimer);release();});});
}, 130000);

test('H04 rejects a genuinely returned replay drain after the original thirty-second deadline', async () => {
  const control: BrowserControl = {closeInvocations: [],traceCausal:true}, gate = deferred<void>();
  let resources: Resources | undefined, held = false, returned = false, fallback = false;
  let heldBytes: Buffer | undefined, heldValue: unknown;
  let releaseTimer: ReturnType<typeof setTimeout> | undefined, watch: ReturnType<typeof setInterval> | undefined;
  let drainCallsAfterRevocation = 0, closedBeforeRelease: string[] = [],sessionsBeforeRelease:BrowserControl['nativeSessions'];
  const release = () => {
    if (releaseTimer !== undefined) clearTimeout(releaseTimer);
    if (watch !== undefined) clearInterval(watch);
    gate.resolve();
  };
  control.evaluate = (_page, args, invoke) => {
    const actual = invoke();
    if (control.context?.ownership.stage === 'replay' && typeof args[0] === 'function'
        && args[0].toString().includes('capture.drain(max)') && args[1] === 64) {
      if (control.context.ownership.signal.aborted) drainCallsAfterRevocation++;
      if (!held) {
        held = true;
        releaseTimer = setTimeout(() => {fallback = true; release();}, Math.max(0, control.context.ownership.startedAtHostMs + 45000 - performance.now()));
        resources!.observe(actual as Promise<unknown>);
        return (actual as Promise<unknown>).then(async value => {
          returned = true; heldValue = value;
          const context = control.context!;
          heldBytes = await readFile(join(activeDirectory!, 'page.jsonl'));
          watch = setInterval(() => {
            const closes = new Set(control.closeInvocations.map(row => row.name));
            const sessions=control.nativeSessions??[];
            if (context.ownership.signal.aborted && sessions.length>0&&sessions.every(session=>session.detachAt!==null)&&['page', 'context', 'browser', 'producer','browser-CDP-detach','target-CDP-detach'].every(name => closes.has(name))) {
              closedBeforeRelease = [...closes];sessionsBeforeRelease=sessions.map(session=>({...session})); release();
            }
          }, 5);
          await gate.promise; return value;
        });
      }
    }
    return actual;
  };
  let activeDirectory: string | undefined;
  await directCase(0, control, async result => {
    expect(result.setup.status).toBe('complete'); expect(held).toBe(true); expect(returned).toBe(true);
    expect(Array.isArray(heldValue)).toBe(true);
    expect(result.replay?.status).toBe('expired');
    expect(result.replay?.deadline.budgetMs).toBe(30000);
    expect(fallback).toBe(false); expect(drainCallsAfterRevocation).toBe(0);
    expect(closedBeforeRelease).toEqual(expect.arrayContaining(['page', 'context', 'browser', 'producer','browser-CDP-detach','target-CDP-detach']));
    expect(sessionsBeforeRelease?.length).toBeGreaterThan(0);expect(sessionsBeforeRelease?.every(session=>session.detachAt!==null&&session.detachAt>=session.acquiredAt)).toBe(true);
    expect(await readFile(join(result.directory, 'page.jsonl'))).toEqual(heldBytes);
    const raw = await slotRaw(result.directory);
    expect(raw.status.status).toBe('partial'); expect(raw.status.terminalPageDrain.status).toBe('unavailable');
    expect(raw.status.traceEof.status).toBe('unavailable');
    await writeFile(join(result.directory,'..','h04-control.json'),JSON.stringify({traceCausality:traceCausalReceipt(control),identity:result.identity,rawDirectory:result.directory,held,returned,array:Array.isArray(heldValue),heldValue,heldJournal:{byteLength:heldBytes!.length,sha256:digest(heldBytes!)},fallback,drainCallsAfterRevocation,closedBeforeRelease,sessionsBeforeRelease,originalReplayDeadline:result.replay!.deadline,captureStatus:raw.status},null,2)+'\n');
    expect(traceCausalReceipt(control).violations).toEqual([]);
  }, owned => {resources = owned; owned.release(release);}, directory => {activeDirectory = directory;});
}, 130000);

test('H05 preserves an unsafe whole plan while an actual active HTTP response blocks server close', async () => {
  const control: BrowserControl = {closeInvocations: []};
  let forwarding: ReturnType<typeof forwardingFactory> | undefined;
  let unsafeObserved: number | undefined,beforeRelease:unknown;
  await rootCase(control, async result => {
    expect(result.initializedBeforeFirst).toBe(12); expect(result.attempts).toBe(1);
    expect(result.execution.unsafeOutstanding).toBe(true); expect(result.execution.finalized).toBe(false);
    unsafeObserved = performance.now();
    expect(forwarding!.facts.closeStarted).not.toBeNull(); expect(forwarding!.facts.closeSettled).toBeNull();
    expect(forwarding!.facts.fallbackUsed).toBe(false);
    let sealRejection:unknown;try{await readFile(join(result.directory,'dataset-seal.json'));}catch(error){sealRejection=error;}expect(sealRejection).toMatchObject({code:'ENOENT'});
    expect(result.execution.invocation.runs.slice(1)).toHaveLength(11);
    for (const row of result.execution.invocation.runs.slice(1)) {
      expect(row.status).toBe('failed'); expect(row.reasons.join('; ')).toContain('failed-not-started');
      expect(row.reasons.join('; ')).toContain('unsafe outstanding ownership');
    }
    expect(control.closeInvocations.map(row => row.name)).toEqual(expect.arrayContaining(['browser', 'context', 'page', 'assets', 'producer']));
    beforeRelease={directory:result.directory,attempts:result.attempts,initializedBeforeFirst:result.initializedBeforeFirst,unsafeOutstanding:result.execution.unsafeOutstanding,finalized:result.execution.finalized,unsafeObserved,sealAbsent:!!sealRejection&&typeof sealRejection==='object'&&Reflect.get(sealRejection,'code')==='ENOENT',sealRejection:{type:typeof sealRejection,rendered:String(sealRejection)},notStartedRows:structuredClone(result.execution.invocation.runs.slice(1)),forwarding:{...forwarding!.facts},closeInvocations:control.closeInvocations.map(row=>({...row}))};
    forwarding!.release();
  }, async result => {
    expect(result.execution.unsafeOutstanding).toBe(false); expect(result.execution.finalized).toBe(true); expect(result.attempts).toBe(1);
    const first = result.execution.invocation.runs[0]!;
    const raw = await slotRaw(join(result.directory, first.artifactDirectory));
    const checkpoints = comparisonCheckpointsSchema.parse(await json(join(result.directory, first.artifactDirectory, 'checkpoints.json')));
    const disposal = checkpoints.deadlines.find(row => row.stage === 'disposal')!;
    expect(disposal.outcome).toBe('expired'); expect(disposal.budgetMs).toBe(10000);
    expect(forwarding!.facts.released).toBeGreaterThanOrEqual(disposal.deadlineAtHostMs);
    expect(forwarding!.facts.released).toBeGreaterThanOrEqual(unsafeObserved!);
    expect(forwarding!.facts.closeSettled).toBeGreaterThanOrEqual(forwarding!.facts.released!);
    expect(forwarding!.facts.fallbackUsed).toBe(false);
    expect(raw.status.status).toBe('partial');
    const dataset = await checkedDataset(result.directory);
    expect(dataset.slots).toHaveLength(12); expect(dataset.invocationLedger.status).toBe('failed');
    await writeRootControl(result.directory,'h05',{rawDirectory:join(result.directory,first.artifactDirectory),beforeRelease,forwarding:forwarding!.facts,originalDisposalDeadline:disposal,settled:{attempts:result.attempts,unsafeOutstanding:result.execution.unsafeOutstanding,finalized:result.execution.finalized},captureStatus:raw.status});
  }, owned => {forwarding = forwardingFactory(owned, false, true); control.replayServer = forwarding.factory;});
}, 130000);

test('H06 retains a genuine empty partial trace after detaching the F session before its first read', async () => {
  const control: BrowserControl = {closeInvocations: [],traceCausal:true};
  let resources: Resources | undefined, detach: Promise<void> | undefined;
  let reads = 0, actualReadRejected = false, readError: unknown, detachCalls = 0;
  let originalReadArguments: unknown[] | undefined, traceSnapshot: ReturnType<ReturnType<typeof createComparisonTraceCapture>['snapshot']> | undefined;
  control.createTrace = options => {
    const actualSession = options.session;
    const detachOnce = () => {
      if (!detach) {detachCalls++; detach = actualSession.detach(); resources!.observe(detach);}
      return detach;
    };
    resources!.close(detachOnce);
    const session = intercept<CDPSession>(actualSession, {
      detach: () => detachOnce(),
      send: (args, invoke) => {
        if (args[0] !== 'IO.read') return invoke();
        reads++; originalReadArguments = args;
        const task = (async () => {
          await detachOnce();
          try {return await (invoke() as Promise<unknown>);}
          catch (error) {actualReadRejected = true; readError = error; throw error;}
        })();
        return resources!.observe(task);
      },
    });
    const trace = createComparisonTraceCapture({...options, session});
    return {...trace, snapshot() {const actual = trace.snapshot(); traceSnapshot = actual; return actual;}};
  };
  await directCase(0, control, async result => {
    expect(result.setup.status).toBe('complete'); expect(result.replay?.status).toBe('failed');
    expect(reads, 'Required first IO.read boundary must be genuinely reached').toBe(1);
    expect(detachCalls).toBe(1); expect(actualReadRejected).toBe(true); expect(readError).toBeDefined();
    expect(originalReadArguments?.[0]).toBe('IO.read');
    expect(originalReadArguments?.[1]).toEqual({handle: expect.any(String), size: 65536});
    expect(traceSnapshot?.trace.status).toBe('available');
    if (traceSnapshot?.trace.status !== 'available') throw new Error('Actual F trace snapshot absent');
    expect(traceSnapshot.trace.complete).toBe(false); expect(traceSnapshot.traceEof.status).toBe('unavailable');
    const bytes = await readFile(join(result.directory, 'trace.json'));
    expect(bytes.length).toBe(0); expect(digest(bytes)).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    const raw = await slotRaw(result.directory);
    expect(raw.status.status).toBe('partial'); expect(raw.status.traceEof.status).toBe('unavailable');
    const auxiliary = comparisonTraceAuxiliarySchema.parse(await json(join(result.directory, 'trace-auxiliary.json')));
    expect(auxiliary.status).toBe('partial'); expect(auxiliary.completion.status).toBe('available');
    if (auxiliary.completion.status === 'available') expect(auxiliary.completion.value.dataLossOccurred).toBe(false);
    expect(result.operationFailures.some(row => row.error === readError)).toBe(true);
    expect(result.cleanupFailures).toContain(readError);
    await writeFile(join(result.directory,'..','h06-control.json'),JSON.stringify({traceCausality:traceCausalReceipt(control,readError),identity:result.identity,rawDirectory:result.directory,reads,detachCalls,actualReadRejected,originalReadArguments,readError:{type:typeof readError,rendered:String(readError)},operationFailureIdentityMatch:result.operationFailures.some(row=>row.error===readError),cleanupFailureIdentityMatch:result.cleanupFailures.includes(readError),traceSnapshot,auxiliary,captureStatus:raw.status,traceBytes:{byteLength:bytes.length,sha256:digest(bytes)}},null,2)+'\n');
    expect(traceCausalReceipt(control).violations).toEqual([]);
  }, owned => {resources = owned;});
}, 130000);

test('H07 executes canonical twelve-slot native components with truthful scored geometry', async () => {
  const control: BrowserControl = {closeInvocations: []};let retained:ReturnType<typeof retainOriginalCapture>|undefined;const slotReceipts:unknown[]=[];let negativeFollow=false,negativeHistory=false;
  await rootCase(control, async result => {
    expect(result.initializedBeforeFirst).toBe(12); expect(result.attempts).toBe(12);
    expect(result.execution.unsafeOutstanding).toBe(false); expect(result.execution.finalized).toBe(true);
  }, async result => {
    expect(result.cleanupFailures).toEqual([]);expect(retained!.violations()).toBe(0);expect(retained!.buckets.size).toBe(12);expect(retained!.pages.size).toBe(12);
    const dataset = await checkedDataset(result.directory);
    expect(dataset.status).toBe('sealed'); expect(dataset.slots).toHaveLength(12);
    expect(dataset.configuration.caseOrder).toEqual(result.config.configuration.caseOrder);
    expect(dataset.invocationLedger.runs.map(row => row.scenarioId)).toEqual(result.config.configuration.caseOrder);
    for (const [slotIndex,slot] of dataset.slots.entries()) {
      const root = join(result.directory, slot.artifactDirectory);
      const raw = await healthyRaw(root);
      const evidence=comparisonEvidenceSchema.parse(await json(join(root,'evidence.json'))),auxiliary=comparisonTraceAuxiliarySchema.parse(await json(join(root,'trace-auxiliary.json')));
      expect(evidence.trace.status).toBe('available');
      if(evidence.trace.status==='available'){expect(evidence.trace.complete).toBe(true);expect(evidence.trace.tracingComplete.status).toBe('available');if(evidence.trace.tracingComplete.status==='available')expect(evidence.trace.tracingComplete.value.dataLossOccurred).toBe(false);}
      expect(auxiliary.status).toBe('complete');expect(auxiliary.completion.status).toBe('available');if(auxiliary.completion.status==='available')expect(auxiliary.completion.value.dataLossOccurred).toBe(false);
      const scheduled=dataset.invocationLedger.runs[slotIndex]!;expect(slot.identity.caseIndex).toBe(slotIndex);expect(slot.identity.scenarioId).toBe(result.config.configuration.caseOrder[slotIndex]);expect(slot.identity.round).toBe(1);expect(slot.identity.adapterProfile).toBe(result.config.configuration.adapterProfiles[0]);expect(slot.identity.repetition).toBe(`1-${slotIndex}-0`);for(const key of ['caseIndex','scenarioId','round','adapterProfile','repetition'] as const)expect(slot.identity[key]).toBe(scheduled[key]);
      const descriptor=comparisonScheduledRunSchema.parse(await json(join(root,'descriptor.json')));expect(descriptor).toEqual({...slot.identity,seed:result.config.configuration.seed,mode:result.config.configuration.mode,artifactDirectory:slot.artifactDirectory});
      const fixture=longThreadFixtureSchema.parse(await json(join(root,'fixture.json'))),expectedFixture=createLongThreadFixture({seed:result.config.configuration.seed,historyCount:([100,1000,10000] as const)[Math.floor(slotIndex/4)]!,responseBytes:slotIndex%4<2?6400:262144,journey:slotIndex%2===0?'follow':'history-reading'});expect(fixture).toEqual(expectedFixture);const bucket=retained!.buckets.get(canonicalSerialize(slot.identity));if(!bucket)throw new Error('Original slot receipt binding is absent');
      const build=adapterBuildSchema.parse(await json(join(root,'provenance/build-evidence.json'))),probe=comparisonInstrumentationBuildSchema.parse(await json(join(root,'instrumentation/build-evidence.json'))),provenance:ExpectedOriginalSlot['provenance']=[];
      const add=(role:string,key:string,path:string,originalSha256?:string)=>provenance.push({role,key,path,...(originalSha256===undefined?{}:{originalSha256})});
      add('build-record','.build-evidence.json','provenance/build-evidence.json');add('instrumentation-build-record','packages/runner/.comparison-build-evidence.json','instrumentation/build-evidence.json');
      for(const [key,hash] of Object.entries(build.sourceHashes).sort())add('build-source',key,`provenance/source/${key}`,hash);for(const [key,hash] of Object.entries(probe.sourceHashes).sort())add('instrumentation-source',key,`instrumentation/source/${key}`,hash);for(const [key,hash] of Object.entries(probe.compiledHashes).sort())add('instrumentation-compiled-input',key,`instrumentation/compiled/${key}`,hash);for(const [key,hash] of Object.entries(build.assetHashes).sort())add('served-asset',key,`provenance/assets/${key}`,hash);
      for(const key of [...new Set([...build.packages.map(row=>row.resolutionPath!),probe.compiler.resolutionPath,probe.nativeCompiler.resolutionPath])].sort())add('installed-package-metadata',key,`provenance/packages/${key}/package.json`);
      expect(raw.manifest.adapter.build).toEqual(build);if(raw.status.captureMetadata.status!=='available')throw new Error('Required actual capture metadata absent');expect(raw.status.captureMetadata.value.instrumentation.sourceHashes).toEqual(probe.sourceHashes);const installerHash=createHash('sha256').update('chat-ui-bench:comparison-installer-pair:v1\n');for(const path of ['instrumentation/pre-navigation.js','instrumentation/main.js']){const bytes=await readFile(join(root,path)),length=Buffer.alloc(8);length.writeBigUInt64BE(BigInt(bytes.length));installerHash.update(length).update(bytes);}expect(raw.status.captureMetadata.value.instrumentation.installerSha256).toBe(installerHash.digest('hex'));
      const expectedOriginal={identity:slot.identity,provenance,fixture:expectedFixture,mode:result.config.configuration.mode,caseOrder:result.config.configuration.caseOrder};
      for(const member of raw.acquisition.members){const source=member.role==='build-record'?'apps/threadplane/.build-evidence.json':member.role==='instrumentation-build-record'?'packages/runner/.comparison-build-evidence.json':member.role==='served-asset'?`apps/threadplane/dist/${member.key}`:member.role==='installed-package-metadata'?`${member.key}/package.json`:member.key;const bytes=await readFile(join(originalRoot,source)),copied=await readFile(join(root,member.path));expect(copied).toEqual(bytes);expect(member.beforeCopy).toEqual({status:'available',value:{byteLength:bytes.length,sha256:digest(bytes)}});expect(member.copied).toEqual(member.beforeCopy);expect(member.afterCopy).toEqual(member.beforeCopy);}
      const exceptions=comparisonExceptionsSchema.parse(await json(join(root,'exceptions.json')));assertSlotIdentity(exceptions,slot.identity);

      const validation=comparisonValidationSchema.parse(await json(join(root,'validation.json'))),facts=originalSlotOracle(raw,fixture,bucket,validation,evidence,auxiliary,expectedOriginal);expect(slot.status).toBe(validation.status);expect(scheduled.status).toBe(validation.status);if(fixture.workload.journey==='history-reading'?!negativeHistory:!negativeFollow){negativeSlotOracle(raw,fixture,bucket,validation,evidence,auxiliary,expectedOriginal);if(fixture.workload.journey==='history-reading')negativeHistory=true;else negativeFollow=true;}expect(evidence.status).toBe(facts.reasons.length?'partial':'complete');expect(evidence.reason).toBe(facts.reasons.length?facts.uniqueReasons.join('; ').slice(0,4096):undefined);slotReceipts.push({identity:bucket.identity,rawPath:root,rawRuntimeSha256:digest(await readFile(join(root,'final-runtime.json'))),facts,receipts:bucket.receipts.map(receipt=>({...receipt,args:receipt.args.map(arg=>typeof arg==='function'?{originalCallbackSha256:digest(arg.toString())}:arg)}))});
      completeDelivery(raw, fixture);
      expect(raw.status.captureMetadata.status).toBe('available'); expect(raw.status.finalPageInstrumentation.status).toBe('available');
      expect(raw.checkpoints.deadlines.map(row => row.budgetMs)).toEqual([60000, 30000, 10000]);
      expect(raw.checkpoints.deadlines.every(row => row.outcome === 'complete')).toBe(true);
      expect(raw.checkpoints.counters.map(row => row.lifecycle)).toEqual(['baseline', 'history-ready', 'replay-end']);
      expect((await readFile(join(root, 'trace.json'))).length).toBeGreaterThan(0);
      expect(raw.manifest.adapter.build.production).toBe(true);
      expect(raw.acquisition.members.every(row => row.status === 'complete')).toBe(true);expect(exceptions.exceptions.filter(row=>row.severity==='error')).toEqual([]);
    }
    expect(negativeFollow).toBe(true);expect(negativeHistory).toBe(true);
    const browserCloses = control.closeInvocations.filter(row => row.name === 'browser');
    expect(browserCloses).toHaveLength(12);for(const name of ['context','page','assets','producer'])expect(control.closeInvocations.filter(row=>row.name===name)).toHaveLength(12);
    console.info('H07 external control',await writeRootControl(result.directory,'h07',{root:result.directory,slots:slotReceipts}));
    if(process.env.CI==='true'){const snapshot=await writeComparisonCiSnapshot(result.directory);expect(snapshot).not.toBeNull();console.info('H07 CI original snapshot JSON '+JSON.stringify(snapshot));}
  },owned=>{retained=retainOriginalCapture(control,owned);});
}, 1260000);

type NativeRangeEvidence={envelopes:number;glyphQueries:number;fragments:number;queries:{kind:'envelope'|'glyph';start:number;end:number;textPrefix:string;at:number;durationMs:number}[]};
type NativePageWindow=Window&{comparisonCapture?:ComparisonPageState;benchHost?:Pick<LongThreadCaptureHost,'locators'|'drainCaptureEvents'|'markPhase'|'readCaptureCandidates'|'readCaptureProgress'|'readCaptureMountedMessageCount'|'readCaptureBufferState'|'readActiveHost'>;rangeEvidence:NativeRangeEvidence;countOwnedRanges:boolean};
/** Declared bridge fixture, real DOM/layout/clock/timers, trusted compiled installer. */
async function nativeSamplingPage(text:string,top:number,preformatted:boolean,body:(page:Page)=>Promise<void>){
  let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,context:BrowserContext|undefined,page:Page|undefined,primaryPresent=false,primary:unknown;const cleanup:unknown[]=[];
  try{
    const compiled=await import(pathToFileURL(join(originalRoot,'packages/runner/dist/comparison-installer.js')).href) as typeof import('./comparison-installer.js');
    const family=comparisonSchemasForVersionPair({collectorVersion:'2.1.0',analyzerVersion:'2.1.0'}),identity={repetition:'native-page-fixture',round:1,artifactDirectory:'runs/native-page-fixture',scenarioId:'native-page-fixture',caseIndex:0,adapterProfile:'threadplane',seed:1,mode:'headless'};
    const pre=canonicalSerialize(family.preNavigationOptionsSchema.parse({optionsVersion:1,identity,limits:COMPARISON_CAPTURE_LIMITS,stateGlobal:'comparisonPreNavigation'}));
    const main=canonicalSerialize(family.mainOptionsSchema.parse({optionsVersion:1,identity,limits:COMPARISON_CAPTURE_LIMITS,probeIntervalMs:50,bridgeGlobal:'benchHost',stateGlobal:'comparisonCapture',preNavigationGlobal:'comparisonPreNavigation',observers:{eventTiming:{buffered:true,durationThresholdMs:16},loaf:{buffered:true}},nativeRecipeIds:{wheel:'comparison-wheel-up-v1',composer:'comparison-composer-calibrate-v1'},scoredScrollSampling:{mode:'fresh-page-acquisition',minimumPostToLaterPageMs:800,maxWaitCallbacks:64}}));
    const pair=compiled.assembleComparisonInstaller(pre,main,'2.1.0');
    browser=await chromium.launch({headless:true,args:['--enable-automation']});context=await browser.newContext({viewport:{width:320,height:240}});page=await context.newPage();
    const session=await browser.newBrowserCDPSession();try{const facts=await session.send('Browser.getVersion'),command=await session.send('Browser.getBrowserCommandLine');expect(facts.product).toContain('Chrome/');expect(facts.revision).toBe('@f842f52ef39fd97b449eb27cff414bf05a98ddce');console.info('Fresh native pinned browser',JSON.stringify({executable:command.arguments[0],...facts,installerSha256:pair.installerSha256}));}finally{await session.detach();}
    await page.setContent('<!doctype html><style>body{margin:0}#scroll{position:relative;width:100px;height:100px;overflow:auto}#host{position:absolute;width:96px}#content{font:16px/40px monospace;overflow-wrap:anywhere}</style><div id="scroll"><div id="host"><div id="content"></div></div></div>');
    await page.evaluate(args=>{
      const w=window as NativePageWindow,host=document.querySelector<HTMLElement>('#host')!,content=document.querySelector<HTMLElement>('#content')!;host.style.top=args.top+'px';content.style.whiteSpace=args.preformatted?'pre':'normal';content.textContent=args.text;
      w.rangeEvidence={envelopes:0,glyphQueries:0,fragments:0,queries:[]};w.countOwnedRanges=false;
      const bounds=Range.prototype.getBoundingClientRect,fragments=Range.prototype.getClientRects;
      Range.prototype.getBoundingClientRect=function(){const at=performance.now(),result=Reflect.apply(bounds,this,arguments),durationMs=performance.now()-at;if(w.countOwnedRanges){w.rangeEvidence.envelopes++;w.rangeEvidence.queries.push({kind:'envelope',start:this.startOffset,end:this.endOffset,textPrefix:this.startContainer.textContent?.slice(0,16)??'',at,durationMs});}return result;};
      Range.prototype.getClientRects=function(){const at=performance.now(),result=Reflect.apply(fragments,this,arguments),durationMs=performance.now()-at;if(w.countOwnedRanges){w.rangeEvidence.glyphQueries++;w.rangeEvidence.fragments+=result.length;w.rangeEvidence.queries.push({kind:'glyph',start:this.startOffset,end:this.endOffset,textPrefix:this.startContainer.textContent?.slice(0,16)??'',at,durationMs});}return result;};
      let ordinal=0;w.benchHost={locators:{scroller:'#scroll',composer:'#absent-composer',returnToResponse:null},drainCaptureEvents:()=>[],markPhase:(phase,boundary)=>({phase,boundary,instanceId:String(++ordinal),timestampMs:performance.now()}),readActiveHost:()=>({activeMessageId:'native-page-fixture',hostMounted:host.isConnected}),readCaptureCandidates:()=>({status:'available',value:{historical:[],active:{id:'native-page-fixture',role:'assistant',hostElement:host,contentElement:content}}}),readCaptureProgress:()=>({status:'available',value:{activeMessage:{id:'native-page-fixture',role:'assistant',text:content.textContent??'',status:'streaming'},delivery:'streaming',outcome:null,loading:true,error:null}}),readCaptureMountedMessageCount:()=>({status:'available',value:document.querySelectorAll('#host').length}),readCaptureBufferState:()=>({name:'transport',maxEntries:4096,maxSerializedBytes:16777216,highWaterEntries:0,highWaterSerializedBytes:0,overflowCount:0,rejectedRecordCount:0,status:'complete'})};
    },{text,top,preformatted});
    await page.evaluate(pair.preNavigation);await page.evaluate(pair.main);await body(page);
  }catch(error){primaryPresent=true;primary=error;}
  finally{
    if(page)try{await page.evaluate(()=>{(window as NativePageWindow).comparisonCapture?.stop();});}catch(error){cleanup.push(error);}
    // Dependent native scopes close inside out; every subsequent close is attempted.
    for(const close of [()=>page?.close(),()=>context?.close(),()=>browser?.close()])try{await close();}catch(error){cleanup.push(error);}
  }
  if(primaryPresent){if(cleanup.length)throw new AggregateError([primary,...cleanup],'Native page assertion and cleanup failed');throw primary;}if(cleanup.length)throw new AggregateError(cleanup,'Native page cleanup failed');
}
test('G01 real whole Text envelope prunes huge offscreen prose without glyph queries',async()=>{
  await nativeSamplingPage('huge offscreen prose '.repeat(10000),300,false,async page=>{
    const facts=await page.evaluate(async()=>{const w=window as NativePageWindow;w.rangeEvidence={envelopes:0,glyphQueries:0,fragments:0,queries:[]};w.countOwnedRanges=true;try{return {sample:await w.comparisonCapture!.readScrollFresh({notBeforePageMs:null}),ranges:w.rangeEvidence,instrumentation:w.comparisonCapture!.readInstrumentation()};}finally{w.countOwnedRanges=false;}});
    expect(facts.sample).toMatchObject({status:'available',value:{activeVisible:false,geometry:{status:'available',value:{contentRects:[]}}}});expect(facts.ranges).toMatchObject({envelopes:1,glyphQueries:0,fragments:0});expect(facts.ranges.queries[0]).toMatchObject({start:0,end:210000});console.info('G01 actual Range work',JSON.stringify({ranges:facts.ranges,instrumentation:facts.instrumentation}));
  });
},30000);
test('G02 real overlapping whole Text envelope over blank lines never supplies positive glyph evidence',async()=>{
  await nativeSamplingPage('A\n\n\n\n\nB',-60,true,async page=>{
    const oracle=await page.evaluate(()=>{const text=document.querySelector('#content')!.firstChild!,clip=document.querySelector('#scroll')!.getBoundingClientRect(),range=document.createRange();try{range.selectNodeContents(text);const envelope=range.getBoundingClientRect();const overlap=envelope.right>clip.left&&envelope.left<clip.right&&envelope.bottom>clip.top&&envelope.top<clip.bottom;const glyphs=[0,6].map(start=>{range.setStart(text,start);range.setEnd(text,start+1);return Array.from(range.getClientRects()).map(rect=>({positive:rect.width>0&&rect.height>0,intersects:rect.right>clip.left&&rect.left<clip.right&&rect.bottom>clip.top&&rect.top<clip.bottom}));});const intervals=[[0,3],[3,7]].map(([start,end])=>{range.setStart(text,start!);range.setEnd(text,end!);const r=range.getBoundingClientRect();return {start,end,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},intersects:r.right>clip.left&&r.left<clip.right&&r.bottom>clip.top&&r.top<clip.bottom};});return {overlap,glyphs,intervals};}finally{range.detach();}});
    expect(oracle.overlap).toBe(true);expect(oracle.glyphs.every(rects=>rects.length>0)).toBe(true);expect(oracle.glyphs.flat().every(rect=>rect.positive&&!rect.intersects)).toBe(true);expect(oracle.intervals.every(row=>!row.intersects&&Object.values(row.rect).every(Number.isFinite))).toBe(true);
    const facts=await page.evaluate(async()=>{const w=window as NativePageWindow;w.rangeEvidence={envelopes:0,glyphQueries:0,fragments:0,queries:[]};w.countOwnedRanges=true;try{return {sample:await w.comparisonCapture!.readScrollFresh({notBeforePageMs:null}),ranges:w.rangeEvidence};}finally{w.countOwnedRanges=false;}});
    console.info('G02 actual Range work',JSON.stringify(facts.ranges));expect(facts.sample).toMatchObject({status:'available',value:{activeVisible:false}});expect(facts.ranges.envelopes).toBe(3);expect(facts.ranges.glyphQueries).toBe(0);expect(facts.ranges.fragments).toBe(0);expect(facts.ranges.queries.map(row=>[row.kind,row.start,row.end])).toEqual([['envelope',0,7],['envelope',0,3],['envelope',3,7]]);console.info('G02 independent subrange negatives',JSON.stringify(oracle));
  });
},30000);
test('G03 real fresh page wait preserves actual800ms and current DOM separately from the polling cache',async()=>{
  await nativeSamplingPage('A',20,false,async page=>{
    await page.waitForFunction(()=>((window as NativePageWindow).comparisonCapture!.readInstrumentation().scrollProbe.callbacks>=1));
    const facts=await page.evaluate(async()=>{const w=window as NativePageWindow,capture=w.comparisonCapture!,content=document.querySelector('#content')!,cached=capture.readScroll(),poll=capture.readInstrumentation().scrollProbe;capture.drain(64);content.firstChild!.textContent='B';const post=await capture.readScrollFresh({notBeforePageMs:null}),sameCache=JSON.stringify(capture.readScroll())===JSON.stringify(cached),samePoll=JSON.stringify(capture.readInstrumentation().scrollProbe)===JSON.stringify(poll);if(post.status!=='available')throw new Error(post.reason);const mutation=setTimeout(()=>{content.firstChild!.textContent='C';document.querySelector<HTMLElement>('#host')!.style.top='300px';},100);w.countOwnedRanges=true;try{const later=await capture.readScrollFresh({notBeforePageMs:post.value.timestampMs+800});const laterQueries=later.status==='available'?w.rangeEvidence.queries.filter(query=>query.at>=later.value.timestampMs):[];return {post,later,sameCache,samePoll,text:content.textContent,laterQueries,instrumentation:capture.readInstrumentation()};}finally{w.countOwnedRanges=false;clearTimeout(mutation);}});
    expect(facts.sameCache).toBe(true);expect(facts.samePoll).toBe(true);expect(facts.text).toBe('C');expect(facts.post.status).toBe('available');expect(facts.later).toMatchObject({status:'available',value:{activeVisible:false,geometry:{status:'available',value:{contentRects:[]}}}});expect(facts.post).toMatchObject({status:'available',value:{activeVisible:true}});expect(facts.laterQueries).toHaveLength(1);expect(facts.laterQueries[0]).toMatchObject({kind:'envelope',textPrefix:'C'});if(facts.post.status==='available'&&facts.later.status==='available')expect(facts.later.value.timestampMs-facts.post.value.timestampMs).toBeGreaterThanOrEqual(800);
    const parsed=comparisonSchemasForVersionPair({collectorVersion:'2.1.0',analyzerVersion:'2.1.0'}).comparisonInstrumentationSchema.parse(facts.instrumentation);expect(parsed.freshScrollProbe.callbacks).toBe(2);expect(parsed.freshScrollProbe.maximumObservedGapMs).toMatchObject({status:'available',value:expect.any(Number)});console.info('G03 actual fresh page samples',JSON.stringify(facts));
  });
},30000);
test('G04 real interval negatives reach an independently visible interior glyph within unchanged budgets',async()=>{
  await nativeSamplingPage('x'.repeat(16384),0,false,async page=>{
    const oracle=await page.evaluate(()=>{
      const host=document.querySelector<HTMLElement>('#host')!,content=document.querySelector('#content')!,node=content.firstChild! as Text,scroller=document.querySelector('#scroll')!,range=document.createRange(),rect=(r:DOMRect)=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom});
      try{range.setStart(node,8192);range.setEnd(node,8193);const initial=range.getClientRects()[0];if(!initial)throw new Error('Independent initial glyph absent');host.style.top=(50-initial.top)+'px';const clip=rect(scroller.getBoundingClientRect()),glyphs=Array.from(range.getClientRects(),rect);range.selectNodeContents(node);return {nodeCount:content.childNodes.length,nodeLength:node.length,clip,glyphs,envelope:rect(range.getBoundingClientRect())};}finally{range.detach();}
    });
    const overlaps=(r:{left:number;top:number;right:number;bottom:number})=>r.right>r.left&&r.bottom>r.top&&r.right>oracle.clip.left&&r.left<oracle.clip.right&&r.bottom>oracle.clip.top&&r.top<oracle.clip.bottom;
    expect(oracle.nodeCount).toBe(1);expect(oracle.nodeLength).toBe(16384);expect(oracle.glyphs.some(overlaps)).toBe(true);expect(overlaps(oracle.envelope)).toBe(true);
    const facts=await page.evaluate(async()=>{const w=window as Window&Partial<NativePageWindow>;w.rangeEvidence={envelopes:0,glyphQueries:0,fragments:0,queries:[]};w.countOwnedRanges=true;try{return {sample:await w.comparisonCapture!.readScrollFresh({notBeforePageMs:null}),ranges:w.rangeEvidence,instrumentation:w.comparisonCapture!.readInstrumentation()};}finally{w.countOwnedRanges=false;}});
    console.info('G04 actual interior geometry',JSON.stringify({oracle,...facts}));
    expect(facts.sample).toMatchObject({status:'available',value:{activeVisible:true,geometry:{status:'available'}}});
    if(facts.sample.status==='available'&&facts.sample.value.geometry.status==='available')expect(facts.sample.value.geometry.value.contentRects.some(overlaps)).toBe(true);
    expect(facts.ranges.glyphQueries).toBeGreaterThan(0);expect(facts.ranges.fragments).toBeGreaterThan(0);expect(facts.ranges.envelopes*2+facts.ranges.glyphQueries+facts.ranges.fragments).toBeLessThanOrEqual(2048);expect(facts.ranges.queries.every(row=>Number.isFinite(row.durationMs)&&row.durationMs>=0)).toBe(true);
  });
},30000);
