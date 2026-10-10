import {expect, test, vi} from 'vitest';
import * as api from './index.js';

const create = () => api.createComparisonBuffer('transport');
test('admits exactly 4096 records without eviction and preserves loss after drains', () => {
  const q = create();
  for(let i=0;i<4096;i++) expect(q.enqueue('object', 1, 'n', 'number', i)).toBe(true);
  const stringify = vi.spyOn(JSON, 'stringify');
  expect(q.enqueue('object', 1, 'n', 'number', 4096)).toBe(false);
  expect(stringify).not.toHaveBeenCalled(); stringify.mockRestore();
  expect(q.state()).toMatchObject({pendingEntries:4096, highWaterEntries:4096, overflowCount:1, rejectedRecordCount:1, status:'partial'});
  expect(q.drain(1)).toEqual(['{"n":0}']);
  expect(q.enqueue('null')).toBe(true);
  expect(q.state()).toMatchObject({highWaterEntries:4096, rejectedRecordCount:1});
});
test('accounts exact escaped UTF8 including surrogate handling before serialization', () => {
  const q=create(); const value='"\\\n漢🌍\ud800';
  expect(q.enqueue('string', value)).toBe(true);
  const expected=JSON.stringify(value);
  expect(q.state().pendingSerializedBytes).toBe(new TextEncoder().encode(expected).length);
  expect(q.drain()).toEqual([expected]); expect(q.state().pendingSerializedBytes).toBe(0);
});
test('accepts inclusive record and pending byte limits; rejects before stringify', () => {
  const q=create(), payload='x'.repeat(4194302);
  for(let i=0;i<4;i++) expect(q.enqueue('string',payload)).toBe(true);
  expect(q.state()).toMatchObject({pendingSerializedBytes:16777216, highWaterSerializedBytes:16777216});
  const stringify=vi.spyOn(JSON,'stringify');
  expect(q.enqueue('null')).toBe(false);
  expect(q.enqueue('string',payload+'x')).toBe(false);
  expect(stringify).not.toHaveBeenCalled(); stringify.mockRestore();
  expect(q.state().rejectedRecordCount).toBe(2);
});
test('rejects hostile values without touching accessors, proxies or toJSON', () => {
  const q=create(); const touched=vi.fn(()=>{throw Error('touched');});
  const hostile=new Proxy({get x(){return touched();},toJSON:touched},{get:touched,getOwnPropertyDescriptor:touched,ownKeys:touched});
  expect(q.enqueue('string', hostile as never)).toBe(false);
  expect(touched).not.toHaveBeenCalled(); expect(q.drain()).toEqual([]);
});
test('retains no record on serialization failure and factory has no module closure', () => {
  const isolated=(0,eval)(`(${api.createComparisonBuffer.toString()})`)('transport');
  expect(isolated.enqueue('object',1,'x','string','ok')).toBe(true);
  expect(isolated.drain()).toEqual(['{"x":"ok"}']);
  const q=create(), stringify=vi.spyOn(JSON,'stringify').mockImplementation(()=>{throw Error('serialization');});
  expect(q.enqueue('null')).toBe(false); stringify.mockRestore();
  expect(q.state()).toMatchObject({pendingEntries:0,rejectedRecordCount:1,status:'partial'});
});
test('rejects malformed, duplicate-key, nonfinite and overbudget grammar without retention',()=>{
  const q=create();
  for(const tokens of [['object',2,'x','null','x','null'],['number',NaN],['object',1,'x','null','null'],['array',-1],['string',3]]) expect(q.enqueue(...tokens as never[])).toBe(false);
  expect(q.enqueue(...Array(65537).fill('null'))).toBe(false);
  const deep=Array.from({length:33},()=>['array',1]).flat();
  expect(q.enqueue(...deep,'null')).toBe(false);
  expect(q.state()).toMatchObject({pendingEntries:0,rejectedRecordCount:7});
});
test('external serialization errors retain only bounded diagnostic reason',()=>{
  const q=create(),spy=vi.spyOn(JSON,'stringify').mockImplementation(()=>{throw 'x'.repeat(1000000);});
  expect(q.enqueue('null')).toBe(false);spy.mockRestore();
  expect(q.state().reason).toBe('Record serialization failed');
});
