import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {types} from 'node:util';
import {SEMANTIC_LARGE_V3_POLICY as policy} from './semantic-large-v3-policy.mjs';
import * as production from './matrix-artifacts-trace-v3.mjs';
const source=await readFile(new URL('./matrix-artifacts-trace-v3.mjs',import.meta.url),'utf8');
const fixedConstructorNames=['createSemanticLarge16StoreV3','createSemanticLarge48StoreV3','createSemanticLargeStock03716StoreV3','createSemanticLargeStock03748StoreV3','createStock037CpuDiagnosticStoreV1','createLocalSharedSignals24StoreV1','createLocalOwnedMarkdown24StoreV1','createLocalOwnedMarkdown24StoreV2','createLocalPostfixTwoSlotStoreV1'];
const roster=family=>Array.from({length:3},(_,round)=>Array.from({length:4},(_,stratum)=>((round+stratum)%2?['candidate','control']:['control','candidate']).map(role=>`threadplane-h${stratum<2?1000:10000}-r6400-${stratum%2?'history-reading':'follow'}-${family}-${role}-round-${round+1}`))).flat(2);
const ids=['threadplane-h10000-r6400-follow-local-postfix-two-slot-v1-candidate','threadplane-h10000-r6400-history-reading-local-postfix-two-slot-v1-candidate'];
// Actual store source with authored in-memory FS/clock only. No real roots/IO.
function stock037Model(constructorName) {
  const directory = '/authored/invocation';
  let ino = 1n;
  const nodes = new Map([['/authored', {ino: ino++, directory: true, bytes: Buffer.alloc(0)}]]);
  const calls = [];
  const stat = node => ({dev: 1n, ino: node.ino, nlink: 1n, size: BigInt(node.bytes.length), mtimeNs: 1n, ctimeNs: 1n,
    isDirectory: () => node.directory, isSymbolicLink: () => false, isFile: () => !node.directory});
  const io = {
    async lstat(file) {assert.ok(nodes.has(file), `authored path missing: ${file}`); return stat(nodes.get(file));},
    async realpath(file) {assert.ok(nodes.has(file)); return file;},
    async statfs() {return {bsize: 1n, bavail: 100n * 1024n ** 3n};},
    async mkdir(file) {assert.equal(nodes.has(file), false); nodes.set(file, {ino: ino++, directory: true, bytes: Buffer.alloc(0)});},
    async open(file, flags) {
      if (flags & constants.O_CREAT) {
        assert.equal(nodes.has(file), false);
        nodes.set(file, {ino: ino++, directory: false, bytes: Buffer.alloc(0)});
      }
      assert.ok(nodes.has(file));
      const node = nodes.get(file);
      return Object.fromEntries(Object.entries({
        async stat() {return stat(node);},
        async writeFile(bytes) {node.bytes = Buffer.from(bytes);},
        async sync() {}, async close() {},
        async read(buffer, offset, length, position) {return {bytesRead: node.bytes.copy(buffer, offset, position, position + length)};},
      }).map(([method, implementation]) => [method, async (...args) => {
        calls.push({method: `descriptor.${method}`, args}); return implementation(...args);
      }]));
    },
  };
  const fakeFS = Object.fromEntries(Object.entries(io).map(([method, implementation]) => [method, async (...args) => {
    calls.push({method, args}); return implementation(...args);
  }]));
  const body = source.replace(/^import .*;\n/gm, '').replace(/export /g, '');
  // typeof makes an absent constructor an explicit contract assertion, rather
  // than an undefined binding/import error in the source-extracted harness.
  const entries = fixedConstructorNames.map(name => `${name}: typeof ${name} === 'function' ? ${name} : null`).join(',');
  const api = vm.runInNewContext(`(function(){${body}\nreturn {${entries}};})()`,
    {fs: fakeFS, constants, path, createHash, types, Buffer, TextDecoder, performance: {now: () => 100}, SEMANTIC_LARGE_V3_POLICY: policy});
  assert.equal(typeof api[constructorName], 'function', `API absence only: missing fixed constructor ${constructorName}`);
  return {calls, directory, create: (...args) => api[constructorName](...args), async store() {return api[constructorName]({directory, invocationStarted: 0});}};
}

for(const name of fixedConstructorNames.slice(0,-1))test('current '+name+' rejects every postfix ID before new filesystem work',async()=>{
 const m=stock037Model(name),store=await m.store(),before=m.calls.length;
 for(const id of ids){await assert.rejects(store.requireSpaceBeforeNextCaseV3(id),/roster/);await assert.rejects(store.beginCase(id),/grant/);}
 assert.equal(m.calls.length,before);
});
test('postfix explicit literal2 IDs exactly match the reviewed schedule and named constructor',()=>{
 assert.equal(typeof production.createLocalPostfixTwoSlotStoreV1,'function','API absence only: postfix independent named store');
 const found=source.match(/const LOCAL_POSTFIX_TWO_SLOT_IDS_V1 = Object\.freeze\(\[([\s\S]*?)\]\);/);assert.ok(found,'postfix source-authored literal2 roster');assert.deepEqual([...found[1].matchAll(/'([^']+)'/g)].map(m=>m[1]),ids);
});
test('postfix store all2 ordered originals keep exact reservation and space checks',async()=>{
 const m=stock037Model('createLocalPostfixTwoSlotStoreV1'),store=await m.store();assert.equal(store.stats().invocationReservation,(2*96+3)*1048576);
 for(const id of ids){await store.requireSpaceBeforeNextCaseV3(id);await store.beginCase(id);}
 assert.equal(store.stats().caseReservation,2*96*1048576);assert.equal(store.stats().spaceChecks.length,3);await assert.rejects(store.requireSpaceBeforeNextCaseV3(ids[0]),/roster/);
});
test('postfix store refuses swapped/omitted/duplicate/extra and other-policy IDs before filesystem work',async()=>{
 const m=stock037Model('createLocalPostfixTwoSlotStoreV1'),store=await m.store(),before=m.calls.length;
 for(const id of [ids[1],...roster('local-shared-signals-v1'),...roster('local-owned-markdown-v1'),'threadplane-h10000-r6400-follow-stock037-cpu-samples-v1','ordinary-stock-id']){await assert.rejects(store.requireSpaceBeforeNextCaseV3(id),/roster/);await assert.rejects(store.beginCase(id),/grant/);}
 assert.equal(m.calls.length,before);await store.requireSpaceBeforeNextCaseV3(ids[0]);await store.beginCase(ids[0]);const after=m.calls.length;await assert.rejects(store.requireSpaceBeforeNextCaseV3(ids[0]),/roster/);await assert.rejects(store.beginCase(ids[0]),/grant/);assert.equal(m.calls.length,after);
});

test('two-slot store retains case failure, final manifest and invocation failure writers under original caps',async()=>{const m=stock037Model('createLocalPostfixTwoSlotStoreV1'),store=await m.store();await store.requireSpaceBeforeNextCaseV3(ids[0]);const record=await store.beginCase(ids[0]);await assert.rejects(record.writeJSON('too-large.json','x'.repeat(policy.storage.kinds.evidence+1)),/file-cap/);assert.equal(record.stats().failed,true);await assert.rejects(record.writeJSON('ordinary-after-failure.json',{}),/case-failed/);const failure=await record.writeJSON('failure.json',{original:true},{kind:'failure'});assert.deepEqual(JSON.parse(JSON.stringify(await store.readJSON(failure,{kind:'failure'}))),{original:true});await assert.rejects(record.writeJSON('second-failure.json',{}, {kind:'failure'}),/reserve-attempted/);const final=await store.writeManifest('manifest-final.json',{complete:false});assert.ok(final.bytes>0);await assert.rejects(store.writeManifest('manifest-final.json',{}),/attempted/);const invocation=await store.writeInvocationFailureV3({originalFailure:true});assert.ok(invocation.bytes>0);await assert.rejects(store.writeInvocationFailureV3({}),/attempted/);assert.equal(store.stats().pendingOriginals,0);assert.equal(store.stats().pendingWriters,0);assert.equal(store.stats().stopped,true);});
test('two-slot failure reserve attempt is consumed on cap refusal, no retry or new IO',async()=>{const m=stock037Model('createLocalPostfixTwoSlotStoreV1'),store=await m.store();await store.requireSpaceBeforeNextCaseV3(ids[0]);const record=await store.beginCase(ids[0]),before=m.calls.length;await assert.rejects(record.writeJSON('failure-too-large.json','x'.repeat(policy.storage.kinds.failure+1),{kind:'failure'}),/file-cap/);await assert.rejects(record.writeJSON('failure-retry.json',{}, {kind:'failure'}),/reserve-attempted/);assert.equal(m.calls.length,before);await assert.rejects(store.writeInvocationFailureV3('x'.repeat(policy.storage.invocationFailureReserveBytes+1)),/file-cap/);await assert.rejects(store.writeInvocationFailureV3({}),/attempted/);assert.equal(m.calls.length,before);});
