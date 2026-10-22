import { expect, test, beforeAll, afterAll, beforeEach, inject } from 'vitest';
import {selectFunctionalBuild,authenticateFunctionalBuild,recheckFunctionalBuild,assertVisibleTypingDots} from '../functional-build.mjs';
import {registeredFunctionalProjection,createFunctionalProjectionServer} from '../functional-fixture.js';
import {GRAMMAR} from '../../../tools/native-real-chat/worker-core.mjs';
import { existsSync } from 'node:fs';
import { resolve,join } from 'node:path';
import {tmpdir} from 'node:os';
import { createServer } from 'node:http';
import { writeFile,mkdtemp,rename,rm } from 'node:fs/promises';
import {hasHistoricalCoverage,hasReturnedToFollowing} from '../history-journey.js';
import { chromium, type Browser, type Page } from 'playwright';
import { serveAssets } from '../../../packages/runner/src/server.js';
import { createLongThreadReplayServer } from '@chat-ui-bench/producer';
import { createLongThreadFixture, validateRuntimeTranscript, projectProseDomText } from '@chat-ui-bench/contract';
import type { ReplayEvent } from '@chat-ui-bench/contract';
let assets: Awaited<ReturnType<typeof serveAssets>>, browser: Browser;
let evidenceDirectory:string;
declare module 'vitest' { interface ProvidedContext { threadplaneFunctionalBuild?: string } }
// Vitest 5 inject reads providedContext[key]; missing stock key returns undefined.
const functionalBuild=selectFunctionalBuild(inject('threadplaneFunctionalBuild'));
let authenticatedFunctionalBuild:Awaited<ReturnType<typeof authenticateFunctionalBuild>>|undefined;
// BEGIN private native case ownership
const pendingNativeCases=new Set<Promise<void>>();
function assertNoPendingNativeCase(){if(pendingNativeCases.size)throw new Error('Earlier native conformance case still owns unsettled operations');}
type NativeEvidenceIo={write:(path:string,value:string)=>Promise<void>;publish:(from:string,to:string)=>Promise<void>;remove:(path:string)=>Promise<void>};
async function publishNativeEvidence(owner:NativeCaseOwner,path:string,value:string,io:NativeEvidenceIo={write:writeFile,publish:rename,remove:async path=>rm(path,{force:true})}):Promise<void>{
 const temporary=path+'.pending';let failed=false,error:unknown;
 try{owner.check();await io.write(temporary,value);owner.check();await io.publish(temporary,path);owner.check();}
 catch(value){failed=true;error=value;}
 const results=await Promise.allSettled([(async()=>io.remove(temporary))(),...(failed?[(async()=>io.remove(path))()]:[])]),cleanup=results.flatMap(result=>result.status==='rejected'?[result.reason]:[]);
 if(failed){if(cleanup.length)throw new AggregateError([error,...cleanup],'Native evidence publication and cleanup failures');throw error;}
 if(cleanup.length===1)throw cleanup[0];if(cleanup.length)throw new AggregateError(cleanup,'Native evidence publication cleanup failed');
}
type NativeCaseContext={signal:AbortSignal;onTestFinished:(handler:()=>Promise<void>)=>void};
type NativeCaseOwner={check:()=>void;close:(operation:()=>Promise<unknown>)=>void;stage:<T>(label:string,operation:()=>Promise<T>)=>Promise<T>};
function runOwnedNativeCase(context:NativeCaseContext,name:string,body:(owner:NativeCaseOwner)=>Promise<void>):Promise<void>{
 const closes:{operation:()=>Promise<unknown>;task:Promise<unknown>|undefined}[]=[];
 const check=()=>{if(context.signal.aborted)throw context.signal.reason;};
 function start(close:typeof closes[number]):Promise<unknown>{
   if(!close.task){try{close.task=Promise.resolve(close.operation());}catch(error){close.task=Promise.reject(error);}void close.task.catch(()=>{});}
   return close.task;
 }
 const closeAll=async()=>{const results=await Promise.allSettled(closes.map(start));return results.flatMap(result=>result.status==='rejected'?[result.reason]:[]);};
 const abort=()=>{void closeAll();};context.signal.addEventListener('abort',abort,{once:true});
 const owner:NativeCaseOwner={check,close(operation){const close={operation,task:undefined};closes.push(close);if(context.signal.aborted)start(close);},async stage(label,operation){
   check();const startMs=performance.now();let failed=false;
   console.log('Native conformance stage: '+JSON.stringify({event:'start',case:name,label,clockDomain:'runner-performance-ms',startMs}));
   try{const result=await operation();check();return result;}catch(error){failed=true;throw error;}
   finally{const endMs=performance.now();console.log('Native conformance stage: '+JSON.stringify({event:'end',case:name,label,clockDomain:'runner-performance-ms',startMs,endMs,durationMs:endMs-startMs,failed}));}
 }};
 let reportTimeoutCleanup=false,timeoutCleanupError:unknown;
 const task=(async()=>{
   let primaryFailed=false,primaryError:unknown;
   try{check();await body(owner);check();}catch(error){primaryFailed=true;primaryError=error;}
   const cleanupErrors=await closeAll();context.signal.removeEventListener('abort',abort);
   if(context.signal.aborted){if(primaryFailed&&!Object.is(primaryError,context.signal.reason))cleanupErrors.unshift(primaryError);primaryFailed=true;primaryError=context.signal.reason;}
   if(context.signal.aborted&&cleanupErrors.length){reportTimeoutCleanup=true;timeoutCleanupError=new AggregateError([primaryError,...cleanupErrors],'Native conformance timeout and cleanup failures');throw timeoutCleanupError;}
   if(primaryFailed){if(cleanupErrors.length)throw new AggregateError([primaryError,...cleanupErrors],'Native conformance primary and cleanup failures');throw primaryError;}
   if(cleanupErrors.length===1)throw cleanupErrors[0];if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Native conformance cleanup failed');
 })();
 pendingNativeCases.add(task);void task.then(()=>pendingNativeCases.delete(task),()=>pendingNativeCases.delete(task));
 context.onTestFinished(async()=>{await Promise.allSettled([task]);if(reportTimeoutCleanup)throw timeoutCleanupError;});return task;
}
// END private native case ownership
beforeEach(assertNoPendingNativeCase);
const requestsByPage = new WeakMap<Page, string[]>(), errorsByPage = new WeakMap<Page, string[]>();
beforeAll(async () => { if(functionalBuild)authenticatedFunctionalBuild=await authenticateFunctionalBuild(functionalBuild.id); evidenceDirectory=await mkdtemp(join(tmpdir(),'threadplane-conformance-independent-'));assets = await serveAssets(resolve('apps/threadplane/dist')); browser = await chromium.launch({ headless: true }); });
afterAll(async () => { const results=await Promise.allSettled([(async()=>{await browser?.close();})(),(async()=>{await assets?.close();})()]);const errors=results.flatMap(result=>result.status==='rejected'?[result.reason]:[]);if(pendingNativeCases.size)errors.push(new Error(`${pendingNativeCases.size} native conformance cases remain unsettled after suite closes`));if(authenticatedFunctionalBuild){try{const after=await recheckFunctionalBuild(authenticatedFunctionalBuild);const path=join(evidenceDirectory,'functional-build-bookends.json');await writeFile(path,JSON.stringify({before:authenticatedFunctionalBuild,after,FPS:null},null,2)+'\n');console.log(`Functional build bookends: ${path}`);}catch(error){errors.push(error);}}if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Native conformance suite cleanup failed'); });
async function pageFor(omit?: number,owner?:NativeCaseOwner): Promise<Page> { const page = await browser.newPage({ viewport: { width: 1280, height: functionalBuild ? 720 : 800 }, deviceScaleFactor: 1 });owner?.close(()=>page.close());owner?.check(); const requests: string[] = [], errors: string[] = []; requestsByPage.set(page, requests); errorsByPage.set(page, errors); page.on('request', request => requests.push(request.url())); page.on('pageerror', error => errors.push(String(error))); await page.goto(`${assets.url}/${omit === undefined ? '' : `?conformanceOmitDelta=${omit}`}`);owner?.check(); await page.waitForFunction(() => window.benchHost || window.benchSetupError);owner?.check(); expect(await page.evaluate(() => window.benchSetupError)).toBeUndefined();owner?.check(); return page; }
async function historyDom(page: Page) { return page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('chat-message[data-bench-message-id]')).map(host => { const id = host.dataset['benchMessageId']!, content = host.querySelector(window.benchHost!.locators.messageContent(id));if(content&&(!host.contains(content)||content.closest('chat-message')!==host))throw new Error('Historical content differs from its original native owner'); return { id, role: host.getAttribute('data-role'), text: content?.textContent ?? null }; })); }
test('builds real optimized Threadplane assets for public-runtime conformance', () => {
    expect(existsSync(resolve('apps/threadplane/dist/index.html'))).toBe(true);
});
test('phase boundaries return their actual performance mark timestamps and unique instances',async()=>{
 const page=await pageFor();
 try{const results=await page.evaluate(()=>{const rows=[];for(let i=0;i<500;i++){for(const boundary of ['start','end'] as const){const event=window.benchHost!.markPhase('streaming-follow',boundary);const mark=performance.getEntriesByName(`bench:comparison:${event.phase}:${event.instanceId}:${boundary}`).at(-1)!;rows.push({event,actual:mark.startTime});}}return rows;});
 expect(results.every(row=>row.event.timestampMs===row.actual)).toBe(true);expect(new Set(results.map(row=>row.event.instanceId)).size).toBe(500);
 }finally{await page.evaluate(()=>window.benchHost?.dispose());await page.close();}
});
async function conformanceServer(events: ReplayEvent[]) {
    let disconnected = false;
    const server = createServer((_request, response) => {
        response.writeHead(200, { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' });
        response.flushHeaders();
        let index = 0;
        const timer = setInterval(() => { if (index === events.length) {
            clearInterval(timer);
            response.end();
            return;
        } response.write(`data: ${JSON.stringify(events[index++])}\n\n`); }, 40);
        response.on('close', () => { disconnected = true; clearInterval(timer); });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as {
        port: number;
    };
    return { url: `http://127.0.0.1:${address.port}/replay`, get disconnected() { return disconnected; }, close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
test.each([false, true])('actual runtime Unicode/EOF conformance (premature %s)', async (premature) => {
    const base = createLongThreadFixture({ historyCount: 100, responseBytes: 6400, journey: 'follow' });
    const events: ReplayEvent[] = [{ sequence: 0, scheduledMs: 0, messageId: 'unicode', type: 'assistant-start', text: '' }, { sequence: 1, scheduledMs: 40, messageId: 'unicode', type: 'text-delta', text: 'A🌍é漢字' }, ...premature ? [] : [{ sequence: 2, scheduledMs: 80, messageId: 'unicode', type: 'assistant-complete' as const, text: '' }]];
    const server = await conformanceServer(events), page = await pageFor();
    try {
        await page.evaluate(history => window.benchHost!.loadHistory(history), base.history);
        await page.evaluate(url => window.benchHost!.connectReplay(url), server.url);
        await page.evaluate(() => window.benchHost!.waitForReplay());
        const actual = await page.evaluate(() => window.benchHost!.readTranscript());
        if (premature) {
            expect(actual.outcome).not.toBe('success');
            expect(actual.error).toBeTruthy();
            expect(actual.delivery).toBe('error');
        }
        else {
            expect(validateRuntimeTranscript({ history: base.history, events }, actual)).toEqual([]);
            const dom = await page.evaluate(() => window.benchHost!.readActiveDom());
            expect(dom.text).toBe('A🌍é漢字');
        }
    }
    finally {
        await page.evaluate(() => window.benchHost?.dispose());
        await page.close();
        await server.close();
    }
});
test('reset and idempotent disposal own actual runtime/component and pending network lifecycle', async () => {
    const fixture = createLongThreadFixture({ historyCount: 100, responseBytes: 6400, journey: 'follow' }), producer = await createLongThreadReplayServer({ fixture, repetition: 'lifecycle-1' }), second = await createLongThreadReplayServer({ fixture, repetition: 'lifecycle-2' }), page = await pageFor();
    try {
        await page.evaluate(history => window.benchHost!.loadHistory(history), fixture.history);
        await page.evaluate(url => window.benchHost!.connectReplay(url), producer.url);
        await page.waitForFunction(() => Boolean(window.benchHost!.readProgress().activeMessage?.text));
        await page.evaluate(() => window.benchHost!.resetThread());
        expect((await page.evaluate(() => window.benchHost!.readTranscript())).transcript).toEqual([]);
        const next = fixture.history.map(m => ({ ...m, id: `new-${m.id}` }));
        await page.evaluate(history => window.benchHost!.loadHistory(history), next);
        await page.waitForTimeout(100);
        expect((await page.evaluate(() => window.benchHost!.readTranscript())).transcript).toEqual(next);
        expect(producer.state).toBe('failed');
        await page.evaluate(url => window.benchHost!.connectReplay(url), second.url);
        await page.waitForFunction(() => Boolean(window.benchHost!.readProgress().activeMessage?.text));
        await page.evaluate(async () => { const host = window.benchHost!; await host.dispose(); await host.dispose(); });
        expect(await page.evaluate(() => window.benchHost)).toBeUndefined();
        expect(await page.locator('chat').count()).toBe(0);
        expect(second.state).toBe('failed');
    }
    finally {
        await page.evaluate(() => window.benchHost?.dispose());
        await page.close();
        await producer.close();
        await second.close();
    }
});
test('native history projection preserves published-selector node identity and rejects foreign owner',async context=>runOwnedNativeCase(context,'historical-native-selector',async owned=>{
 const page=await owned.stage('page-create-navigation',()=>pageFor(undefined,owned)),fixture=createLongThreadFixture({historyCount:100,responseBytes:6400,journey:'follow'});
 await owned.stage('load-history',()=>page.evaluate(history=>window.benchHost!.loadHistory(history),fixture.history));
 const original=await owned.stage('global-selector-oracle',()=>page.evaluate(()=>Array.from(document.querySelectorAll<HTMLElement>('chat-message[data-bench-message-id]')).map(host=>{
   const id=host.dataset['benchMessageId']!,selector=window.benchHost!.locators.messageContent(id),global=document.querySelector(selector),local=host.querySelector(selector);
   return {sameNode:global===local,owned:!!local&&host.contains(local)&&local.closest('chat-message')===host,tuple:{id,role:host.getAttribute('data-role'),text:global?.textContent??null}};
 })));
 expect(original).toHaveLength(100);expect(original.every(row=>row.sameNode&&row.owned)).toBe(true);expect(await owned.stage('local-selector-projection',()=>historyDom(page))).toEqual(original.map(row=>row.tuple));
 await owned.stage('foreign-owner-control',()=>page.evaluate(()=>{
   const host=document.querySelector<HTMLElement>('chat-message[data-bench-message-id]')!,nodes=Array.from(host.childNodes),foreign=host.cloneNode(true);
   host.replaceChildren(foreign);(window as any).restoreNativeOwnerControl=()=>{host.replaceChildren(...nodes);delete (window as any).restoreNativeOwnerControl;};
 }));
 await expect(owned.stage('foreign-owner-rejection',()=>historyDom(page))).rejects.toThrow('Historical content differs from its original native owner');owned.check();
 await owned.stage('restore-native-owner',()=>page.evaluate(()=>(window as any).restoreNativeOwnerControl()));
 expect(await owned.stage('restored-projection',()=>historyDom(page))).toEqual(original.map(row=>row.tuple));
 await owned.stage('host-dispose',()=>page.evaluate(()=>window.benchHost?.dispose()));
}));
for(const [historyCount,responseBytes,journey] of [[10000,6400,'history-reading'],[100,262144,'follow'],[10000,262144,'history-reading']] as const)test(`extreme native profile h${historyCount} r${responseBytes} ${journey}`, async context => runOwnedNativeCase(context,`h${historyCount}-r${responseBytes}`,async owned=>{
    const fixture = createLongThreadFixture({ historyCount, responseBytes, journey });
    const producer = await owned.stage('producer-create',async()=>{const producer=await createLongThreadReplayServer({ fixture, repetition: `extreme-${historyCount}-${responseBytes}` });owned.close(()=>producer.close());return producer;});
    const page = await owned.stage('page-create-navigation',()=>pageFor(undefined,owned));
    const requests = requestsByPage.get(page)!;
        await owned.stage('load-history',()=>page.evaluate(history => window.benchHost!.loadHistory(history), fixture.history));
        expect((await owned.stage('initial-transcript',()=>page.evaluate(() => window.benchHost!.readTranscript()))).transcript).toEqual(fixture.history);
        expect((await owned.stage('initial-dom',()=>historyDom(page))).map(m => ({ ...m, text: projectProseDomText(m.text!) }))).toEqual(fixture.history.map(m => ({ id: m.id, role: m.role, text: projectProseDomText(m.text) })));
        const scroller = page.locator('chat .chat-scroll');
        if(journey==='history-reading'){
            const rect=await owned.stage('scroller-box',()=>scroller.boundingBox());await owned.stage('mouse-position',()=>page.mouse.move(rect!.x+rect!.width/2,rect!.y+rect!.height/2));
            await page.evaluate(()=>{
                const scroller=document.querySelector<HTMLElement>('chat .chat-scroll')!;
                const records:unknown[]=[];
                const observe=(kind:string,event?:WheelEvent)=>{
                    const timestampMs=performance.now(),progress=window.benchHost!.readProgress(),text=progress.activeMessage?.text;
                    records.push({kind,clockDomain:'page-performance-ms',timestampMs,scrollTop:scroller.scrollTop,scrollHeight:scroller.scrollHeight,clientHeight:scroller.clientHeight,activeMessageId:progress.activeMessage?.id??null,prefixChars:text?.length??null,prefixUtf8Bytes:text===undefined?null:new TextEncoder().encode(text).length,delivery:progress.delivery,loading:progress.loading,deltaY:event?.deltaY??null,trusted:event?.isTrusted??null});
                };
                const wheel=(event:WheelEvent)=>observe('native-wheel',event),scroll=()=>observe('scroll');
                scroller.addEventListener('wheel',wheel,{passive:true});scroller.addEventListener('scroll',scroll,{passive:true});
                (window as any).readConformanceGesture=()=>({records:[...records]});
                (window as any).closeConformanceGesture=()=>{scroller.removeEventListener('wheel',wheel);scroller.removeEventListener('scroll',scroll);};
            });owned.check();
        }
        await owned.stage('connect-replay',()=>page.evaluate(url => window.benchHost!.connectReplay(url), producer.url));
        await owned.stage('response-mount',()=>page.waitForFunction(id=>document.querySelector(`chat-message[data-bench-message-id="${CSS.escape(id)}"]`),fixture.events[0]!.messageId));
        const mount = await owned.stage('mount-snapshot',()=>page.evaluate(() => ({ timestampMs: performance.now(), progress: window.benchHost!.readProgress(), dom: window.benchHost!.readActiveDom() })));
        const rafs = await page.evaluate(async () => { const times = []; for (let i = 0; i < 2; i++)
            times.push(await new Promise<number>(resolve => requestAnimationFrame(resolve))); return times; });owned.check();
        const geometry = () => owned.stage('geometry',()=>page.evaluate(() => {
            const s = document.querySelector<HTMLElement>('chat .chat-scroll')!,progress=window.benchHost!.readProgress(),rect=s.getBoundingClientRect();
            const viewport={left:Math.max(0,rect.left+s.clientLeft),top:Math.max(0,rect.top+s.clientTop),right:Math.min(innerWidth,rect.left+s.clientLeft+s.clientWidth),bottom:Math.min(innerHeight,rect.top+s.clientTop+s.clientHeight)};
            const id=progress.activeMessage?.id,content=id?document.querySelector(window.benchHost!.locators.messageContent(id)):null;
            let visibleTextRects=0;const clippingAncestors=new Map<Element,{tag:string;className:string;clipX:boolean;clipY:boolean;left:number;top:number;right:number;bottom:number}>();
            if(content){const walker=document.createTreeWalker(content,NodeFilter.SHOW_TEXT);for(let node=walker.nextNode();node;node=walker.nextNode()){
                if(!node.textContent?.trim())continue;
                const clipped={...viewport};
                for(let ancestor=node.parentElement;ancestor;ancestor=ancestor.parentElement){
                    const style=getComputedStyle(ancestor),clipX=/^(hidden|clip|scroll|auto)$/.test(style.overflowX),clipY=/^(hidden|clip|scroll|auto)$/.test(style.overflowY);
                    if(!clipX&&!clipY)continue;
                    const r=ancestor.getBoundingClientRect(),bounds={tag:ancestor.tagName,className:ancestor.className,clipX,clipY,left:r.left+ancestor.clientLeft,top:r.top+ancestor.clientTop,right:r.left+ancestor.clientLeft+ancestor.clientWidth,bottom:r.top+ancestor.clientTop+ancestor.clientHeight};
                    clippingAncestors.set(ancestor,bounds);
                    if(clipX){clipped.left=Math.max(clipped.left,bounds.left);clipped.right=Math.min(clipped.right,bounds.right);}
                    if(clipY){clipped.top=Math.max(clipped.top,bounds.top);clipped.bottom=Math.min(clipped.bottom,bounds.bottom);}
                }
                const range=document.createRange();range.selectNodeContents(node);
                for(const r of range.getClientRects())if(clipped.right>clipped.left&&clipped.bottom>clipped.top&&r.width>0&&r.height>0&&r.bottom>clipped.top&&r.top<clipped.bottom&&r.right>clipped.left&&r.left<clipped.right)visibleTextRects++;
            }}
            return { timestampMs: performance.now(), scrollTop: s.scrollTop, scrollHeight: s.scrollHeight, clientHeight: s.clientHeight, progress,visible: window.benchHost!.readVisibleMessages(),activeContent:{id:id??null,visible:visibleTextRects>0,visibleTextRects,viewport,clippingAncestors:[...clippingAncestors.values()]}, returnVisible: !!document.querySelector('chat button.chat-scroll-bubble') };
        }));
        const wheels:{requestedDeltaCssPx:number;requestedOffsetMs:number;dispatchMs:number;latenessMs:number;clockDomain:'runner-performance-ms'}[]=[];
        if (journey === 'history-reading') {
            const start=performance.now();
            // Independent deadlines: neither producer delivery nor page checkpoints acknowledge inputs.
            const wheelTasks=Array.from({length:4},(_,i)=>new Promise<void>((resolve,reject)=>setTimeout(()=>{
                try{owned.check();}catch(error){reject(error);return;}
                const requestedOffsetMs=i*50,dispatchMs=performance.now();
                wheels.push({requestedDeltaCssPx:-100,requestedOffsetMs,dispatchMs,latenessMs:dispatchMs-start-requestedOffsetMs,clockDomain:'runner-performance-ms'});
                page.mouse.wheel(0,-100).then(()=>{try{owned.check();resolve();}catch(error){reject(error);}},reject);
            },Math.max(0,start+i*50-performance.now()))));
            owned.close(()=>Promise.allSettled(wheelTasks));
            const wheelResults=await Promise.allSettled(wheelTasks),wheelErrors=wheelResults.flatMap(result=>result.status==='rejected'?[result.reason]:[]);
            if(wheelErrors.length===1)throw wheelErrors[0];if(wheelErrors.length)throw new AggregateError(wheelErrors,'Native wheel dispatch failures');owned.check();
        }
        const after = await geometry();
        await owned.stage('overlap-wait',()=>page.waitForTimeout(200));
        const overlap = await geometry();
        const anchor = after.visible.find(m => m.id.startsWith('history-')), laterAnchor = anchor ? overlap.visible.find(m => m.id === anchor.id) : undefined;
        const inputObservation=journey==='history-reading'?await owned.stage('gesture-observation',()=>page.evaluate(()=>(window as any).readConformanceGesture())):null;
        const records=inputObservation?.records??[];
        const firstWheel=records.find((record:any)=>record.kind==='native-wheel')?.timestampMs??Infinity;
        const gestureRecords=records.filter((record:any)=>record.timestampMs>=firstWheel&&record.timestampMs<=after.timestampMs);
        const upwardMovementCssPx=gestureRecords.reduce((maximum:number,record:any,index:number)=>Math.max(maximum,index===0?0:gestureRecords[index-1].scrollTop-record.scrollTop),0);
        const coverage = hasHistoricalCoverage({afterGapCssPx:after.scrollHeight-after.scrollTop-after.clientHeight,overlapGapCssPx:overlap.scrollHeight-overlap.scrollTop-overlap.clientHeight,upwardMovementCssPx,hasAnchor:!!anchor,anchorStillVisible:!!laterAnchor,runtimeUpdated:!!(after.progress.activeMessage&&overlap.progress.activeMessage&&after.progress.activeMessage.text!==overlap.progress.activeMessage.text)});
        let returned = false, afterReturn: Awaited<ReturnType<typeof geometry>> | null = null, laterReturn: Awaited<ReturnType<typeof geometry>> | null = null;
        const control = page.locator('chat button.chat-scroll-bubble');
        if (await owned.stage('return-visible',()=>control.isVisible())) {
            await owned.stage('return-click',()=>control.click());
            await owned.stage('after-return-wait',()=>page.waitForTimeout(100));
            returned = true;
            afterReturn = await geometry();
            await owned.stage('later-return-wait',()=>page.waitForTimeout(100));
            laterReturn = await geometry();
        }
        const responseId=after.progress.activeMessage?.id;
        const returnFollowing=hasReturnedToFollowing({clicked:returned,afterVisible:!!(afterReturn?.activeContent.id===responseId&&afterReturn.activeContent.visible),laterVisible:!!(laterReturn?.activeContent.id===responseId&&laterReturn.activeContent.visible),afterGapCssPx:afterReturn?afterReturn.scrollHeight-afterReturn.scrollTop-afterReturn.clientHeight:Infinity,laterGapCssPx:laterReturn?laterReturn.scrollHeight-laterReturn.scrollTop-laterReturn.clientHeight:Infinity,runtimeUpdated:!!(afterReturn?.progress.activeMessage&&laterReturn?.progress.activeMessage&&afterReturn.progress.activeMessage.id===responseId&&laterReturn.progress.activeMessage.id===responseId&&afterReturn.progress.activeMessage.text!==laterReturn.progress.activeMessage.text)});
        await owned.stage('composer-fill',()=>page.locator('chat textarea.chat-input__textarea').fill('Extreme composer'));
        await owned.stage('terminal-replay',()=>page.evaluate(() => window.benchHost!.waitForReplay()));
        const actual = await owned.stage('final-transcript',()=>page.evaluate(() => window.benchHost!.readTranscript()));
        expect(validateRuntimeTranscript(fixture, actual)).toEqual([]);
        const dom = await owned.stage('final-active-dom',()=>page.evaluate(() => window.benchHost!.readActiveDom()));
        expect(projectProseDomText(dom.text!)).toBe(projectProseDomText(actual.transcript.at(-1)!.text));
        expect(dom.mountedMessageCount).toBe(historyCount + 1);
        const finalGeometry = await geometry();
        expect(finalGeometry.visible.some(m => m.id === actual.transcript.at(-1)!.id)).toBe(true);
        expect(finalGeometry.scrollHeight - finalGeometry.scrollTop - finalGeometry.clientHeight).toBeLessThan(150);
        // Outside replay: independently compare bounded observer candidates with all real host geometry.
        await owned.stage('coverage-wait',()=>page.waitForTimeout(100));
        const coverageSets = await page.evaluate(() => { const s = document.querySelector('chat .chat-scroll')!.getBoundingClientRect(); return { bounded: window.benchHost!.readVisibleMessages().map(m => m.id).sort(), full: Array.from(document.querySelectorAll<HTMLElement>('chat-message[data-bench-message-id]')).filter(host => { const r = host.getBoundingClientRect(); return r.bottom > s.top && r.top < s.bottom; }).map(host => host.dataset['benchMessageId']!).sort() }; });
        owned.check();expect(coverageSets.bounded).toEqual(coverageSets.full);
        expect(requests.every(url => url.startsWith(assets.url) || url.startsWith(producer.url))).toBe(true);
        expect(errorsByPage.get(page)).toEqual([]);
        const pageGesture=journey==='history-reading'?await owned.stage('gesture-close',()=>page.evaluate(()=>{const records=(window as any).readConformanceGesture();(window as any).closeConformanceGesture();return records;})):null;
        owned.check();
        await publishNativeEvidence(owned,`${evidenceDirectory}/h${historyCount}-r${responseBytes}.json`, JSON.stringify({captureId:evidenceDirectory.split('/').at(-1),revision:'independent-native-inputs-v3-observed-return-following',frameworkVersion:'21.2.25',historyCount, responseBytes, journey, mount, rafs, wheels,pageGesture, upwardMovementCssPx,after, overlap, historicalCoverage: coverage, historicalJourneyValidation: journey === 'follow' ? null : { status: coverage&&returnFollowing ? 'valid' : 'invalid', reason: !coverage?'Fixed native gesture did not establish sustained departure beyond the native pin region with a historical anchor overlapping further runtime updates':!returnFollowing?'Native return did not establish visible active response with further updates and continued bottom following':null }, anchorDriftCssPx: anchor && laterAnchor ? laterAnchor.topCssPx - anchor.topCssPx : null, returned,returnFollowing, afterReturn, laterReturn, finalGeometry, requests }, null, 2));
        owned.check();console.log(`Native conformance evidence: ${evidenceDirectory}/h${historyCount}-r${responseBytes}.json`);
        await owned.stage('host-dispose',()=>page.evaluate(() => window.benchHost?.dispose()));
}));
test.each([undefined, 50])('real public runtime and default DOM preserve exact content without omission repair (%s)', async (omit) => {
    const fixture = createLongThreadFixture({ historyCount: 100, responseBytes: 6400, journey: 'follow' }), producer = await createLongThreadReplayServer({ fixture, repetition: `conformance-${omit}` });
    const page = await pageFor(omit);
    try {
        await page.evaluate(history => window.benchHost!.loadHistory(history), fixture.history);
        const initial = await page.evaluate(() => window.benchHost!.readTranscript());
        expect(initial.transcript).toEqual(fixture.history);
        expect(initial.loading).toBe(false);
        expect((await historyDom(page)).map(m => ({ ...m, text: projectProseDomText(m.text!) }))).toEqual(fixture.history.map(m => ({ id: m.id, role: m.role, text: projectProseDomText(m.text) })));
        await page.evaluate(url => window.benchHost!.connectReplay(url), producer.url);
        await page.waitForFunction(() => Boolean(window.benchHost!.readProgress().activeMessage?.text));
        const intermediate = await page.evaluate(() => window.benchHost!.readProgress());
        expect(intermediate.delivery).toBe('streaming');
        await page.locator('chat textarea.chat-input__textarea').fill('Independent composer');
        await page.evaluate(() => window.benchHost!.waitForReplay());
        const actual = await page.evaluate(() => window.benchHost!.readTranscript()), reasons = validateRuntimeTranscript(fixture, actual);
        expect(actual.transcript).toHaveLength(101);
        expect(actual.outcome).toBe('success');
        expect(reasons).toEqual(omit === undefined ? [] : ['Response raw text mismatch']);
        const events = await page.evaluate(() => window.benchHost!.drainCaptureEvents());
        expect(events.filter(e => e.kind === 'receipt')).toHaveLength(202);
        expect(events.filter(e => e.kind === 'translation' && e.data.protocolEvent === 'messages')).toHaveLength(omit === undefined ? 201 : 200);
        const dom = await page.evaluate(() => window.benchHost!.readActiveDom());
        expect(dom.mounted).toBe(true);
        expect(projectProseDomText(dom.text!)).toBe(projectProseDomText(actual.transcript.at(-1)!.text));
        expect(await page.locator('chat textarea').inputValue()).toBe('Independent composer');
        expect(requestsByPage.get(page)!.every(url => url.startsWith(assets.url) || url.startsWith(producer.url))).toBe(true);
        expect(errorsByPage.get(page)).toEqual([]);
    }
    finally {
        await page.evaluate(() => window.benchHost?.dispose());
        await page.close();
        await producer.close();
    }
});

// Standalone functional controls: no trace, native preparation, warmup or FPS estimate.
const functionalTest=test.skipIf(!functionalBuild);
async function idleIndicator(page:Page){
 const state=await page.evaluate(()=>Array.from(document.querySelectorAll<HTMLElement>('chat .chat-scroll > chat-typing-indicator')).map(host=>({empty:host.matches(':empty'),display:getComputedStyle(host).display,height:host.getBoundingClientRect().height,rects:host.getClientRects().length})));
 expect(state.length).toBeLessThanOrEqual(1);
 for(const host of state)expect(host).toEqual({empty:true,display:'none',height:0,rects:0});
 return state.length===1?'present-empty-hidden':'absent';
}
async function functionalHistory(page:Page,fixture:ReturnType<typeof registeredFunctionalProjection>['fixture']){
 expect((await page.evaluate(()=>window.benchHost!.readTranscript())).transcript).toEqual(fixture.history);
 expect((await historyDom(page)).map(row=>({...row,text:projectProseDomText(row.text!)}))).toEqual(fixture.history.map(row=>({id:row.id,role:row.role,text:projectProseDomText(row.text)})));
}
async function functionalGeometry(page:Page){return page.evaluate(()=>{
 const s=document.querySelector<HTMLElement>('chat .chat-scroll')!,r=s.getBoundingClientRect();
 return {top:s.scrollTop,height:s.clientHeight,extent:s.scrollHeight,x:r.x,y:r.y,width:r.width,rectHeight:r.height};
});}
function assertFunctionalRequests(page:Page,producerUrl?:string){
 expect(requestsByPage.get(page)!.every(url=>url.startsWith(assets.url+'/')||(producerUrl!==undefined&&url===producerUrl))).toBe(true);
 expect(errorsByPage.get(page)).toEqual([]);
}
functionalTest('native idle-host CSS functional idle history100 has stable no-wheel geometry',async context=>runOwnedNativeCase(context,'functional-idle-history100',async owned=>{
 const projection=registeredFunctionalProjection(),page=await pageFor(undefined,owned);
 const initialIndicator=await idleIndicator(page);
 await page.evaluate(history=>window.benchHost!.loadHistory(history),projection.fixture.history);
 await functionalHistory(page,projection.fixture);
 const ownership=await page.evaluateHandle(()=>{
  const scroller=document.querySelector<HTMLElement>('chat .chat-scroll')!,nodes=Array.from(document.querySelectorAll('chat-message[data-bench-message-id]')),host=window.benchHost;
  const wheels:WheelEvent[]=[];const listener=(event:WheelEvent)=>wheels.push(event);scroller.addEventListener('wheel',listener,{passive:true});
  return {scroller,nodes,host,wheels,listener};
 });
 owned.close(()=>ownership.dispose());
 const before=await functionalGeometry(page);
 const samples=await page.evaluate(async()=>{
  const read=()=>{const s=document.querySelector<HTMLElement>('chat .chat-scroll')!,r=s.getBoundingClientRect();return {top:s.scrollTop,height:s.clientHeight,extent:s.scrollHeight,x:r.x,y:r.y,width:r.width,rectHeight:r.height};};
  const first=await new Promise<ReturnType<typeof read>>(resolve=>requestAnimationFrame(()=>resolve(read())));
  const second=await new Promise<ReturnType<typeof read>>(resolve=>requestAnimationFrame(()=>resolve(read())));
  return [first,second];
 });
 await page.waitForTimeout(100);
 expect([...samples,await functionalGeometry(page)]).toEqual([before,before,before]);
 expect(await page.evaluate(value=>{const current=Array.from(document.querySelectorAll('chat-message[data-bench-message-id]'));return value.host===window.benchHost&&value.scroller===document.querySelector('chat .chat-scroll')&&current.length===100&&value.nodes.every((node,i)=>node===current[i])&&value.wheels.length===0;},ownership)).toBe(true);
 await page.evaluate(value=>value.scroller.removeEventListener('wheel',value.listener),ownership);
 await functionalHistory(page,projection.fixture);
 const finalIndicator=await idleIndicator(page);assertFunctionalRequests(page);
 console.log(JSON.stringify({functional:'idle-history100',initialIndicator,finalIndicator,fixture:projection.label,digests:projection.digests,FPS:null}));
 await page.evaluate(()=>window.benchHost?.dispose());
}));
functionalTest('native idle-host CSS functional strict single negative wheel preserves extent and native identity',async context=>runOwnedNativeCase(context,'functional-strict-history100',async owned=>{
 const projection=registeredFunctionalProjection(),page=await pageFor(),pageContext=page.context(),mainFrame=page.mainFrame();
 const cleanups:(()=>Promise<unknown>)[]=[];owned.close(async()=>{const errors:unknown[]=[];for(const close of cleanups.reverse()){try{await close();}catch(error){errors.push(error);}}try{await page.close();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Strict functional cleanup failed');});owned.check();
 await page.evaluate(history=>window.benchHost!.loadHistory(history),projection.fixture.history);
 await functionalHistory(page,projection.fixture);await idleIndicator(page);
 const nodes=await page.evaluateHandle(()=>({host:window.benchHost,nodes:Array.from(document.querySelectorAll('chat-message[data-bench-message-id]'))}));cleanups.push(()=>nodes.dispose());
 const session=await pageContext.newCDPSession(page);cleanups.push(()=>session.detach());
 const contexts:{id:number;uniqueId:string;auxData?:{isDefault?:boolean;frameId?:string}}[]=[];let invalidated=false;
 session.on('Runtime.executionContextCreated',event=>contexts.push(event.context));
 session.on('Runtime.executionContextsCleared',()=>{invalidated=true;});session.on('Runtime.executionContextDestroyed',()=>{invalidated=true;});session.on('Page.frameNavigated',()=>{invalidated=true;});
 await session.send('Page.enable');const tree=await session.send('Page.getFrameTree');await session.send('Runtime.enable');
 const selected=contexts.filter(value=>value.auxData?.isDefault&&value.auxData.frameId===tree.frameTree.frame.id);expect(selected).toHaveLength(1);
 const execution=selected[0]!;expect(execution.uniqueId).toBeTruthy();
 const handle=await session.send('Runtime.evaluate',{expression:'document.querySelector("chat .chat-scroll")',uniqueContextId:execution.uniqueId,returnByValue:false});expect(handle.exceptionDetails).toBeUndefined();
 const objectId=handle.result.objectId!;expect(objectId).toBeTruthy();cleanups.push(()=>session.send('Runtime.releaseObject',{objectId}));
 async function call(name:'geometry'|'twoRAF'|'wheelWitness',returnByValue=true,awaitPromise=false){
  const result=await session.send('Runtime.callFunctionOn',{functionDeclaration:GRAMMAR[name],objectId,returnByValue,awaitPromise});expect(result.exceptionDetails).toBeUndefined();return result.result;
 }
 const backend=(await session.send('DOM.describeNode',{objectId})).node.backendNodeId;expect(backend).toBeGreaterThan(0);
 const before=(await call('geometry')).value as Awaited<ReturnType<typeof functionalGeometry>>;
 expect(before.top).toBeGreaterThanOrEqual(1);expect(before.height).toBeGreaterThan(0);expect(before.width).toBeGreaterThan(0);expect(before.rectHeight).toBeGreaterThan(0);expect(before.extent).toBeGreaterThanOrEqual(before.height);expect(before.top).toBeLessThanOrEqual(before.extent-before.height);expect(before.x).toBeGreaterThanOrEqual(0);expect(before.y).toBeGreaterThanOrEqual(0);expect(before.x+before.width).toBeLessThanOrEqual(1280);expect(before.y+before.rectHeight).toBeLessThanOrEqual(720);
 // Original native strict recipe: one CDP wheel, trusted witness, original twoRAF.
 const promise=(await call('wheelWitness',false)).objectId!;expect(promise).toBeTruthy();cleanups.push(()=>session.send('Runtime.releaseObject',{objectId:promise}));
 const deltaY=-Math.min(before.height,before.top),x=before.x+before.width/2,y=before.y+before.rectHeight/2;
 await session.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
 await session.send('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY});
 const witness=await session.send('Runtime.awaitPromise',{promiseObjectId:promise,returnByValue:true});expect(witness.exceptionDetails).toBeUndefined();expect(witness.result.value).toEqual({trusted:true,deltaX:0,deltaY});
 expect((await call('twoRAF',true,true)).value).toBe(true);
 const after=(await call('geometry')).value as typeof before;
 expect(after.top).toBeLessThan(before.top);expect(after.top).toBeGreaterThanOrEqual(0);
 // Stage 53 is exact equality; a changed extent is a failure, never a tolerance.
 for(const key of ['height','extent','x','y','width','rectHeight'] as const)expect(after[key],`strict ${key}`).toBe(before[key]);
 expect((await session.send('DOM.describeNode',{objectId})).node.backendNodeId).toBe(backend);
 expect(invalidated).toBe(false);expect(contexts.filter(value=>value.auxData?.isDefault&&value.auxData.frameId===tree.frameTree.frame.id)).toEqual([execution]);
 expect(page.context()).toBe(pageContext);expect(page.mainFrame()).toBe(mainFrame);expect(page.frames()).toEqual([mainFrame]);
 expect(await page.evaluate(value=>{const current=Array.from(document.querySelectorAll('chat-message[data-bench-message-id]'));return value.host===window.benchHost&&current.length===100&&value.nodes.every((node,i)=>node===current[i]);},nodes)).toBe(true);
 await functionalHistory(page,projection.fixture);const indicator=await idleIndicator(page);assertFunctionalRequests(page);
 console.log(JSON.stringify({functional:'strict-history100',before,after,witness:witness.result.value,indicator,fixture:projection.label,digests:projection.digests,FPS:null}));
 await page.evaluate(()=>window.benchHost?.dispose());
}));
// Actual computed presentation only. Intersections require positive viewport/overflow bounds; no pixel or occlusion check.
async function readTypingPresentation(page:Page){return page.evaluate(()=>{
 const host=document.querySelector<HTMLElement>('chat .chat-scroll > chat-typing-indicator')!,status=host.querySelector<HTMLElement>('[role="status"]')!,dots=Array.from(status.querySelectorAll<HTMLElement>('.chat-typing__dot'));
 const box=(element:HTMLElement)=>{const r=element.getBoundingClientRect();return {width:r.width,height:r.height};};
 return {loading:window.benchHost!.readProgress().loading,text:window.benchHost!.readProgress().activeMessage?.text??'',hostEmpty:host.matches(':empty'),display:getComputedStyle(host).display,host:box(host),status:box(status),label:status.getAttribute('aria-label'),dots:dots.map(dot=>{
  const r=dot.getBoundingClientRect(),style=getComputedStyle(dot);let left=Math.max(0,r.left),top=Math.max(0,r.top),right=Math.min(innerWidth,r.right),bottom=Math.min(innerHeight,r.bottom),effectiveOpacity=1;
  for(let ancestor:HTMLElement|null=dot;ancestor;ancestor=ancestor.parentElement){
   const computed=getComputedStyle(ancestor);effectiveOpacity*=Number(computed.opacity);
   if(ancestor===dot)continue;
   const bounds=ancestor.getBoundingClientRect();
   if(/^(hidden|clip|scroll|auto)$/.test(computed.overflowX)){left=Math.max(left,bounds.left+ancestor.clientLeft);right=Math.min(right,bounds.left+ancestor.clientLeft+ancestor.clientWidth);}
   if(/^(hidden|clip|scroll|auto)$/.test(computed.overflowY)){top=Math.max(top,bounds.top+ancestor.clientTop);bottom=Math.min(bottom,bounds.top+ancestor.clientTop+ancestor.clientHeight);}
  }
  return {box:box(dot),display:style.display,visibility:style.visibility,effectiveOpacity,visibleWidth:Math.max(0,right-left),visibleHeight:Math.max(0,bottom-top),animation:style.animationName,running:dot.getAnimations().some(animation=>animation.playState==='running')};
 })};
});}
functionalTest('native idle-host CSS functional typing presentation after explicit viewport placement streams then hides idle host',async context=>runOwnedNativeCase(context,'functional-active-typing',async owned=>{
 const projection=registeredFunctionalProjection(),producer=await createFunctionalProjectionServer(projection);owned.close(()=>producer.close());
 const page=await pageFor(undefined,owned);await idleIndicator(page);
 await page.evaluate(history=>window.benchHost!.loadHistory(history),projection.fixture.history);await functionalHistory(page,projection.fixture);await idleIndicator(page);
 await page.evaluate(url=>window.benchHost!.connectReplay(url),producer.url);
 const status=page.locator('chat .chat-scroll > chat-typing-indicator [role="status"][aria-label="Assistant is typing"]');
 await status.waitFor({state:'visible'});expect(await status.isVisible()).toBe(true);
 // Position the held pending-response indicator before measuring its viewport presentation.
 await status.scrollIntoViewIfNeeded();
 const active=await readTypingPresentation(page);
 console.log(JSON.stringify({functional:'typing-presentation',presentationSetup:'explicit-status-scroll-into-view; functional-only',dots:active.dots,FPS:null}));
 expect(active.loading).toBe(true);expect(active.text).toBe('');expect(active.hostEmpty).toBe(false);expect(active.display).not.toBe('none');expect(active.host.width).toBeGreaterThan(0);expect(active.host.height).toBeGreaterThan(0);expect(active.status.width).toBeGreaterThan(0);expect(active.status.height).toBeGreaterThan(0);expect(active.label).toBe('Assistant is typing');
 assertVisibleTypingDots(active.dots);
 producer.releaseResponse();await page.waitForFunction(()=>window.benchHost!.readProgress().delivery==='streaming'&&Boolean(window.benchHost!.readProgress().activeMessage?.text));
 expect((await page.evaluate(()=>window.benchHost!.readProgress())).activeMessage!.text.length).toBeGreaterThan(0);
 await page.locator('chat textarea.chat-input__textarea').fill('Functional composer');
 await page.evaluate(()=>window.benchHost!.waitForReplay());
 const actual=await page.evaluate(()=>window.benchHost!.readTranscript());expect(validateRuntimeTranscript(projection.fixture,actual)).toEqual([]);expect(actual.transcript).toHaveLength(101);expect(actual.loading).toBe(false);expect(actual.delivery).toBe('complete');expect(actual.outcome).toBe('success');
 const dom=await page.evaluate(()=>window.benchHost!.readActiveDom());expect(dom.mountedMessageCount).toBe(101);expect(projectProseDomText(dom.text!)).toBe(projectProseDomText(actual.transcript.at(-1)!.text));expect(await page.locator('chat textarea.chat-input__textarea').inputValue()).toBe('Functional composer');
 const indicator=await idleIndicator(page);assertFunctionalRequests(page,producer.url);
 console.log(JSON.stringify({functional:'active-typing',presentationSetup:'explicit-status-scroll-into-view; functional-only',indicator,fixture:projection.label,controlledHold:'before-assistant-start; functional-only; exact canonical history100/events',digests:projection.digests,FPS:null}));
 await page.evaluate(()=>window.benchHost?.dispose());
}));

// Real CSS fault controls use the actual held typing fixture; no benchmark score.
functionalTest('native idle-host CSS functional typing presentation after explicit viewport placement rejects hidden and transparent CSS mutants',async context=>runOwnedNativeCase(context,'functional-typing-visibility-mutants',async owned=>{
 const projection=registeredFunctionalProjection(),producer=await createFunctionalProjectionServer(projection);owned.close(()=>producer.close());
 const page=await pageFor(undefined,owned);
 await page.evaluate(history=>window.benchHost!.loadHistory(history),projection.fixture.history);
 await page.evaluate(url=>window.benchHost!.connectReplay(url),producer.url);
 const status=page.locator('chat .chat-scroll > chat-typing-indicator [role="status"][aria-label="Assistant is typing"]');await status.waitFor({state:'visible'});
 // Use the same explicit viewing position for the baseline and all visibility mutants.
 await status.scrollIntoViewIfNeeded();
 assertVisibleTypingDots((await readTypingPresentation(page)).dots);
 const dotSelector='chat .chat-scroll > chat-typing-indicator .chat-typing__dot';
 for(const [name,css] of [
  ['hidden dots',`${dotSelector} { visibility: hidden !important; }`],
  ['transparent dots',`${dotSelector} { opacity: 0 !important; }`],
  ['transparent ancestor','chat .chat-scroll > chat-typing-indicator { opacity: 0 !important; }']
 ]){
  const style=await page.addStyleTag({content:css!});
  try{
   const measured=await readTypingPresentation(page);expect(measured.loading).toBe(true);expect(measured.text).toBe('');expect(measured.dots).toHaveLength(3);
   for(const dot of measured.dots){expect(dot.box.width).toBeGreaterThan(0);expect(dot.box.height).toBeGreaterThan(0);expect(dot.display).not.toBe('none');expect(dot.animation).not.toBe('none');expect(dot.running).toBe(true);}
   expect(()=>assertVisibleTypingDots(measured.dots),name).toThrow(/Typing dot .* fails visibility\/style\/geometry checks/);
  }finally{await style.evaluate(element=>element.parentNode?.removeChild(element));await style.dispose();}
  assertVisibleTypingDots((await readTypingPresentation(page)).dots);
 }
 assertFunctionalRequests(page,producer.url);
 console.log(JSON.stringify({functional:'typing-visibility-css-mutants',fixture:projection.label,controlledHold:'before-assistant-start; functional-only; exact canonical history100/events',mutants:['visibility:hidden dots','opacity:0 dots','opacity:0 ancestor'],FPS:null}));
 await page.evaluate(()=>window.benchHost?.dispose());
}));
