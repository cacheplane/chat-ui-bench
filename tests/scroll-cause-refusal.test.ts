import {test,expect} from 'vitest';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

async function api(){const p=resolve('tests/support/hosted-copilot-scroll-cause-refusal.ts');return existsSync(p)?import(pathToFileURL(p).href):{};}

test('only owned finite predicate identities expose refusal codes',async()=>{
 const a=await api();expect(a.diagnosticNeed).toBeTypeOf('function');
 let original:unknown;try{a.diagnosticNeed(false,'diagnostic-case-open');}catch(e){original=e;}
 const line=a.diagnosticRefusalLine(original,'inventory');
 expect(JSON.parse(line)).toMatchObject({action:'inventory',stage:'action',code:'diagnostic-case-open',qualification:false});
 expect(Buffer.byteLength(line)).toBeLessThanOrEqual(1024);
 let touched=0;const hostile=new Proxy({}, {get(){touched++;throw null;},getOwnPropertyDescriptor(){touched++;throw null;},getPrototypeOf(){touched++;throw null;}});
 for(const value of [new Error('secret'),hostile,null,'secret'])expect(JSON.parse(a.diagnosticRefusalLine(value,'inventory')).code).toBe('unclassified');
 expect(touched).toBe(0);
 let wrong:unknown;try{a.diagnosticNeed(false,'secret-not-an-owned-code');}catch(e){wrong=e;}
 expect(JSON.parse(a.diagnosticRefusalLine(wrong,'inventory')).code).toBe('unclassified');
 let hostileCode:unknown;try{a.diagnosticNeed(false,hostile);}catch(e){hostileCode=e;}
 expect(touched).toBe(0);expect(JSON.parse(a.diagnosticRefusalLine(hostileCode,'inventory')).code).toBe('unclassified');
});

test('primary diagnostics copy only bounded native Error own data without getters or proxy traps',async()=>{
 const a=await api();expect(a.diagnosticPrimaryLine).toBeTypeOf('function');
 const original=new Error('literal original\nmessage');Object.defineProperty(original,'stack',{value:'literal original stack',configurable:true});
 expect(JSON.parse(a.diagnosticPrimaryLine(original))).toMatchObject({kind:'unqualified-scroll-cause-primary',message:{status:'available',value:'literal original\nmessage'},stack:{status:'available',value:'literal original stack'},qualification:false,performance:false,fps:'unavailable'});
 let touched=0;Object.defineProperty(original,'message',{get(){touched++;throw null;},configurable:true});Object.defineProperty(original,'stack',{get(){touched++;throw null;},configurable:true});
 expect(JSON.parse(a.diagnosticPrimaryLine(original))).toMatchObject({message:{status:'unavailable'},stack:{status:'unavailable'}});
 const proxy=new Proxy(original,{get(){touched++;throw null;},getOwnPropertyDescriptor(){touched++;throw null;},getPrototypeOf(){touched++;throw null;}});
 expect(JSON.parse(a.diagnosticPrimaryLine(proxy)).status).toBe('unavailable');expect(touched).toBe(0);
});

test('primary record cap includes UTF8, JSON escaping and final newline without truncation',async()=>{
 const a=await api();expect(a.diagnosticPrimaryLine).toBeTypeOf('function');
 for(const value of ['界'.repeat(6000),'\u0000'.repeat(16000),'x'.repeat(16385)]){
  const error=new Error(value);Object.defineProperty(error,'stack',{value,configurable:true});
  const line=a.diagnosticPrimaryLine(error);expect(Buffer.byteLength(line)).toBeLessThanOrEqual(32768);expect(line.endsWith('\n')).toBe(true);
  const record=JSON.parse(line);expect(record.message.status).toBe('unavailable');expect(record.stack.status).toBe('unavailable');
 }
});

test('existing publisher predicates retain exact owned failure codes',async()=>{
 const a=await api();expect(a.diagnosticRefusalLine).toBeTypeOf('function');
 const publisher=await import('./support/hosted-copilot-scroll-cause-artifact.js');let original:unknown;
 try{publisher.diagnosticRecord(null,[]);}catch(e){original=e;}
 expect(JSON.parse(a.diagnosticRefusalLine(original,'inventory')).code).toBe('diagnostic-record');
});

test('the real CLI reports the owned preflight refusal without exposing Git stderr',()=>{
 const r=spawnSync(process.execPath,['--experimental-import-meta-resolve','tools/hosted-copilot-scroll-cause.mjs','preflight'],{cwd:resolve('.'),env:{PATH:'/usr/bin:/bin'},encoding:'utf8'});
 expect(r.status).toBe(1);expect(r.signal).toBeNull();expect(r.stdout).toBe('');
 const refusal=JSON.parse(r.stderr);expect(refusal).toMatchObject({action:'preflight',stage:'action',qualification:false});
 expect(['diagnostic-source-command','diagnostic-clean-checkout','diagnostic-source-context']).toContain(refusal.code);
 expect(Buffer.byteLength(r.stderr)).toBeLessThanOrEqual(1024);
});

test.each([{args:[]},{args:['invalid']},{args:['preflight','extra']}])('invalid CLI shape stays generic for $args',({args})=>{
 const r=spawnSync(process.execPath,['--experimental-import-meta-resolve','tools/hosted-copilot-scroll-cause.mjs',...args],{cwd:resolve('.'),env:{PATH:'/usr/bin:/bin'},encoding:'utf8'});
 expect(r.status).toBe(1);expect(r.stdout).toBe('');expect(r.stderr).toBe('scroll-cause-diagnostic-refused\n');
});
