/** Synchronous test-harness observations only. No cleanup action, Promise, timer or I/O on import. */
export const TEARDOWN_DIAGNOSTIC_PREFIX='comparison-load-teardown: ';
export interface TeardownObserverOptions {labels:()=>{taskId:unknown;testName:unknown};initialOwnedCount?:()=>number;now:()=>number;log:(line:string)=>void}
export interface TeardownObserver {restoreStarted():void;restoreReturned():void;restoreThrown():void;batch(count:()=>number):void;rmStarted(path:()=>string):void;rmReturned():void;rmThrown():void;summary(outcome:'returned'|'thrown'):void}
export function createComparisonLoadTeardownObserver(options:TeardownObserverOptions):TeardownObserver {
 let diagnosticErrorCount=0,ordinaryAttempts=0,ordinaryRetained=0,ordinaryDropped=0,labelsTruncated=false,summaryAttempted=false;
 let taskId:string|null=null,testName:string|null=null,ownedCount:number|null=null;
 let restoreOutcome:'not-started'|'pending'|'returned'|'thrown'='not-started',restorePending=false,removePending=false;
 let removalsStarted=0,removalsReturned=0,removalsThrown=0,restoreStart:number|null=null,removeStart:number|null=null,pathLabel:string|null=null;
 function label(value:unknown):string|null {if(typeof value!=='string')return null;if(value.length>64)labelsTruncated=true;return value.slice(0,64);}
 try {const values=options.labels();taskId=label(values.taskId);testName=label(values.testName);}catch {diagnosticErrorCount++;}
 function readCount(count:()=>number):void {try {const value=count();if(Number.isSafeInteger(value)&&value>=0)ownedCount=value;else diagnosticErrorCount++;}catch {diagnosticErrorCount++;}}
 try {const initial=options.initialOwnedCount;if(initial!==undefined)readCount(initial);}catch {diagnosticErrorCount++;}
 function clock():number|null {try {const value=options.now();if(Number.isFinite(value)&&value>=0)return value;}catch { /* Original cleanup does not depend on the clock. */ }diagnosticErrorCount++;return null;}
 const anchor=clock();
 function duration(now:number|null,start:number|null):number|null {if(now===null||start===null)return null;const elapsed=now-start;if(Number.isFinite(elapsed)&&elapsed>=0)return elapsed;diagnosticErrorCount++;return null;}
 function safely(action:()=>void):void {try {action();}catch {diagnosticErrorCount++;}}
 function serialize(record:object):string|null {try {const line=TEARDOWN_DIAGNOSTIC_PREFIX+JSON.stringify(record);if(Buffer.byteLength(line+'\n')<=512)return line;}catch {diagnosticErrorCount++;}return null;}
 function log(line:string):boolean {try {options.log(line);return true;}catch {diagnosticErrorCount++;return false;}}
 function remaining():number|null {return ownedCount===null?null:Math.max(0,ownedCount-removalsReturned-removalsThrown);}
 function event(phase:string,start:number|null=null):number|null {
  const now=clock();ordinaryAttempts++;
  if(ordinaryAttempts>12){ordinaryDropped++;return now;}
  const line=serialize({phase,taskId,testName,ownedCount,index:removalsStarted===0?null:removalsStarted-1,pathLabel,remaining:remaining(),timestampMs:now,elapsedMs:duration(now,anchor),phaseDurationMs:duration(now,start),diagnosticErrorCount,labelsTruncated});
  // This counts synchronous logger callback returns, never stdout/file retention or physical cleanup proof.
  if(line!==null&&log(line))ordinaryRetained++;else ordinaryDropped++;
  return now;
 }
 return {
  restoreStarted():void {safely(()=>{restoreOutcome='pending';restorePending=true;restoreStart=event('restore-start');});},
  restoreReturned():void {safely(()=>{restoreOutcome='returned';restorePending=false;event('restore-returned',restoreStart);});},
  restoreThrown():void {safely(()=>{restoreOutcome='thrown';restorePending=false;event('restore-thrown',restoreStart);});},
  batch(count):void {safely(()=>{readCount(count);event('batch');});},
  rmStarted(path):void {safely(()=>{removePending=true;removalsStarted++;pathLabel=null;try {const value=path();if(typeof value==='string'){if(value.length>64)labelsTruncated=true;pathLabel=label(value.slice(-64).split('/').at(-1));}}catch {diagnosticErrorCount++;}removeStart=event('rm-start');});},
  rmReturned():void {safely(()=>{removePending=false;removalsReturned++;event('rm-returned',removeStart);});},
  rmThrown():void {safely(()=>{removePending=false;removalsThrown++;event('rm-thrown',removeStart);});},
  summary(outcome):void {safely(()=>{
   if(summaryAttempted)return;
   if(restorePending||removePending||outcome==='returned'&&ownedCount!==null&&remaining()!==0){diagnosticErrorCount++;return;}
   summaryAttempted=true;const now=clock();
   const facts={phase:'summary',outcome,restoreOutcome,ownedCount,removalsStarted,removalsReturned,removalsThrown,elapsedMs:duration(now,anchor),ordinaryAttempts,ordinaryRetained,ordinaryDropped,diagnosticErrorCount,diagnosticTruncated:labelsTruncated||ordinaryDropped>0};
   let line=serialize({...facts,taskId,testName});
   if(line===null)line=serialize({...facts,labelsOmitted:true,diagnosticTruncated:true});
   if(line===null)line=TEARDOWN_DIAGNOSTIC_PREFIX+'{"phase":"summary","outcome":"'+(outcome==='returned'?'returned':'thrown')+'","diagnosticState":"metadata-unavailable","diagnosticTruncated":true}';
   log(line);
  });},
 };
}
