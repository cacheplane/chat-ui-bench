import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as api from './run.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const temporary=fn=>{const d=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'custody-authored-')));try{return fn(d);}finally{fs.rmSync(d,{recursive:true,force:true});}};
test('closed JSON rejects duplicate keys before parsing and limits depth',()=>{
 assert.throws(()=>api.decodeRecord(Buffer.from('{"a":1,"a":2}')),/custody-json/);
 assert.throws(()=>api.decodeRecord(Buffer.from('['.repeat(33)+'0'+']'.repeat(33))),/custody-json/);
 assert.deepEqual(api.decodeRecord(Buffer.from('{"a":[1,true,null,"x"]}')),{a:[1,true,null,'x']});
});
test('bounded physical file observation owns EOF hash and stable descriptor',()=>temporary(d=>{
 const p=path.join(d,'input');fs.writeFileSync(p,'authored');assert.equal(api.observeFile(p,8).sha256,hash('authored'));assert.throws(()=>api.observeFile(p,7),/custody-file/);
 const alias=path.join(d,'alias');fs.linkSync(p,alias);assert.throws(()=>api.observeFile(p,8),/custody-file/);
}));
test('proxy refused without any reflection trap',()=>{let n=0;const p=new Proxy({},{get(){n++;throw 1;},ownKeys(){n++;throw 1;},getPrototypeOf(){n++;throw 1;}});assert.throws(()=>api.validateRequest(p),/custody-request/);assert.equal(n,0);});
test('request rejects actual mode before creating output or spawning anything',()=>temporary(d=>{
 assert.throws(()=>api.validateRequest({root:path.resolve(new URL('../..',import.meta.url).pathname),output:path.join(d,'out'),referenceRoot:d,referenceManifest:path.join(d,'ref'),referenceSHA256:'0'.repeat(64),runId:'x',phaseId:'y',mode:'actual',expectedRevision:'b5425e58f69fd15bdc5f091f8fe809b28d472ebf',expectedTree:'b402fa99a69de56e38657b8528bed846e7830a48'}),/custody-request/);assert.equal(fs.existsSync(path.join(d,'out')),false);
}));
test('closed compiler program inventory refuses unexpected repo input',()=>{
 const expected=['packages/analyzer/src/x.ts'];assert.throws(()=>api.classifyCompilerLines('/repo/packages/analyzer/src/evil.ts\n','/repo',expected,[]),/custody-compiler/);
 assert.deepEqual(api.classifyCompilerLines('/repo/packages/analyzer/src/x.ts\n','/repo',expected,[]),expected);
});
test('all predefined roster members are unique and within fixed115 capacity',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./profile.json',import.meta.url)));assert.equal(p.inputs.length,106);assert.equal(new Set(p.inputs).size,106);assert.equal(p.references.length,33);assert.equal(p.vendor.length,286);assert.equal(api.expectedRoles(p).length,115);
});
test('compiler closure distinguishes emitted declarations from actual compiler inputs',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./profile.json',import.meta.url)));assert.equal(p.compilerRepo?.length,101);
 for(const k of ['comparison-proto-native-capture','comparison-proto-trace','comparison-proto-public-ports'])assert.equal(p.compilerRepo.includes('packages/runner/dist/'+k+'.d.ts'),false);
});
test('owned read refuses zero progress and still closes its descriptor',(t)=>temporary(d=>{
 const p=path.join(d,'input');fs.writeFileSync(p,'authored');const read=fs.readSync,close=fs.closeSync;let closes=0;
 t.mock.method(fs,'readSync',()=>0);t.mock.method(fs,'closeSync',fd=>{closes++;return close(fd);});assert.throws(()=>api.observeFile(p,8),/custody-file/);assert.equal(closes,1);t.mock.restoreAll();
}));
test('physical EOF detector refuses growth instead of admitting prefix',(t)=>temporary(d=>{
 const p=path.join(d,'input');fs.writeFileSync(p,'authored');const read=fs.readSync;let count=0;t.mock.method(fs,'readSync',(...args)=>{if(++count===2)return 1;return read(...args);});assert.throws(()=>api.observeFile(p,8),/custody-file/);t.mock.restoreAll();
}));
test('named source symlink is refused before descriptor read',()=>temporary(d=>{
 const p=path.join(d,'input'),alias=path.join(d,'alias');fs.writeFileSync(p,'authored');fs.symlinkSync(p,alias);assert.throws(()=>api.observeFile(alias,8),/custody-file/);
}));
test('canonical deep parent is bookended by native resolution without repeated prefix construction',t=>temporary(d=>{
 const dir=path.join(d,...Array.from({length:20},(_,i)=>'d'+i));fs.mkdirSync(dir,{recursive:true});const p=path.join(dir,'input');fs.writeFileSync(p,'x');const original=fs.realpathSync.native;let calls=0;t.mock.method(fs.realpathSync,'native',(...a)=>{calls++;return original(...a);});assert.equal(api.observeFile(p,1).bytes,1);assert.equal(calls,2);t.mock.restoreAll();
}));
test('intermediate symlink alias to the same endpoint is refused',()=>temporary(d=>{
 const dir=path.join(d,'real');fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'input'),'x');fs.symlinkSync(dir,path.join(d,'alias'));assert.throws(()=>api.observeFile(path.join(d,'alias','input'),1),/custody-file/);
}));
for(const bytes of ['{"a":1} trailing','{"a":01}','{"a":"\\uZZZZ"}','{"a":1,}','[1,]','{"a":NaN}'])test('JSON lexical failure '+bytes,()=>assert.throws(()=>api.decodeRecord(Buffer.from(bytes)),/custody-json/));
// Exact private-function copy: only add test exports in an isolated native-module
// scope. Installed source/profile remain unchanged; no production fault API.
async function privateFunctions(t){
 const d=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'custody-private-')));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));
 fs.copyFileSync(new URL('./profile.json',import.meta.url),path.join(d,'profile.json'));const source=fs.readFileSync(new URL('./run.mjs',import.meta.url),'utf8');fs.writeFileSync(path.join(d,'run.mjs'),source+'\nexport {child,output,copy,record,references,parseRevision,verifyTree,collect,runtimeRows,unchanged};\n');return {d,module:await import('file://'+path.join(d,'run.mjs'))};
}
function childState(d){return {output:d,total:0,roles:new Set(),dirs:new Set([d]),budget:{work:0}};}
test('owned child captures independent EOF/raw bytes and real wait/group closure',async t=>{
 const{d,module:m}=await privateFunctions(t);const r=await m.child(childState(d),'build',[process.execPath,'-e','process.stdout.write("ok");process.stderr.write("err")'],d,2000,8,8);assert.equal(r.exitCode,0);assert.deepEqual(r.eof,[true,true]);assert.equal(r.groupGone,true);assert.equal(r.force,false);assert.equal(r.streams[0].bytes,2);assert.equal(r.streams[1].bytes,3);assert.equal(fs.readFileSync(path.join(d,'build.stdout.bin'),'utf8'),'ok');
});
test('overflow original child refuses without discarding already retained bytes',async t=>{
 const{d,module:m}=await privateFunctions(t);const r=await m.child(childState(d),'original',[process.execPath,'-e','process.stdout.write("123456789")'],d,2000,8,8);assert.equal(r.reason,'stream-overflow-or-write');assert.equal(r.streams[0].bytes,0);assert.equal(r.groupGone,true);
});
test('nonzero wait remains failure despite clean pipe EOF',async t=>{
 const{d,module:m}=await privateFunctions(t);const r=await m.child(childState(d),'original',[process.execPath,'-e','process.stdout.write("kept");process.exitCode=9'],d,2000,8,8);assert.equal(r.exitCode,9);assert.deepEqual(r.eof,[true,true]);assert.equal(fs.readFileSync(path.join(d,'original.stdout.bin'),'utf8'),'kept');
});
test('failed second raw open closes the first descriptor',async t=>{
 const{d,module:m}=await privateFunctions(t),open=fs.openSync,close=fs.closeSync;let first,closed=false;
 t.mock.method(fs,'openSync',(...a)=>{if(String(a[0]).endsWith('.stderr.bin'))throw new Error('authored-open');const fd=open(...a);if(String(a[0]).endsWith('.stdout.bin'))first=fd;return fd;});t.mock.method(fs,'closeSync',fd=>{if(fd===first)closed=true;return close(fd);});
 await assert.rejects(m.child(childState(d),'build',[process.execPath,'-e',''],d,2000,8,8));assert.equal(closed,true);t.mock.restoreAll();
});
test('one fsync failure still closes both raw stream descriptors',async t=>{
 const{d,module:m}=await privateFunctions(t),open=fs.openSync,close=fs.closeSync;const owned=new Set(),closed=new Set();t.mock.method(fs,'openSync',(...a)=>{const fd=open(...a);if(/\.(stdout|stderr)\.bin$/.test(String(a[0])))owned.add(fd);return fd;});t.mock.method(fs,'closeSync',fd=>{if(owned.has(fd))closed.add(fd);return close(fd);});let once=false;t.mock.method(fs,'fsyncSync',()=>{if(!once){once=true;throw Error('authored-fsync');}});
 await assert.rejects(m.child(childState(d),'build',[process.execPath,'-e',''],d,2000,8,8));assert.equal(closed.size,2);t.mock.restoreAll();
});
test('ancestor replaced by a symlink during read cannot preserve path authority',t=>temporary(d=>{
 const dir=path.join(d,'original'),moved=path.join(d,'moved');fs.mkdirSync(dir);const p=path.join(dir,'input');fs.writeFileSync(p,'authored');const read=fs.readSync;let once=false;
 t.mock.method(fs,'readSync',(...a)=>{const n=read(...a);if(!once){once=true;fs.renameSync(dir,moved);fs.symlinkSync(moved,dir);}return n;});assert.throws(()=>api.observeFile(p,8),/custody-file/);t.mock.restoreAll();
}));
test('oversized private profile is refused before startup JSON allocation',async t=>{
 const d=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'custody-profile-')));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));fs.copyFileSync(new URL('./run.mjs',import.meta.url),path.join(d,'run.mjs'));fs.writeFileSync(path.join(d,'profile.json'),JSON.stringify({x:'x'.repeat(32768)}));await assert.rejects(import('file://'+path.join(d,'run.mjs')),/custody-profile/);
});
test('source revision bookend must be an actual observed raw pair, not a declared label',async t=>{
 const{module:m}=await privateFunctions(t);const p=JSON.parse(fs.readFileSync(new URL('./profile.json',import.meta.url)));assert.throws(()=>m.parseRevision('0'.repeat(40)+'\n'+p.tree+'\n'),/custody-compiler/);assert.deepEqual(m.parseRevision(p.seed+'\n'+p.tree+'\n'),{revision:p.seed,tree:p.tree});
});
test('synchronous spawn throw closes both prepared raw files',async t=>{
 const{d,module:m}=await privateFunctions(t);const cp=await import('node:child_process');const{syncBuiltinESMExports}=await import('node:module');const close=fs.closeSync;let closes=0;t.mock.method(cp.default,'spawn',()=>{throw Error('authored-spawn');});syncBuiltinESMExports();t.mock.method(fs,'closeSync',fd=>{closes++;return close(fd);});try{await assert.rejects(m.child(childState(d),'build',[process.execPath,'-e',''],d,2000,8,8));assert.equal(closes,2);}finally{t.mock.restoreAll();syncBuiltinESMExports();}
});
test('fixed watchdog refuses a surviving child without claiming success',async t=>{
 const{d,module:m}=await privateFunctions(t);const r=await m.child(childState(d),'original',[process.execPath,'-e','setInterval(()=>{},1000)'],d,50,8,8);assert.equal(r.timedOut,true);assert.equal(r.reason,'timeout');assert.notEqual(r.exitCode,0);
});
test('bounded owned-tree verification refuses unlisted sibling files',async t=>{
 const{d,module:m}=await privateFunctions(t);const out=path.join(d,'out');fs.mkdirSync(out);const s=childState(out);m.output(s,'ok',Buffer.from('kept'),8);assert.equal(m.verifyTree(s).files,1);fs.writeFileSync(path.join(out,'extra'),'unexpected');assert.throws(()=>m.verifyTree(s),/custody-output/);
});
test('trusted fixed OS git identity is distinct from exclusive raw-input ownership',{skip:process.platform!=='darwin'},()=>{
 const s=fs.lstatSync('/usr/bin/git');assert.ok(s.nlink>=1);if(s.nlink!==1)assert.throws(()=>api.observeFile('/usr/bin/git',134217728),/custody-file/);assert.equal(api.observeFile('/usr/bin/git',134217728,{platformSystem:true}).bytes,s.size);
});

test('raw-input joint precharge refuses before any descriptor data read',async t=>{
 const{d,module:m}=await privateFunctions(t);const keys=['package-lock.json','a','b','c','d'];fs.writeFileSync(path.join(d,keys[0]),Buffer.alloc(2097152));for(const k of keys.slice(1))fs.writeFileSync(path.join(d,k),Buffer.alloc(262144));let reads=0;const read=fs.readSync;t.mock.method(fs,'readSync',(...a)=>{reads++;return read(...a);});assert.throws(()=>m.collect(d,keys,{work:0}),/custody-budget/);assert.equal(reads,0);t.mock.restoreAll();
});
test('same bytes in replacement copied inode are not the owned original',async t=>{
 const{d,module:m}=await privateFunctions(t),out=path.join(d,'out');fs.mkdirSync(out);const s=childState(out);m.output(s,'run.mjs',Buffer.from('runtime'),16);fs.renameSync(path.join(out,'run.mjs'),path.join(d,'moved'));fs.writeFileSync(path.join(out,'run.mjs'),'runtime');assert.throws(()=>m.verifyTree(s),/custody-output/);
});
test('runtime copy mutation is caught by final owned inventory',async t=>{
 const{d,module:m}=await privateFunctions(t),out=path.join(d,'out');fs.mkdirSync(out);const s=childState(out);m.output(s,'profile.json',Buffer.from('{}'),16);fs.writeFileSync(path.join(out,'profile.json'),'[]');assert.throws(()=>m.verifyTree(s),/custody-output/);
});
test('replaced created directory cannot retain ownership through moved child inode',async t=>{
 const{d,module:m}=await privateFunctions(t),out=path.join(d,'out');fs.mkdirSync(out);const s=childState(out);m.output(s,'sub/ok',Buffer.from('kept'),8);fs.renameSync(path.join(out,'sub'),path.join(d,'moved'));fs.mkdirSync(path.join(out,'sub'));fs.renameSync(path.join(d,'moved','ok'),path.join(out,'sub','ok'));assert.throws(()=>m.verifyTree(s),/custody-output/);
});
test('same-sized profile content mutation cannot alter the closed source policy',async t=>{
 const d=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'custody-policy-')));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));fs.copyFileSync(new URL('./run.mjs',import.meta.url),path.join(d,'run.mjs'));const source=fs.readFileSync(new URL('./profile.json',import.meta.url),'utf8'),p=JSON.parse(source);fs.writeFileSync(path.join(d,'profile.json'),source.replace(p.seed,'0'.repeat(40)));await assert.rejects(import('file://'+path.join(d,'run.mjs')),/custody-profile/);
});
test('external intent binds revision/tree without self-hashing committed profile',()=>temporary(d=>{
 const profile=JSON.parse(fs.readFileSync(new URL('./profile.json',import.meta.url))),r={root:path.resolve(new URL('../..',import.meta.url).pathname),output:path.join(d,'out'),referenceRoot:d,referenceManifest:path.join(d,'reference.json'),referenceSHA256:'0'.repeat(64),runId:'x',phaseId:'y',mode:'synthetic',expectedRevision:profile.seed,expectedTree:profile.tree};
 assert.equal(api.validateRequest(r).expectedRevision,profile.seed);assert.equal(fs.existsSync(r.output),false);
 for(const k of ['expectedRevision','expectedTree']){const missing={...r};delete missing[k];assert.throws(()=>api.validateRequest(missing),/custody-request/);for(const bad of ['','x'.repeat(40),'0'.repeat(41)])assert.throws(()=>api.validateRequest({...r,[k]:bad}),/custody-request/);}
 assert.throws(()=>api.validateRequest({...r,mode:'actual'}),/custody-request/);
}));
for(const field of ['revision','tree'])test('owned build refuses wrong '+field+' before compiler execution',async()=>{
 const{spawnSync}=await import('node:child_process'),root=path.resolve(new URL('../..',import.meta.url).pathname),git=spawnSync('/usr/bin/git',['rev-parse','HEAD','HEAD^{tree}'],{cwd:root,encoding:'utf8',maxBuffer:4096,timeout:3000});assert.equal(git.status,0);const[revision,tree]=git.stdout.trim().split('\n');const r=spawnSync(process.execPath,[new URL('./run.mjs',import.meta.url).pathname,'--owned-build',root,field==='revision'?'0'.repeat(40):revision,field==='tree'?'0'.repeat(40):tree],{cwd:root,encoding:'utf8',maxBuffer:4096,timeout:3000});assert.equal(r.status,1);assert.equal(r.stdout,git.stdout);assert.match(r.stderr,/custody-compiler/);assert.equal(r.stdout.includes('@chat-ui-bench'),false);
});

test('serialized runtime pairs bind both observed source and physical copied bytes',async t=>{
 const{d,module:m}=await privateFunctions(t),out=path.join(d,'out');fs.mkdirSync(out);const state=childState(out),runtime=[];for(const k of ['run.mjs','profile.json']){const src=path.join(d,'original-'+k);fs.writeFileSync(src,'authored-'+k);const original={key:k,...api.observeFile(src,64)};runtime.push(original);m.copy(state,k,src,original,64);}const rows=m.runtimeRows(runtime,state);assert.equal(rows.length,2);for(let i=0;i<2;i++){assert.equal(rows[i].source.sha256,runtime[i].sha256);assert.equal(rows[i].copied.sha256,runtime[i].sha256);assert.notEqual(rows[i].source.identity[1],rows[i].copied.identity[1]);}assert.equal(JSON.parse(JSON.stringify({runtime:rows})).runtime.length,2);
});
for(const kind of ['source-or-runtime','platform','copy'])test('grown '+kind+' refuses before data read or sink write',async t=>{
 const{d,module:m}=await privateFunctions(t),p=path.join(d,'input');fs.writeFileSync(p,'x');const fact=api.observeFile(p,262144);fs.appendFileSync(p,'growth');let reads=0;const read=fs.readSync;t.mock.method(fs,'readSync',(...a)=>{reads++;return read(...a);});
 try{if(kind==='source-or-runtime')assert.throws(()=>m.unchanged(d,[{key:'input',...fact}],{work:0}),/custody-file/);
 else if(kind==='copy'){const out=path.join(d,'out');fs.mkdirSync(out);assert.throws(()=>m.copy(childState(out),'copied',p,fact,262144),/custody-file/);assert.equal(fs.statSync(path.join(out,'copied')).size,0);}
 else{const source=fs.readFileSync(new URL('./run.mjs',import.meta.url),'utf8'),start=source.indexOf('for(const t of tools)need('),end=source.indexOf(';',start);assert.ok(start>0&&end>start);const check=Function('tools','observeFile','equal','need','state',source.slice(start,end+1));assert.throws(()=>check([{name:'authored-small-platform',path:p,...fact}],api.observeFile,(a,b)=>JSON.stringify(a)===JSON.stringify(b),(v,c)=>{if(!v)throw Error(c);},{budget:{work:0}}),/custody-file/);}
 assert.equal(reads,0);}finally{t.mock.restoreAll();}
});
for(const kind of ['output','copy','stream'])test('created '+kind+' inode cannot be replaced before first readback',async t=>{
 const{d,module:m}=await privateFunctions(t),target=path.join(d,kind==='stream'?'build.stdout.bin':'owned'),source=path.join(d,'input');fs.writeFileSync(source,'x');const fact=api.observeFile(source,1),open=fs.openSync,close=fs.closeSync;let created=null,replaced=false;
 t.mock.method(fs,'openSync',(p,flags,...a)=>{const fd=open(p,flags,...a);if(p===target&&(flags&fs.constants.O_WRONLY))created=fd;return fd;});
 t.mock.method(fs,'closeSync',fd=>{if(fd===created&&!replaced){created=null;const b=fs.readFileSync(target);close(fd);fs.renameSync(target,target+'.old');fs.writeFileSync(target,b,{flag:'wx'});replaced=true;return;}return close(fd);});
 try{if(kind==='output')assert.throws(()=>m.output(childState(d),'owned',Buffer.from('x'),1),/custody-file/);else if(kind==='copy')assert.throws(()=>m.copy(childState(d),'owned',source,fact,1),/custody-file/);else await assert.rejects(()=>m.child(childState(d),'build',[process.execPath,'-e','process.stdout.write("x")'],d,2000,1,1),/custody-file/);assert.equal(replaced,true);}finally{t.mock.restoreAll();}
});
