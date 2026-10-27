import fs from 'node:fs';
import { readOwnedPaintTraceV12ForWorker } from '../../packages/analyzer/dist/browser-frame-owned-paint-v12-reader.js';
import { OwnedPaintBudgetV12 } from '../../packages/analyzer/dist/browser-frame-owned-paint-v12-budget.js';

const policy='private-owned-whole-ordered-paint-r-v12';
const budget=new OwnedPaintBudgetV12('reader');
// All transport operations use the very same branded child/reader ledger.
const releaseInput=budget.reserveTransient({bufferBytes:196608,utf16Units:65536});
const input=Buffer.alloc(65536);let used=0,reads=0;
try{
 for(;;){
  if(++reads>4096)throw Error('worker-request-capacity');
  budget.chargeCumulative('wrapperWork',4*(65536-used)+64);
  if(used===65536){budget.chargeCumulative('wrapperWork',4);const probe=Buffer.alloc(1);if(fs.readSync(0,probe,0,1,null)!==0)throw Error('worker-request-capacity');break;}
  const n=fs.readSync(0,input,used,65536-used,null);
  if(!Number.isSafeInteger(n)||n<0||n>65536-used)throw Error('worker-request-result');
  if(!n)break;budget.chargeCumulative('wrapperWork',4*n);used+=n;
 }
 budget.chargeCumulative('wrapperWork',used*4+64);
 const raw=input.subarray(0,used),text=raw.toString('utf8');
 if(!Buffer.from(text).equals(raw))throw Error('worker-request-utf8');
 // Prepay the one eventual response encoding/write pass before the reader's
 // final usage snapshot. This is a disclosed conservative bound, not measured use.
 budget.chargeCumulative('wrapperWork',12*33554432+16*1048576+4096);
 const result=readOwnedPaintTraceV12ForWorker(text,policy,budget);
 const encoded=JSON.stringify(result);if(Buffer.byteLength(encoded)>33554432)throw Error('worker-output-capacity');
 const bytes=Buffer.from(encoded);let offset=0,calls=0;
 while(offset<bytes.length){if(++calls>1024)throw Error('worker-output-calls');const n=Math.min(65536,bytes.length-offset);if(fs.writeSync(1,bytes,offset,n)!==n)throw Error('worker-output-short');offset+=n;}
}catch{process.exitCode=1;}
finally{releaseInput();}
