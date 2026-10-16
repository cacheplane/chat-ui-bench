import {expect, test} from 'vitest';
import {deriveAdmittedLifecycle, type OriginalCaptureBucket, type OriginalCaptureReceipt} from './comparison-lifecycle-oracle.js';
import type {ComparisonCheckpoints} from '@chat-ui-bench/contract';

const identity = {schemaVersion:2, suite:'long-thread-prose-v1', suiteVersion:'1.0.0', collectorVersion:'2.0.0', analyzerVersion:'2.0.0', repetition:'fixture', scenarioId:'history', round:1, caseIndex:1, adapterProfile:'fixture'} as const;
const rectangleReason = 'Prose rectangle budget exhausted before range query';
type Row = ComparisonCheckpoints['scroll'][number];
const rect = {top:0,right:100,bottom:100,left:0};
function geometry(messageId:string, role:'user'|'assistant') {
  return {status:'available' as const,value:{messageId,role,hostRect:rect,contentRects:[rect],viewportRect:rect,scrollerRect:rect,clippingAncestorRects:[],clippingAncestorAxes:[],effectiveClipRect:rect}};
}
function row(timestampMs:number):Row {
  return {timestampMs,clockDomain:'page-performance-ms',scrollTop:20,scrollHeight:1000,clientHeight:100,anchorId:'history',anchorTopCssPx:10,activeVisible:true,followArmed:null,pinThresholdCssPx:24,geometry:geometry('active','assistant'),anchorGeometry:geometry('history','user')};
}
function receipt(kind:OriginalCaptureReceipt['kind'], result:unknown):OriginalCaptureReceipt {
  return {identity,stage:'replay',pageAssociation:0,kind,args:[],admittedAtHostMs:10,settledAtHostMs:11,clockDomain:'host-performance-ms',status:'fulfilled',result,...(kind==='return-visible'?{selector:'chat chat-scroll-bubble button.chat-scroll-bubble'}:{})};
}
function bucket(rows:Row[]=[10,20,820,900,1000].map(row), visible=true):OriginalCaptureBucket {
  return {identity,counts:{scroll:5,full:0,'return-visible':1},receipts:[...rows.map(value=>receipt('scroll',{status:'available',value})),receipt('return-visible',visible)]};
}
function resultRow(b:OriginalCaptureBucket,index=0):Row {return (b.receipts[index]!.result as {value:Row}).value;}

test('no active assistant retains every original row and unavailable score with failed return visibility',()=>{
  const rows=[10,20,820,900,1000].map(row);
  rows[0]={...rows[0]!,activeVisible:false,geometry:{status:'unavailable',reason:'No active assistant'}};
  expect(deriveAdmittedLifecycle(bucket(rows,false),true,24)).toEqual({rows,reasons:['Scored scroll geometry unavailable','Declared return control did not dispatch'],uniqueReasons:['Scored scroll geometry unavailable','Declared return control did not dispatch'],windowAvailable:true,visible:false});
});
test('available geometry preserves complete rows and exact 800ms window',()=>{
  const rows=[10,20,820,900,1000].map(row);
  expect(deriveAdmittedLifecycle(bucket(rows),true,24)).toEqual({rows,reasons:[],uniqueReasons:[],windowAvailable:true,visible:true});
});
test('rectangle budget and missing historical anchor remain failed, with stable reason deduplication',()=>{
  const rows=[10,20,820,900,1000].map(row);
  rows[0]={...rows[0]!,geometry:{status:'unavailable',reason:rectangleReason}};
  rows[1]={...rows[1]!,anchorGeometry:{status:'unavailable',reason:'Historical anchor unavailable'}};
  rows[4]={...rows[4]!,anchorGeometry:{status:'unavailable',reason:rectangleReason}};
  expect(deriveAdmittedLifecycle(bucket(rows),true,24)).toEqual({rows,reasons:Array(3).fill('Scored scroll geometry unavailable'),uniqueReasons:['Scored scroll geometry unavailable'],windowAvailable:true,visible:true});
});
test.each(['unknown','Historical anchor unavailable','Active prose unavailable for visibility'])('rejects unadmitted active reason %s',reason=>{
  const b=bucket();resultRow(b).geometry={status:'unavailable',reason};
  expect(()=>deriveAdmittedLifecycle(b,true,24)).toThrow('Unadmitted active geometry reason');
});
test('rejects no-active sentinel with contradictory true visibility',()=>{
  const b=bucket();resultRow(b).geometry={status:'unavailable',reason:'No active assistant'};
  expect(()=>deriveAdmittedLifecycle(b,true,24)).toThrow('Unadmitted active geometry reason');
});
test.each([undefined,null,0,'false',new Boolean(false)])('requires primitive false for no-active visibility %s',activeVisible=>{
  const b=bucket();Object.assign(resultRow(b),{activeVisible,geometry:{status:'unavailable',reason:'No active assistant'}});
  expect(()=>deriveAdmittedLifecycle(b,true,24)).toThrow();
});
test.each(['No active assistant','unknown'])('rejects active-only or unknown historical anchor reason %s',reason=>{
  const b=bucket();resultRow(b).anchorGeometry={status:'unavailable',reason};
  expect(()=>deriveAdmittedLifecycle(b,true,24)).toThrow('Unadmitted historical anchor geometry reason');
});
test.each(['Active visibility not established: '+rectangleReason,'Active prose unavailable for visibility'])('retains unavailable original read reason %s',reason=>{
  const rows=[10,20,820,900,1000].map(row),b=bucket(rows);
  b.receipts[0]!.result={status:'unavailable',reason};
  expect(deriveAdmittedLifecycle(b,true,24)).toEqual({rows:rows.slice(1),reasons:[reason,'Actual cached samples do not cover the required 800ms window'],uniqueReasons:[reason,'Actual cached samples do not cover the required 800ms window'],windowAvailable:false,visible:true});
});
test.each(['No active assistant','unknown','Historical anchor unavailable'])('rejects unavailable whole-read reason %s',reason=>{
  const b=bucket();b.receipts[0]!.result={status:'unavailable',reason};
  expect(()=>deriveAdmittedLifecycle(b,true,24)).toThrow('Unadmitted original geometry reason');
});
test.each([[10,20,819],[20,20,820],[21,20,820]])('retains rows but fails chronological window %j',(before,post,later)=>{
  const rows=[before,post,later,900,1000].map(row);
  expect(deriveAdmittedLifecycle(bucket(rows),true,24)).toEqual({rows,reasons:['Actual cached samples do not cover the required 800ms window'],uniqueReasons:['Actual cached samples do not cover the required 800ms window'],windowAvailable:false,visible:true});
});
test.each([NaN,Infinity,-1])('rejects malformed row timestamp %s',timestampMs=>{
  const b=bucket();resultRow(b).timestampMs=timestampMs;expect(()=>deriveAdmittedLifecycle(b,true,24)).toThrow();
});
test.each(['scroll-count','scroll-row','visibility-count','visibility-row','stage','status','result','selector','visible-type','visible-stage','visible-status','malformed-row'] as const)('rejects original lifecycle violation %s',fault=>{
  const b=bucket(),first=b.receipts[0]!,last=b.receipts[5]!;
  if(fault==='scroll-count')b.counts.scroll=4;
  if(fault==='scroll-row')b.receipts.splice(0,1);
  if(fault==='visibility-count')b.counts['return-visible']=0;
  if(fault==='visibility-row')b.receipts.pop();
  if(fault==='stage')first.stage='setup';
  if(fault==='status')first.status='rejected';
  if(fault==='result')first.result=null;
  if(fault==='selector')last.selector='button';
  if(fault==='visible-type')last.result='true';
  if(fault==='visible-stage')last.stage='setup';
  if(fault==='visible-status')last.status='pending';
  if(fault==='malformed-row')delete (resultRow(b) as Partial<Row>).scrollTop;
  expect(()=>deriveAdmittedLifecycle(b,true,24)).toThrow();
});
test('non-history lifecycle has no reads or return query',()=>{
  expect(deriveAdmittedLifecycle({identity,counts:{scroll:0,full:2,'return-visible':0},receipts:[receipt('full',null)]},false,null)).toEqual({rows:[],reasons:[],uniqueReasons:[],windowAvailable:true,visible:undefined});
  expect(()=>deriveAdmittedLifecycle(bucket(),false,null)).toThrow('Original scroll count differs');
});
