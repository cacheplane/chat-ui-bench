import {expect,test} from 'vitest';
import {createComparisonLoadTeardownObserver,TEARDOWN_DIAGNOSTIC_PREFIX} from './comparison-load-teardown.test-helper.js';

function harness(labels=()=>({taskId:'case-1',testName:'original case'})) {
 const lines:string[]=[];let time=10;
 const observer=createComparisonLoadTeardownObserver({labels,now:()=>time,log:line=>{lines.push(line);}});
 return {observer,lines,advance:(value:number)=>{time=value;},records:()=>lines.map(line=>JSON.parse(line.slice(TEARDOWN_DIAGNOSTIC_PREFIX.length)))};
}
test('synchronous notifications retain original restore/batch/remove order and durations',()=>{
 const h=harness();expect(h.observer.restoreStarted()).toBeUndefined();h.advance(11);h.observer.restoreReturned();h.observer.batch(()=>2);
 h.advance(12);h.observer.rmStarted(()=>'/owned/first');h.advance(15);h.observer.rmReturned();h.observer.rmStarted(()=>'/owned/second');h.advance(19);h.observer.rmReturned();h.observer.summary('returned');
 expect(h.records().map(row=>row.phase)).toEqual(['restore-start','restore-returned','batch','rm-start','rm-returned','rm-start','rm-returned','summary']);
 expect(h.records()[4]).toMatchObject({index:0,phaseDurationMs:3,remaining:1});expect(h.records()[6]).toMatchObject({index:1,phaseDurationMs:4,remaining:0});
 expect(h.records().at(-1)).toMatchObject({outcome:'returned',ownedCount:2,removalsReturned:2,elapsedMs:9});
});
test('held deferred event has no settlement or fabricated summary before original notification',async()=>{
 const h=harness();let release!:()=>void;const original=new Promise<void>(resolve=>{release=resolve;});h.observer.restoreStarted();h.observer.restoreReturned();h.observer.batch(()=>1);h.observer.rmStarted(()=>'/owned/held');
 h.observer.summary('returned');expect(h.records().some(row=>row.phase==='summary'||row.phase==='rm-returned')).toBe(false);
 h.advance(10025);release();await original;h.observer.rmReturned();h.observer.summary('returned');
 expect(h.records().at(-1)).toMatchObject({elapsedMs:10015,outcome:'returned'});expect(h.records().filter(row=>row.phase==='summary')).toHaveLength(1);
});
test('late events retain protected labels captured before external context changes',()=>{
 let labels={taskId:'first-id',testName:'first test'};const h=harness(()=>labels);h.observer.restoreStarted();h.observer.restoreReturned();h.observer.batch(()=>1);h.observer.rmStarted(()=>'/owned/held');labels={taskId:'next-id',testName:'next test'};h.observer.rmThrown();h.observer.summary('thrown');
 expect(h.records().every(row=>row.taskId==='first-id'&&row.testName==='first test')).toBe(true);
});
test('throwing label getter is protected during construction and notifications',()=>{
 const lines:string[]=[];const observer=createComparisonLoadTeardownObserver({labels(){throw new Error('label read');},now:()=>1,log:line=>{lines.push(line);}});
 expect(()=>{observer.restoreStarted();observer.restoreThrown();observer.summary('thrown');}).not.toThrow();expect(JSON.parse(lines.at(-1)!.slice(TEARDOWN_DIAGNOSTIC_PREFIX.length)).diagnosticErrorCount).toBeGreaterThan(0);
});
test('throwing task label properties never escape the protected getter zone',()=>{
 const labels={get taskId():string{throw new Error('task.id');},get testName():string{throw new Error('task.name');}};const h=harness(()=>labels);expect(()=>{h.observer.restoreStarted();h.observer.restoreReturned();h.observer.batch(()=>0);h.observer.summary('returned');}).not.toThrow();
 expect(h.records().at(-1)).toMatchObject({outcome:'returned',diagnosticErrorCount:1});
});
test('clock failures retain cleanup notifications without inventing a timing',()=>{
 const lines:string[]=[];const observer=createComparisonLoadTeardownObserver({labels:()=>({taskId:'id',testName:'name'}),now(){throw new Error('clock');},log:line=>{lines.push(line);}});
 expect(()=>{observer.restoreStarted();observer.restoreReturned();observer.batch(()=>1);observer.rmStarted(()=>'/owned/root');observer.rmReturned();observer.summary('returned');}).not.toThrow();
 expect(JSON.parse(lines.at(-1)!.slice(TEARDOWN_DIAGNOSTIC_PREFIX.length))).toMatchObject({elapsedMs:null,outcome:'returned',removalsReturned:1});
});
test('logger errors never throw into restore/remove error handling',()=>{
 const observer=createComparisonLoadTeardownObserver({labels:()=>({taskId:'id',testName:'name'}),now:()=>0,log(){throw undefined;}});
 expect(()=>{observer.restoreStarted();observer.restoreReturned();observer.batch(()=>1);observer.rmStarted(()=>'/owned/root');observer.rmThrown();observer.summary('thrown');}).not.toThrow();
});
test.each([undefined,null,false,0,''])('original falsy exception survives synchronous observer notification %#',original=>{
 const h=harness();let caught:unknown=Symbol('not caught');try {try {throw original;}catch(error){h.observer.restoreThrown();h.observer.summary('thrown');throw error;}}catch(error){caught=error;}
 expect(caught).toBe(original);expect(h.records().at(-1)).toMatchObject({outcome:'thrown',restoreOutcome:'thrown'});
});
test('ordinary cap cannot consume reserved summary and duplicate summary is ignored',()=>{
 const h=harness();h.observer.restoreStarted();h.observer.restoreReturned();h.observer.batch(()=>20);for(let i=0;i<20;i++){h.observer.rmStarted(()=>`/owned/root-${i}`);h.observer.rmReturned();}h.observer.summary('returned');h.observer.summary('returned');
 expect(h.lines).toHaveLength(13);expect(h.records().at(-1)).toMatchObject({phase:'summary',removalsReturned:20,ordinaryRetained:12,diagnosticTruncated:true});expect(h.records().filter(row=>row.phase==='summary')).toHaveLength(1);
});
test('escaped long labels still have an independent compact summary within512UTF8 bytes',()=>{
 const h=harness(()=>({taskId:'\u0000'.repeat(1000),testName:'\u0001'.repeat(1000)}));h.observer.restoreStarted();h.observer.restoreReturned();h.observer.batch(()=>0);h.observer.summary('returned');
 expect(h.lines.length).toBeGreaterThan(0);expect(h.lines.every(line=>Buffer.byteLength(line+'\n')<=512&&!line.includes('\n'))).toBe(true);expect(h.records().at(-1)).toMatchObject({phase:'summary',outcome:'returned',labelsOmitted:true,diagnosticTruncated:true});
});
test('nonASCII labels and owned path tails stay bounded without logging original paths',()=>{
 const h=harness(()=>({taskId:'🙂'.repeat(10000),testName:'é'.repeat(10000)}));h.observer.restoreStarted();h.observer.restoreReturned();h.observer.batch(()=>1);h.observer.rmStarted(()=>'/private/secret/parent/'+'é'.repeat(10000));h.observer.rmReturned();h.observer.summary('returned');
 expect(h.lines.every(line=>Buffer.byteLength(line+'\n')<=512&&!line.includes('/private/secret/parent'))).toBe(true);
});
test('metadata getter errors cannot replace the actual thrown outcome',()=>{
 const h=harness();h.observer.restoreStarted();h.observer.restoreReturned();expect(()=>h.observer.batch(()=>{throw new Error('count');})).not.toThrow();expect(()=>h.observer.rmStarted(()=>{throw new Error('path');})).not.toThrow();h.observer.rmThrown();h.observer.summary('thrown');expect(h.records().at(-1)).toMatchObject({outcome:'thrown',removalsThrown:1,diagnosticErrorCount:2});
});
test('serializer failure still has a compact reserved original-outcome summary',()=>{
 const h=harness(),original=JSON.stringify;try {JSON.stringify=()=>{throw undefined;};h.observer.restoreStarted();h.observer.restoreThrown();h.observer.summary('thrown');}finally {JSON.stringify=original;}
 expect(h.lines).toHaveLength(1);expect(Buffer.byteLength(h.lines[0]!+'\n')).toBeLessThanOrEqual(512);expect(h.records()[0]).toMatchObject({phase:'summary',outcome:'thrown',diagnosticState:'metadata-unavailable'});
});
test('initial owned count is captured before synchronous restore observations',()=>{
 const lines:string[]=[];const observer=createComparisonLoadTeardownObserver({labels:()=>({taskId:'id',testName:'name'}),initialOwnedCount:()=>2,now:()=>1,log:line=>{lines.push(line);}});observer.restoreStarted();observer.restoreReturned();
 expect(lines.map(line=>JSON.parse(line.slice(TEARDOWN_DIAGNOSTIC_PREFIX.length))).map(row=>row.ownedCount)).toEqual([2,2]);
});

test('short task labels flag an owned basename longer than64 characters before slicing',()=>{
 const h=harness(()=>({taskId:'id',testName:'name'}));h.observer.restoreStarted();h.observer.restoreReturned();h.observer.batch(()=>1);h.observer.rmStarted(()=>'/owned/'+'x'.repeat(65));h.observer.rmReturned();h.observer.summary('returned');
 expect(h.records().find(row=>row.phase==='rm-start')).toMatchObject({pathLabel:'x'.repeat(64),labelsTruncated:true});expect(h.records().at(-1)).toMatchObject({outcome:'returned',diagnosticTruncated:true,ordinaryDropped:0});
});
