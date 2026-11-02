import {gunzipSync} from 'node:zlib';
import {validateAimockTraceV2} from './aimock-trace-capture-v1.mjs';
import {projectOwnedRendererCostsV1} from './aimock-trace-costs-v1.mjs';
const unavailable=()=>({schema:'aimock-owned-renderer-costs-v1',status:'unavailable',reason:'aimock-trace-v2-capture-or-binding-unavailable',performance:false,scoringEligibility:false,FPS:null,cpuTime:null,presentationCoverage:'unverified'});
/** New declared capture profile; common observed-event semantics remain V1.
 * V1 failed/truncated captures cannot enter this path or acquire derived costs.
 */
export function analyzeAimockTraceCostsV2(snapshot){
 const validation=validateAimockTraceV2(snapshot);
 if(validation.status!=='valid'||validation.rendererMapping.status!=='available')return unavailable();
 try{
  const decoded=gunzipSync(Buffer.from(snapshot.payloadBase64,'base64'),{maxOutputLength:16777216});
  const trace=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decoded));
  return {...projectOwnedRendererCostsV1(trace,validation.rendererMapping.binding),decodedSha256:validation.decodedSha256};
 }catch{return unavailable();}
}
