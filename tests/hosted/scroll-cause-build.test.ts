/** Explicit LOCAL_TEST compiler/browser load only. Never hosted/clean-source admission. */
import {test,expect} from 'vitest';
import {mkdtemp,realpath,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {randomInt} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import * as build from '../support/hosted-copilot-scroll-cause-build.ts';
import {observeDiagnosticBrowserStdio} from '../support/hosted-copilot-scroll-cause-launch.ts';
import {readDiagnosticPhysical,writeDiagnosticRole,readDiagnosticRole} from '../support/hosted-copilot-scroll-cause-artifact.ts';

test('LOCAL_TEST actual Vite build retains shared observer graph and original named HTML launch',async()=>{
 expect((build as any).buildScrollCauseFrontend).toBeTypeOf('function');
 const root=await realpath(resolve('.')),directory=await realpath(await mkdtemp(join(tmpdir(),'scroll-cause-local-build-')));
 const output=await (build as any).buildScrollCauseFrontend(root,directory);
 expect(output.context).toBe('LOCAL_TEST_OR_HOSTED_CALLER_BOUND_BUILD_BYTES_ONLY');
 expect(output.sharedObserver).toEqual({bridgeModules:1,ledgerModules:1,vendorModules:1});
 expect(output.transform.originalSha256).toBe('06f0d457a913752786a32f3f16dff0c5a9c5a8c4877665c31a2e74598db13c09');
 expect(output.inventory.files.some((f:{path:string})=>f.path==='index.html')).toBe(true);
 expect(output.emittedChunks).toBeInstanceOf(Array);
 for(const chunk of output.emittedChunks)expect(output.inventory.files.find((f:{path:string})=>f.path===chunk.path)).toMatchObject({bytes:chunk.bytes,sha256:chunk.sha256});
 const html=await readFile(join(directory,'dist/index.html'),'utf8');expect(html).toContain('<script');
 expect(output.qualification).toBe(false);
 expect(output.html).toMatchObject({originalLaunchCalls:1,originalSha256:createHash('sha256').update(await readFile(join(root,'apps/copilotkit/index.html'))).digest('hex')});
 const {chromium}=await import('playwright');
 const server=createServer(async(request,response)=>{
  try{const path=new URL(request.url??'/', 'http://127.0.0.1').pathname.slice(1)||'index.html',fact=output.inventory.files.find((f:{path:string})=>f.path===path);if(!fact){response.writeHead(404).end();return;}
   const raw=await readFile(join(directory,'dist',path));if(raw.length!==fact.bytes||createHash('sha256').update(raw).digest('hex')!==fact.sha256)throw Error('LOCAL_TEST asset changed');
   response.setHeader('content-type',path.endsWith('.html')?'text/html':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'application/octet-stream');response.end(raw);
  }catch{response.writeHead(500).end();}
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();if(!address||typeof address==='string')throw Error('LOCAL_TEST loopback absent');
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,browserServer:Awaited<ReturnType<typeof chromium.launchServer>>|undefined,closeEvent:Promise<unknown>|undefined,stdio:ReturnType<typeof observeDiagnosticBrowserStdio>|undefined,requests=0,atFetch:unknown;
 const captures=await realpath(await mkdtemp(join(tmpdir(),'scroll-cause-local-browser-')));
 try{
  browserServer=await chromium.launchServer({headless:true,host:'127.0.0.1',port:0});closeEvent=new Promise<void>(done=>browserServer!.once('close',()=>done()));stdio=observeDiagnosticBrowserStdio(captures,browserServer.process());
  browser=await chromium.connect(browserServer.wsEndpoint());const page=await browser.newPage();
  await page.route('**/__bench/context',async route=>{
   requests++;atFetch=await page.evaluate(()=>{const d=Object.getOwnPropertyDescriptor(window,'__copilotkitScrollCauseDiagnostic');if(!d||!('value'in d))return null;const c=d.value;return {protocol:c.protocol,frozen:Object.isFrozen(c),state:c.observer.snapshot().collectionState};});
   // Deliberate LOCAL_TEST mount refusal after the actual entry requested its
   // original context. This is no fixture/benchmark or replacement renderer.
   await route.fulfill({status:409,contentType:'application/json',body:'{}'});
  });
  await page.goto(`http://127.0.0.1:${address.port}`,{waitUntil:'load'});
  await page.waitForFunction(()=>typeof (window as unknown as {__copilotkitBenchSourceError?:string}).__copilotkitBenchSourceError==='string');
  expect(requests).toBe(1);expect(atFetch).toEqual({protocol:'scroll-cause-attribution-v1',frozen:true,state:'inactive'});
 }finally{if(browser)await browser.close();if(browserServer)await browserServer.close();if(closeEvent)await closeEvent;if(stdio){await stdio.closed();expect(stdio.rows.every(row=>row.status==='fulfilled')).toBe(true);for(const row of stdio.rows)if(row.kind!=='protocol'){const f=await readDiagnosticRole(captures,`browser-${row.kind}.bin`);expect(row).toMatchObject({readableEOF:true,writerFinish:true,writerClose:true,writerError:false,overflow:false,seen:f.bytes,retained:f.bytes});}}await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));}
});

test('LOCAL_TEST actual nested worker build and import resolves configured public externals without NODE_PATH',async()=>{
 expect((build as any).buildScrollCauseWorker).toBeTypeOf('function');
 const root=await realpath(resolve('.')),runId=String(BigInt(Date.now())*1000000n+BigInt(randomInt(1000000)));
 const result=await (build as any).buildScrollCauseWorker(root,runId);
 expect(result.launchPath).toBe(`apps/copilotkit/artifacts/scroll-cause/${runId}-1/worker.mjs`);
 const original=await readFile(join(root,result.launchPath));expect(original.length).toBe(result.bytes);expect(createHash('sha256').update(original).digest('hex')).toBe(result.sha256);
 const captures=await realpath(await mkdtemp(join(tmpdir(),'scroll-cause-local-worker-copy-'))),before=await readDiagnosticPhysical(join(root,result.launchPath),16777216),copy=await writeDiagnosticRole(captures,'diagnostic-worker.mjs',before.raw);expect(copy.sha256).toBe(before.sha256);expect(copy.bytes).toBe(before.bytes);
 const script=`const w=await import(${JSON.stringify(result.launchFileUrl)});process.stdout.write(JSON.stringify({exports:Object.keys(w).sort(),invoked:false}));`;
 const imported=await promisify(execFile)(process.execPath,['--experimental-import-meta-resolve','--input-type=module','-e',script],{cwd:root,env:{PATH:'/usr/bin:/bin'},maxBuffer:1048576,timeout:30000});
 expect(JSON.parse(imported.stdout)).toEqual({exports:['projectScrollCauseEvidence','runNativeMountedScrollCauseDiagnostic'],invoked:false});
 expect(imported.stderr).toBe('');
 const after=await readDiagnosticPhysical(join(root,result.launchPath),16777216);expect(after.identity).toEqual(before.identity);expect(after.sha256).toBe(copy.sha256);expect((await readDiagnosticRole(captures,'diagnostic-worker.mjs')).sha256).toBe(copy.sha256);
});
