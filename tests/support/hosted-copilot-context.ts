/** Native source reader only. Importing this module performs no I/O. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { assertContext, assertInventory, assertDenseEntries, ordinaryPath, releaseTag, LIMITS } from './hosted-copilot-contract.ts';
import {assertProviderSnapshot,type ProviderSnapshot} from './hosted-copilot-production-policy.ts';
function git(cwd:string,args:readonly string[],maxBuffer=4*1024*1024):string {
 return execFileSync('git',[...args],{cwd,encoding:'utf8',timeout:5000,maxBuffer,stdio:['ignore','pipe','pipe']}).trimEnd();
}
function clean(cwd:string):void {
 const flags=git(cwd,['ls-files','-v','-z']).split('\0').filter(Boolean);
 if(flags.length>4096||flags.some(entry=>!entry.startsWith('H '))) throw new Error('Unsupported tracked index visibility flags');
 git(cwd,['diff','--quiet','HEAD','--']);
}
/** Whole tracked tree is commit-anchored; selected byte inventory is <=128 files.
 * Untracked/dirty selected sources never establish a reviewed guard snapshot. */
export function readSourceSnapshot(cwd:string,paths:readonly string[]) {
 assertDenseEntries(paths,LIMITS.files);
 if(paths.length<1||paths.length>LIMITS.files||new Set(paths).size!==paths.length||paths.some(path=>!ordinaryPath(path))) throw new Error('Selected source paths denied');
 const root=realpathSync(cwd);
 if(realpathSync(git(root,['rev-parse','--show-toplevel'],2048))!==root) throw new Error('Exact repository root required');
 clean(root);
 const commitSha=git(root,['rev-parse','--verify','HEAD'],1024),treeSha=git(root,['rev-parse','--verify','HEAD^{tree}'],1024);
 if(!/^[a-f0-9]{40}$/.test(commitSha)||! /^[a-f0-9]{40}$/.test(treeSha)) throw new Error('Unsupported Git identity');
 const entries=git(root,['ls-tree','-rz','--full-tree','HEAD']).split('\0').filter(Boolean);
 if(entries.length>4096) throw new Error('Tracked tree metadata bound');
 const tracked=new Map<string,{mode:string;blob:string}>();
 for(const entry of entries) {
  const match=/^(\d{6}) blob ([a-f0-9]{40})\t(.+)$/.exec(entry);
  if(!match||!match[1]||!match[2]||!match[3]) throw new Error('Unsupported tracked tree entry');
  tracked.set(match[3],{mode:match[1],blob:match[2]});
 }
 let total=0;
 const facts=paths.map(path=> {
  const expected=tracked.get(path);
  if(!expected||!['100644','100755'].includes(expected.mode)) throw new Error('Selected source not ordinary tracked blob');
  let ancestor=root;
  for(const part of path.split('/')) {ancestor=join(ancestor,part);if(lstatSync(ancestor).isSymbolicLink()) throw new Error('Source symlink denied');}
  const absolute=join(root,path),resolved=realpathSync(absolute);
  if(relative(root,resolved)!==path) throw new Error('Source containment denied');
  const fd=openSync(absolute,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
   const before=fstatSync(fd);total+=before.size;
   if(!before.isFile()||total>LIMITS.bytes) throw new Error('Source byte bound');
   const raw=readFileSync(fd),after=fstatSync(fd);
   if(before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs||raw.byteLength!==before.size) throw new Error('Source changed while reading');
   const blob=createHash('sha1').update(`blob ${raw.length}\0`).update(raw).digest('hex');
   if(blob!==expected.blob||realpathSync(absolute)!==resolved) throw new Error('Source differs from exact Git blob');
   return {path,bytes:raw.byteLength,sha256:createHash('sha256').update(raw).digest('hex'),regular:true,contained:true,symlink:false};
  } finally {closeSync(fd);}
 });
 clean(root);
 if(git(root,['rev-parse','HEAD'],1024)!==commitSha) throw new Error('Source commit changed');
 const inventory=assertInventory(facts);
 return Object.freeze({commitSha,treeSha,trackedFiles:entries.length,...inventory,scope:'commit/tree and selected tracked bytes only' as const});
}
export function readHostedCopilotContext(cwd=process.cwd(),env:Readonly<Record<string,string|undefined>>=process.env) {
 // Reject the missing release/environment before any Git invocation.
 const tag=releaseTag(env['HOSTED_RELEASE_ID']??'');
 if(env['GITHUB_ACTIONS']!=='true'||env['GITHUB_EVENT_NAME']!=='workflow_dispatch'||env['GITHUB_RUN_ATTEMPT']!=='1') throw new Error('Hosted environment required');
 const resolve=(ref:string)=>git(cwd,['rev-parse','--verify',ref],1024);
 return assertContext({candidateSha:env['HOSTED_CANDIDATE_SHA']??'',checkoutSha:resolve('HEAD'),githubSha:env['GITHUB_SHA']??'',workflowSha:env['GITHUB_WORKFLOW_SHA']??'',tagSha:resolve(`refs/tags/${tag}^{commit}`),repository:env['GITHUB_REPOSITORY']??'',releaseId:tag,githubRef:env['GITHUB_REF']??'',workflowRef:env['GITHUB_WORKFLOW_REF']??'',eventName:env['GITHUB_EVENT_NAME']??'',actions:env['GITHUB_ACTIONS']??'',platform:process.platform,runnerOs:env['RUNNER_OS']??'',runnerMarker:env['HOSTED_RUNNER_MARKER']??'',attempt:env['GITHUB_RUN_ATTEMPT']??''});
}

/** Full-stage native source gate. No I/O occurs until explicitly called. */
export const COPILOT_PRODUCTION_SOURCES=Object.freeze([
 '.github/workflows/hosted-copilot-production.yml','apps/copilotkit/vite.config.ts','apps/copilotkit/README.md',
 'tools/hosted-copilot-admission.mjs','tools/hosted-copilot-step.mjs','tools/hosted-copilot-api.ts',
 'tests/support/hosted-copilot-contract.ts','tests/support/hosted-copilot-context.ts','tests/support/hosted-copilot-production-policy.ts',
 'tests/support/hosted-copilot-build-plugin.ts','tests/support/hosted-copilot-static-assets.ts','tests/tsconfig.copilot-production.json',
 'package.json','package-lock.json','apps/copilotkit/package.json','apps/copilotkit/index.html',
 'apps/copilotkit/tsconfig.json','apps/copilotkit/tsconfig.controls.json','apps/copilotkit/tsconfig.vendor.json',
 'apps/copilotkit/src/main.tsx','apps/copilotkit/src/host.ts','apps/copilotkit/src/probe.tsx','apps/copilotkit/src/context.ts','apps/copilotkit/src/controls.ts','apps/copilotkit/src/styles.css',
 'apps/copilotkit/runtime/server.ts','apps/copilotkit/runtime/runtime.ts','apps/copilotkit/runtime/ownership.ts','apps/copilotkit/runtime/producer-agent.ts','apps/copilotkit/runtime/wire.ts',
 'tests/fixtures/aimock.ts','packages/contract/src/long-thread.ts',
]);
export function productionArtifactPaths() {
 const temp=process.env['RUNNER_TEMP']??'',run=process.env['GITHUB_RUN_ID']??'';
 if(!/^\/[A-Za-z0-9_./-]+$/.test(temp)||temp.length>2048||temp.split('/').some(part=>part==='.'||part==='..')||! /^[1-9][0-9]{0,19}$/.test(run)) throw new Error('Owned hosted artifact identity denied');
 const root=realpathSync(temp);if(!lstatSync(root).isDirectory()) throw new Error('Runner temp is not directory');
 const artifactDirectory=join(root,`copilot-production-${run}-1`),outputDirectory=join(artifactDirectory,'dist');
 return Object.freeze({artifactDirectory,outputDirectory});
}
export function readIntegratedAdmission() {
 const context=readHostedCopilotContext();
 if(context.releaseId!=='hosted-copilot-react-production-build-v1'||process.version!=='v24.20.0') throw new Error('Fixed production release/tool profile required');
 const paths=productionArtifactPaths();
 const directory=lstatSync(paths.artifactDirectory);if(!directory.isDirectory()||directory.isSymbolicLink()) throw new Error('Artifact owner differs');
 const stateFile=join(paths.artifactDirectory,'admission.json'),stateStat=lstatSync(stateFile);
 if(!stateStat.isFile()||stateStat.isSymbolicLink()||stateStat.size>256*1024) throw new Error('Native admission state bound');
 const raw=readFileSync(stateFile),value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
 if(typeof value!=='object'||value===null) throw new Error('Native admission state missing');
 const state=value as {context?:unknown;source?:unknown;provider?:ProviderSnapshot;runtimeAdmission?:unknown;scope?:unknown};
 const repositoryRoot=realpathSync(git(process.cwd(),['rev-parse','--show-toplevel'],2048));
 const source=readSourceSnapshot(repositoryRoot,COPILOT_PRODUCTION_SOURCES);
 if(state.runtimeAdmission!==true||state.scope!=='hosted-production-static-only'||JSON.stringify(context)!==JSON.stringify(state.context)||JSON.stringify(source)!==JSON.stringify(state.source)||!state.provider) throw new Error('Actual same-run source admission differs');
 assertProviderSnapshot(state.provider);
 const lock=source.files.find(file=>file.path==='package-lock.json');
 if(lock?.sha256!=='c9c4138247c23c593ceb5bd9f5275b59962aad0f017bcbc33dc78bcec3545a56') throw new Error('Accepted parent-only lock differs');
 return Object.freeze({context,source,repositoryRoot,...paths,scope:'hosted-production-static-only' as const});
}
