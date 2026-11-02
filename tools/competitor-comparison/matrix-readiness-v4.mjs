import {MATRIX_V3_STAGE_MS as STAGES} from './matrix-policy-v3.mjs';
import {validateMatrixReadinessSample,matrixStreamingReadiness} from './matrix-admission-v4.mjs';

/** A single controller-observed acquisition budget. The runner supplies the
 * original atomic public SDK/selected-DOM read and the original explicit poll.
 * No full transcript, source control, native input, or completion substitution.
 */
export async function acquireMatrixReadinessV4({context,acquire,poll,remaining,now,diagnostics,started}){
 const until=started+STAGES.readiness;
 const budget=()=>{
  const value=Math.min(until-now(),remaining());
  if(value<=0)throw Error('matrix-v4-readiness-deadline');
  return value;
 };
 for(;;){
  const available=budget();diagnostics.sampleDispatched('readiness-v4');
  const sample=await acquire(available);diagnostics.sampleFulfilled(sample);budget();
  validateMatrixReadinessSample(context,sample);
  let readiness;
  try{readiness=matrixStreamingReadiness(context,sample.progress,sample.response,sample.dom);}
  catch(error){
   if(error?.message!=='matrix-streaming-response-not-ready')throw error;
   await poll(50,budget());budget();continue;
  }
  budget();return{sample,readiness};
 }
}
