// Native Node source/provider admission before any installed dependency/config.
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {readHostedCopilotContext,readSourceSnapshot,productionArtifactPaths,COPILOT_PRODUCTION_SOURCES} from '../tests/support/hosted-copilot-context.ts';
import {assertProductionFinalInventory} from '../tests/support/hosted-copilot-contract.ts';
import {collectProductionArtifact} from '../tests/support/hosted-copilot-static-assets.ts';
const option=process.argv[2];
if(process.argv.length!==3||!['--initialize-evidence','--admit-artifacts','--source-policy-report'].includes(option)) throw new Error('Fixed explicit production admission action required');
const context=readHostedCopilotContext();
if(context.releaseId!=='hosted-copilot-react-production-build-v16'||process.version!=='v24.20.0') throw new Error('Exact sixteenth production source/tool profile required');
const source=readSourceSnapshot(process.cwd(),COPILOT_PRODUCTION_SOURCES),paths=productionArtifactPaths();
if(source.files.find(file=>file.path==='package-lock.json')?.sha256!=='c9c4138247c23c593ceb5bd9f5275b59962aad0f017bcbc33dc78bcec3545a56') throw new Error('Accepted exact parent-only lock differs');
if(option==='--source-policy-report') {console.log(JSON.stringify({context,source,runtimeAdmission:false,qualification:false}));process.exitCode=1;}
else if(option==='--initialize-evidence') {
 await mkdir(paths.artifactDirectory);await mkdir(join(paths.artifactDirectory,'api'));
 await writeFile(join(paths.artifactDirectory,'intent.json'),JSON.stringify({context,source,runtimeAdmission:false,qualification:false,provider:'pending',scope:'initial original source intent only'})+'\n',{flag:'wx'});
 let count=0;
 try {
  // This module itself contains only native/builtin and owned inert imports.
  const {acquireHostedCopilotProvider}=await import('./hosted-copilot-api.ts');
  const provider=await acquireHostedCopilotProvider({token:process.env.GH_TOKEN??'',retain:async receipt=> {
   if(++count>14) throw new Error('Original API evidence file bound');
   const prefix=join(paths.artifactDirectory,'api',String(count).padStart(2,'0'));
   const {body,...facts}=receipt;await writeFile(prefix+'.body.bin',body,{flag:'wx'});await writeFile(prefix+'.json',JSON.stringify(facts)+'\n',{flag:'wx'});
  }});
  const text=JSON.stringify({context,source,provider,runtimeAdmission:true,qualification:false,scope:'hosted-production-static-only',timing:'checked request/acquisition budgets; evidence callback and missing-original-close are not hardtermination guarantees'});
  if(Buffer.byteLength(text)>256*1024) throw new Error('Original native source/provider receipt bound');
  await writeFile(join(paths.artifactDirectory,'admission.json'),text+'\n',{flag:'wx'});
  console.log(JSON.stringify({runtimeAdmission:true,qualification:false,scope:'observed provider/native source admission; static build still pending',apiRequests:count}));
 } catch(error) {
  await writeFile(join(paths.artifactDirectory,'admission-failure.json'),JSON.stringify({runtimeAdmission:false,qualification:false,apiRequests:count,reason:error instanceof Error?error.message.slice(0,512):'Native provider failed',originalComplete:false})+'\n',{flag:'wx'});throw error;
 }
} else {
 const root=paths.artifactDirectory,inventory=await collectProductionArtifact(root);
 const text=JSON.stringify({context,source,files:inventory.files,bytesBeforeInventory:inventory.bytes,qualification:false,scope:'actual file admission only; original outcome/root artifact qualification separate'});
 const final=assertProductionFinalInventory(inventory.files,inventory.visitedEntries,Buffer.byteLength(text+'\n'));
 await writeFile(join(root,'artifact-inventory.json'),text+'\n',{flag:'wx'});console.log(JSON.stringify({admitted:true,qualification:false,files:final.files,bytes:final.bytes}));
}
