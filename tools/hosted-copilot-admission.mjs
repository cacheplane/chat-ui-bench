// Native Node source/provider admission before any installed dependency/config.
import {mkdir,writeFile,readFile,lstat,readdir,realpath} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {readHostedCopilotContext,readSourceSnapshot,productionArtifactPaths,COPILOT_PRODUCTION_SOURCES} from '../tests/support/hosted-copilot-context.ts';
import {assertInventory,ordinaryPath,LIMITS} from '../tests/support/hosted-copilot-contract.ts';
const option=process.argv[2];
if(process.argv.length!==3||!['--initialize-evidence','--admit-artifacts','--source-policy-report'].includes(option)) throw new Error('Fixed explicit production admission action required');
const context=readHostedCopilotContext();
if(context.releaseId!=='hosted-copilot-react-production-build-v1'||process.version!=='v24.20.0') throw new Error('Exact first production source/tool profile required');
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
 const root=paths.artifactDirectory,stat=await lstat(root);if(!stat.isDirectory()||stat.isSymbolicLink()||await realpath(root)!==root) throw new Error('Artifact root owner missing');
 const files=[];let entries=0,total=0;
 async function walk(directory) {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
   if(++entries>512) throw new Error('Actual artifact directory-entry bound');
   const absolute=join(directory,entry.name),name=relative(root,absolute).split('\\').join('/'),info=await lstat(absolute);
   if(!ordinaryPath(name)||info.isSymbolicLink()||await realpath(absolute)!==absolute) throw new Error('Artifact regular containment denied');
   if(info.isDirectory()) {if(name!=='api'&&!name.startsWith('dist/')&&name!=='dist') throw new Error('Unexpected artifact directory');await walk(absolute);continue;}
   const allowed=name.startsWith('dist/')||/^api\/[0-9]{2}\.(?:body\.bin|json)$/.test(name)||/^(?:intent|admission|admission-failure|installed-profile|build-mappings|static-assets|artifact-inventory)\.json$/.test(name)||/^step-(?:profile|install|audit|audit-high|contract|consumer|controls|helpers|vendor|build|inspect)(?:-(?:started|result)\.json|\.(?:stdout|stderr))$/.test(name);
   if(!allowed||!info.isFile()||files.length>=LIMITS.files||(total+=info.size)>LIMITS.bytes) throw new Error('Actual artifact inventory bound/name failed');
   if(/\.(?:stdout|stderr)$/.test(name)&&info.size>4*1024*1024) throw new Error('Original command log overflow; retained originals not uploaded');
   const raw=await readFile(absolute),after=await lstat(absolute);if(raw.length!==info.size||after.size!==info.size||after.ino!==info.ino||after.mtimeMs!==info.mtimeMs) throw new Error('Original artifact bytes changed');
   files.push({path:name,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex'),regular:true,contained:true,symlink:false});
  }
 }
 await walk(root);const inventory=assertInventory(files);
 const text=JSON.stringify({context,source,files:inventory.files,bytesBeforeInventory:inventory.bytes,qualification:false,scope:'actual file admission only; original outcome/root artifact qualification separate'});
 if(files.length+1>LIMITS.files||inventory.bytes+Buffer.byteLength(text)+1>LIMITS.bytes) throw new Error('Actual inventory file itself exceeds joint artifact bound');
 await writeFile(join(root,'artifact-inventory.json'),text+'\n',{flag:'wx'});console.log(JSON.stringify({admitted:true,qualification:false,files:files.length+1,bytes:inventory.bytes+Buffer.byteLength(text)+1}));
}
