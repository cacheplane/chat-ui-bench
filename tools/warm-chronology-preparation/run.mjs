// Node source controls only: no browser, server, capture, or live entry point.
import fs from'node:fs';import{resolve,dirname,isAbsolute,relative}from'node:path';import{fileURLToPath}from'node:url';import{spawnSync}from'node:child_process';
import{boundedRead,preflight,registry,sourceRoot,sha}from'../copilot-history-functional/instrument.mjs';
const here=dirname(fileURLToPath(import.meta.url));
export const toolFiles=Object.freeze(['run.mjs','preparation.mjs','source-inputs.mjs','kernel.mjs','preparation.node.mjs','profile.json','README.md']);
const identity=path=>{const s=fs.lstatSync(path,{bigint:true});return[s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].map(String);};
function snapshot(){
 const paths=[...toolFiles.map(n=>resolve(here,n)),...['instrument.mjs','source-pins.json'].map(n=>resolve(here,'../copilot-history-functional',n)),...['package.json','package-lock.json','.github/workflows/ci.yml'].map(n=>resolve(sourceRoot,n)),...registry.map(p=>resolve(sourceRoot,p.path))];
 let total=0;return[...new Set(paths)].sort().map(path=>{const before=identity(path),raw=boundedRead(path,8388608);total+=raw.length;if(total>33554432||JSON.stringify(before)!==JSON.stringify(identity(path)))throw Error('source-drift');return{path:relative(sourceRoot,path),bytes:raw.length,sha256:sha(raw),stat7:before};});
}
function writeExclusive(path,raw){
 if(raw.length>1048576)throw Error('output-cap');
 const fd=fs.openSync(path,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
 try{fs.writeFileSync(fd,raw);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 const checked=boundedRead(path,1048576);if(!checked.equals(raw))throw Error('output-readback');fs.chmodSync(path,0o444);
}
export function main(args){
 if(!/^24\./.test(process.versions.node)||args.length!==3||args[0]!=='--test'||args[1]!=='--out'||typeof args[2]!=='string'||args[2].length>4096||!isAbsolute(args[2])||resolve(args[2])!==args[2])throw Error('source-only-arguments');
 preflight();const before=snapshot(),out=args[2];fs.mkdirSync(out,{mode:0o700});
 const argv=['--test',resolve(here,'preparation.node.mjs')],child=spawnSync(process.execPath,argv,{cwd:sourceRoot,encoding:null,timeout:60000,maxBuffer:1048576,stdio:['ignore','pipe','pipe']});
 const stdout=child.stdout??Buffer.alloc(0),stderr=child.stderr??Buffer.alloc(0);
 for(const[name,raw]of[['stdout',stdout],['stderr',stderr]])writeExclusive(resolve(out,name),raw);
 let stable=false,sourceVerificationError=null;
 try{const after=snapshot();stable=JSON.stringify(before)===JSON.stringify(after);}catch{sourceVerificationError='post-child-source-verification-failed';}
 if(!stable)sourceVerificationError='post-child-source-verification-failed';
 const receipt={kind:'node-source-only-warm-chronology-controls',status:stable&&!child.error&&child.status===0?'source-only-pass':'unavailable',argv:[process.execPath,...argv],cwd:sourceRoot,stdin:'ignored',environment:'inherited; values not recorded',runtime:{node:process.versions.node,execPath:process.execPath,platform:process.platform,arch:process.arch},directWait:true,pipeEOF:!child.error,exit:child.status,signal:child.signal,error:child.error?.code??null,sourceStable:stable,sourceVerificationError,sourceManifest:before,stdout:{bytes:stdout.length,sha256:sha(stdout)},stderr:{bytes:stderr.length,sha256:sha(stderr)},runtimeIntegrated:false,browserExecuted:false,nativeGO:false,FPS:'unavailable'};
 writeExclusive(resolve(out,'receipt.json'),Buffer.from(JSON.stringify(receipt,null,2)+'\n'));
 if(!stable||child.error||child.status!==0)throw Error('source-controls-refused');
 console.log(JSON.stringify({status:'source-only-pass',testsOutput:out,manifestRows:before.length,nativeGO:false}));return receipt;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2));
