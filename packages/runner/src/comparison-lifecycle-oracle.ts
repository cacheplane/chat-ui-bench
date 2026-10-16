import {comparisonCheckpointsSchema} from '@chat-ui-bench/contract';
import type {ComparisonCheckpoints} from '@chat-ui-bench/contract';
import type {ComparisonRuntimeIdentity as ComparisonIdentity} from './comparison-runtime-family.js';

export interface OriginalCaptureReceipt {
  identity:Readonly<ComparisonIdentity>;stage:string;pageAssociation:number;kind:'scroll'|'full'|'return-visible';
  args:unknown[];selector?:unknown;admittedAtHostMs:number;settledAtHostMs:number|null;clockDomain:'host-performance-ms';
  status:'pending'|'fulfilled'|'rejected';result?:unknown;error?:unknown;
}
export interface OriginalCaptureBucket {identity:Readonly<ComparisonIdentity>;receipts:OriginalCaptureReceipt[];counts:{scroll:number;full:number;'return-visible':number};}
/** Independent finite lifecycle oracle: no production collector/analyzer is imported. */
export function deriveAdmittedLifecycle(bucket:OriginalCaptureBucket,history:boolean,pinThresholdCssPx:number|null){
  const reads=bucket.receipts.filter(row=>row.kind==='scroll'),visibility=bucket.receipts.filter(row=>row.kind==='return-visible');
  const require=(condition:boolean,message:string)=>{if(!condition)throw new Error(message);};
  require(bucket.counts.scroll===(history?5:0)&&reads.length===(history?5:0),'Original scroll count differs');
  require(bucket.counts['return-visible']===(history?1:0)&&visibility.length===(history?1:0),'Original return visibility count differs');
  const rows:ComparisonCheckpoints['scroll']=[],reasons:string[]=[],values:(ComparisonCheckpoints['scroll'][number]|undefined)[]=[];
  const rectangleReason='Prose rectangle budget exhausted before range query';
  let windowAvailable=!history;
  for(let index=0;index<reads.length;index++){
    const receipt=reads[index]!;require(receipt.status==='fulfilled'&&receipt.stage==='replay','Original scroll operation did not fulfill in replay');
    const result=receipt.result as {status?:unknown;value?:unknown;reason?:unknown};require(!!result&&typeof result==='object','Original scroll result missing');
    if(result.status==='available'){
      const value=comparisonCheckpointsSchema.shape.scroll.element.parse({...result.value as object,pinThresholdCssPx,followArmed:null});rows.push(value);values.push(value);
      if(value.geometry.status==='unavailable'||history&&value.anchorGeometry.status==='unavailable'){
        if(value.geometry.status==='unavailable')require(value.geometry.reason===rectangleReason||value.geometry.reason==='No active assistant'&&value.activeVisible===false,'Unadmitted active geometry reason');
        if(history&&value.anchorGeometry.status==='unavailable')require(value.anchorGeometry.reason===rectangleReason||value.anchorGeometry.reason==='Historical anchor unavailable','Unadmitted historical anchor geometry reason');
        reasons.push('Scored scroll geometry unavailable');
      }
    }else{require(result.status==='unavailable'&&(result.reason==='Active visibility not established: '+rectangleReason||result.reason==='Active prose unavailable for visibility'),'Unadmitted original geometry reason');values.push(undefined);reasons.push(result.reason as string);}
    if(index===2){const [before,post,later]=values;windowAvailable=!!before&&!!post&&!!later&&before.clockDomain===post.clockDomain&&post.clockDomain===later.clockDomain&&post.timestampMs>before.timestampMs&&later.timestampMs-post.timestampMs>=800;if(!windowAvailable)reasons.push('Actual cached samples do not cover the required 800ms window');}
  }
  let visible:boolean|undefined;
  if(history){const query=visibility[0]!;require(query.stage==='replay'&&query.status==='fulfilled'&&typeof query.result==='boolean','Original visibility did not fulfill');require(query.selector==='chat chat-scroll-bubble button.chat-scroll-bubble','Original declared canonical return locator differs');visible=query.result as boolean;if(!visible)reasons.push('Declared return control did not dispatch');}
  require(reasons.length<=32&&reasons.every(reason=>reason.length<=4096)&&reasons.join('; ').length<=4096,'Derived lifecycle exceeds original reason capacities');
  return {rows,reasons,uniqueReasons:[...new Set(reasons)],windowAvailable,visible};
}
