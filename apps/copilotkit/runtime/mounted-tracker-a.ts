/** Finite supplied-port pilot; importing this module starts no native work. */
import {checkJourney,type MountedCaseOwner} from './mounted-conformance.ts';
import {evaluateMountedClosurePolicy,type CaseRecord} from '../../../tests/support/hosted-copilot-mounted-policy.ts';
import {evaluateMountedGeometry,evaluateHistoricalAnchor,type MountedGeometryInput,type HistoricalAnchorEvaluation} from '../src/geometry-policy.ts';
import type {GeometrySnapshot} from '../src/geometry.ts';
import type {createMountedTrackerATrace,TrackerAOriginal,TrackerAProfileRef} from './mounted-tracker-a-trace.ts';
type Trace=ReturnType<typeof createMountedTrackerATrace>;
type Original={status:TrackerAOriginal;startedHostMs:number|null;settledHostMs:number|null};
type ListenerOriginal={status:TrackerAOriginal;requestedHostMs:number|null;settledHostMs:number|null};
type ListenerFact={registration:ListenerOriginal;removal:ListenerOriginal;ownedIdentityMatch:boolean|null};
const listenerNames=['wheel','scroll','animationstart','transitionrun','navigation','contextClose','pageClose'] as const;
type ListenerName=typeof listenerNames[number];
export interface TrackerAScalar {pageNowMs:number;url:string;sameOriginalScroller:boolean;connected:boolean;uniqueSelector:boolean;innerWidth:number;innerHeight:number;devicePixelRatio:number;rect:{x:number;y:number;width:number;height:number};scrollTop:number;scrollHeight:number;clientHeight:number}
export interface TrackerAEntrySample {scalar:TrackerAScalar;active:boolean;prefixLength:number;returnControlVisible:boolean}
type EntryRow=Original&{value:TrackerAEntrySample|null};
export interface TrackerAHistoryOwner {
 /** Original owned topology, without a full collector or one of the82 scalars. */
 baseline:unknown;seed():Promise<void>;restore():Promise<GeometrySnapshot>;acquireTrace():Promise<Trace>;
 listeners:Record<ListenerName,{install():Promise<boolean>;remove():Promise<boolean>}>;
 startContinuation():Promise<void>;waitActivePrefix():Promise<unknown>;geometry():Promise<GeometrySnapshot>;
 movePointer(x:number,y:number):Promise<void>;entrySample():Promise<unknown>;scalar():Promise<unknown>;wheel(x:0,y:-600|-12):Promise<void>;
 returnToResponse():Promise<void>;
 /** Original canonical EOF/public-idle validation and G4, before disposal. */
 complete():Promise<GeometrySnapshot>;close():Promise<CaseRecord>;observations():unknown|Promise<unknown>;
}
export interface TrackerASequencerPorts {
 profileRef:TrackerAProfileRef;
 clock:{now():number;deadlineHostMs:number;alarm(atHostMs:number,fire:()=>void):()=>void;waitUntil(atHostMs:number):Promise<void>};
 connect():Promise<void>;openFollow():Promise<MountedCaseOwner>;openHistory():Promise<TrackerAHistoryOwner>;closeClient():Promise<void>;
}
type ScalarRow={ordinal:number;role:'pre'|'before'|'after'|'post';slot:number|null;requestedHostMs:number;settledHostMs:number|null;status:TrackerAOriginal;value:TrackerAScalar|null};
type WheelRow={slot:number;nominalHostMs:number;requestedHostMs:number;settledHostMs:number|null;status:TrackerAOriginal;beforeOrdinal:number;afterOrdinal:number|null};
type Checkpoint={status:TrackerAOriginal;requestedHostMs:number|null;settledHostMs:number|null;snapshotRef:{path:'native-case-2.json';index:number}|null};
type WheelEvent={ordinal:number;receivedHostMs:number;pageNowMs:number;eventTimeStampMs:number;isTrusted:boolean;deltaX:number;deltaY:number;deltaMode:number;targetContained:boolean;currentTargetIsScroller:boolean};
type ScrollEvent={ordinal:number;receivedHostMs:number;pageNowMs:number;eventTimeStampMs:number;currentTargetIsScroller:boolean;scrollTop:number;scrollHeight:number;clientHeight:number};
type MotionEvent={ordinal:number;kind:'animationstart'|'transitionrun';receivedHostMs:number;pageNowMs:number;eventTimeStampMs:number;targetContained:boolean};
type Loss={firstHostMs:number;firstOverflowHostMs:number|null};type Overflow={firstHostMs:number;ordinal:number};
type Observations={wheelEvents:WheelEvent[];scrollEvents:ScrollEvent[];motionEvents:MotionEvent[];losses:Record<'navigation'|'context'|'page'|'session',Loss|null>;overflows:Record<'wheel'|'scroll'|'motion',Overflow|null>};
const authority=()=>({qualification:false as const,fps:'unavailable' as const,ratio:'unavailable' as const,scoring:false as const,ranking:false as const});
export interface TrackerAInput extends Observations {
 schemaVersion:1;kind:'tracker-a-case-input';mode:'tracker-json-a-pilot-v2';caseNumber:2;profileRef:TrackerAProfileRef;
 entry:{before:EntryRow;wheel:Original;afterWait:Original;after:EntryRow;settledWait:Original;settled:EntryRow};
 phase:{hostT0Ms:number|null;hostT1Ms:number|null;postBoundaryScalarOrdinal:number|null;postBoundarySettled:TrackerAOriginal;returnClick:Original;captureTail:Original&{targetHostMs:number|null};completion:Original;tail:Original};
 geometryCheckpoints:Record<'G0'|'G1'|'G2'|'G3'|'G4',Checkpoint>;
 anchor:{id:string;ownerToken:number;selectedAtHostMs:number;firstCheckpoint:'G1';secondCheckpoint:'G2';evaluation:HistoricalAnchorEvaluation|null}|null;
 listeners:Record<ListenerName,ListenerFact>;
 pointer:{requestedHostMs:number;settledHostMs:number|null;status:TrackerAOriginal;x:number;y:number}|null;
 scalarObservations:ScalarRow[];wheelRequests:WheelRow[];
 outcome:{phase:{status:'not-started'|'incomplete'|'complete';reason:null|'phase'};competingMotion:'unavailable';scenarioQualification:'unavailable'};authority:ReturnType<typeof authority>;
}
export type TrackerAFirstFailure=Readonly<{code:'unclassified'|'baseline'|'timestamp-reverse'|'opposing-offset'|'end-stop';ordinal:number|null;previousOrdinal:number|null;slot:number|null}>;
export interface TrackerASequencerResult {status:'complete'|'incomplete';cases:CaseRecord[];caseEvidence:CaseRecord[];snapshots:{caseNumber:1|2;snapshot:GeometrySnapshot}[];input:TrackerAInput|null;transport:ReturnType<Trace['snapshot']>|null;/** Private original receipt; never serialized into the V3 input/artifacts. */inputDrain:ListenerOriginal;hasPrimary:boolean;primary:unknown;firstFailure:TrackerAFirstFailure|null;cleanupFailures:unknown[];authority:ReturnType<typeof authority>}
function data(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(typeof value!=='object'||value===null||Array.isArray(value)||(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null))throw Error('Invalid owned data');
 const names=Reflect.ownKeys(value);if(names.length!==keys.length||names.some(k=>typeof k!=='string'||!keys.includes(k)))throw Error('Invalid owned keys');
 const result:Record<string,unknown>={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!('value'in d))throw Error('Own data required');result[key]=d.value;}return result;
}
function finite(value:unknown):number{if(typeof value!=='number'||!Number.isFinite(value))throw Error('Nonfinite scalar');return value;}
function text(value:unknown,cap:number):string{
 if(typeof value!=='string'||value.length>cap)throw Error('Bounded text required');
 for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))throw Error('Invalid Unicode');}else if(c>=0xdc00&&c<=0xdfff)throw Error('Invalid Unicode');}
 if(new TextEncoder().encode(value).length>cap)throw Error('UTF8 text capacity');return value;
}
function scalar(value:unknown):TrackerAScalar{
 const r=data(value,['pageNowMs','url','sameOriginalScroller','connected','uniqueSelector','innerWidth','innerHeight','devicePixelRatio','rect','scrollTop','scrollHeight','clientHeight']);
 const rect=data(r.rect,['x','y','width','height']);for(const k of ['x','y','width','height'])finite(rect[k]);
 for(const k of ['pageNowMs','innerWidth','innerHeight','devicePixelRatio','scrollTop','scrollHeight','clientHeight'])finite(r[k]);
 for(const k of ['sameOriginalScroller','connected','uniqueSelector'])if(typeof r[k]!=='boolean')throw Error('Invalid identity fact');
 const url=text(r.url,4096),x=rect.x as number,y=rect.y as number,width=rect.width as number,height=rect.height as number;
 const scrollTop=r.scrollTop as number,scrollHeight=r.scrollHeight as number,clientHeight=r.clientHeight as number;
 if(width<0||height<0||scrollHeight<0||clientHeight<=0||scrollHeight<clientHeight||scrollTop<0||scrollTop>scrollHeight-clientHeight)throw Error('Invalid scalar range');
 return {...r,url,rect:{x,y,width,height}} as unknown as TrackerAScalar;
}
function entrySample(value:unknown):TrackerAEntrySample{
 const r=data(value,['scalar','active','prefixLength','returnControlVisible']);
 return {scalar:scalar(r.scalar),active:boolean(r.active),prefixLength:integer(r.prefixLength,0,6400),returnControlVisible:boolean(r.returnControlVisible)};
}
function frame(snapshot:GeometrySnapshot,phase:MountedGeometryInput['phase']):MountedGeometryInput{
 if(snapshot.status!=='available')throw Error('Geometry unavailable');const f=snapshot.frame,e=evaluateMountedGeometry(f);
 if(e.status!=='evaluated'||f.phase!==phase||!e.rows.some(r=>r.geometryEligibility==='eligible')||e.rows.some(r=>r.presence!=='unmounted'&&r.geometryEligibility!=='eligible'&&r.reason!=='fully-clipped'))throw Error('Geometry invalid');return f;
}
function responseVisible(f:MountedGeometryInput,final=false){if(!evaluateMountedGeometry(f).rows.some(r=>r.id===f.expectedResponse.id&&r.geometryEligibility==='eligible'&&(!final||r.textRelation==='exact')))throw Error('Response not visible');}

/** Supplied data only; fixed pilot admission belongs before the native entry's
 * SDK import. No supplied prerequisite flag authorizes or qualifies this run. */
export async function runMountedTrackerA(ports:TrackerASequencerPorts):Promise<TrackerASequencerResult>{
 const cases:CaseRecord[]=[],caseEvidence:CaseRecord[]=[],snapshots:TrackerASequencerResult['snapshots']=[],cleanupFailures:unknown[]=[];
 const inputDrain:ListenerOriginal={status:'not-started',requestedHostMs:null,settledHostMs:null};
 let hasPrimary=false,primary:unknown,input:TrackerAInput|null=null,trace:Trace|null=null,transport:TrackerASequencerResult['transport']=null,connected=false,lastNow=-Infinity;
 let traceFinish:Promise<void>|null=null;
 const finishTrace=()=>{if(traceFinish===null){try{traceFinish=trace!.finish();}catch(error){traceFinish=Promise.reject(error);}}return traceFinish;};
 let clockInvalid=false,clockFailure:unknown;
 let firstFailure:TrackerAFirstFailure|null=null;
 const remember=(error:unknown,witness:TrackerAFirstFailure={code:'unclassified',ordinal:null,previousOrdinal:null,slot:null})=>{if(!hasPrimary){hasPrimary=true;primary=error;firstFailure=Object.freeze({...witness});}};
 const scalarFailure=(code:Exclude<TrackerAFirstFailure['code'],'unclassified'>,message:string,row:ScalarRow|null=null,previousOrdinal:number|null=null):never=>{const error=Error(message);remember(error,{code,ordinal:row?.ordinal??null,previousOrdinal,slot:row?.slot??null});throw error;};
 const now=()=>{
  if(clockInvalid)throw clockFailure;
  try{
   const n=finite(ports.clock.now());
   if(n<lastNow)throw Error('Host clock reversed');
   lastNow=n;return n;
  }catch(error){
   clockInvalid=true;clockFailure=error;
   if(input)input.outcome.phase={status:'incomplete',reason:'phase'};
   throw error;
  }
 };
 const deadline=ports.clock.deadlineHostMs;
 function bounded<T>(work:Promise<T>,requestedLimit=deadline):Promise<T>{const limit=Math.min(requestedLimit,deadline);return new Promise((resolve,reject)=>{
  let done=false,cancel=()=>{};
  const fail=()=>{if(!done){done=true;reject(Error('Original settlement boundary exceeded'));}};
  void work.then(value=>{
   if(done)return;
   try{
    if(now()>=limit){fail();return;}
    done=true;cancel();resolve(value);
   }catch(error){done=true;cancel();reject(error);}
  },error=>{if(done)return;done=true;cancel();reject(error);});
  try{if(now()>=limit)fail();else cancel=ports.clock.alarm(limit,fail);}catch(e){done=true;reject(e);}
 });}
 function check(limit=deadline){const at=now();if(at>=limit)throw Error('Original deadline unavailable');return at;}
 function dispatch<T>(call:()=>Promise<T>):Promise<T>{check();let work:Promise<T>;try{work=Promise.resolve(call());}catch(e){work=Promise.reject(e);}return bounded(work);}
 function invoke<T>(call:()=>Promise<T>,row:{status:TrackerAOriginal;settledHostMs:number|null;requestedHostMs?:number|null;startedHostMs?:number|null},limit=deadline){
  const at=check(Math.min(limit,deadline));
  if('requestedHostMs'in row)row.requestedHostMs=at;
  if('startedHostMs'in row)row.startedHostMs=at;
  row.status='pending';let original:Promise<T>;try{original=Promise.resolve(call());}catch(e){original=Promise.reject(e);}
  const settled=()=>{if(input?.scalarObservations.some(s=>s===row&&s.role==='post'))input.phase.postBoundarySettled=row.status;};
  const observed=original.then(value=>{
   row.status='fulfilled';
   try{row.settledHostMs=now();}catch(error){remember(error);}
   // Preserve the actual fulfilled value for its independent bounded copier,
   // even when timing qualification has permanently refused further work.
   settled();return value;
  },error=>{
   // The original rejection is known before its optional receipt-clock read.
   // A failed clock observation must not replace null/undefined originals.
   row.status='rejected';remember(error);
   try{row.settledHostMs=now();}
   catch{if(input)input.outcome.phase={status:'incomplete',reason:'phase'};}
   settled();throw error;
  });
  return {original:observed,wait:bounded(observed,limit)};
 }
 const original=():Original=>({status:'not-started',startedHostMs:null,settledHostMs:null});
 const wait=async(at:number)=>{if(!Number.isFinite(at)||at>=deadline)throw Error('Original deadline unavailable');await dispatch(()=>ports.clock.waitUntil(at));if(now()<at)throw Error('Early host wake');};
 async function close(owner:{close():Promise<CaseRecord>},n:1|2,caseSnapshots:GeometrySnapshot[],semantic=true){
  const current=await dispatch(()=>owner.close());caseEvidence.push(current);
  if(current.caseNumber!==n||current.journey!==(n===1?'follow':'history-reading')||caseSnapshots.some(s=>s.status!=='available'||s.frame.scopeId!==current.threadId)||evaluateMountedClosurePolicy({schemaVersion:1,kind:'case-boundary',priorCase:n===1?null:cases[0],currentCase:current,secondStarted:n===2}).status!=='accepted')throw Error('Original case boundary incomplete');if(semantic)cases.push(current);
 }
 try{
  finite(deadline);now();const p=data(ports.profileRef,['path','bytes','sha256']);if(p.path!=='tracker-a-profile.json'||!Number.isSafeInteger(p.bytes)||typeof p.bytes!=='number'||p.bytes<0||p.bytes>16384||typeof p.sha256!=='string'||!/^[0-9a-f]{64}$/.test(p.sha256))throw Error('Invalid profile reference');
  check();connected=true;await dispatch(()=>ports.connect());
  let follow:MountedCaseOwner|undefined,followClosed=false;const firstSnapshots:GeometrySnapshot[]=[];
  try{
   const f=await dispatch(()=>ports.openFollow());follow=f;
   await dispatch(()=>f.seed());
   const restored=await dispatch(()=>f.restore());
   firstSnapshots.push(restored);frame(restored,'restored-history');
   await dispatch(()=>f.startContinuation());
   const observations=await dispatch(()=>f.exercise('follow'));
   checkJourney('follow',observations);firstSnapshots.push(...observations.samples);
   const completed=await dispatch(()=>f.complete());
   firstSnapshots.push(completed);responseVisible(frame(completed,'completed'),true);
   followClosed=true;await close(f,1,firstSnapshots);
  }catch(error){remember(error);throw error;}
  finally{
   snapshots.push(...firstSnapshots.map(snapshot=>({caseNumber:1 as const,snapshot})));
   if(follow&&!followClosed){followClosed=true;try{await close(follow,1,firstSnapshots,false);}catch(error){cleanupFailures.push(error);}}
  }
  let owner:TrackerAHistoryOwner|undefined,closed=false,semanticComplete=false,inputAcquired=false;const secondSnapshots:GeometrySnapshot[]=[];
  try{
   const h=await dispatch(()=>ports.openHistory());owner=h;
   const checkpoint=():Checkpoint=>({status:'not-started',requestedHostMs:null,settledHostMs:null,snapshotRef:null});
   const listener=():ListenerFact=>({registration:{status:'not-started',requestedHostMs:null,settledHostMs:null},removal:{status:'not-started',requestedHostMs:null,settledHostMs:null},ownedIdentityMatch:null});
   input={schemaVersion:1,kind:'tracker-a-case-input',mode:'tracker-json-a-pilot-v2',caseNumber:2,profileRef:{path:'tracker-a-profile.json',bytes:p.bytes,sha256:p.sha256},entry:{before:{...original(),value:null},wheel:original(),afterWait:original(),after:{...original(),value:null},settledWait:original(),settled:{...original(),value:null}},phase:{hostT0Ms:null,hostT1Ms:null,postBoundaryScalarOrdinal:null,postBoundarySettled:'not-started',returnClick:original(),captureTail:{...original(),targetHostMs:null},completion:original(),tail:original()},geometryCheckpoints:{G0:checkpoint(),G1:checkpoint(),G2:checkpoint(),G3:checkpoint(),G4:checkpoint()},anchor:null,listeners:{wheel:listener(),scroll:listener(),animationstart:listener(),transitionrun:listener(),navigation:listener(),contextClose:listener(),pageClose:listener()},pointer:null,scalarObservations:[],wheelRequests:[],wheelEvents:[],scrollEvents:[],motionEvents:[],losses:{navigation:null,context:null,page:null,session:null},overflows:{wheel:null,scroll:null,motion:null},outcome:{phase:{status:'not-started',reason:null},competingMotion:'unavailable',scenarioQualification:'unavailable'},authority:authority()};const current=input;
   async function geometry(name:keyof TrackerAInput['geometryCheckpoints'],call:()=>Promise<GeometrySnapshot>,phase:MountedGeometryInput['phase']){
    check();const row=current.geometryCheckpoints[name];
    if(row.status!=='not-started')throw Error('Checkpoint already charged');
    const shot=await invoke(call,row).wait;
    const index=secondSnapshots.length;
    secondSnapshots.push(shot);row.snapshotRef={path:'native-case-2.json',index};
    return frame(shot,phase);
   }
   await dispatch(()=>h.seed());await geometry('G0',()=>h.restore(),'restored-history');const baseline=scalar(h.baseline);
   const guard=(s:TrackerAScalar,row:ScalarRow|null=null,previousOrdinal:number|null=null)=>{if(!s.sameOriginalScroller||!s.connected||!s.uniqueSelector||s.innerWidth!==1280||s.innerHeight!==800||s.devicePixelRatio!==1||s.url!==baseline.url||Object.keys(s.rect).some(k=>s.rect[k as keyof typeof s.rect]!==baseline.rect[k as keyof typeof baseline.rect]))scalarFailure('baseline','Original scalar baseline changed',row,previousOrdinal);};
   guard(baseline);if(baseline.rect.width<=0||baseline.rect.height<=0||baseline.rect.x<0||baseline.rect.y<0||baseline.rect.x+baseline.rect.width>1280||baseline.rect.y+baseline.rect.height>800)throw Error('Pointer outside original viewport');
   trace=await dispatch(()=>h.acquireTrace());
   for(const name of listenerNames){
    check();const fact=current.listeners[name];
    const match=await invoke(()=>owner!.listeners[name].install(),fact.registration).wait;
    fact.ownedIdentityMatch=match===true;
    if(match!==true)throw Error('Listener ownership mismatch');
   }
   await dispatch(()=>h.startContinuation());
   const progress=data(await dispatch(()=>h.waitActivePrefix()),['active','prefixLength']);
   if(progress.active!==true||typeof progress.prefixLength!=='number'||!Number.isSafeInteger(progress.prefixLength)||progress.prefixLength<=0||progress.prefixLength>6400)throw Error('No original public advancement');
   const pointer={requestedHostMs:now(),settledHostMs:null as number|null,status:'not-started' as TrackerAOriginal,x:baseline.rect.x+baseline.rect.width/2,y:baseline.rect.y+baseline.rect.height/2};
   await invoke(()=>{current.pointer=pointer;return owner!.movePointer(pointer.x,pointer.y);},pointer).wait;
   async function sampleEntry(row:EntryRow,limit=deadline){
    const op=invoke(()=>owner!.entrySample(),row,limit);
    const retained=op.original.then(value=>{row.value=entrySample(value);return row.value;});
    void retained.catch(()=>{});void op.wait.catch(()=>{});
    const s=await bounded(retained,limit);guard(s.scalar);
    if(!s.active||s.prefixLength<=0)throw Error('Inactive original entry');return s;
   }
   const entryBefore=await sampleEntry(current.entry.before);
   await invoke(()=>owner!.wheel(0,-600),current.entry.wheel).wait;
   const entryAt=current.entry.wheel.settledHostMs!;
   const entryWait=(row:Original,target:number,upper:number)=>invoke(async()=>{await wait(target);if(now()>=upper)throw Error('Late entry wake');},row,upper).wait;
   await entryWait(current.entry.afterWait,entryAt+100,entryAt+200);
   const entryAfter=await sampleEntry(current.entry.after,entryAt+200);
   await entryWait(current.entry.settledWait,entryAt+200,entryAt+300);
   const entrySettled=await sampleEntry(current.entry.settled,entryAt+300);
   if(entryBefore.scalar.pageNowMs>=entryAfter.scalar.pageNowMs||entryAfter.scalar.pageNowMs>=entrySettled.scalar.pageNowMs||entrySettled.scalar.pageNowMs-entryAfter.scalar.pageNowMs<50||entryAfter.scalar.scrollTop>=entryBefore.scalar.scrollTop||entrySettled.scalar.scrollTop!==entryAfter.scalar.scrollTop||entryAfter.prefixLength<=entryBefore.prefixLength||entrySettled.prefixLength<=entryAfter.prefixLength||!entryAfter.returnControlVisible||!entrySettled.returnControlVisible||entrySettled.scalar.scrollHeight-entrySettled.scalar.clientHeight-entrySettled.scalar.scrollTop<entrySettled.scalar.clientHeight/2)throw Error('Original history entry unsettled');
   check();await trace.start();await wait(now()+500);
   const first=await geometry('G1',()=>owner!.geometry(),'streaming');
   if(!first.responseProgress.active||first.responseProgress.prefix.length===0)throw Error('Inactive original streaming');
   const anchor=evaluateMountedGeometry(first).rows.find(r=>r.id!==first.expectedResponse.id&&r.geometryEligibility==='eligible');
   if(!anchor||anchor.ownerToken===null)throw Error('Historical anchor unavailable');
   current.anchor={id:anchor.id,ownerToken:anchor.ownerToken,selectedAtHostMs:now(),firstCheckpoint:'G1',secondCheckpoint:'G2',evaluation:null};
   let priorScalar:TrackerAScalar|null=null,priorScalarOrdinal:number|null=null;
   function observe(role:ScalarRow['role'],slot:number|null,limit=deadline){
    check(Math.min(limit,deadline));if(current.scalarObservations.length>=82)throw Error('Scalar capacity');
    const row:ScalarRow={ordinal:current.scalarObservations.length+1,role,slot,requestedHostMs:now(),settledHostMs:null,status:'not-started',value:null};
    const op=invoke(()=>{
     current.scalarObservations.push(row);
     if(role==='post'){current.phase.postBoundaryScalarOrdinal=row.ordinal;current.phase.postBoundarySettled='pending';}
     return owner!.scalar();
    },row,limit);
    const retained=op.original.then(value=>{row.value=scalar(value);return row.value;});
    void retained.catch(()=>{});void op.wait.catch(()=>{});
    const checked=async()=>{const s=await bounded(retained,limit);guard(s,row,priorScalarOrdinal);if(priorScalar!==null){if(s.pageNowMs<priorScalar.pageNowMs)scalarFailure('timestamp-reverse','Opposing or reversed scalar',row,priorScalarOrdinal);if(s.scrollTop>priorScalar.scrollTop)scalarFailure('opposing-offset','Opposing or reversed scalar',row,priorScalarOrdinal);}if(role!=='pre'&&s.scrollTop===0)scalarFailure('end-stop','Observed end stop',row,priorScalarOrdinal);priorScalar=s;priorScalarOrdinal=row.ordinal;return s;};return {row,original:retained,wait:checked()};
   }
   const pre=await observe('pre',null).wait;
   if(pre.pageNowMs<entrySettled.scalar.pageNowMs||pre.scrollHeight-pre.clientHeight-pre.scrollTop<pre.clientHeight/2)throw Error('Original history detached pre unavailable');
   const t0=now(),t1=t0+2000;current.phase.hostT0Ms=t0;current.phase.hostT1Ms=t1;current.phase.captureTail.targetHostMs=t1+2000;current.outcome.phase={status:'incomplete',reason:'phase'};
   let slotFailure=false,pending:Promise<unknown>|null=null;
   try{
    for(let slot=0;slot<40;slot++){
     const lower=t0+50*slot,upper=lower+50;
     await wait(lower);
     if(now()<lower||now()>=upper)throw Error('Missed absolute slot');
     const before=observe('before',slot,upper);
     pending=before.original;await before.wait;pending=null;
     if(now()>=upper)throw Error('Before outside slot');
     const row:WheelRow={slot,nominalHostMs:lower,requestedHostMs:now(),settledHostMs:null,status:'not-started',beforeOrdinal:before.row.ordinal,afterOrdinal:null};
     const wheel=invoke(()=>{current.wheelRequests.push(row);return owner!.wheel(0,-12);},row,upper);
     pending=wheel.original;await wheel.wait;pending=null;
     if(now()>=upper)throw Error('Wheel outside slot');
     const after=observe('after',slot,upper);row.afterOrdinal=after.row.ordinal;
     pending=after.original;await after.wait;pending=null;
    }
   }catch(error){slotFailure=true;remember(error);}
   // Keep t1 fixed after an early failure. A pending original is still owned,
   // and post is forbidden until its actual outcome is safely accounted for.
   await wait(t1);
   if(pending!==null){
    try{await bounded(pending);}
    catch(error){
     remember(error);
     if(current.scalarObservations.some(row=>row.status==='pending')||current.wheelRequests.some(row=>row.status==='pending'))throw error;
    }
   }
   const post=observe('post',null);
   try{const s=await post.wait;if(s.scrollTop>=pre.scrollTop)throw Error('No net upward movement');}
   finally{current.phase.postBoundarySettled=post.row.status;}
   const second=await geometry('G2',()=>owner!.geometry(),'streaming');
   current.anchor.evaluation=evaluateHistoricalAnchor({schemaVersion:1,anchorId:current.anchor.id,first,second});
   if(current.anchor.evaluation.status!=='accepted')throw Error('Historical comparison unavailable');
   await invoke(()=>owner!.returnToResponse(),current.phase.returnClick).wait;
   responseVisible(await geometry('G3',()=>owner!.geometry(),'streaming'));
   const captureTarget=current.phase.captureTail.targetHostMs!;
   await invoke(async()=>{await wait(captureTarget);if(now()>=captureTarget+50)throw Error('Late capture wake');},current.phase.captureTail,captureTarget+50).wait;
   check(captureTarget+50);await finishTrace();
   const finalFrame=await geometry('G4',()=>{
    const completion=invoke(()=>owner!.complete(),current.phase.completion);
    void completion.wait.catch(()=>{});
    return completion.original;
   },'completed');
   responseVisible(finalFrame,true);semanticComplete=true;
   await invoke(()=>wait(current.phase.tail.startedHostMs!+2000),current.phase.tail).wait;
   if(!slotFailure)current.outcome.phase={status:'complete',reason:null};
  }catch(e){remember(e);}finally{
   if(trace){try{await finishTrace();}catch(e){remember(e);cleanupFailures.push(e);}try{transport=trace.snapshot();if(transport.outcome.capture.status!=='complete'||transport.outcome.containment!=='verified')remember(Error('Trace closure incomplete'));}catch(e){remember(e);}}
   if(owner&&input){
    for(const name of listenerNames){
     const fact=input.listeners[name];
     if(fact.registration.status==='not-started')continue;
     try{
      check();const match=await invoke(()=>owner!.listeners[name].remove(),fact.removal).wait;
      if(match!==true){fact.ownedIdentityMatch=false;throw Error('Listener removal identity mismatch');}
     }catch(error){
      remember(error);cleanupFailures.push(error);
      input.outcome.phase={status:'incomplete',reason:'phase'};
     }
    }
    try{
     // One separately owned drain follows every listener removal attempt.
     // Await the actual drain, including its original rejection identity.
     if(inputDrain.status!=='not-started')throw Error('Original input drain already charged');
     const drain=invoke(()=>Promise.resolve(owner!.observations()),inputDrain);
     const drained=await drain.wait;
     Object.assign(input,copyObservations(drained));inputAcquired=true;
     checkObservations(input);
    }catch(error){remember(error);input.outcome.phase={status:'incomplete',reason:'phase'};}
    if(transport?.sessionClose.timing==='unexpected-loss'){
     const s=transport.sessionClose;
     input.losses.session=s.firstHostMs===null?null:{firstHostMs:s.firstHostMs,firstOverflowHostMs:s.overflowHostMs};
     input.outcome.phase={status:'incomplete',reason:'phase'};
    }
   }
   snapshots.push(...secondSnapshots.map(snapshot=>({caseNumber:2 as const,snapshot})));if(owner&&!closed){closed=true;try{await close(owner,2,secondSnapshots,semanticComplete&&inputAcquired);}catch(e){remember(e);cleanupFailures.push(e);}}
  }
 }catch(e){remember(e);}finally{if(connected)try{await dispatch(()=>ports.closeClient());}catch(e){if(!hasPrimary)remember(e);cleanupFailures.push(e);}}
 return {status:!hasPrimary&&cleanupFailures.length===0&&cases.length===2?'complete':'incomplete',cases,caseEvidence,snapshots,input,transport,inputDrain,hasPrimary,primary,firstFailure,cleanupFailures,authority:authority()};
}
function dense(value:unknown,cap:number):unknown[]{
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)throw Error('Dense population required');const d=Object.getOwnPropertyDescriptor(value,'length');if(!d||!('value'in d)||!Number.isSafeInteger(d.value)||d.value<0||d.value>cap)throw Error('Population capacity');
 if(Reflect.ownKeys(value).length!==d.value+1)throw Error('Dense population keys');const result:unknown[]=[];for(let i=0;i<d.value;i++){const row=Object.getOwnPropertyDescriptor(value,String(i));if(!row||!('value'in row))throw Error('Own population entry');result.push(row.value);}return result;
}
function integer(value:unknown,min:number,max=Number.MAX_SAFE_INTEGER):number{const n=finite(value);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('Invalid integer');return n;}
function boolean(value:unknown):boolean{if(typeof value!=='boolean')throw Error('Invalid boolean');return value;}
function copyObservations(value:unknown):Observations {
 const r=data(value,['wheelEvents','scrollEvents','motionEvents','losses','overflows']);
 // All populations are preflighted before walking or copying any entry.
 const wheels=dense(r.wheelEvents,41),scrolls=dense(r.scrollEvents,256),motions=dense(r.motionEvents,32),loss=data(r.losses,['navigation','context','page','session']),over=data(r.overflows,['wheel','scroll','motion']);
 const base=(row:Record<string,unknown>)=>({ordinal:integer(row.ordinal,1),receivedHostMs:finite(row.receivedHostMs),pageNowMs:finite(row.pageNowMs),eventTimeStampMs:finite(row.eventTimeStampMs)});
 const wheelEvents=wheels.map(value=>{const row=data(value,['ordinal','receivedHostMs','pageNowMs','eventTimeStampMs','isTrusted','deltaX','deltaY','deltaMode','targetContained','currentTargetIsScroller']);return {...base(row),isTrusted:boolean(row.isTrusted),deltaX:finite(row.deltaX),deltaY:finite(row.deltaY),deltaMode:finite(row.deltaMode),targetContained:boolean(row.targetContained),currentTargetIsScroller:boolean(row.currentTargetIsScroller)};});
 const scrollEvents=scrolls.map(value=>{const row=data(value,['ordinal','receivedHostMs','pageNowMs','eventTimeStampMs','currentTargetIsScroller','scrollTop','scrollHeight','clientHeight']);const scrollTop=finite(row.scrollTop),scrollHeight=finite(row.scrollHeight),clientHeight=finite(row.clientHeight);if(clientHeight<=0||scrollHeight<clientHeight||scrollTop<0||scrollTop>scrollHeight-clientHeight)throw Error('Scroll event range');return {...base(row),currentTargetIsScroller:boolean(row.currentTargetIsScroller),scrollTop,scrollHeight,clientHeight};});
 const motionEvents=motions.map(value=>{const row=data(value,['ordinal','kind','receivedHostMs','pageNowMs','eventTimeStampMs','targetContained']);if(row.kind!=='animationstart'&&row.kind!=='transitionrun')throw Error('Motion kind');return {...base(row),kind:row.kind,targetContained:boolean(row.targetContained)};});
 const losses:Observations['losses']={navigation:null,context:null,page:null,session:null};for(const key of ['navigation','context','page','session'] as const){if(loss[key]===null)continue;const row=data(loss[key],['firstHostMs','firstOverflowHostMs']),firstHostMs=finite(row.firstHostMs),firstOverflowHostMs=row.firstOverflowHostMs===null?null:finite(row.firstOverflowHostMs);if(firstOverflowHostMs!==null&&firstOverflowHostMs<firstHostMs)throw Error('Reversed loss');losses[key]={firstHostMs,firstOverflowHostMs};}
 const overflows:Observations['overflows']={wheel:null,scroll:null,motion:null};for(const key of ['wheel','scroll','motion'] as const){if(over[key]===null)continue;const row=data(over[key],['firstHostMs','ordinal']);overflows[key]={firstHostMs:finite(row.firstHostMs),ordinal:integer(row.ordinal,key==='wheel'?42:key==='scroll'?257:33,key==='wheel'?42:key==='scroll'?257:33)};}
 return {wheelEvents,scrollEvents,motionEvents:motionEvents as MotionEvent[],losses,overflows};
}
function checkObservations(input:TrackerAInput):void {
 for(const population of [input.wheelEvents,input.scrollEvents,input.motionEvents]){let lastHost=-Infinity,lastPage=-Infinity,lastEvent=-Infinity;for(let i=0;i<population.length;i++){const row=population[i]!;if(row.ordinal!==i+1||row.eventTimeStampMs<0||row.eventTimeStampMs>row.pageNowMs||row.receivedHostMs<lastHost||row.pageNowMs<lastPage||row.eventTimeStampMs<lastEvent)throw Error('Observation ordering unavailable');lastHost=row.receivedHostMs;lastPage=row.pageNowMs;lastEvent=row.eventTimeStampMs;}}
 if(Object.values(input.losses).some(v=>v!==null)||Object.values(input.overflows).some(v=>v!==null)||input.wheelRequests.length!==40||input.wheelEvents.length!==41)throw Error('Observation coverage incomplete');
 if(input.wheelEvents.some((e,i)=>!e.isTrusted||e.deltaX!==0||e.deltaY!==(i===0?-600:-12)||e.deltaMode!==0||!e.targetContained||!e.currentTargetIsScroller))throw Error('Original trusted wheel facts unavailable');
 const preRows=input.scalarObservations.filter(r=>r.role==='pre'),postRows=input.scalarObservations.filter(r=>r.role==='post');
 const pre=preRows[0]?.value,post=postRows[0]?.value;
 if(preRows.length!==1||postRows.length!==1||!pre||!post||preRows[0]!.status!=='fulfilled'||postRows[0]!.status!=='fulfilled'||input.phase.postBoundaryScalarOrdinal!==postRows[0]!.ordinal||pre.pageNowMs>post.pageNowMs)throw Error('Original phase bracket unavailable');
 const inside=(at:number)=>at>=pre.pageNowMs&&at<=post.pageNowMs;
 const possibleInside=(event:{eventTimeStampMs:number;pageNowMs:number})=>event.eventTimeStampMs<=post.pageNowMs&&event.pageNowMs>=pre.pageNowMs;
 const before=input.entry.before.value?.scalar,after=input.entry.after.value?.scalar,entry=input.wheelEvents[0]!;
 if(!before||!after||entry.pageNowMs<before.pageNowMs||entry.pageNowMs>after.pageNowMs||entry.pageNowMs>=pre.pageNowMs)throw Error('Original entry wheel bracket unavailable');
 const brackets=input.wheelRequests.map((request,i)=>{
  const before=input.scalarObservations.find(row=>row.ordinal===request.beforeOrdinal),after=input.scalarObservations.find(row=>row.ordinal===request.afterOrdinal);
  if(request.slot!==i||request.status!=='fulfilled'||!before?.value||!after?.value||before.role!=='before'||after.role!=='after'||before.slot!==i||after.slot!==i||before.status!=='fulfilled'||after.status!=='fulfilled'||before.value.pageNowMs>after.value.pageNowMs)throw Error('Original slot bracket unavailable');
  return {before:before.value.pageNowMs,after:after.value.pageNowMs};
 });
 for(const [i,event] of input.wheelEvents.slice(1).entries()){
  const eligible=brackets.flatMap((b,slot)=>event.pageNowMs>=b.before&&event.pageNowMs<=b.after?[slot]:[]);
  if(!inside(event.pageNowMs)||eligible.length!==1||eligible[0]!==i)throw Error('Original wheel slot attribution unavailable');
 }
 let previous=pre.scrollTop;
 for(const event of input.scrollEvents){
  if(!event.currentTargetIsScroller)throw Error('Original scroll ownership unavailable');
  if(possibleInside(event)){if(event.scrollTop===0||event.scrollTop>previous)throw Error('Scroll direction unavailable');previous=event.scrollTop;}
 }
 if(input.motionEvents.some(e=>e.targetContained&&possibleInside(e)))throw Error('Competing motion observed');
}
