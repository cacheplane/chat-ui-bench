import {pathToFileURL} from 'node:url';

/** No original release exists in this unit. Caller booleans cannot grant one. */
export function originalModeReceipt(){
 return {schemaVersion:1,status:'unreleased',reason:'root-original-release-absent',captureInvoked:false,analysis:'not_evaluated',qualification:false,fpsEligibility:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false};
}
/** Source-only supplied owner orchestration. The caller owns supplied public
 * objects and original runner closure. This function acquires no resources. */
export async function runInjectedNativeOwner(createOwner){
 const owner=createOwner();let terminal;
 try{
  const started=await owner.start();if(started.status!=='open')return {sourceOnly:true,analysis:'not_evaluated',receipt:started};
  const startMark=await owner.mark('start');if(startMark.status!=='open')terminal=await owner.close();
  else{const endMark=await owner.mark('end');terminal=endMark.status==='open'?await owner.finish():await owner.close();}
 }catch{terminal=await owner.close();}
 return {sourceOnly:true,analysis:'not_evaluated',receipt:terminal};
}
// Deliberately no browser import, acquisition, fallback or original execution.
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 process.stdout.write(JSON.stringify(originalModeReceipt())+'\n');process.exitCode=2;
}
