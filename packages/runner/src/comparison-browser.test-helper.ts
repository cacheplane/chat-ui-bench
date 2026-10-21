import type {OriginalCaptureReceipt, OriginalCaptureBucket} from './comparison-lifecycle-oracle.js';
export {deriveAdmittedLifecycle, type OriginalCaptureReceipt, type OriginalCaptureBucket} from './comparison-lifecycle-oracle.js';
import type {ComparisonRuntimeIdentity as ComparisonIdentity} from './comparison-runtime-family.js';
import {createHash} from 'node:crypto';
import {createServer, get, type ClientRequest, type ServerResponse} from 'node:http';
import {mkdtemp,mkdir, readFile, readdir, lstat, writeFile, open} from 'node:fs/promises';
import {join, resolve, dirname} from 'node:path';
import {constants,type BigIntStats} from 'node:fs';
import type {FileHandle} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import type {Socket} from 'node:net';
import {chromium, type Browser, type BrowserContext, type Page,type CDPSession,type Locator} from 'playwright';
import {createLongThreadReplayServer} from '@chat-ui-bench/producer';
import {
  canonicalSerialize, createLongThreadFixture, comparisonScheduledRunSchema,
  comparisonCaptureStatusSchema, comparisonExceptionsSchema, comparisonEvidenceSchema, comparisonRawInventorySchema,
  comparisonObservationSchema, comparisonCheckpointsSchema, comparisonNativeDispatchResultsSchema,
  comparisonFinalRuntimeSchema, comparisonVisibleValidationSchema, comparisonProvenanceAcquisitionSchema,
  comparisonManifestSchema, comparisonValidationSchema,
  comparisonDatasetInventorySchema, comparisonCaptureInvocationSchema,
  adapterBuildSchema, comparisonInstrumentationBuildSchema,
  type LongThreadCaptureHost,
} from '@chat-ui-bench/contract';
import {ComparisonArtifactWriter, type ComparisonScopedWriter} from './comparison-artifacts.js';
import {ComparisonOwnership, type ComparisonStageResult} from './comparison-ownership.js';
import {parseLongThreadArgs, type LongThreadConfiguration} from './long-thread-cli.js';
import {createLongThreadLedger, runLongThreadInvocation, type ComparisonInvocationExecution, type ComparisonSlotContext, type ComparisonSlotCapture, type ComparisonSlotFinalization} from './long-thread-run.js';
import {createLongThreadCaptureDriver, type AcquiredSlot, type LongThreadCaptureDependencies} from './long-thread-capture.js';
import {serveAssets} from './server.js';
import {createComparisonTraceCapture} from './comparison-trace.js';

export const originalRoot = resolve('.');
export const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export function configuration(out: string): LongThreadConfiguration {
  const config = parseLongThreadArgs(['--mode', 'headless', '--rounds', '1', '--out', out]);
  if (config.help) throw new Error('Unexpected help configuration');
  return config;
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {resolve = done;});
  return {promise, resolve};
}
export class Resources {
  private releases: (() => void)[] = [];
  private closes: (() => Promise<unknown>)[] = [];
  readonly tasks: Promise<unknown>[] = [];
  release(call: () => void) {this.releases.push(call);}
  close(call: () => Promise<unknown>) {this.closes.push(call);}
  observe<T>(task: Promise<T>): Promise<T> {
    this.tasks.push(task); void task.catch(() => {}); return task;
  }
  async settle() {
    // Every independent release and close starts before the first join.
    const errors: unknown[] = [];
    for (const release of this.releases) {try {release();} catch (error) {errors.push(error);}}
    const closing: Promise<unknown>[] = [];
    for (const close of this.closes) {try {closing.push(this.observe(close()));} catch (error) {errors.push(error);}}
    const results = await Promise.allSettled([...closing, ...this.tasks]);
    errors.push(...results.flatMap(result => result.status === 'rejected' ? [result.reason] : []));
    return errors;
  }
}
type Interceptors<T> = Partial<Record<keyof T, (args: unknown[], invoke: (replacement?: unknown[]) => unknown) => unknown>>;
/** The proxy retains the real target and method receivers, including overloads. */
export function intercept<T extends object>(target: T, methods: Interceptors<T>): T {
  return new Proxy(target, {get(actual, key) {
    const value: unknown = Reflect.get(actual, key, actual);
    if (typeof value !== 'function') return value;
    const handler = methods[key as keyof T];
    return (...args: unknown[]) => handler ? handler(args, replacement => Reflect.apply(value, actual, replacement ?? args)) : Reflect.apply(value, actual, args);
  }});
}
export interface BrowserControl {
  context?: ComparisonSlotContext;
  page?: Page;
  browserContext?: BrowserContext;
  closeInvocations: {name: string; at: number}[];
  nativeSessions?:{kind:'browser'|'target';acquiredAt:number;detachAt:number|null}[];
  evaluate?: (page: Page, args: unknown[], invoke: () => unknown) => unknown;
  wrapContext?: (context: BrowserContext) => BrowserContext;
  replayServer?: typeof createLongThreadReplayServer;
  createTrace?: LongThreadCaptureDependencies['createTrace'];
  traceCausal?:boolean;traceCausalStates?:OriginalTraceCausalState[];
}
export function browserDependencies(resources: Resources, control: BrowserControl): LongThreadCaptureDependencies {
  function closeOnce(name: string, invoke: () => Promise<void>) {
    let actual: Promise<void> | undefined;
    return () => {
      if (!actual) {
        control.closeInvocations.push({name, at: performance.now()});
        try {actual = invoke();} catch (error) {actual = Promise.reject(error);}
        resources.observe(actual);
      }
      return actual;
    };
  }
  function nativeSession(session:CDPSession,kind:'browser'|'target'){const receipt={kind,acquiredAt:performance.now(),detachAt:null as number|null};(control.nativeSessions??=[]).push(receipt);const detach=closeOnce(`${kind}-CDP-detach`,()=>{receipt.detachAt=performance.now();return session.detach();});resources.close(detach);return intercept(session,{detach:()=>detach()});}
  return {
    async launch(options) {
      const browser = await chromium.launch(options);
      const closeBrowser = closeOnce('browser', () => browser.close()); resources.close(closeBrowser);
      return intercept<Browser>(browser, {
        close: () => closeBrowser(),
        newBrowserCDPSession:async (_args,invoke)=>nativeSession(await(invoke() as Promise<CDPSession>),'browser'),
        newContext: async (_args, invoke) => {
          const context = await (invoke() as Promise<BrowserContext>);
          const closeContext = closeOnce('context', () => context.close()); resources.close(closeContext);
          const wrapped = intercept<BrowserContext>(context, {
            close: () => closeContext(),
            newCDPSession:async (_args,invoke)=>nativeSession(await(invoke() as Promise<CDPSession>),'target'),
            newPage: async (_args, call) => {
              const page = await (call() as Promise<Page>);
              const closePage = closeOnce('page', () => page.close()); resources.close(closePage); control.page = page;
              return intercept<Page>(page, {
                close: () => closePage(),
                evaluate: (args, evaluate) => control.evaluate ? control.evaluate(page, args, evaluate) : evaluate(),
              });
            },
          });
          control.browserContext = context;
          return control.wrapContext ? control.wrapContext(wrapped) : wrapped;
        },
      });
    },
    async serveAssets(path) {
      const assets = await serveAssets(path), close = closeOnce('assets', () => assets.close()); resources.close(close);
      return {...assets, close};
    },
    async createReplayServer(options) {
      const producer = await (control.replayServer ?? createLongThreadReplayServer)(options);
      const close = closeOnce('producer', () => producer.close()); resources.close(close);
      return {get url() {return producer.url;}, get suite() {return producer.suite;}, get repetition() {return producer.repetition;},
        get state() {return producer.state;}, drain: () => producer.drain(), close};
    },
    ...(control.createTrace||control.traceCausal?{createTrace(options){
      if(!control.traceCausal)return control.createTrace!(options);
      const state=new OriginalTraceCausalState(options.context);(control.traceCausalStates??=[]).push(state);
      const session=intercept<CDPSession>(options.session,{send:(args,invoke)=>state.observe('session.send',args,invoke),detach:(args,invoke)=>state.observe('session.detach',args,invoke)});
      const trace=(control.createTrace??createComparisonTraceCapture)({...options,session});
      return intercept(trace,{start:(args,invoke)=>state.observe('trace.start',args,invoke),finish:(args,invoke)=>state.observe('trace.finish',args,invoke),close:(args,invoke)=>state.observe('trace.close',args,invoke),snapshot:(_args,invoke)=>{const actual=invoke();state.snapshot(actual);return actual;}});
    }}:{}),
  };
}
export interface DirectResult {
  directory: string; identity: ComparisonIdentity; fixture: ComparisonSlotContext['fixture'];
  owner: ComparisonOwnership; setup: ComparisonStageResult<AcquiredSlot>;
  replay: ComparisonStageResult<ComparisonSlotCapture> | undefined;
  disposal: ComparisonStageResult<void>; capture: ComparisonSlotCapture | null;
  finalization: void | ComparisonSlotFinalization;
  operationFailures: {stage: string; error: unknown}[];
  cleanupFailures: unknown[];
}
export async function directCase(caseIndex: number, control: BrowserControl,
  inspect: (result: DirectResult) => Promise<void>, prepare?: (resources: Resources) => void,
  located?: (directory: string) => void) {
  const resources = new Resources();
  let failed = false, originalError: unknown, owner: ComparisonOwnership | undefined;
  let receiptDirectory: string | undefined;
  let disposal: Promise<ComparisonStageResult<void>> | undefined;
  try {
    prepare?.(resources);
    receiptDirectory = await mkdtemp(join(tmpdir(), 'comparison-browser-direct-'));
    const directory = join(receiptDirectory, 'raw');
    const config = configuration(directory), slot = createLongThreadLedger(config).runs[caseIndex]!;
    const identity: ComparisonIdentity = {schemaVersion: 2, suite: 'long-thread-prose-v1', suiteVersion: '1.0.0', collectorVersion: '2.0.0', analyzerVersion: '2.0.0',
      repetition: slot.repetition, scenarioId: slot.scenarioId, round: slot.round, caseIndex: slot.caseIndex, adapterProfile: slot.adapterProfile};
    owner = new ComparisonOwnership();
    const owned = owner, dispose = () => disposal ??= owned.dispose();
    resources.close(dispose);
    const writer = await ComparisonArtifactWriter.create(directory);
    resources.close(() => writer.drain());
    located?.(directory);
    const fixture = createLongThreadFixture({seed: config.configuration.seed, historyCount: ([100, 1000, 10000] as const)[Math.floor(caseIndex / 4)]!, responseBytes: caseIndex % 4 < 2 ? 6400 : 262144, journey: caseIndex % 2 === 0 ? 'follow' : 'history-reading'});
    const descriptor = comparisonScheduledRunSchema.parse({...identity, seed: config.configuration.seed, mode: 'headless', artifactDirectory: slot.artifactDirectory});
    await writer.json('descriptor.json', descriptor); await writer.text('fixture.json', canonicalSerialize(fixture));
    for (const path of ['page.jsonl', 'producer.jsonl', 'trace.json']) await writer.text(path, '');
    const driver = createLongThreadCaptureDriver({originalRoot, configuration: config}, browserDependencies(resources, control));
    const operationFailures: DirectResult['operationFailures'] = [];
    function context(ownership: ComparisonSlotContext['ownership']): ComparisonSlotContext {
      const scoped = writer.scoped(() => ownership.assertActive());
      const stream: ComparisonScopedWriter['stream'] = async path => {
        const raw = await scoped.stream(path); await ownership.adopt({name: `artifact-stream:${path}`, close: () => raw.complete()}); return raw;
      };
      return {identity, descriptor, fixture, ownership, writer: {...scoped, stream}};
    }
    const setup = await owned.run('setup', async ownership => {
      await ownership.adopt({name: 'artifact-writer-drain', close: () => writer.drain()});
      const ctx = context(ownership); control.context = ctx;
      try {return await driver.setup(ctx);} catch (error) {operationFailures.push({stage: 'setup', error}); throw error;}
    });
    let replay: DirectResult['replay'], capture: ComparisonSlotCapture | null = null;
    if (setup.status === 'complete') {
      replay = await owned.run('replay', async ownership => {
        const ctx = context(ownership); control.context = ctx;
        try {return await driver.replay(ctx, setup.value);} catch (error) {operationFailures.push({stage: 'replay', error}); throw error;}
      });
      if (replay.status === 'complete') capture = replay.value;
    }
    const disposed = await dispose();
    const cleanupFailures = await resources.settle(); await owned.ownershipSettled;
    const deadlines = Object.freeze(owned.deadlines.map(value => Object.freeze({...value})));
    const finalization = await driver.finalize?.({identity, writer: writer.scoped(() => {}), deadlines}, capture);
    if (finalization) await writer.json('capture-status.json', finalization.captureStatus);
    await writer.json('validation.json', capture?.validation ?? comparisonValidationSchema.parse({...identity, status: 'failed', reasons: ['Capture did not complete'], checks: [{name: 'actual-capture', passed: false, reason: 'Capture did not complete', evidencePaths: ['descriptor.json']}]}));
    await writer.json('exceptions.json', comparisonExceptionsSchema.parse({...identity, exceptions: owned.failures.map(row => ({
      source: 'runner', stage: row.stage, clockDomain: 'host-monotonic-ms', timestampMs: row.timestampMs,
      message: row.resource ? `${row.resource}: ${row.message}` : row.message, stack: row.stack, severity: 'error',
    }))}));
    await inspect({directory, identity, fixture, owner: owned, setup, replay, disposal: disposed, capture, finalization, operationFailures, cleanupFailures});
  } catch (error) {failed = true; originalError = error;}
  finally {
    const secondaryFailures = await resources.settle();
    if (owner) await owner.ownershipSettled;
    if (receiptDirectory) {
      try {await writeFile(join(receiptDirectory, 'case-result.json'), JSON.stringify({caseIndex, failed,
        ...(failed ? {originalFailure: {type: typeof originalError, rendered: String(originalError)}} : {}),
        cleanupFailures: secondaryFailures.map(error => ({type: typeof error, rendered: String(error)})),
        deadlines: owner?.deadlines, ownershipFailures: owner?.failures, closeInvocations: control.closeInvocations,
      }, null, 2) + '\n');}
      catch (error) {if (!failed) {failed = true; originalError = error;} else console.error('Unable to retain external case receipt', error);}
    }
  }
  if (failed) throw originalError;
}

export interface ForwardFacts {
  startAdmitted: number | null; firstTextAdmitted: number | null;
  upstreamConnections: number; downstreamConnections: number;
  closeStarted: number | null; closeSettled: number | null; released: number | null;
  fallbackUsed: boolean;
}
export function forwardingFactory(resources: Resources, holdText: boolean, activeDiagnostic = false) {
  const released = deferred<void>(), start = deferred<void>(), diagnosticAccepted = deferred<void>();
  const facts: ForwardFacts = {startAdmitted: null, firstTextAdmitted: null, upstreamConnections: 0, downstreamConnections: 0, closeStarted: null, closeSettled: null, released: null, fallbackUsed: false};
  let allowText = !holdText, releaseTimer: ReturnType<typeof setTimeout> | undefined;
  let diagnosticResponse: ServerResponse | undefined, diagnosticRequest: ClientRequest | undefined;
  const sockets = new Set<Socket>(), requests = new Set<ClientRequest>();
  const release = () => {
    if (facts.released === null) facts.released = performance.now();
    allowText = true; released.resolve(); diagnosticResponse?.end(); diagnosticRequest?.destroy();
    if (releaseTimer !== undefined) clearTimeout(releaseTimer);
  };
  resources.release(release);
  const factory: typeof createLongThreadReplayServer = async options => {
    const upstream = await createLongThreadReplayServer(options); resources.close(() => upstream.close());
    let closeAttempt: Promise<void> | undefined;
    const listener = createServer((request, response) => {
      if (activeDiagnostic && request.url === '/__held-diagnostic') {
        diagnosticResponse = response; response.writeHead(200, {'content-type': 'text/plain'}); response.write('active'); diagnosticAccepted.resolve(); return;
      }
      if (request.url !== '/replay') {response.writeHead(404); response.end(); return;}
      facts.downstreamConnections++;
      const outgoing = get(upstream.url, incoming => {
        facts.upstreamConnections++;
        response.writeHead(incoming.statusCode ?? 502, incoming.headers); response.flushHeaders();
        let pending = Buffer.alloc(0), queued: Buffer[] = [], queuedBytes = 0;
        const write = (frame: Buffer) => {
          if (frame.includes(Buffer.from('"type":"assistant-start"'))) {
            facts.startAdmitted = performance.now(); start.resolve();
            if (holdText) releaseTimer = setTimeout(() => {facts.fallbackUsed = true; release();}, 10000);
          }
          if (frame.includes(Buffer.from('"type":"text-delta"')) && facts.firstTextAdmitted === null) facts.firstTextAdmitted = performance.now();
          response.write(frame);
        };
        incoming.on('data', (chunk: Buffer) => {
          pending = Buffer.concat([pending, chunk]);
          for (;;) {
            const end = pending.indexOf('\n\n'); if (end < 0) break;
            const frame = pending.subarray(0, end + 2); pending = pending.subarray(end + 2);
            if (!allowText && !frame.includes(Buffer.from('"type":"assistant-start"'))) {
              queued.push(frame); queuedBytes += frame.length;
              if (queuedBytes > 2 * 1024 * 1024) {incoming.destroy(new Error('Held original SSE byte budget exceeded')); release();}
            } else write(frame);
          }
        });
        resources.observe(released.promise.then(() => {for (const frame of queued) write(frame); queued = []; queuedBytes = 0;}));
        incoming.on('end', () => {
          const finish = () => {if (pending.length) response.write(pending); response.end();};
          if (allowText) finish(); else resources.observe(released.promise.then(finish));
        });
        incoming.on('error', error => response.destroy(error));
      });
      requests.add(outgoing); outgoing.once('close', () => requests.delete(outgoing));
      outgoing.on('error', error => response.destroy(error)); response.once('close', () => outgoing.destroy());
    });
    listener.on('connection', socket => {sockets.add(socket); socket.once('close', () => sockets.delete(socket));});
    resources.release(() => {for (const request of requests) request.destroy(); for (const socket of sockets) socket.destroy();});
    const close = () => {
      if (closeAttempt) return closeAttempt;
      facts.closeStarted = performance.now();
      if (activeDiagnostic) releaseTimer = setTimeout(() => {facts.fallbackUsed = true; release();}, 12000);
      const upstreamClose = resources.observe(upstream.close());
      const listenerClose = new Promise<void>((done, reject) => listener.close(error => {
        facts.closeSettled = performance.now(); error ? reject(error) : done();
      }));
      void listenerClose.catch(() => {});
      closeAttempt = Promise.all([upstreamClose, listenerClose]).then(() => {}); void closeAttempt.catch(() => {}); return closeAttempt;
    };
    resources.close(close);
    await new Promise<void>((done, reject) => {listener.once('error', reject); listener.listen(0, '127.0.0.1', () => {listener.off('error', reject); done();});});
    const address = listener.address(); if (!address || typeof address === 'string') throw new Error('Forward listener requires real TCP address');
    const url = `http://127.0.0.1:${address.port}/replay`;
    if (activeDiagnostic) {
      diagnosticRequest = get(`http://127.0.0.1:${address.port}/__held-diagnostic`, incoming => {incoming.on('data', () => {}); incoming.on('error', () => {});});
      diagnosticRequest.on('error', () => {}); await diagnosticAccepted.promise;
    }
    return {get url() {return url;}, get suite() {return upstream.suite;}, get repetition() {return upstream.repetition;}, get state() {return upstream.state;}, drain: () => upstream.drain(), close};
  };
  return {factory, facts, release, start: start.promise};
}

export async function json(path: string): Promise<unknown> {return JSON.parse(await readFile(path, 'utf8'));}
export async function records(path: string) {
  const bytes = await readFile(path, 'utf8');
  if (bytes && !bytes.endsWith('\n')) throw new Error('Raw journal suffix lacks complete newline');
  return bytes.trimEnd() ? bytes.trimEnd().split('\n').map(line => comparisonObservationSchema.parse(JSON.parse(line))) : [];
}
export async function physicalFiles(directory: string, prefix = ''): Promise<string[]> {
  const paths: string[] = [];
  for (const name of await readdir(join(directory, prefix))) {
    const path = prefix ? `${prefix}/${name}` : name, stat = await lstat(join(directory, path));
    if (stat.isSymbolicLink()) throw new Error('Raw inventory contains symlink');
    if (stat.isDirectory()) paths.push(...await physicalFiles(directory, path));
    else if (stat.isFile()) paths.push(path); else throw new Error('Raw inventory contains nonregular member');
  }
  return paths.sort();
}
export async function slotRaw(directory: string) {
  const status = comparisonCaptureStatusSchema.parse(await json(join(directory, 'capture-status.json')));
  const page = await records(join(directory, 'page.jsonl')), producer = await records(join(directory, 'producer.jsonl'));
  const acquisition = comparisonProvenanceAcquisitionSchema.parse(await json(join(directory, 'provenance/acquisition.json')));
  for (const member of acquisition.members) {
    const bytes = await readFile(join(directory, member.path));
    if (member.copied.status === 'available' && (bytes.length !== member.copied.value.byteLength || digest(bytes) !== member.copied.value.sha256)) throw new Error('Original acquisition member hash differs');
  }
  return {status, page, producer, acquisition};
}
export async function healthyRaw(directory: string) {
  const raw = await slotRaw(directory);
  const checkpoints = comparisonCheckpointsSchema.parse(await json(join(directory, 'checkpoints.json')));
  const native = comparisonNativeDispatchResultsSchema.parse(await json(join(directory, 'native-dispatch-results.json')));
  const runtime = comparisonFinalRuntimeSchema.parse(await json(join(directory, 'final-runtime.json')));
  const visible = comparisonVisibleValidationSchema.parse(await json(join(directory, 'visible-validation.json')));
  const manifest = comparisonManifestSchema.parse(await json(join(directory, 'manifest.json')));
  return {...raw, checkpoints, native, runtime, visible, manifest};
}
export async function readiness() {
  // Read-only readiness: no claims, owner attempts, imports of build helpers or resources.
  await readFile(join(originalRoot, 'apps/threadplane/dist/index.html'));
  adapterBuildSchema.parse(await json(join(originalRoot, 'apps/threadplane/.build-evidence.json')));
  comparisonInstrumentationBuildSchema.parse(await json(join(originalRoot, 'packages/runner/.comparison-build-evidence.json')));
  const config = configuration(join(tmpdir(), 'comparison-browser-readiness-unclaimed'));
  if (createLongThreadLedger(config).runs.length !== 12) throw new Error('Default canonical configuration must retain twelve slots');
}
export type TestWindow = Window & {benchHost?: LongThreadCaptureHost};

/** Self-contained page callback: H01 and pure controls execute the same serialized observer. */
export async function observeEmptyHostFrames(id: string) {
  const host = (window as TestWindow).benchHost!;
  const element = document.querySelector<HTMLElement>(`chat-message[data-bench-message-id="${id}"]`);
  if (!element) throw new Error('Actual assistant host is absent');
  const body=element.querySelector('.chat-message__assistant-body');
  if(!body||!body.isConnected||!element.contains(body))throw new Error('Actual assistant body is absent');
  const observedAt = performance.now();
  const empty = () => host.readProgress().activeMessage?.id === id && host.readProgress().activeMessage?.text === '' && element.textContent === '' && body.textContent === '' && body.isConnected && element.contains(body) && element.querySelector('.chat-message__assistant-body')===body;
  const snapshot=()=>{const content=document.querySelector(host.locators.messageContent(id));return {at:performance.now(),active:host.readProgress().activeMessage,selector:host.locators.messageContent(id),contentPresent:content!==null,contentConnected:content?.isConnected??null,contentText:content?.textContent??null,hostText:element.textContent,bodyText:body.textContent,outerHTML:element.outerHTML};};
  const snapshots=[snapshot()];let allEmpty = empty(), retained = element.isConnected;
  const frames: number[] = [];
  const callbacks: {timestampMs:number;eligible:boolean;empty:boolean;retained:boolean;snapshotIndex:number}[] = [];
  while (frames.length < 2) {
    const timestamp=await new Promise<number>(done => requestAnimationFrame(done));
    const currentEmpty=empty(),currentRetained=element.isConnected && document.querySelector(`chat-message[data-bench-message-id="${id}"]`) === element;
    allEmpty = currentEmpty && allEmpty;
    retained = currentRetained && retained;
    snapshots.push(snapshot());
    const valid=Number.isFinite(timestamp)&&timestamp>=0;
    const eligible=valid&&(frames.length===0?timestamp>=observedAt:timestamp>frames[0]!);
    callbacks.push({timestampMs:timestamp,eligible,empty:currentEmpty,retained:currentRetained,snapshotIndex:snapshots.length-1});
    if(!valid||frames.length>0&&!eligible)throw new Error('Distinct chronological rAF timestamp unavailable');
    // A rendering-opportunity timestamp may precede this observer's performance.now sample.
    // Preserve that original callback and wait; the accepted pair stays strictly chronological.
    if(eligible)frames.push(timestamp);
  }
  return {messageId: id, empty: allEmpty, retained, frames, observedAt,snapshots,callbacks};
}

export interface RootResult {
  directory: string; config: LongThreadConfiguration; execution: ComparisonInvocationExecution;
  attempts: number; initializedBeforeFirst: number; control: BrowserControl;cleanupFailures:unknown[];
}
export async function rootCase(control: BrowserControl,
  inspectBeforeSettlement: (result: RootResult) => Promise<void>, inspectSettled: (result: RootResult) => Promise<void>,
  prepare?: (resources: Resources) => void) {
  const resources = new Resources(); let failed = false, originalError: unknown;
  let run: Promise<ComparisonInvocationExecution> | undefined, execution: ComparisonInvocationExecution | undefined;
  let directory: string | undefined, attempts = 0, initializedBeforeFirst = 0;
  let firstCleanupFailures:unknown[]|undefined;
  try {
    prepare?.(resources);
    directory = await mkdtemp(join(tmpdir(), 'comparison-browser-root-'));
    const config = configuration(directory), actualDirectory = directory;
    const driver = createLongThreadCaptureDriver({originalRoot, configuration: config}, browserDependencies(resources, control));
    run = runLongThreadInvocation(config, {
      async setup(context) {
        attempts++;
        if (attempts === 1) {
          const ledger = comparisonCaptureInvocationSchema.parse(await json(join(actualDirectory, 'invocation.json')));
          for (const row of ledger.runs) {
            comparisonScheduledRunSchema.parse(await json(join(actualDirectory, row.artifactDirectory, 'descriptor.json')));
            const validation = comparisonValidationSchema.parse(await json(join(actualDirectory, row.artifactDirectory, 'validation.json')));
            if (validation.status === 'failed' && validation.reasons.includes('capture-not-started')) initializedBeforeFirst++;
          }
          await json(join(actualDirectory, 'invocation-claim.json'));
        }
        control.context = context; return driver.setup(context);
      },
      replay(context, state) {control.context = context; return driver.replay(context, state);},
      finalize: driver.finalize!.bind(driver),
    });
    void run.catch(() => {});
    execution = await run;
    const result:RootResult = {directory, config, execution, attempts, initializedBeforeFirst, control,cleanupFailures:[]};
    await inspectBeforeSettlement(result);
    firstCleanupFailures=await resources.settle();result.cleanupFailures=firstCleanupFailures; await execution.ownershipSettled; await execution.finalize();
    await inspectSettled(result);
  } catch (error) {failed = true; originalError = error;}
  finally {
    const cleanupFailures = await resources.settle();
    if (run) {
      try {execution ??= await run; await execution.ownershipSettled; await execution.finalize();}
      catch (error) {if (!failed) {failed = true; originalError = error;} else console.error('Original root finalization rejection', error);}
    }
    if (directory) {
      try {await writeFile(join(tmpdir(), `comparison-browser-root-result-${directory.split('/').at(-1)}.json`), JSON.stringify({directory, failed, attempts, initializedBeforeFirst,
        ...(failed ? {originalFailure: {type: typeof originalError, rendered: String(originalError)}} : {}),
        cleanupFailures: (firstCleanupFailures??cleanupFailures).map(error => ({type: typeof error, rendered: String(error)})), secondaryCleanupFailures:cleanupFailures.map(error=>({type:typeof error,rendered:String(error)})),closeInvocations: control.closeInvocations,
        finalized: execution?.finalized, unsafeOutstanding: execution?.unsafeOutstanding,
      }, null, 2) + '\n');}
      catch (error) {if (!failed) {failed = true; originalError = error;} else console.error('Unable to retain root case receipt', error);}
    }
  }
  if (failed) throw originalError;
}

export async function checkedDataset(directory: string) {
  const inventory = comparisonDatasetInventorySchema.parse(await json(join(directory, 'dataset-seal.json')));
  for (const member of inventory.members) {
    const bytes = await readFile(join(directory, member.path));
    if (bytes.length !== member.byteLength || digest(bytes) !== member.sha256) throw new Error(`Dataset member bytes differ: ${member.path}`);
  }
  const actual = await physicalFiles(directory);
  const expected = [...inventory.members.map(member => member.path), 'dataset-seal.json'].sort();
  if (canonicalSerialize(actual) !== canonicalSerialize(expected)) throw new Error('Dataset physical path inventory differs');
  for (const slot of inventory.slots) {
    const root = join(directory, slot.artifactDirectory);
    let manifest;
    try {manifest = comparisonEvidenceSchema.parse(await json(join(root, 'evidence.json')));}
    catch (error) {
      if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) throw error;
      manifest = comparisonRawInventorySchema.parse(await json(join(root, 'raw-inventory.json')));
    }
    for (const member of manifest.files) {
      const bytes = await readFile(join(root, member.path));
      if (bytes.length !== member.byteLength || digest(bytes) !== member.sha256) throw new Error('Slot inventory hash differs');
    }
  }
  return inventory;
}

/** Retains only original operations, with admission-time identity/stage/page binding. */
export function retainOriginalCapture(control:BrowserControl,resources:Resources){
  const buckets=new Map<string,OriginalCaptureBucket>(),pages=new Map<Page,number>();let violations=0;
  function observe(page:Page,kind:OriginalCaptureReceipt['kind'],args:unknown[],invoke:()=>unknown,selector?:unknown):unknown{
    const context=control.context,at=performance.now();
    let receipt:OriginalCaptureReceipt|undefined;
    if(!context){violations++;}else{
      const identity=Object.freeze({...context.identity}),key=canonicalSerialize(identity);
      let bucket=buckets.get(key);if(!bucket&&buckets.size<12){bucket={identity,receipts:[],counts:{scroll:0,full:0,'return-visible':0}};buckets.set(key,bucket);}
      if(!bucket){violations++;}else{
        bucket.counts[kind]++;const limit=kind==='scroll'?5:kind==='full'?2:1;
        if(bucket.counts[kind]>limit)violations++;else{
          if(!pages.has(page))pages.set(page,pages.size);
          receipt={identity,stage:context.ownership.stage,pageAssociation:pages.get(page)!,kind,args:[...args],...(selector!==undefined?{selector}:{}),admittedAtHostMs:at,settledAtHostMs:null,clockDomain:'host-performance-ms',status:'pending'};
          bucket.receipts.push(receipt);
        }
      }
    }
    let actual:unknown;try{actual=invoke();}catch(error){if(receipt){receipt.status='rejected';receipt.error=error;receipt.settledAtHostMs=performance.now();}throw error;}
    const retained=receipt;
    const observed=(actual as Promise<unknown>).then(value=>{if(retained){retained.result=value;retained.status='fulfilled';retained.settledAtHostMs=performance.now();}return value;},error=>{if(retained){retained.error=error;retained.status='rejected';retained.settledAtHostMs=performance.now();}throw error;});
    resources.observe(observed);return observed;
  }
  control.evaluate=(page,args,invoke)=>{if(typeof args[0]==='function'){
    const source=args[0].toString();
    if(source.includes('capture.readScroll()'))return observe(page,'scroll',args,invoke);
    if(source.includes('Actual host unavailable for full validation'))return observe(page,'full',args,invoke);
  }return invoke();};
  control.wrapContext=context=>intercept<BrowserContext>(context,{newPage:async(_args,invoke)=>{
    const page=await(invoke() as Promise<Page>),association=control.page!;
    return intercept<Page>(page,{locator:(args,call)=>intercept<Locator>(call() as Locator,{isVisible:(options,visible)=>observe(association,'return-visible',options,visible,args[0])})});
  }});
  return {buckets,pages,violations:()=>violations};
}

export async function writeRootControl(root:string,caseName:'h05'|'h07',value:unknown){
  const directory=join(tmpdir(),`comparison-browser-controls-${root.split('/').at(-1)}`);await mkdir(directory,{recursive:true});
  const path=join(directory,`${caseName}-control.json`),bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');await writeFile(path,bytes);const actual=await readFile(path);if(actual.length!==bytes.length||digest(actual)!==digest(bytes))throw new Error('External control serialization bytes differ');
  return {directory,path,byteLength:actual.length,sha256:digest(actual)};
}


/** Opt-in passive original F rejection identity receipts. No operation is initiated here. */
class OriginalTraceCausalState {
  readonly identity:ComparisonIdentity;readonly violations:string[]=[];
  private readonly errors:unknown[]=[];private readonly observed=new WeakSet<Promise<unknown>>();
  private readonly rejections:{method:string;args:unknown[];admittedAtHostMs:number;rejectionObservedAtHostMs:number;errorId:number|null;ownership:ReturnType<OriginalTraceCausalState['ownership']>}[]=[];
  private nativeDetach:{admittedAtHostMs:number;fulfillmentObservedAtHostMs:number|null;rejectionObservedAtHostMs:number|null;errorId:number|null}|undefined;
  private readonly snapshots:{observedAtHostMs:number;ownership:ReturnType<OriginalTraceCausalState['ownership']>;value:unknown}[]=[];
  constructor(private readonly context:ComparisonSlotContext){this.identity=structuredClone(context.identity);}
  private violate(reason:string){if(this.violations.length<16)this.violations.push(reason);}
  private ownership(){const value=this.context.ownership;return {stage:value.stage,generation:value.generation,startedAtHostMs:value.startedAtHostMs,deadlineAtHostMs:value.deadlineAtHostMs,aborted:value.signal.aborted,observedAtHostMs:performance.now()};}
  errorId(error:unknown):number|null{const index=this.errors.findIndex(value=>Object.is(value,error));return index<0?null:index;}
  private retain(error:unknown):number|null{const present=this.errorId(error);if(present!==null)return present;if(this.errors.length>=64){this.violate('Original trace error identity capacity exceeded');return null;}this.errors.push(error);return this.errors.length-1;}
  private rejection(method:string,args:unknown[],admittedAtHostMs:number,error:unknown){
    try{if(this.rejections.length>=64){this.violate('Original trace rejection receipt capacity exceeded');return;}const rendered=JSON.stringify(args);if(rendered===undefined||Buffer.byteLength(rendered)>8192){this.violate('Original trace rejection arguments exceed receipt capacity');return;}this.rejections.push({method,args:[...args],admittedAtHostMs,rejectionObservedAtHostMs:performance.now(),errorId:this.retain(error),ownership:this.ownership()});}catch{this.violate('Original trace rejection observation failed');}
  }
  observe(method:string,args:unknown[],invoke:()=>unknown):unknown{
    const admitted=performance.now();let actual:unknown;try{actual=invoke();}catch(error){this.rejection(method,args,admitted,error);throw error;}
    if(!(actual instanceof Promise)){this.violate('Original trace method did not return its genuine Promise');return actual;}
    if(!this.observed.has(actual)){this.observed.add(actual);if(method==='session.detach')this.nativeDetach={admittedAtHostMs:admitted,fulfillmentObservedAtHostMs:null,rejectionObservedAtHostMs:null,errorId:null};void actual.then(()=>{if(method==='session.detach'&&this.nativeDetach)this.nativeDetach.fulfillmentObservedAtHostMs=performance.now();},error=>{this.rejection(method,args,admitted,error);if(method==='session.detach'&&this.nativeDetach){this.nativeDetach.rejectionObservedAtHostMs=performance.now();this.nativeDetach.errorId=this.errorId(error);}});}return actual;
  }
  snapshot(value:unknown){try{if(this.snapshots.length>=4){this.violate('Original trace snapshot receipt capacity exceeded');return;}this.snapshots.push({observedAtHostMs:performance.now(),ownership:this.ownership(),value});}catch{this.violate('Original trace snapshot observation failed');}}
  receipt(){
    let nodes=0,leaves=0;const trees:unknown[]=[];const descriptions:unknown[]=[];
    const tree=(error:unknown,ancestors:Set<object>,depth:number,directFirst=false,closeRejectedAt=0):unknown=>{
      if(++nodes>128||depth>16){this.violate('Original trace aggregate tree capacity exceeded');return {proofUnavailable:true};}
      const id=this.retain(error);if(error instanceof AggregateError){if(ancestors.has(error)){this.violate('Original trace aggregate cycle');return {errorId:id,proofUnavailable:true};}const descriptor=Object.getOwnPropertyDescriptor(error,'errors');if(!descriptor||!('value' in descriptor)||!Array.isArray(descriptor.value)||descriptor.value.length===0||descriptor.value.length>32){this.violate('Original trace aggregate errors shape/capacity invalid');return {errorId:id,proofUnavailable:true};}const next=new Set(ancestors);next.add(error);return {errorId:id,aggregate:true,children:descriptor.value.map((child,index)=>tree(child,next,depth+1,depth===0&&index===0,closeRejectedAt))};}leaves++;const matches=this.rejections.map((row,index)=>({row,index})).filter(({row})=>(row.method==='session.send'||row.method==='session.detach')&&row.errorId===id).map(({index})=>index);let classification:string|null=matches.length?'original-session-operation-reference':null;
      const last=this.snapshots.at(-1),snapshot=last?.value as {trace?:{status?:unknown;tracingComplete?:{status?:unknown}}}|undefined,internal=directFirst&&error instanceof Error&&error.constructor===Error;
      if(classification===null&&internal&&error.message==='Trace ownership revoked'&&this.context.ownership.signal.aborted)classification='original-F-first-error:Trace ownership revoked';
      if(classification===null&&internal&&error.message==='Session closed before tracing completion'&&snapshot?.trace?.status==='available'&&snapshot.trace.tracingComplete?.status==='unavailable'&&this.nativeDetach?.fulfillmentObservedAtHostMs!==null&&this.nativeDetach?.fulfillmentObservedAtHostMs!==undefined&&this.nativeDetach.fulfillmentObservedAtHostMs<=closeRejectedAt)classification='original-F-first-error:Session closed before tracing completion';
      if(classification===null)this.violate('Unmatched original trace-close leaf');return {errorId:id,aggregate:false,operationRejectionIds:matches,classification};
    };
    const closeRejections=this.rejections.filter(row=>row.method==='trace.close');if(closeRejections.length!==1)this.violate('Exactly one original trace.close rejection is required');for(const row of closeRejections){const error=row.errorId===null?undefined:this.errors[row.errorId];if(!(error instanceof AggregateError)||error.message!=='Trace acquisition or cleanup failed')this.violate('Original F close rejection must be its genuine source-exact AggregateError');trees.push({closeErrorId:row.errorId,tree:tree(error,new Set(),0,false,row.rejectionObservedAtHostMs)});}if(leaves===0)this.violate('Original F close aggregate must retain nonempty leaves');
    for(const [id,error] of this.errors.entries()){try{const rendered=String(error);if(Buffer.byteLength(rendered)>8192){this.violate('Original trace error diagnostic capacity exceeded');descriptions.push({id,type:typeof error,diagnosticUnavailable:true});}else descriptions.push({id,type:typeof error,rendered,aggregate:error instanceof AggregateError});}catch{this.violate('Original trace error diagnostic observation failed');descriptions.push({id,type:typeof error,diagnosticUnavailable:true});}}
    return {identity:this.identity,clockDomain:'host-performance-ms',rejections:this.rejections,snapshots:this.snapshots,nativeDetach:this.nativeDetach,authorityAtReceipt:this.ownership(),errors:descriptions,closeTrees:trees,violations:[...this.violations]};
  }
}
export function traceCausalReceipt(control:BrowserControl,error?:unknown){
  const states=control.traceCausalStates??[];if(states.length!==1)throw new Error('Exactly one original F causal state is required');const state=states[0]!;return {...state.receipt(),...(arguments.length>1?{selectedOriginalErrorId:state.errorId(error)}:{})};
}

const CI_SNAPSHOT_NAMES={
  "product47": [
    "apps/threadplane/angular.json",
    "apps/threadplane/build.mjs",
    "apps/threadplane/dependency-closure.mjs",
    "apps/threadplane/package.json",
    "apps/threadplane/probe-provenance.mjs",
    "apps/threadplane/provenance.mjs",
    "apps/threadplane/src/app.ts",
    "apps/threadplane/src/capture-buffer.ts",
    "apps/threadplane/src/host.ts",
    "apps/threadplane/src/index.html",
    "apps/threadplane/src/main.ts",
    "apps/threadplane/src/replay-transport.ts",
    "apps/threadplane/src/sse.ts",
    "apps/threadplane/src/styles.css",
    "apps/threadplane/tsconfig.app.json",
    "apps/threadplane/tsconfig.json",
    "package-lock.json",
    "package.json",
    "packages/contract/dist/adapter.js",
    "packages/contract/dist/artifact.js",
    "packages/contract/dist/capture-bridge.js",
    "packages/contract/dist/comparison-artifact.js",
    "packages/contract/dist/comparison-buffer.js",
    "packages/contract/dist/comparison-installer-options.js",
    "packages/contract/dist/comparison-presentation.js",
    "packages/contract/dist/comparison-version-families.js",
    "packages/contract/dist/comparison.js",
    "packages/contract/dist/fixture.js",
    "packages/contract/dist/index.js",
    "packages/contract/dist/long-thread.js",
    "packages/contract/dist/presentation.js",
    "packages/contract/package.json",
    "packages/contract/src/adapter.ts",
    "packages/contract/src/artifact.ts",
    "packages/contract/src/capture-bridge.ts",
    "packages/contract/src/comparison-artifact.ts",
    "packages/contract/src/comparison-buffer.ts",
    "packages/contract/src/comparison-installer-options.ts",
    "packages/contract/src/comparison-presentation.ts",
    "packages/contract/src/comparison-version-families.ts",
    "packages/contract/src/comparison.ts",
    "packages/contract/src/fixture.ts",
    "packages/contract/src/index.ts",
    "packages/contract/src/long-thread.ts",
    "packages/contract/src/presentation.ts",
    "packages/contract/tsconfig.json",
    "tsconfig.base.json"
  ],
  "probe31": [
    "apps/threadplane/angular.json",
    "apps/threadplane/build.mjs",
    "apps/threadplane/dependency-closure.mjs",
    "apps/threadplane/package.json",
    "apps/threadplane/probe-provenance.mjs",
    "apps/threadplane/provenance.mjs",
    "apps/threadplane/tsconfig.app.json",
    "apps/threadplane/tsconfig.json",
    "package-lock.json",
    "package.json",
    "packages/contract/package.json",
    "packages/contract/src/adapter.ts",
    "packages/contract/src/artifact.ts",
    "packages/contract/src/capture-bridge.ts",
    "packages/contract/src/comparison-artifact.ts",
    "packages/contract/src/comparison-buffer.ts",
    "packages/contract/src/comparison-installer-options.ts",
    "packages/contract/src/comparison-presentation.ts",
    "packages/contract/src/comparison-version-families.ts",
    "packages/contract/src/comparison.ts",
    "packages/contract/src/fixture.ts",
    "packages/contract/src/index.ts",
    "packages/contract/src/long-thread.ts",
    "packages/contract/src/presentation.ts",
    "packages/contract/tsconfig.json",
    "packages/runner/package.json",
    "packages/runner/src/comparison-assembly-worker.ts",
    "packages/runner/src/comparison-installer.ts",
    "packages/runner/src/comparison-observations.ts",
    "packages/runner/tsconfig.json",
    "tsconfig.base.json"
  ],
  "compiled16": [
    "packages/contract/dist/adapter.js",
    "packages/contract/dist/artifact.js",
    "packages/contract/dist/capture-bridge.js",
    "packages/contract/dist/comparison-artifact.js",
    "packages/contract/dist/comparison-buffer.js",
    "packages/contract/dist/comparison-installer-options.js",
    "packages/contract/dist/comparison-presentation.js",
    "packages/contract/dist/comparison-version-families.js",
    "packages/contract/dist/comparison.js",
    "packages/contract/dist/fixture.js",
    "packages/contract/dist/index.js",
    "packages/contract/dist/long-thread.js",
    "packages/contract/dist/presentation.js",
    "packages/runner/dist/comparison-assembly-worker.js",
    "packages/runner/dist/comparison-installer.js",
    "packages/runner/dist/comparison-observations.js"
  ],
  "output138": [
    "packages/contract/dist/adapter.d.ts",
    "packages/contract/dist/adapter.js",
    "packages/contract/dist/adapter.js.map",
    "packages/contract/dist/artifact.d.ts",
    "packages/contract/dist/artifact.js",
    "packages/contract/dist/artifact.js.map",
    "packages/contract/dist/capture-bridge.d.ts",
    "packages/contract/dist/capture-bridge.js",
    "packages/contract/dist/capture-bridge.js.map",
    "packages/contract/dist/comparison-artifact.d.ts",
    "packages/contract/dist/comparison-artifact.js",
    "packages/contract/dist/comparison-artifact.js.map",
    "packages/contract/dist/comparison-buffer.d.ts",
    "packages/contract/dist/comparison-buffer.js",
    "packages/contract/dist/comparison-buffer.js.map",
    "packages/contract/dist/comparison-installer-options.d.ts",
    "packages/contract/dist/comparison-installer-options.js",
    "packages/contract/dist/comparison-installer-options.js.map",
    "packages/contract/dist/comparison-presentation.d.ts",
    "packages/contract/dist/comparison-presentation.js",
    "packages/contract/dist/comparison-presentation.js.map",
    "packages/contract/dist/comparison-version-families.d.ts",
    "packages/contract/dist/comparison-version-families.js",
    "packages/contract/dist/comparison-version-families.js.map",
    "packages/contract/dist/comparison.d.ts",
    "packages/contract/dist/comparison.js",
    "packages/contract/dist/comparison.js.map",
    "packages/contract/dist/fixture.d.ts",
    "packages/contract/dist/fixture.js",
    "packages/contract/dist/fixture.js.map",
    "packages/contract/dist/hash.d.ts",
    "packages/contract/dist/hash.js",
    "packages/contract/dist/hash.js.map",
    "packages/contract/dist/index.d.ts",
    "packages/contract/dist/index.js",
    "packages/contract/dist/index.js.map",
    "packages/contract/dist/long-thread.d.ts",
    "packages/contract/dist/long-thread.js",
    "packages/contract/dist/long-thread.js.map",
    "packages/contract/dist/presentation.d.ts",
    "packages/contract/dist/presentation.js",
    "packages/contract/dist/presentation.js.map",
    "packages/runner/dist/artifacts.d.ts",
    "packages/runner/dist/artifacts.js",
    "packages/runner/dist/artifacts.js.map",
    "packages/runner/dist/calibrate.d.ts",
    "packages/runner/dist/calibrate.js",
    "packages/runner/dist/calibrate.js.map",
    "packages/runner/dist/capture.d.ts",
    "packages/runner/dist/capture.js",
    "packages/runner/dist/capture.js.map",
    "packages/runner/dist/cli.d.ts",
    "packages/runner/dist/cli.js",
    "packages/runner/dist/cli.js.map",
    "packages/runner/dist/comparison-artifacts.d.ts",
    "packages/runner/dist/comparison-artifacts.js",
    "packages/runner/dist/comparison-artifacts.js.map",
    "packages/runner/dist/comparison-assembly-worker.d.ts",
    "packages/runner/dist/comparison-assembly-worker.js",
    "packages/runner/dist/comparison-assembly-worker.js.map",
    "packages/runner/dist/comparison-browser.test-helper.d.ts",
    "packages/runner/dist/comparison-browser.test-helper.js",
    "packages/runner/dist/comparison-browser.test-helper.js.map",
    "packages/runner/dist/comparison-capture-journal.d.ts",
    "packages/runner/dist/comparison-capture-journal.js",
    "packages/runner/dist/comparison-capture-journal.js.map",
    "packages/runner/dist/comparison-counters.d.ts",
    "packages/runner/dist/comparison-counters.js",
    "packages/runner/dist/comparison-counters.js.map",
    "packages/runner/dist/comparison-installer.d.ts",
    "packages/runner/dist/comparison-installer.js",
    "packages/runner/dist/comparison-installer.js.map",
    "packages/runner/dist/comparison-lifecycle-oracle.d.ts",
    "packages/runner/dist/comparison-lifecycle-oracle.js",
    "packages/runner/dist/comparison-lifecycle-oracle.js.map",
    "packages/runner/dist/comparison-native-input.d.ts",
    "packages/runner/dist/comparison-native-input.js",
    "packages/runner/dist/comparison-native-input.js.map",
    "packages/runner/dist/comparison-observations.d.ts",
    "packages/runner/dist/comparison-observations.js",
    "packages/runner/dist/comparison-observations.js.map",
    "packages/runner/dist/comparison-ownership.d.ts",
    "packages/runner/dist/comparison-ownership.js",
    "packages/runner/dist/comparison-ownership.js.map",
    "packages/runner/dist/comparison-proto-native-capture.d.ts",
    "packages/runner/dist/comparison-proto-native-capture.js",
    "packages/runner/dist/comparison-proto-native-capture.js.map",
    "packages/runner/dist/comparison-proto-public-ports.d.ts",
    "packages/runner/dist/comparison-proto-public-ports.js",
    "packages/runner/dist/comparison-proto-public-ports.js.map",
    "packages/runner/dist/comparison-proto-trace.d.ts",
    "packages/runner/dist/comparison-proto-trace.js",
    "packages/runner/dist/comparison-proto-trace.js.map",
    "packages/runner/dist/comparison-provenance.d.ts",
    "packages/runner/dist/comparison-provenance.js",
    "packages/runner/dist/comparison-provenance.js.map",
    "packages/runner/dist/comparison-runtime-family.d.ts",
    "packages/runner/dist/comparison-runtime-family.js",
    "packages/runner/dist/comparison-runtime-family.js.map",
    "packages/runner/dist/comparison-threadplane.d.ts",
    "packages/runner/dist/comparison-threadplane.js",
    "packages/runner/dist/comparison-threadplane.js.map",
    "packages/runner/dist/comparison-trace.d.ts",
    "packages/runner/dist/comparison-trace.js",
    "packages/runner/dist/comparison-trace.js.map",
    "packages/runner/dist/environment.d.ts",
    "packages/runner/dist/environment.js",
    "packages/runner/dist/environment.js.map",
    "packages/runner/dist/history-window-diagnostic.d.ts",
    "packages/runner/dist/history-window-diagnostic.js",
    "packages/runner/dist/history-window-diagnostic.js.map",
    "packages/runner/dist/history-window-experiment.d.ts",
    "packages/runner/dist/history-window-experiment.js",
    "packages/runner/dist/history-window-experiment.js.map",
    "packages/runner/dist/index.d.ts",
    "packages/runner/dist/index.js",
    "packages/runner/dist/index.js.map",
    "packages/runner/dist/long-thread-capture.d.ts",
    "packages/runner/dist/long-thread-capture.js",
    "packages/runner/dist/long-thread-capture.js.map",
    "packages/runner/dist/long-thread-cli.d.ts",
    "packages/runner/dist/long-thread-cli.js",
    "packages/runner/dist/long-thread-cli.js.map",
    "packages/runner/dist/long-thread-main.d.ts",
    "packages/runner/dist/long-thread-main.js",
    "packages/runner/dist/long-thread-main.js.map",
    "packages/runner/dist/long-thread-run.d.ts",
    "packages/runner/dist/long-thread-run.js",
    "packages/runner/dist/long-thread-run.js.map",
    "packages/runner/dist/retention.d.ts",
    "packages/runner/dist/retention.js",
    "packages/runner/dist/retention.js.map",
    "packages/runner/dist/run.d.ts",
    "packages/runner/dist/run.js",
    "packages/runner/dist/run.js.map",
    "packages/runner/dist/server.d.ts",
    "packages/runner/dist/server.js",
    "packages/runner/dist/server.js.map"
  ],
  "analyzerSelected9": [
    "packages/analyzer/dist/browser-frame-ordered-state.d.ts",
    "packages/analyzer/dist/browser-frame-ordered-state.js",
    "packages/analyzer/dist/browser-frame-ordered-state.js.map",
    "packages/analyzer/dist/browser-frame-trace-evidence.d.ts",
    "packages/analyzer/dist/browser-frame-trace-evidence.js",
    "packages/analyzer/dist/browser-frame-trace-evidence.js.map",
    "packages/analyzer/dist/browser-frame-track-descriptor-fragments.d.ts",
    "packages/analyzer/dist/browser-frame-track-descriptor-fragments.js",
    "packages/analyzer/dist/browser-frame-track-descriptor-fragments.js.map"
  ],
  "contract42": [
    "packages/contract/dist/adapter.d.ts",
    "packages/contract/dist/adapter.js",
    "packages/contract/dist/adapter.js.map",
    "packages/contract/dist/artifact.d.ts",
    "packages/contract/dist/artifact.js",
    "packages/contract/dist/artifact.js.map",
    "packages/contract/dist/capture-bridge.d.ts",
    "packages/contract/dist/capture-bridge.js",
    "packages/contract/dist/capture-bridge.js.map",
    "packages/contract/dist/comparison-artifact.d.ts",
    "packages/contract/dist/comparison-artifact.js",
    "packages/contract/dist/comparison-artifact.js.map",
    "packages/contract/dist/comparison-buffer.d.ts",
    "packages/contract/dist/comparison-buffer.js",
    "packages/contract/dist/comparison-buffer.js.map",
    "packages/contract/dist/comparison-installer-options.d.ts",
    "packages/contract/dist/comparison-installer-options.js",
    "packages/contract/dist/comparison-installer-options.js.map",
    "packages/contract/dist/comparison-presentation.d.ts",
    "packages/contract/dist/comparison-presentation.js",
    "packages/contract/dist/comparison-presentation.js.map",
    "packages/contract/dist/comparison-version-families.d.ts",
    "packages/contract/dist/comparison-version-families.js",
    "packages/contract/dist/comparison-version-families.js.map",
    "packages/contract/dist/comparison.d.ts",
    "packages/contract/dist/comparison.js",
    "packages/contract/dist/comparison.js.map",
    "packages/contract/dist/fixture.d.ts",
    "packages/contract/dist/fixture.js",
    "packages/contract/dist/fixture.js.map",
    "packages/contract/dist/hash.d.ts",
    "packages/contract/dist/hash.js",
    "packages/contract/dist/hash.js.map",
    "packages/contract/dist/index.d.ts",
    "packages/contract/dist/index.js",
    "packages/contract/dist/index.js.map",
    "packages/contract/dist/long-thread.d.ts",
    "packages/contract/dist/long-thread.js",
    "packages/contract/dist/long-thread.js.map",
    "packages/contract/dist/presentation.d.ts",
    "packages/contract/dist/presentation.js",
    "packages/contract/dist/presentation.js.map"
  ],
  "productMetadata50": [
    "apps/threadplane/node_modules/@angular/build",
    "apps/threadplane/node_modules/@angular/cli",
    "apps/threadplane/node_modules/@angular/common",
    "apps/threadplane/node_modules/@angular/compiler",
    "apps/threadplane/node_modules/@angular/compiler-cli",
    "apps/threadplane/node_modules/@angular/core",
    "apps/threadplane/node_modules/@angular/platform-browser",
    "apps/threadplane/node_modules/@angular/router",
    "apps/threadplane/node_modules/@cacheplane/partial-json",
    "apps/threadplane/node_modules/@cacheplane/partial-markdown",
    "apps/threadplane/node_modules/@json-render/core",
    "apps/threadplane/node_modules/@langchain/core",
    "apps/threadplane/node_modules/@langchain/core/node_modules/langsmith",
    "apps/threadplane/node_modules/@langchain/langgraph-sdk",
    "apps/threadplane/node_modules/@langchain/langgraph-sdk/node_modules/p-queue",
    "apps/threadplane/node_modules/@langchain/langgraph-sdk/node_modules/p-queue/node_modules/p-timeout",
    "apps/threadplane/node_modules/@threadplane/a2ui",
    "apps/threadplane/node_modules/@threadplane/chat",
    "apps/threadplane/node_modules/@threadplane/langgraph",
    "apps/threadplane/node_modules/@threadplane/render",
    "apps/threadplane/node_modules/@threadplane/telemetry",
    "apps/threadplane/node_modules/marked",
    "apps/threadplane/node_modules/rxjs",
    "apps/threadplane/node_modules/typescript",
    "apps/threadplane/node_modules/vitest",
    "node_modules/@cfworker/json-schema",
    "node_modules/@langchain/protocol",
    "node_modules/@opentelemetry/api",
    "node_modules/@standard-schema/spec",
    "node_modules/@types/json-schema",
    "node_modules/base64-js",
    "node_modules/commander",
    "node_modules/eventemitter3",
    "node_modules/is-network-error",
    "node_modules/js-tiktoken",
    "node_modules/katex",
    "node_modules/mustache",
    "node_modules/openai",
    "node_modules/p-finally",
    "node_modules/p-queue",
    "node_modules/p-queue/node_modules/eventemitter3",
    "node_modules/p-retry",
    "node_modules/p-timeout",
    "node_modules/react",
    "node_modules/react-dom",
    "node_modules/scheduler",
    "node_modules/tslib",
    "node_modules/undici",
    "node_modules/ws",
    "node_modules/zod"
  ],
  "source55": [
    ".github/workflows/ci.yml",
    "apps/threadplane/probe-provenance.mjs",
    "apps/threadplane/probe-provenance.test.ts",
    "package.json",
    "packages/analyzer/src/browser-frame-ordered-state-v2.test.ts",
    "packages/analyzer/src/browser-frame-ordered-state.ts",
    "packages/analyzer/src/browser-frame-trace-evidence.test.ts",
    "packages/analyzer/src/browser-frame-trace-evidence.ts",
    "packages/analyzer/src/browser-frame-track-descriptor-fragments.test.ts",
    "packages/analyzer/src/browser-frame-track-descriptor-fragments.ts",
    "packages/contract/tsconfig.types.json",
    "packages/contract/type-tests/comparison-families.ts",
    "packages/runner/src/comparison-assembly-worker.test.ts",
    "packages/runner/src/comparison-assembly-worker.ts",
    "packages/runner/src/comparison-browser.test-helper.test.ts",
    "packages/runner/src/comparison-browser.test-helper.ts",
    "packages/runner/src/comparison-browser.test.ts",
    "packages/runner/src/comparison-capture-journal.test.ts",
    "packages/runner/src/comparison-capture-journal.ts",
    "packages/runner/src/comparison-counters.test.ts",
    "packages/runner/src/comparison-counters.ts",
    "packages/runner/src/comparison-lifecycle-oracle.test.ts",
    "packages/runner/src/comparison-lifecycle-oracle.ts",
    "packages/runner/src/comparison-native-input.test.ts",
    "packages/runner/src/comparison-native-input.ts",
    "packages/runner/src/comparison-observations.test.ts",
    "packages/runner/src/comparison-observations.ts",
    "packages/runner/src/comparison-ownership.test.ts",
    "packages/runner/src/comparison-ownership.ts",
    "packages/runner/src/comparison-proto-native-capture.test.ts",
    "packages/runner/src/comparison-proto-native-capture.ts",
    "packages/runner/src/comparison-proto-public-ports.test.ts",
    "packages/runner/src/comparison-proto-public-ports.ts",
    "packages/runner/src/comparison-proto-trace.test.ts",
    "packages/runner/src/comparison-proto-trace.ts",
    "packages/runner/src/comparison-provenance.test.ts",
    "packages/runner/src/comparison-provenance.ts",
    "packages/runner/src/comparison-runtime-family.test.ts",
    "packages/runner/src/comparison-runtime-family.ts",
    "packages/runner/src/comparison-scroll-fresh.test.ts",
    "packages/runner/src/comparison-threadplane.test.ts",
    "packages/runner/src/comparison-threadplane.ts",
    "packages/runner/src/comparison-trace.test.ts",
    "packages/runner/src/comparison-trace.ts",
    "packages/runner/src/environment.test.ts",
    "packages/runner/src/environment.ts",
    "packages/runner/src/index.ts",
    "packages/runner/src/long-thread-capture.test.ts",
    "packages/runner/src/long-thread-capture.ts",
    "packages/runner/src/long-thread-main.test.ts",
    "packages/runner/src/long-thread-main.ts",
    "packages/runner/src/long-thread-run.test.ts",
    "packages/runner/src/long-thread-run.ts",
    "vitest.comparison.browser.config.ts",
    "vitest.config.ts"
  ],
  "source23": [
    ".github/workflows/ci.yml",
    "package.json",
    "packages/analyzer/src/browser-frame-ordered-state-v2.test.ts",
    "packages/analyzer/src/browser-frame-ordered-state.ts",
    "packages/analyzer/src/browser-frame-trace-evidence.test.ts",
    "packages/analyzer/src/browser-frame-trace-evidence.ts",
    "packages/analyzer/src/browser-frame-track-descriptor-fragments.test.ts",
    "packages/analyzer/src/browser-frame-track-descriptor-fragments.ts",
    "packages/runner/src/comparison-browser.test-helper.test.ts",
    "packages/runner/src/comparison-browser.test-helper.ts",
    "packages/runner/src/comparison-browser.test.ts",
    "packages/runner/src/comparison-lifecycle-oracle.test.ts",
    "packages/runner/src/comparison-lifecycle-oracle.ts",
    "packages/runner/src/comparison-observations.test.ts",
    "packages/runner/src/comparison-observations.ts",
    "packages/runner/src/comparison-proto-public-ports.test.ts",
    "packages/runner/src/comparison-proto-public-ports.ts",
    "packages/runner/src/comparison-proto-trace.test.ts",
    "packages/runner/src/comparison-proto-trace.ts",
    "packages/runner/src/long-thread-capture.test.ts",
    "packages/runner/src/long-thread-capture.ts",
    "vitest.comparison.browser.config.ts",
    "vitest.config.ts"
  ]
} as const;
type CiSnapshotIdentity={dev:string;ino:string;size:string;mtimeNs:string;ctimeNs:string};
type CiSnapshotFact={byteLength:number;sha256:string};
type CiSnapshotContext={ci:string|undefined;runId:string|undefined;runAttempt:string|undefined;repository:string|undefined;workflowRef:string|undefined;eventName:string|undefined;sha:string|undefined;platform:string;architecture:string};
export type CiSnapshotPorts={workspace?:string;evidenceRoot?:string;context?:CiSnapshotContext;open?:typeof open;lstat?:typeof lstat};
const CI_SNAPSHOT_METADATA_FILE_CAP=1024*1024;
const CI_SNAPSHOT_LOCK_FILE_CAP=2*1024*1024;
const CI_SNAPSHOT_JSON_FILES_CAP=69; // 16 original records + 52 package records, with one bounded spare.
const CI_SNAPSHOT_UNION_BYTES_CAP=8*1024*1024;
// Snapshot-v7 retains V6 and adds the two native-capture sources and three runner outputs.
// Analyzer coverage remains the same nine selected outputs, not a full dist closure.
// Named inventory cardinalities evolve; fixed aggregate ceilings and per-directory 129 remain unchanged.
const CI_SNAPSHOT_MAX_FILES=311;
const CI_SNAPSHOT_MAX_ANCESTORS=CI_SNAPSHOT_MAX_FILES*32;
const CI_SNAPSHOT_MAX_OWN_DIRECTORIES=85+12*32;
const CI_SNAPSHOT_RECEIPT_CAP=CI_SNAPSHOT_MAX_OWN_DIRECTORIES*1536+(CI_SNAPSHOT_MAX_OWN_DIRECTORIES+CI_SNAPSHOT_MAX_FILES+2)*1056+16384;
const CI_SNAPSHOT_MANIFEST_CAP=23_348_128;
function ciSnapshotRequire(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(message);}
export function comparisonCiSnapshotBudget(current:number,addition:number,maximum:number,label:string){ciSnapshotRequire(Number.isSafeInteger(current)&&current>=0&&Number.isSafeInteger(addition)&&addition>=0&&Number.isSafeInteger(maximum)&&maximum>=0&&current<=maximum&&addition<=maximum-current,label);return current+addition;}
function ciSnapshotEqual(a:unknown,b:unknown,message:string){ciSnapshotRequire(canonicalSerialize(a)===canonicalSerialize(b),message);}
function ciSnapshotKey(key:string){ciSnapshotRequire(typeof key==='string'&&key.length>0&&key.length<=1024&&/^[A-Za-z0-9_@./-]+$/.test(key)&&!key.startsWith('/')&&!key.split('/').some(p=>p===''||p==='.'||p==='..')&&key.split('/').length<=32,'CI snapshot normalized relative key');return key;}
function ciSnapshotIdentity(stat:BigIntStats):CiSnapshotIdentity{const result={dev:String(stat.dev),ino:String(stat.ino),size:String(stat.size),mtimeNs:String(stat.mtimeNs),ctimeNs:String(stat.ctimeNs)};for(const value of Object.values(result))ciSnapshotRequire(/^-?[0-9]{1,31}$/.test(value),'CI identity representation cap');return result;}
export function comparisonCiSnapshotFileCap(key:string){ciSnapshotKey(key);return key==='package-lock.json'?CI_SNAPSHOT_LOCK_FILE_CAP:CI_SNAPSHOT_METADATA_FILE_CAP;}
function ciSnapshotJson(bytes:Buffer,cap=CI_SNAPSHOT_METADATA_FILE_CAP):unknown{
 ciSnapshotRequire(bytes.length<=cap,'CI JSON bytes');const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);let i=0,awu=0,cpt=0;
 const ws=()=>{while(/[\t\n\r ]/.test(text[i]??'!'))i++;};const quoted=():string=>{const start=i;ciSnapshotRequire(text[i++]==='"','CI JSON quoted token');while(i<text.length){const c=text[i++]!;if(c==='"'){const token=text.slice(start,i);ciSnapshotRequire(Buffer.byteLength(token)<=2*1024*1024,'CI JSON UTF8 token cap');return JSON.parse(token) as string;}if(c==='\\'){ciSnapshotRequire(i<text.length,'CI JSON escape');i++;}else ciSnapshotRequire(c.charCodeAt(0)>=32,'CI JSON control');}throw new Error('CI JSON unterminated token');};
 const value=(depth:number):void=>{ciSnapshotRequire(depth<=32&&++awu<=2097152,'CI JSON depth/AWU');ws();const c=text[i];if(c==='"'){cpt+=2;quoted();}else if(c==='{'||c==='['){cpt+=2;i++;ws();const object=c==='{',end=object?'}':']',seen=new Set<string>();if(text[i]===end){i++;return;}for(;;){if(object){ws();const key=quoted();awu++;cpt++;ciSnapshotRequire(!seen.has(key),'CI JSON duplicate key');seen.add(key);ws();ciSnapshotRequire(text[i++]===':','CI JSON colon');}value(depth+1);ws();if(text[i]===end){i++;break;}ciSnapshotRequire(text[i++ ]===',','CI JSON comma');}}else{const m=/^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(i));ciSnapshotRequire(m&&m[0].length<=32,'CI JSON scalar');if(!['true','false','null'].includes(m[0]))ciSnapshotRequire(Number.isFinite(Number(m[0])),'CI JSON finite scalar');cpt+=m[0]==='null'?1:2;i+=m[0].length;}ciSnapshotRequire(awu<=2097152&&cpt<=4194304,'CI JSON work');};value(0);ws();ciSnapshotRequire(i===text.length,'CI JSON trailing text');return JSON.parse(text);
}
export async function writeComparisonCiSnapshot(root:string,ports:CiSnapshotPorts={}){
 const context=ports.context??{ci:process.env.CI,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,repository:process.env.GITHUB_REPOSITORY,workflowRef:process.env.GITHUB_WORKFLOW_REF,eventName:process.env.GITHUB_EVENT_NAME,sha:process.env.GITHUB_SHA,platform:process.platform,architecture:process.arch};
 if(context.ci!=='true')return null;
 ciSnapshotRequire(context.platform==='linux'&&context.architecture==='x64','CI snapshot requires actual configured Linux x64');ciSnapshotRequire(context.repository==='cacheplane/chat-ui-bench','CI snapshot repository');ciSnapshotRequire(typeof context.runId==='string'&&/^[1-9][0-9]{0,19}$/.test(context.runId)&&typeof context.runAttempt==='string'&&/^[1-9][0-9]{0,9}$/.test(context.runAttempt),'CI snapshot run identity');ciSnapshotRequire(typeof context.sha==='string'&&/^[a-f0-9]{40}$/.test(context.sha),'CI snapshot checkout SHA');ciSnapshotRequire(['pull_request','push','workflow_dispatch'].includes(context.eventName??''),'CI snapshot event');const workflowPrefix='cacheplane/chat-ui-bench/.github/workflows/ci.yml@';ciSnapshotRequire(typeof context.workflowRef==='string'&&context.workflowRef.startsWith(workflowPrefix)&&context.workflowRef.length<=256,'CI snapshot workflow');const ref=context.workflowRef.slice(workflowPrefix.length);ciSnapshotRequire(context.eventName==='pull_request'?/^refs\/pull\/[1-9][0-9]{0,19}\/merge$/.test(ref):context.eventName==='push'?ref==='refs/heads/main':/^refs\/heads\/[A-Za-z0-9_/-]{1,128}$/.test(ref),'CI snapshot event ref');
 const workspace=ports.workspace??originalRoot,evidenceRoot=ports.evidenceRoot??tmpdir(),stat=ports.lstat??lstat,openFile=ports.open??open;const originalAncestors=new Map<string,CiSnapshotIdentity>(),originalInodes=new Map<string,string>();let readBytes=0,writtenBytes=0,jsonFiles=0;
 const absolute=(path:string)=>{ciSnapshotRequire(path.startsWith('/')&&resolve(path)===path&&path.length<=2048&&path.split('/').filter(Boolean).length<=32&&/^[A-Za-z0-9_@./-]+$/.test(path),'CI supplied absolute path');return path;};
 const chain=async(path:string)=>{absolute(path);let current='/';const rows:{path:string;identity:CiSnapshotIdentity}[]=[];for(const part of path.split('/').filter(Boolean)){current=join(current,part);const s=await stat(current,{bigint:true});ciSnapshotRequire(!s.isSymbolicLink(),'CI snapshot supplied symlink');if(current!==path){ciSnapshotRequire(s.isDirectory(),'CI snapshot ancestor directory');rows.push({path:current,identity:ciSnapshotIdentity(s)});}}return rows;};
 await chain(workspace);await chain(evidenceRoot);await chain(root);ciSnapshotRequire((await stat(workspace,{bigint:true})).isDirectory()&&(await stat(evidenceRoot,{bigint:true})).isDirectory()&&(await stat(root,{bigint:true})).isDirectory(),'CI snapshot roots');ciSnapshotRequire(workspace.length<=512&&evidenceRoot.length<=512&&root.startsWith(evidenceRoot+'/')&&workspace!==evidenceRoot&&!evidenceRoot.startsWith(workspace+'/')&&!workspace.startsWith(evidenceRoot+'/'),'CI snapshot root domains');
 const readLimit=6*CI_SNAPSHOT_UNION_BYTES_CAP+CI_SNAPSHOT_JSON_FILES_CAP*CI_SNAPSHOT_METADATA_FILE_CAP+(CI_SNAPSHOT_LOCK_FILE_CAP-CI_SNAPSHOT_METADATA_FILE_CAP)+2*CI_SNAPSHOT_MANIFEST_CAP,writeLimit=CI_SNAPSHOT_UNION_BYTES_CAP+CI_SNAPSHOT_MANIFEST_CAP;
 async function owned<T>(path:string,flags:number,operation:(fd:FileHandle)=>Promise<T>):Promise<T>{const fd=await openFile(path,flags,0o600);let failed=false,primary:unknown;try{return await operation(fd);}catch(error){failed=true;primary=error;throw error;}finally{try{await fd.close();}catch(closeError){if(failed)throw new AggregateError([primary,closeError],'CI snapshot original operation and descriptor close failed');throw closeError;}}}
 async function read(path:string,expected?:CiSnapshotIdentity,destination?:FileHandle,collect=false,cap=CI_SNAPSHOT_METADATA_FILE_CAP){const ancestors=await chain(path),before=await stat(path,{bigint:true});ciSnapshotRequire(before.isFile()&&before.size>=0n&&before.size<=BigInt(cap),'CI snapshot regular bounded original');const beforeIdentity=ciSnapshotIdentity(before);if(expected)ciSnapshotEqual(beforeIdentity,expected,'CI original identity changed');return owned(path,constants.O_RDONLY|constants.O_NOFOLLOW,async fd=>{ciSnapshotEqual(ciSnapshotIdentity(await fd.stat({bigint:true})),beforeIdentity,'CI open identity');const hash=createHash('sha256'),parts:Buffer[]=[];let length=0;for(;;){const block=Buffer.allocUnsafe(65536),r=await fd.read(block,0,block.length,null);ciSnapshotRequire(Number.isSafeInteger(r.bytesRead)&&r.bytesRead>=0&&r.bytesRead<=block.length,'CI snapshot native read count');if(!r.bytesRead)break;const bytes=block.subarray(0,r.bytesRead);length=comparisonCiSnapshotBudget(length,bytes.length,cap,'CI snapshot file read cap');readBytes=comparisonCiSnapshotBudget(readBytes,bytes.length,readLimit,'CI snapshot read byte/work cap');hash.update(bytes);if(collect)parts.push(Buffer.from(bytes));if(destination){let offset=0;while(offset<bytes.length){const w=await destination.write(bytes,offset,bytes.length-offset,null);ciSnapshotRequire(Number.isSafeInteger(w.bytesWritten)&&w.bytesWritten>0&&w.bytesWritten<=bytes.length-offset,'CI snapshot copy write stalled');offset+=w.bytesWritten;writtenBytes=comparisonCiSnapshotBudget(writtenBytes,w.bytesWritten,writeLimit,'CI snapshot write byte cap');}}}ciSnapshotRequire(BigInt(length)===before.size,'CI snapshot original length');ciSnapshotEqual(ciSnapshotIdentity(await fd.stat({bigint:true})),beforeIdentity,'CI descriptor changed');ciSnapshotEqual(ciSnapshotIdentity(await stat(path,{bigint:true})),beforeIdentity,'CI pathname changed');ciSnapshotEqual((await chain(path)).map(a=>({path:a.path,dev:a.identity.dev,ino:a.identity.ino})),ancestors.map(a=>({path:a.path,dev:a.identity.dev,ino:a.identity.ino})),'CI ancestor changed during read');return {fact:{byteLength:length,sha256:hash.digest('hex')},identity:beforeIdentity,ancestors,...(collect?{bytes:Buffer.concat(parts,length)}:{})};});}
 async function data(path:string,cap=CI_SNAPSHOT_METADATA_FILE_CAP){const row=await read(path,undefined,undefined,true,cap);ciSnapshotRequire(row.bytes!==undefined,'CI JSON read');const value=ciSnapshotJson(row.bytes,cap);jsonFiles+=1;ciSnapshotRequire(jsonFiles<=CI_SNAPSHOT_JSON_FILES_CAP,'CI JSON file count');return {value,row};}
 const sealFile=await data(join(root,'dataset-seal.json')),seal=comparisonDatasetInventorySchema.parse(sealFile.value);ciSnapshotRequire(seal.status==='sealed'&&seal.ownershipSettled&&seal.finalizationSucceeded&&seal.slots.length===12,'CI snapshot requires settled H07 root12');ciSnapshotRequire(seal.configuration.rounds===1&&seal.configuration.mode==='headless','CI H07 configuration');
 const buildFile=await data(join(workspace,'apps/threadplane/.build-evidence.json')),probeFile=await data(join(workspace,'packages/runner/.comparison-build-evidence.json')),build=adapterBuildSchema.parse(buildFile.value),probe=comparisonInstrumentationBuildSchema.parse(probeFile.value);
 const keys=(v:Record<string,unknown>)=>Object.keys(v).sort(),same=(actual:string[],expected:readonly string[],label:string)=>ciSnapshotEqual(actual,[...expected].sort(),label);
 same(keys(build.sourceHashes),CI_SNAPSHOT_NAMES.product47,'CI product47 closure');same(keys(probe.sourceHashes),CI_SNAPSHOT_NAMES.probe31,'CI probe31 closure');same(keys(probe.compiledHashes),CI_SNAPSHOT_NAMES.compiled16,'CI selected16 closure');ciSnapshotRequire(keys(build.assetHashes).length===12,'CI served asset count');for(const key of keys(build.assetHashes))ciSnapshotKey(key);
 same(build.packages.map(p=>{ciSnapshotRequire(typeof p.resolutionPath==='string','CI product metadata original path');return p.resolutionPath;}).sort(),CI_SNAPSHOT_NAMES.productMetadata50,'CI product metadata membership');ciSnapshotRequire(probe.compiler.name==='typescript'&&probe.compiler.resolutionPath==='node_modules/typescript'&&probe.nativeCompiler.name==='@typescript/typescript-linux-x64'&&probe.nativeCompiler.resolutionPath==='node_modules/@typescript/typescript-linux-x64'&&probe.nativeCompiler.executablePath==='node_modules/@typescript/typescript-linux-x64/lib/tsc'&&probe.nativeCompiler.platform==='linux'&&probe.nativeCompiler.architecture==='x64','CI compiler platform/resolution');
 const lock=await data(join(workspace,'package-lock.json'),comparisonCiSnapshotFileCap('package-lock.json'));ciSnapshotRequire(lock.value&&typeof lock.value==='object'&&!Array.isArray(lock.value),'CI original lock object');const packages=Reflect.get(lock.value,'packages') as Record<string,{version?:unknown;integrity?:unknown}>;ciSnapshotRequire(packages&&typeof packages==='object'&&!Array.isArray(packages),'CI locked package map');const packageRows=[...build.packages,probe.compiler,probe.nativeCompiler].map(pkg=>{ciSnapshotRequire(typeof pkg.resolutionPath==='string'&&typeof pkg.name==='string'&&typeof pkg.version==='string'&&typeof pkg.integrity==='string','CI locked package complete facts');return {name:pkg.name,version:pkg.version,integrity:pkg.integrity,resolutionPath:pkg.resolutionPath};});for(const pkg of packageRows){const locked=packages[pkg.resolutionPath];ciSnapshotRequire(locked&&locked.version===pkg.version&&locked.integrity===pkg.integrity,'CI locked package version/integrity');}
 for(const slot of seal.slots){const manifest=comparisonManifestSchema.parse((await data(join(root,slot.artifactDirectory,'manifest.json'))).value);ciSnapshotRequire(manifest.git.revision===context.sha&&manifest.git.dirty===false,'CI original tested checkout identity');ciSnapshotEqual(manifest.adapter.build,build,'CI H07 build agrees with original record');}
 const outputs:string[]=[];async function physical(relative:string){const dir=join(workspace,relative);await chain(dir);const entries=await readdir(dir,{withFileTypes:true});ciSnapshotRequire(entries.length<=129,'CI output directory entry cap');for(const entry of entries){const key=ciSnapshotKey(relative+'/'+entry.name);ciSnapshotRequire(!entry.isSymbolicLink(),'CI output symlink');if(entry.isDirectory()){ciSnapshotRequire(CI_SNAPSHOT_NAMES.output138.some(p=>p.startsWith(key+'/')),'CI unexpected output directory');await physical(key);}else{ciSnapshotRequire(entry.isFile(),'CI output regular file');outputs.push(key);ciSnapshotRequire(outputs.length<=CI_SNAPSHOT_NAMES.output138.length,'CI output entry cap');}}}await physical('packages/contract/dist');await physical('packages/runner/dist');same(outputs.sort(),CI_SNAPSHOT_NAMES.output138,'CI full physical138 closure');same(outputs.filter(p=>p.startsWith('packages/contract/dist/')).sort(),CI_SNAPSHOT_NAMES.contract42,'CI contract42 closure');
 const metadata=[...new Set(packageRows.map(p=>p.resolutionPath+'/package.json'))].sort();ciSnapshotRequire(metadata.length===52,'CI platform metadata52');const names={source55:[...CI_SNAPSHOT_NAMES.source55],source23:[...CI_SNAPSHOT_NAMES.source23],product47:keys(build.sourceHashes),probe31:keys(probe.sourceHashes),compiled16:keys(probe.compiledHashes),output138:[...outputs],analyzerSelected9:[...CI_SNAPSHOT_NAMES.analyzerSelected9],contract42:[...CI_SNAPSHOT_NAMES.contract42],raw2:['apps/threadplane/.build-evidence.json','packages/runner/.comparison-build-evidence.json'],assets:keys(build.assetHashes).map(key=>'apps/threadplane/dist/'+key),metadata52:metadata};const union=[...new Set([...names.source55,...names.product47,...names.probe31,...names.output138,...names.analyzerSelected9,...names.raw2,...names.assets,...names.metadata52])].sort();ciSnapshotRequire(union.length<=CI_SNAPSHOT_MAX_FILES,'CI named union file cap');union.forEach(ciSnapshotKey);let declaredOriginalBytes=0;for(const key of union){const value=await stat(join(workspace,key),{bigint:true});ciSnapshotRequire(value.isFile()&&!value.isSymbolicLink()&&value.size>=0n&&value.size<=BigInt(comparisonCiSnapshotFileCap(key)),'CI union pre-read file cap');declaredOriginalBytes=comparisonCiSnapshotBudget(declaredOriginalBytes,Number(value.size),CI_SNAPSHOT_UNION_BYTES_CAP,'CI union pre-read aggregate cap');}comparisonCiSnapshotBudget(0,declaredOriginalBytes,CI_SNAPSHOT_UNION_BYTES_CAP,'CI union pre-read aggregate cap');
 const physicalAssets=async()=>{const found:string[]=[];async function walk(relative:string){const dir=join(workspace,relative);await chain(dir);const entries=await readdir(dir,{withFileTypes:true});ciSnapshotRequire(entries.length<=12,'CI asset directory entry cap');for(const entry of entries){const key=ciSnapshotKey(relative+'/'+entry.name);ciSnapshotRequire(!entry.isSymbolicLink(),'CI asset symlink');if(entry.isDirectory()){ciSnapshotRequire(names.assets.some(p=>p.startsWith(key+'/')),'CI unexpected asset directory');await walk(key);}else{ciSnapshotRequire(entry.isFile(),'CI asset regular');found.push(key);ciSnapshotRequire(found.length<=12,'CI asset physical count');}}}await walk('apps/threadplane/dist');same(found.sort(),names.assets,'CI served asset physical closure');};await physicalAssets();
 const expectedHashes:Record<string,string>={...build.sourceHashes,...probe.sourceHashes,...probe.compiledHashes,...Object.fromEntries(Object.entries(build.assetHashes).map(([key,hash])=>['apps/threadplane/dist/'+key,hash]))};for(const [key,hash] of Object.entries(probe.sourceHashes))if(build.sourceHashes[key]!==undefined)ciSnapshotRequire(build.sourceHashes[key]===hash,'CI shared source digest');for(const [key,hash] of Object.entries(probe.compiledHashes))if(build.sourceHashes[key]!==undefined)ciSnapshotRequire(build.sourceHashes[key]===hash,'CI shared compiled digest');
 const originals=new Map<string,Awaited<ReturnType<typeof read>>>();let originalBytes=0;for(const key of union){const row=await read(join(workspace,key),undefined,undefined,false,comparisonCiSnapshotFileCap(key));if(expectedHashes[key]!==undefined)ciSnapshotRequire(row.fact.sha256===expectedHashes[key],'CI source/build original digest');const inode=row.identity.dev+':'+row.identity.ino;ciSnapshotRequire(!originalInodes.has(inode),'CI distinct original hardlink');originalInodes.set(inode,key);for(const a of row.ancestors){const old=originalAncestors.get(a.path);if(old)ciSnapshotEqual({dev:old.dev,ino:old.ino},{dev:a.identity.dev,ino:a.identity.ino},'CI ancestor inconsistent');else originalAncestors.set(a.path,a.identity);}originals.set(key,row);originalBytes=comparisonCiSnapshotBudget(originalBytes,row.fact.byteLength,CI_SNAPSHOT_UNION_BYTES_CAP,'CI aggregate original byte cap');}ciSnapshotRequire(originalAncestors.size<=CI_SNAPSHOT_MAX_ANCESTORS,'CI ancestor entry cap');
 ciSnapshotEqual(originals.get(names.raw2[0]!)!.fact,buildFile.row.fact,'CI build record changed');ciSnapshotEqual(originals.get(names.raw2[1]!)!.fact,probeFile.row.fact,'CI probe record changed');ciSnapshotEqual(originals.get('package-lock.json')!.fact,lock.row.fact,'CI lock changed');
 for(const pkg of packageRows){const row=originals.get(pkg.resolutionPath+'/package.json');ciSnapshotRequire(row,'CI metadata original');const metadataValue=(await data(join(workspace,pkg.resolutionPath+'/package.json'))).value;ciSnapshotRequire(metadataValue&&typeof metadataValue==='object'&&!Array.isArray(metadataValue)&&Reflect.get(metadataValue,'name')===pkg.name&&Reflect.get(metadataValue,'version')===pkg.version,'CI package metadata identity');if(pkg.resolutionPath===probe.compiler.resolutionPath)ciSnapshotEqual(row.fact,probe.compilerPackageMetadata,'CI compiler metadata bytes');if(pkg.resolutionPath===probe.nativeCompiler.resolutionPath)ciSnapshotEqual(row.fact,probe.nativeCompilerPackageMetadata,'CI native compiler metadata bytes');}
 const directory=await mkdtemp(join(evidenceRoot,`comparison-browser-ci-context-${context.runId}-${context.runAttempt}-`));await chain(directory);const createdOwnDirectories=new Map<string,CiSnapshotIdentity>();async function rememberOwnDirectory(path:string){const actual=await stat(path,{bigint:true});ciSnapshotRequire(actual.isDirectory()&&!actual.isSymbolicLink(),'CI created own directory kind');const identity=ciSnapshotIdentity(actual),old=createdOwnDirectories.get(path);if(old)ciSnapshotRequire(identity.dev===old.dev&&identity.ino===old.ino,'CI created own directory replaced');else createdOwnDirectories.set(path,identity);ciSnapshotRequire(createdOwnDirectories.size<=CI_SNAPSHOT_MAX_OWN_DIRECTORIES,'CI created own directory cap');}await rememberOwnDirectory(directory);const records:{key:string;originalPath:string;before:{identity:CiSnapshotIdentity;fact:CiSnapshotFact};copied:{path:string;identity:CiSnapshotIdentity;fact:CiSnapshotFact};after:{identity:CiSnapshotIdentity;fact:CiSnapshotFact}}[]=[];const copiedInodes=new Set<string>();
 for(const key of union){const before=originals.get(key)!;const relative=ciSnapshotKey('workspace/'+key),destination=join(directory,relative);await mkdir(dirname(destination),{recursive:true});const createdChain=await chain(dirname(destination));for(const row of createdChain)if(row.path===directory||row.path.startsWith(directory+'/'))await rememberOwnDirectory(row.path);await rememberOwnDirectory(dirname(destination));const source=join(workspace,key);const copied=await owned(destination,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,async output=>{const row=await read(source,before.identity,output,false,comparisonCiSnapshotFileCap(key));ciSnapshotEqual(row.fact,before.fact,'CI source changed while copying');const identity=ciSnapshotIdentity(await output.stat({bigint:true}));ciSnapshotRequire(identity.size===String(before.fact.byteLength),'CI own copy size');return {identity,fact:row.fact};});const verified=await read(destination,copied.identity,undefined,false,comparisonCiSnapshotFileCap(key));ciSnapshotEqual(verified.fact,copied.fact,'CI own copy verification');const inode=copied.identity.dev+':'+copied.identity.ino;ciSnapshotRequire(!copiedInodes.has(inode)&&!originalInodes.has(inode),'CI copy hardlink identity');copiedInodes.add(inode);const after=await read(source,before.identity,undefined,false,comparisonCiSnapshotFileCap(key));ciSnapshotEqual(after.fact,before.fact,'CI original changed after copy');const record={key,originalPath:source,before:{identity:before.identity,fact:before.fact},copied:{path:relative,...copied},after:{identity:after.identity,fact:after.fact}};ciSnapshotRequire(Buffer.byteLength(JSON.stringify(record))<=8192,'CI per-record serialization cap');records.push(record);}
 const ancestors:{path:string;before:CiSnapshotIdentity;after:CiSnapshotIdentity}[]=[];for(const [path,before] of originalAncestors){const actual=await stat(path,{bigint:true});ciSnapshotRequire(actual.isDirectory()&&!actual.isSymbolicLink(),'CI original ancestor kind');const after=ciSnapshotIdentity(actual);ciSnapshotRequire(after.dev===before.dev&&after.ino===before.ino,'CI original ancestor replaced after snapshot');const row={path,before,after};ciSnapshotRequire(Buffer.byteLength(JSON.stringify(row))<=2048,'CI ancestor serialization cap');ancestors.push(row);}
 ciSnapshotEqual((await read(join(root,'dataset-seal.json'))).fact,sealFile.row.fact,'CI settled seal changed');const manifest={format:'comparison-ci-original-snapshot-v7',context,originalWorkspacePrefix:workspace,originalTmpdirPrefix:evidenceRoot,originalRoot:root,rootSeal:sealFile.row.fact,inventories:names,originalBytes,limits:{fileBytes:CI_SNAPSHOT_METADATA_FILE_CAP,lockBytes:CI_SNAPSHOT_LOCK_FILE_CAP,originalBytes:CI_SNAPSHOT_UNION_BYTES_CAP,files:CI_SNAPSHOT_MAX_FILES,ancestors:CI_SNAPSHOT_MAX_ANCESTORS,manifestBytes:CI_SNAPSHOT_MANIFEST_CAP,readBytes:readLimit,writeBytes:writeLimit,jsonFiles:CI_SNAPSHOT_JSON_FILES_CAP,ownDirectories:CI_SNAPSHOT_MAX_OWN_DIRECTORIES,receiptBytes:CI_SNAPSHOT_RECEIPT_CAP},work:{beforeManifestReadBytes:readBytes,copiedFileBytes:writtenBytes,jsonFiles:jsonFiles},records,ancestors};ciSnapshotRequire(originalBytes===declaredOriginalBytes,'CI union preflight bytes changed');const bytes=Buffer.from(JSON.stringify(manifest)+'\n');comparisonCiSnapshotBudget(0,bytes.length,CI_SNAPSHOT_MANIFEST_CAP,'CI snapshot manifest cap');const path=join(directory,'snapshot.json');const manifestIdentity=await owned(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,async fd=>{let offset=0;while(offset<bytes.length){const result=await fd.write(bytes,offset,bytes.length-offset,null);ciSnapshotRequire(Number.isSafeInteger(result.bytesWritten)&&result.bytesWritten>0&&result.bytesWritten<=bytes.length-offset,'CI manifest write stalled');offset+=result.bytesWritten;writtenBytes=comparisonCiSnapshotBudget(writtenBytes,result.bytesWritten,writeLimit,'CI manifest write byte cap');}const identity=ciSnapshotIdentity(await fd.stat({bigint:true}));ciSnapshotRequire(identity.size===String(bytes.length),'CI manifest own size');return identity;});const final=await read(path,manifestIdentity,undefined,true,CI_SNAPSHOT_MANIFEST_CAP);ciSnapshotRequire(final.bytes!==undefined&&final.bytes.equals(bytes),'CI snapshot manifest readback');
 const ownTree=async()=>{const files:string[]=[],directories:{path:string;created:CiSnapshotIdentity;identity:CiSnapshotIdentity;members:string[]}[]=[];async function walk(relative=''){const dir=relative?join(directory,relative):directory;await chain(dir);const before=await stat(dir,{bigint:true});ciSnapshotRequire(before.isDirectory()&&!before.isSymbolicLink(),'CI own directory kind');const identity=ciSnapshotIdentity(before),created=createdOwnDirectories.get(dir);ciSnapshotRequire(created&&identity.dev===created.dev&&identity.ino===created.ino,'CI own directory creation identity');const entries=await readdir(dir,{withFileTypes:true});ciSnapshotRequire(entries.length<=CI_SNAPSHOT_MAX_FILES+1,'CI own directory entry cap');const members=entries.map(entry=>entry.name).sort();for(const entry of entries){const key=relative?relative+'/'+entry.name:entry.name;ciSnapshotKey(key);const actual=await stat(join(directory,key),{bigint:true});ciSnapshotRequire(!actual.isSymbolicLink()&&!entry.isSymbolicLink(),'CI copied tree symlink');if(actual.isDirectory()){ciSnapshotRequire(records.some(r=>r.copied.path.startsWith(key+'/')),'CI extra copied directory');await walk(key);}else{ciSnapshotRequire(actual.isFile()&&entry.isFile(),'CI copied tree regular');const expected=key==='snapshot.json'?manifestIdentity:records.find(r=>r.copied.path===key)?.copied.identity;ciSnapshotRequire(expected,'CI unexpected own member');ciSnapshotEqual(ciSnapshotIdentity(actual),expected,'CI own physical member identity');files.push(key);ciSnapshotRequire(files.length<=CI_SNAPSHOT_MAX_FILES+1,'CI copied tree entry cap');}}ciSnapshotEqual(ciSnapshotIdentity(await stat(dir,{bigint:true})),identity,'CI own directory changed during enumeration');const row={path:relative,created,identity,members};ciSnapshotRequire(Buffer.byteLength(JSON.stringify(row))<=8192,'CI own directory row cap');directories.push(row);ciSnapshotRequire(directories.length<=CI_SNAPSHOT_MAX_OWN_DIRECTORIES,'CI own directory count cap');}await walk();same(files.sort(),[...records.map(r=>r.copied.path),'snapshot.json'],'CI own physical closed membership');same(directories.map(row=>row.path).sort(),[...createdOwnDirectories.keys()].map(path=>path===directory?'':path.slice(directory.length+1)).sort(),'CI own directory closed identities');return directories.sort((a,b)=>a.path.localeCompare(b.path));};
 const ownBefore=await ownTree();for(const record of records){const current=await read(join(directory,record.copied.path),record.copied.identity,undefined,false,comparisonCiSnapshotFileCap(record.key));ciSnapshotEqual(current.fact,record.copied.fact,'CI final own copy bytes');}
 for(const [key,before] of originals){const after=await read(join(workspace,key),before.identity,undefined,false,comparisonCiSnapshotFileCap(key));ciSnapshotEqual(after.fact,before.fact,'CI original changed during whole snapshot');}outputs.length=0;await physical('packages/contract/dist');await physical('packages/runner/dist');same(outputs.sort(),names.output138,'CI final original physical138 closure');await physicalAssets();
 for(const [path,before] of originalAncestors){const actual=await stat(path,{bigint:true});ciSnapshotRequire(actual.isDirectory()&&!actual.isSymbolicLink(),'CI final original ancestor kind');const identity=ciSnapshotIdentity(actual);ciSnapshotRequire(identity.dev===before.dev&&identity.ino===before.ino,'CI final original ancestor identity');}
 const manifestAfter=await read(path,manifestIdentity,undefined,true,CI_SNAPSHOT_MANIFEST_CAP);ciSnapshotRequire(manifestAfter.bytes!==undefined&&manifestAfter.bytes.equals(bytes),'CI final manifest bytes');ciSnapshotEqual(manifestAfter.fact,final.fact,'CI manifest lifetime fact');const ownAfter=await ownTree();ciSnapshotEqual(ownAfter,ownBefore,'CI own directory lifetime closure');
 const lifetime={manifest:{identity:manifestIdentity,fact:manifestAfter.fact},directories:ownAfter};const receipt={directory,path,byteLength:bytes.length,sha256:digest(bytes),lifetime,work:{readBytes,writtenBytes,jsonFiles}};comparisonCiSnapshotBudget(0,Buffer.byteLength(JSON.stringify(receipt)),CI_SNAPSHOT_RECEIPT_CAP,'CI own lifetime receipt cap');return receipt;
}
