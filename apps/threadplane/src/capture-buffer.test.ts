import {expect,test,vi} from 'vitest';
import {createAdapterCaptureBuffer} from './capture-buffer.js';
test('known receipt and translation shape admission retains genuine timestamp and text',()=>{
  const q=createAdapterCaptureBuffer();
  const receipt={kind:'receipt',timestampMs:15,sequence:0,data:{event:{type:'assistant-start',sequence:0,scheduledMs:0,messageId:'actual',text:''}}} as const;
  const translation={kind:'translation',timestampMs:16,sequence:1,data:{protocolEvent:'messages',messageId:'actual',text:'🌍'}} as const;
  expect(q.receipt(15,0,'assistant-start',0,'actual','')).toBe(true);expect(q.translation(16,1,'messages','actual','🌍')).toBe(true);
  expect(q.drain()).toEqual([receipt,translation]);expect(q.state()).toMatchObject({pendingEntries:0,highWaterEntries:2});
});
test('known shape preflight refuses oversized translation before serializing',()=>{
  const q=createAdapterCaptureBuffer(),spy=vi.spyOn(JSON,'stringify');
  expect(q.translation(1,1,'messages','actual','x'.repeat(4194304))).toBe(false);
  expect(spy).not.toHaveBeenCalled();spy.mockRestore();
  expect(q.state()).toMatchObject({pendingEntries:0,rejectedRecordCount:1});
});
