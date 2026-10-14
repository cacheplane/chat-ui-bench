/** Hosted-only allocator. Dynamically load only after both external admission guards.
 * No SDK, AIMock, or fixture value imports. Never execute this file during local preparation.
 */
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { writeFile, mkdir, appendFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import type { AGUIMock } from '@copilotkit/aimock';
import type { HttpAgent, HttpAgentFetchFn, AgentSubscriber, RunAgentParameters } from '@ag-ui/client';
import {
  assertHostedAdmission, CAPTURE_LIMITS, createOperationGate, reserveCaptureBytes,
  transitionReader, recordObservedEvent, recordObservedError, projectBoundedJson,
  TASK_LIMITS, createTaskCapacity, reserveTaskGroup, commitTaskTicket, admitReaderRead, encodeTerminalSummary,
} from '../support/hosted-httpagent-contract.js';
import type {
  HostedAdmission, CaptureBudget, OperationGate, ObservationRecorder,
  ReaderLifecycle as InertReaderLifecycle,
  TaskCapacity, TaskTicket,
} from '../support/hosted-httpagent-contract.js';

export const OPERATION_MS = 15_000;
export const DISPOSAL_MS = 10_000;
// One monotonic clock for liveness deadlines only; no timing qualification.
function monotonicNow(): number { return performance.now(); }
export type TaskSettlement = 'pending' | 'fulfilled' | 'rejected';
export interface OwnedTask<T = unknown> {
  id: number; label: string; owner: string; lane: 'normal' | 'terminal'; operation: number | null; settlement: TaskSettlement;
  // Non-void settled results are released after their ORIGINAL disposition is
  // observed, avoiding a second durable copy of every read buffer/SDK result.
  original: Promise<T> | null; observed: Promise<void>;
}
export interface BodyEvidence { domain: string; bytes: number; chunks: Uint8Array[]; persistedChunks: number; persistedBytes: number; persistenceFailed: boolean; persistenceIncomplete: boolean }
export interface ReaderLifecycle {
  id: number;
  state: InertReaderLifecycle; reader: ReadableStreamDefaultReader<Uint8Array>;
  controller: AbortController; body: BodyEvidence; operation: number;
  pending: OwnedTask<ReadableStreamReadResult<Uint8Array>> | null;
  disposal: OwnedTask<void> | null; released: boolean;
  terminal: 'open' | 'eof' | 'cancelled' | 'read-error';
}
export interface OperationSettlement {
  token: number; kind: 'sdk' | 'raw'; original: TaskSettlement; complete: boolean;
  finalized: boolean; timedOut: boolean; recorder: ObservationRecorder;
  request: BodyEvidence; proxyRequest: BodyEvidence; upstreamRequest: BodyEvidence;
  response: BodyEvidence; proxyResponse: BodyEvidence;
  status: number | null; contentType: string | null; requests: number; proxyRequests: number; upstreamRequests: number;
  controller: AbortController; agent: HttpAgent | null;
  publicTask: OwnedTask | null; deadline: number;
  proxySocket: Socket | null; upstreamSocket: Socket | null;
  requestHeaders: unknown;
  finalize: (() => void) | null; unsubscribe: (() => void) | null; removeListeners: (() => void)[];
}
interface OwnedSocket { socket: Socket; close: OwnedTask<void>; closed: boolean }
interface OwnedResponse {
  response: ServerResponse; finish: OwnedTask<'finish' | 'premature-close' | 'error'>;
  close: OwnedTask<void>; finished: boolean; closed: boolean;
}
interface OwnedServer { server: Server; listen: OwnedTask<void>; close: OwnedTask<void>; closeStarted: boolean; requestClose: () => void }
export interface SessionOwnership {
  admission: Readonly<HostedAdmission>; budget: CaptureBudget; gate: OperationGate;
  tasks: OwnedTask[]; readers: ReaderLifecycle[]; sockets: OwnedSocket[];
  responses: OwnedResponse[]; servers: OwnedServer[]; controllers: AbortController[];
  operations: OperationSettlement[]; active: OperationSettlement | null;
  upstreamUrl: string | null; proxyUrl: string | null; receiptPath: string;
  initialReceipt: boolean; closing: boolean; incomplete: boolean;
  primaryFailures: string[]; cleanupFailures: string[]; captureFailed: boolean;
  disposal: OwnedTask<void> | null; receiptTail: Promise<void>;
  disposalDeadline: number | null;
  capacity: TaskCapacity; terminalReceipts: (OwnedTask<void> | null)[];
  normalReceipt: { task: OwnedTask<void> | null; bytes: number; sha256: string | null };
}

/** Caller must pass actual RUNNER_TEMP and actual bounded Actions run ID. The
 * workflow owns this fixed destination; candidate/release data cannot select paths.
 * This constructor allocates only metadata, not files, timers, servers or SDKs.
 */
export function createOwnedSession(admission: HostedAdmission, runnerTemp: string, runId: string): SessionOwnership {
  const admitted = assertHostedAdmission(admission);
  if (!/^\/[a-zA-Z0-9_./-]+$/.test(runnerTemp) || runnerTemp.split('/').some(part => part === '..' || part === '.')
    || runnerTemp.length > 2048 || !/^[1-9][0-9]{0,19}$/.test(runId)) throw new Error('Invalid owned runner destination');
  const budget: CaptureBudget = { retainedBytes: 0, domains: Object.create(null) as Record<string, number> };
  // Reserve SERIALIZED evidence capacity, not JavaScript heap accounting.
  // Every fixed ASCII row/failure is constrained to fit its 256-byte slot.
  // Capture exhaustion must never prevent registration of abort/disposal tasks.
  // Additional 128 KiB covers the fixed identity and bounded scalar resource
  // projections: <=2 servers, 64 sockets, 16 responses/readers, 20 controllers,
  // eight operations and forty body descriptors. Raw bytes/observer graphs and
  // each serialized receipt/disk copy are reserved separately when captured.
  reserveCaptureBytes(budget, null, 8192 * 256 + 128 * 256 + 128 * 1024);
  const capacity = createTaskCapacity(budget);
  return {
    admission: admitted, budget,
    gate: createOperationGate(), tasks: [], readers: [], sockets: [], responses: [], servers: [], controllers: [],
    operations: [], active: null, upstreamUrl: null, proxyUrl: null,
    receiptPath: join(runnerTemp, `hosted-httpagent-${runId}-1`, 'receipt.json'),
    initialReceipt: false, closing: false, incomplete: false, primaryFailures: [], cleanupFailures: [],
    captureFailed: false, disposal: null, receiptTail: Promise.resolve(), disposalDeadline: null,
    capacity, terminalReceipts: [null, null],
    normalReceipt: { task: null, bytes: 0, sha256: null },
  };
}

function failure(session: SessionOwnership, cleanup: boolean, label: string): void {
  // Fixed caller-controlled classifications, never arbitrary errors/graphs.
  const target = cleanup ? session.cleanupFailures : session.primaryFailures;
  if (target.includes(label)) return;
  if (!/^[a-zA-Z -]{1,128}$/.test(label) || session.primaryFailures.length + session.cleanupFailures.length >= 128) session.captureFailed = true;
  else target.push(label); // Covered by constructor's fixed failure reservation.
  // Any owned infrastructure/capture/cleanup failure closes further admission.
  session.gate.close();
}

/** Register the deferred ORIGINAL before calling the effect. Its rejection is
 * observed immediately; its public value/error is never replaced with a race.
 */
function deferredTask<T>(session: SessionOwnership, label: string, operation: number | null,
  ticket?: TaskTicket, terminalOwner?: string): {
  task: OwnedTask<T>; resolve: (value: T | PromiseLike<T>) => void; reject: (reason: unknown) => void;
} {
  if (!/^[a-z-]{1,64}$/.test(label) || (operation !== null && (!Number.isInteger(operation) || operation < 1 || operation > 8))) throw new Error('Invalid owned task identity');
  const admitted = ticket ?? taskGroup(session, terminalOwner ? 'terminal' : 'normal', [{ label,
    owner: terminalOwner ?? (operation === null ? 'session' : `operation-${operation}`) }])[0]!;
  if (admitted.label !== label) throw new Error('Wrong original task permit');
  commitTaskTicket(session.capacity, admitted);
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const original = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  const task: OwnedTask<T> = { id: admitted.id, label, owner: admitted.owner, lane: admitted.lane, operation,
    settlement: 'pending', original, observed: Promise.resolve() };
  const discard = ['reader-read', 'reader-acquire', 'sdk-scoped-fetch', 'proxy-upstream-fetch',
    'raw-fetch', 'sdk-public-run-agent', 'sdk-subscribe', 'aimock-public-handler'].includes(label);
  task.observed = original.then(() => {
    task.settlement = 'fulfilled'; if (discard) task.original = null;
  }, () => {
    task.settlement = 'rejected'; if (discard) task.original = null;
  });
  session.tasks.push(task);
  return { task, resolve, reject };
}
function taskGroup(session: SessionOwnership, lane: 'normal' | 'terminal', requests: { label: string; owner: string }[]): TaskTicket[] {
  const admitted = reserveTaskGroup(session.capacity, lane, requests);
  if (admitted) return admitted;
  session.incomplete = true; session.captureFailed = true; session.gate.close();
  failure(session, false, lane === 'normal' ? 'Normal task admission exhausted' : 'Terminal task admission invalid');
  if (lane === 'normal') void disposeOwnedSession(session); // Registered/aborted before this denial throws.
  else { session.closing = true; for (const controller of session.controllers) controller.abort(); }
  throw new Error('Owned task admission denied');
}
function launch<T>(session: SessionOwnership, label: string, operation: number | null, effect: () => T | Promise<T>,
  ticket?: TaskTicket, terminalOwner?: string): OwnedTask<T> {
  const registered = deferredTask<T>(session, label, operation, ticket, terminalOwner);
  try { registered.resolve(effect()); } catch (error) { registered.reject(error); }
  return registered.task;
}
function body(domain: string): BodyEvidence { return { domain, bytes: 0, chunks: [], persistedChunks: 0, persistedBytes: 0, persistenceFailed: false, persistenceIncomplete: false }; }
function capture(session: SessionOwnership, evidence: BodyEvidence, bytes: Uint8Array): void {
  try { reserveCaptureBytes(session.budget, evidence.domain, bytes.byteLength); }
  catch (error) {
    session.captureFailed = true; session.incomplete = true;
    failure(session, false, 'Raw byte capture admission failed'); throw error;
  }
  // Own exact bytes; SDK/Node buffers may subsequently be reused.
  evidence.chunks.push(Uint8Array.from(bytes)); evidence.bytes += bytes.byteLength;
}
/** A separately retained joined copy is charged too. Callers must not clone it
 * or decode/parse it into durable evidence without another budget reservation.
 */
export function joinedBody(session: SessionOwnership, evidence: BodyEvidence): Uint8Array<ArrayBuffer> {
  reserveCaptureBytes(session.budget, null, evidence.bytes);
  const result = new Uint8Array(evidence.bytes); let offset = 0;
  for (const chunk of evidence.chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}
function digest(evidence: BodyEvidence): string {
  const hash = createHash('sha256'); for (const chunk of evidence.chunks) hash.update(chunk); return hash.digest('hex');
}
function ownController(session: SessionOwnership): AbortController {
  if (session.controllers.length >= 20) throw new Error('Owned controller count limit');
  const controller = new AbortController(); session.controllers.push(controller); return controller;
}
function requireActive(session: SessionOwnership): OperationSettlement {
  const operation = session.active;
  if (operation && monotonicNow() >= operation.deadline) expireOperation(session, operation);
  if (!operation || session.closing || session.incomplete || session.gate.closed
    || session.gate.active !== operation.token || operation.controller.signal.aborted) throw new Error('No active owned operation');
  return operation;
}
function captureResponseHeaders(session: SessionOwnership, operation: OperationSettlement, response: Response): void {
  const projected = projectBoundedJson({ status: response.status, contentType: response.headers.get('content-type') }, session.budget) as {
    status: number; contentType: string | null;
  };
  operation.status = projected.status; operation.contentType = projected.contentType;
}

function ownResponse(session: SessionOwnership, response: ServerResponse, operation: number | null): OwnedResponse {
  if (session.responses.length >= 16) throw new Error('Owned response count limit');
  const owner = operation === null ? 'session' : `operation-${operation}`;
  const permits = taskGroup(session, 'normal', ['response-finish', 'response-close'].map(label => ({ label, owner })));
  const finish = deferredTask<'finish' | 'premature-close' | 'error'>(session, 'response-finish', operation, permits[0]!);
  const close = deferredTask<void>(session, 'response-close', operation, permits[1]!);
  const owned: OwnedResponse = { response, finish: finish.task, close: close.task, finished: false, closed: false };
  session.responses.push(owned);
  response.once('finish', () => { owned.finished = true; finish.resolve('finish'); });
  response.once('close', () => { owned.closed = true; close.resolve(); if (!owned.finished) finish.resolve('premature-close'); });
  response.on('error', () => { finish.resolve('error'); failure(session, session.closing, 'Owned response error'); });
  return owned;
}
function ownSocket(session: SessionOwnership, socket: Socket): void {
  if (session.sockets.length >= 64) throw new Error('Owned socket count limit');
  const close = deferredTask<void>(session, 'socket-close', null);
  const owned: OwnedSocket = { socket, close: close.task, closed: false }; session.sockets.push(owned);
  socket.once('close', () => { owned.closed = true; close.resolve(); });
  socket.on('error', () => { failure(session, session.closing, 'Owned socket error'); });
}
function ownedEnd(session: SessionOwnership, response: ServerResponse, operation: number | null, bytes?: Uint8Array): OwnedTask<void> {
  return launch(session, 'response-end', operation, () => new Promise<void>((resolve, reject) => {
    // finish/close/error have independent pre-effect records. They cannot
    // manufacture settlement of this ORIGINAL end callback.
    try { response.end(bytes, () => { resolve(); }); } catch (error) { reject(error); }
  }));
}
function rejectRoute(session: SessionOwnership, response: ServerResponse): void {
  response.writeHead(405, { 'content-type': 'application/json', connection: 'close' });
  const task = ownedEnd(session, response, session.active?.token ?? null, Buffer.from('{"error":"Owned route rejected"}'));
  void task.observed.then(() => { if (task.settlement === 'rejected') failure(session, false, 'Route rejection write failed'); });
}
function infrastructureResponse(session: SessionOwnership, response: ServerResponse, token: number, classification: string): void {
  failure(session, false, classification);
  if (response.destroyed || response.writableEnded) return;
  if (response.headersSent) response.destroy();
  else {
    response.writeHead(500, { 'content-type': 'application/json', connection: 'close' });
    const task = ownedEnd(session, response, token, Buffer.from('{"error":"Owned handler infrastructure failure"}'));
    void task.observed.then(() => { if (task.settlement === 'rejected') failure(session, true, 'Infrastructure fallback write failed'); });
  }
}

async function allocateServer(session: SessionOwnership, handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<OwnedServer> {
  if (session.closing || session.servers.length >= 2) throw new Error('Session closing / server count limit');
  const deadline = monotonicNow() + OPERATION_MS;
  const permits = taskGroup(session, 'normal', ['server-allocate', 'server-listen', 'server-close'].map(label => ({ label, owner: 'session' })));
  let server!: Server;
  const allocated = launch(session, 'server-allocate', null, () => { server = createServer(); }, permits[0]!);
  await allocated.original;
  const listen = deferredTask<void>(session, 'server-listen', null, permits[1]!);
  const close = deferredTask<void>(session, 'server-close', null, permits[2]!);
  const owned: OwnedServer = { server, listen: listen.task, close: close.task, closeStarted: false,
    requestClose() {
      if (owned.closeStarted) return; owned.closeStarted = true;
      try { server.close(error => { if (error) close.reject(error); else close.resolve(); }); }
      catch (error) { close.reject(error); }
    } };
  session.servers.push(owned);
  server.on('connection', socket => {
    try { ownSocket(session, socket); } catch { failure(session, false, 'Socket registration failed'); socket.destroy(); }
  });
  server.on('request', (req, res) => {
    try { ownResponse(session, res, session.active?.token ?? null); handler(req, res); }
    catch { failure(session, false, 'Request registration failed'); res.destroy(); }
  });
  server.on('error', error => { listen.reject(error); failure(session, session.closing, 'Owned server error'); });
  server.once('listening', () => { listen.resolve(); });
  server.listen(0, '127.0.0.1');
  if (!await within(session, listen.task.observed, deadline, () => { owned.requestClose(); })) {
    session.incomplete = true; session.gate.close(); throw new Error('Server listen incomplete');
  }
  await listen.task.original;
  return owned;
}
function addressOf(owned: OwnedServer, route: '/' | '/agui'): string {
  const address = owned.server.address();
  if (!address || typeof address === 'string' || address.address !== '127.0.0.1') throw new Error('Unexpected owned server address');
  return `http://127.0.0.1:${address.port}${route}`;
}

export async function openOwnedMockEndpoint(session: SessionOwnership, mock: Pick<AGUIMock, 'handleRequest'>): Promise<string> {
  if (session.upstreamUrl !== null) throw new Error('Upstream already allocated');
  const owned = await allocateServer(session, (req, res) => {
    if (session.closing || req.method !== 'POST' || req.url !== '/') { rejectRoute(session, res); return; }
    const operation = requireActive(session);
    if (++operation.upstreamRequests !== 1) { infrastructureResponse(session, res, operation.token, 'Duplicate upstream request'); return; }
    operation.upstreamSocket = req.socket;
    const request = deferredTask<void>(session, 'upstream-request-body', operation.token);
    let bodyFailed = false;
    // Same tick as public handler: observe rather than preconsume the request.
    req.on('data', (chunk: Buffer) => {
      if (bodyFailed) return;
      try { capture(session, operation.upstreamRequest, chunk); }
      catch { bodyFailed = true; failure(session, false, 'Upstream request capture failed'); req.destroy(); }
    });
    req.once('end', () => { bodyFailed ? request.reject(new Error('Body capture failed')) : request.resolve(); });
    req.once('aborted', () => { request.reject(new Error('Request aborted')); });
    req.once('error', () => { request.reject(new Error('Request error')); });
    req.once('close', () => { if (!req.complete) request.reject(new Error('Request closed')); });
    const handled = launch(session, 'aimock-public-handler', operation.token, () => mock.handleRequest(req, res, '/'));
    const branch = launch(session, 'aimock-handler-branch', operation.token, async () => {
      try { if (!await handled.original!) infrastructureResponse(session, res, operation.token, 'AIMock handler returned false'); }
      catch { infrastructureResponse(session, res, operation.token, 'AIMock handler rejected'); }
    });
    void branch.observed;
  });
  session.upstreamUrl = addressOf(owned, '/'); return session.upstreamUrl;
}

function ownReader(session: SessionOwnership, response: Response, controller: AbortController,
  evidence: BodyEvidence, token: number): ReaderLifecycle {
  if (!response.body || session.readers.length >= 16) throw new Error('Missing response body / reader count limit');
  const lifecycle: ReaderLifecycle = {
    id: session.readers.length + 1,
    state: { phase: 'open', pendingRead: false, pendingCancel: false, disposalStarted: false,
      cancelStarted: false, cancelSettled: false, eof: false, socketClosed: false, releases: 0 },
    reader: acquireReader(session, response.body, token), controller, body: evidence, operation: token,
    pending: null, disposal: null, released: false, terminal: 'open',
  };
  session.readers.push(lifecycle);
  // Observe the owned SERVER peer socket, never inspect undici/private SDK sockets.
  const operation = session.operations.find(item => item.token === token);
  const peer = evidence === operation?.proxyResponse ? operation.upstreamSocket : operation?.proxySocket;
  if (peer) {
    const closed = () => { lifecycle.state = transitionReader(lifecycle.state, 'socketClosed'); };
    if (session.sockets.find(item => item.socket === peer)?.closed) closed();
    else peer.once('close', closed);
  }
  return lifecycle;
}
function acquireReader(session: SessionOwnership, stream: ReadableStream<Uint8Array>, token: number): ReadableStreamDefaultReader<Uint8Array> {
  const acquisition = deferredTask<ReadableStreamDefaultReader<Uint8Array>>(session, 'reader-acquire', token);
  try { const reader = stream.getReader(); acquisition.resolve(reader); return reader; }
  catch (error) { acquisition.reject(error); throw error; }
}
function releaseReader(session: SessionOwnership, owned: ReaderLifecycle): void {
  if (owned.released) return;
  owned.state = transitionReader(owned.state, 'release');
  // Exactly one attempted release even if the public method throws.
  owned.released = true;
  try { owned.reader.releaseLock(); } catch { failure(session, true, 'Owned reader release failed'); }
}
async function readOwned(session: SessionOwnership, owned: ReaderLifecycle): Promise<ReadableStreamReadResult<Uint8Array>> {
  const admitted = admitReaderRead(session.capacity, owned.state, `reader-${owned.id}`);
  if (!admitted) {
    session.incomplete = true; session.captureFailed = true; failure(session, false, 'Normal reader admission exhausted');
    void disposeOwnedSession(session); throw new Error('Owned reader admission denied');
  }
  const registered = deferredTask<ReadableStreamReadResult<Uint8Array>>(session, 'reader-read', owned.operation, admitted.ticket);
  owned.state = admitted.state; owned.pending = registered.task;
  const pending = registered.task;
  try { registered.resolve(owned.reader.read()); } catch (error) { registered.reject(error); }
  try {
    const result = await pending.original!;
    owned.state = transitionReader(owned.state, 'readSettled');
    if (owned.state.phase === 'closing') return result; // Original bytes never enqueue after closing.
    if (result.done) { owned.state = transitionReader(owned.state, 'eof'); owned.terminal = 'eof'; }
    else capture(session, owned.body, result.value);
    return result;
  } catch (error) {
    if (owned.state.pendingRead) owned.state = transitionReader(owned.state, 'readSettled');
    owned.terminal = 'read-error'; throw error;
  } finally {
    owned.pending = null;
    if (owned.state.eof) releaseReader(session, owned);
  }
}
function disposeReader(session: SessionOwnership, owned: ReaderLifecycle): Promise<void> {
  if (owned.disposal) return owned.disposal.original!;
  const registered = deferredTask<void>(session, 'reader-dispose', owned.operation, undefined, `reader-${owned.id}`); owned.disposal = registered.task;
  owned.state = transitionReader(owned.state, 'dispose'); owned.controller.abort();
  registered.resolve((async () => {
    if (owned.pending) await owned.pending.observed;
    try {
      if (!owned.state.eof && !owned.released) {
        owned.state = transitionReader(owned.state, 'cancel');
        const cancel = launch(session, 'reader-cancel', owned.operation, () => owned.reader.cancel('Owned disposal'), undefined, `reader-${owned.id}`);
        try { await cancel.original; owned.terminal = 'cancelled'; }
        catch { failure(session, true, 'Owned reader cancellation rejected'); }
        finally { owned.state = transitionReader(owned.state, 'cancelSettled'); }
      }
    } finally { releaseReader(session, owned); }
  })());
  return registered.task.original!;
}

export function wrapOwnedResponse(session: SessionOwnership, response: Response, controller: AbortController,
  evidence: BodyEvidence, token: number): Response {
  const owned = ownReader(session, response, controller, evidence, token);
  const stream = new ReadableStream<Uint8Array>({
    pull(destination) {
      const pull = launch(session, 'wrapper-pull', token, async () => {
        try {
          const result = await readOwned(session, owned);
          if (owned.state.disposalStarted) return;
          if (result.done) destination.close();
          else { owned.state = transitionReader(owned.state, 'enqueue'); destination.enqueue(result.value); }
        } catch (error) {
          if (!owned.state.disposalStarted) {
            failure(session, false, 'Owned wrapper read failed'); destination.error(error);
          }
          await disposeReader(session, owned);
        }
      });
      return pull.original!;
    },
    cancel() { return disposeReader(session, owned); },
  }, { highWaterMark: 0 });
  return new Response(stream, { status: response.status, statusText: response.statusText, headers: response.headers });
}

/** Install drain/abort/close/error and callback settlement BEFORE write(). False
 * means buffered bytes, never dropped bytes. Both originals are owned and waited.
 */
async function writeChunk(session: SessionOwnership, res: ServerResponse, controller: AbortController,
  bytes: Uint8Array, token: number): Promise<void> {
  // No callback-effect record exists when no write will be invoked. The
  // following registration/listener/write sequence has no asynchronous gap.
  if (controller.signal.aborted || res.destroyed) throw new Error('Write not invoked');
  const permits = taskGroup(session, 'normal', ['response-write-callback', 'response-drain'].map(label => ({ label, owner: `operation-${token}` })));
  const callback = deferredTask<void>(session, 'response-write-callback', token, permits[0]!);
  const drain = deferredTask<void>(session, 'response-drain', token, permits[1]!);
  const cleanup = () => {
    res.off('drain', onDrain); res.off('close', onClose); res.off('error', onError);
    controller.signal.removeEventListener('abort', onAbort);
  };
  const onDrain = () => { res.off('drain', onDrain); drain.resolve(); };
  const fail = () => { cleanup(); drain.reject(new Error('Write interrupted')); };
  const onClose = () => { fail(); }; const onError = () => { fail(); }; const onAbort = () => { fail(); };
  res.once('drain', onDrain); res.once('close', onClose); res.once('error', onError);
  controller.signal.addEventListener('abort', onAbort, { once: true });
  try {
    const accepted = res.write(bytes, error => { if (error) { callback.reject(error); fail(); } else callback.resolve(); });
    if (accepted) { res.off('drain', onDrain); drain.resolve(); }
  } catch (error) { cleanup(); callback.reject(error); drain.reject(error); }
  try { await Promise.all([callback.task.original, drain.task.original]); }
  finally { cleanup(); }
}

export async function openOwnedProxy(session: SessionOwnership): Promise<string> {
  const upstream = session.upstreamUrl;
  if (!upstream || session.proxyUrl) throw new Error('Fixed upstream required / proxy already allocated');
  const owned = await allocateServer(session, (req, res) => {
    if (session.closing || req.method !== 'POST' || req.url !== '/agui') { rejectRoute(session, res); return; }
    const operation = requireActive(session); const controller = ownController(session);
    if (++operation.proxyRequests !== 1) { infrastructureResponse(session, res, operation.token, 'Duplicate proxy request'); return; }
    operation.proxySocket = req.socket;
    let reader: ReaderLifecycle | null = null;
    let disposal: OwnedTask<void> | null = null;
    let forwarding: OwnedTask<void> | null = null;
    const dispose = (): Promise<void> => {
      if (disposal) return disposal.original!;
      const registered = deferredTask<void>(session, 'proxy-dispose', operation.token, undefined, `operation-${operation.token}`); disposal = registered.task;
      controller.abort();
      // The serial loop observes controller abort before any further read/write.
      registered.resolve((async () => {
        if (reader) await disposeReader(session, reader);
        if (!res.destroyed && !res.writableFinished) res.destroy();
      })());
      return disposal.original!;
    };
    const onAbort = () => { void dispose(); };
    const onClose = () => { if (!res.writableFinished) void dispose(); };
    req.once('aborted', onAbort); req.once('error', onAbort);
    res.once('close', onClose); res.once('error', onAbort);
    operation.controller.signal.addEventListener('abort', onAbort, { once: true });
    forwarding = launch(session, 'proxy-forwarding', operation.token, async () => {
      try {
        // No parsing/re-encoding: original POST bytes forwarded exactly once.
        for await (const chunk of req) {
          if (controller.signal.aborted) throw new Error('Proxy closing');
          capture(session, operation.proxyRequest, chunk as Buffer);
        }
        const bytes = joinedBody(session, operation.proxyRequest);
        const upstreamFetch = launch(session, 'proxy-upstream-fetch', operation.token, () => fetch(upstream, {
          method: 'POST', body: bytes, headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
          signal: controller.signal, redirect: 'error',
        }));
        const response = await upstreamFetch.original!;
        reader = ownReader(session, response, controller, operation.proxyResponse, operation.token);
        if (controller.signal.aborted) { await disposeReader(session, reader); throw new Error('Proxy closing'); }
        const contentType = response.headers.get('content-type');
        if (contentType === null) res.writeHead(response.status);
        else res.writeHead(response.status, { 'content-type': contentType });
        while (!controller.signal.aborted) {
          const result = await readOwned(session, reader);
          if (controller.signal.aborted || reader.state.disposalStarted) break;
          if (result.done) {
            // writeChunk awaits every earlier write callback and backpressure original.
            await ownedEnd(session, res, operation.token).original; return;
          }
          await writeChunk(session, res, controller, result.value, operation.token);
        }
        throw new Error('Proxy closing');
      } catch {
        if (!session.closing && !operation.controller.signal.aborted) failure(session, false, 'Proxy forwarding failed');
        await dispose();
      } finally {
        req.off('aborted', onAbort); req.off('error', onAbort); res.off('close', onClose); res.off('error', onAbort);
        operation.controller.signal.removeEventListener('abort', onAbort);
      }
    });
    void forwarding.observed;
  });
  session.proxyUrl = addressOf(owned, '/agui'); return session.proxyUrl;
}

export function createScopedFetch(session: SessionOwnership): HttpAgentFetchFn {
  return (url, init) => {
    const operation = requireActive(session);
    if (!session.proxyUrl || url !== session.proxyUrl || init.method !== 'POST' || typeof init.body !== 'string'
      || operation.kind !== 'sdk' || !operation.agent || init.signal !== operation.agent.abortController.signal
      || init.signal.aborted || operation.requests !== 0) throw new Error('Scoped fetch admission denied');
    const headers = new Headers(init.headers);
    if (headers.get('content-type') !== 'application/json' || headers.get('accept') !== 'text/event-stream') throw new Error('Scoped headers denied');
    operation.requestHeaders = projectBoundedJson({ 'content-type': headers.get('content-type'), accept: headers.get('accept') }, session.budget);
    const originalBody = init.body;
    if (originalBody.length > CAPTURE_LIMITS.bodyBytes || Buffer.byteLength(originalBody) > CAPTURE_LIMITS.bodyBytes) throw new Error('SDK request body limit');
    capture(session, operation.request, Buffer.from(originalBody)); operation.requests++;
    const controller = operation.controller;
    const onAbort = () => { controller.abort(); };
    const signal = init.signal; signal.addEventListener('abort', onAbort, { once: true });
    operation.removeListeners.push(() => { signal.removeEventListener('abort', onAbort); });
    const fetchTask = launch(session, 'sdk-scoped-fetch', operation.token, async () => {
        const response = await fetch(session.proxyUrl!, { method: 'POST', headers, body: originalBody, signal: controller.signal, redirect: 'error' });
        const wrapped = wrapOwnedResponse(session, response, controller, operation.response, operation.token);
        const reader = session.readers[session.readers.length - 1]!;
        try { captureResponseHeaders(session, operation, response); }
        catch (error) {
          failure(session, false, 'Response header capture failed'); await disposeReader(session, reader); throw error;
        }
        if (controller.signal.aborted) {
          await disposeReader(session, reader); throw new Error('Scoped fetch closing');
        }
        return wrapped;
    });
    // SDK signal must continue to abort the owned stream after fetch resolves.
    // The operation public watchdog aborts controller too; signal listener lifetime
    // is owned by the operation cleanup, rather than response header settlement.
    return fetchTask.original!;
  };
}

function admitOperation(session: SessionOwnership, kind: 'sdk' | 'raw', agent: HttpAgent | null): OperationSettlement {
  if (!session.initialReceipt || !session.proxyUrl || session.closing || session.incomplete) throw new Error('Initial receipt / owned endpoints required');
  const token = session.gate.admit();
  const operation: OperationSettlement = {
    token, kind, original: 'pending', complete: false, finalized: false, timedOut: false,
    recorder: { budget: session.budget, events: [], errors: [], failures: [], captureFailed: false },
    request: body(`${token}:original-request`), proxyRequest: body(`${token}:proxy-request`), upstreamRequest: body(`${token}:upstream-request`),
    response: body(`${token}:client-response`), proxyResponse: body(`${token}:proxy-response`),
    status: null, contentType: null, requests: 0, proxyRequests: 0, upstreamRequests: 0, controller: ownController(session), agent,
    publicTask: null, deadline: monotonicNow() + OPERATION_MS, proxySocket: null, upstreamSocket: null, requestHeaders: null,
    finalize: null, unsubscribe: null, removeListeners: [],
  };
  session.operations.push(operation); session.active = operation; return operation;
}
function subscriberFor(operation: OperationSettlement): AgentSubscriber {
  return {
    onEvent({ event }) { recordObservedEvent(operation.recorder, event as unknown as Record<string, unknown>); },
    onRunErrorEvent({ event }) { recordObservedError(operation.recorder, event as unknown as Record<string, unknown>); },
    onRunFailed({ error }) {
      // Error's nonenumerable message/name are ordinary public scalar fields.
      // Inert recorder copies only named bounded properties, no callback context.
      recordObservedError(operation.recorder, error as unknown as Record<string, unknown>);
    },
    onRunFinalized() { operation.finalized = true; operation.finalize?.(); },
  };
}

/** A deadline observes the original; it does not replace it. Timeout callback
 * aborts owned work synchronously. The caller then awaits tracked disposal.
 */
async function within(session: SessionOwnership, originalObservation: Promise<void>, deadline: number, expired: () => void,
  watchdog?: TaskTicket): Promise<boolean> {
  const remaining = deadline - monotonicNow();
  // Expired observations cannot win a zero-delay race, even if fulfilled.
  if (!Number.isFinite(remaining) || remaining <= 0) {
    // Retire only an unused preflight ticket. No timer original was allocated
    // or invoked, so there is no callback settlement to manufacture.
    if (watchdog) commitTaskTicket(session.capacity, watchdog);
    expired(); return false;
  }
  const timer = deferredTask<void>(session, watchdog?.label ?? 'watchdog', session.active?.token ?? null, watchdog);
  let handle: ReturnType<typeof setTimeout> | null = null;
  const alarm = new Promise<boolean>(resolve => {
    handle = setTimeout(() => { handle = null; timer.resolve(); try { expired(); } finally { resolve(false); } }, remaining);
  });
  try {
    const observed = await Promise.race([originalObservation.then(() => true), alarm]);
    if (observed && monotonicNow() >= deadline) { expired(); return false; }
    return observed;
  }
  finally { if (handle !== null) clearTimeout(handle); timer.resolve(); }
}
function operationTasks(session: SessionOwnership, operation: OperationSettlement): OwnedTask[] {
  return session.tasks.filter(task => task.operation === operation.token && task.label !== 'watchdog');
}
function expireOperation(session: SessionOwnership, operation: OperationSettlement): void {
  operation.timedOut = true; session.gate.close(); operation.controller.abort(); operation.agent?.abortRun();
  failure(session, false, 'Original operation deadline');
}
function unsubscribeOwned(session: SessionOwnership, operation: OperationSettlement): OwnedTask<void> | null {
  if (!operation.unsubscribe) return null;
  const unsubscribe = operation.unsubscribe; operation.unsubscribe = null;
  const task = launch(session, 'sdk-unsubscribe', operation.token, unsubscribe, undefined, `operation-${operation.token}`);
  void task.observed.then(() => { if (task.settlement === 'rejected') failure(session, true, 'SDK unsubscribe rejected'); });
  return task;
}
async function settleOperation(session: SessionOwnership, operation: OperationSettlement): Promise<OperationSettlement> {
  const original = operation.publicTask!;
  const settled = await within(session, original.observed, operation.deadline, () => {
    expireOperation(session, operation);
  });
  if (settled) {
    // Observe all current operation resources; tasks can appear while originals settle.
    const work = launch(session, 'operation-resource-settlement', null, async () => {
      for (;;) {
        const tasks = operationTasks(session, operation); await Promise.all(tasks.map(task => task.observed));
        if (tasks.length === operationTasks(session, operation).length) break;
      }
    });
    const resources = await within(session, work.observed, operation.deadline, () => {
      operation.timedOut = true; session.gate.close(); operation.controller.abort(); operation.agent?.abortRun();
      failure(session, false, 'Operation resource deadline');
    });
    if (!resources) session.gate.close();
  }
  operation.original = original.settlement;
  if (operation.recorder.captureFailed) {
    session.captureFailed = true; session.incomplete = true; failure(session, false, 'SDK observer capture failed');
  }
  for (const remove of operation.removeListeners.splice(0)) remove();
  const unsubscribed = unsubscribeOwned(session, operation); if (unsubscribed) await unsubscribed.observed;
  let phasePersisted = false;
  try {
    const ready = !operation.timedOut && !session.incomplete && !session.gate.closed
      && original.settlement !== 'pending'
      && operationTasks(session, operation).every(task => task.settlement !== 'pending')
      && session.readers.filter(reader => reader.operation === operation.token).every(reader => reader.released);
    if (ready) {
      // Keep the original token and absolute deadline through this phase's
      // original persistence. Its snapshot truthfully still shows complete:false.
      await writeReceipt(session);
      phasePersisted = !operation.timedOut && monotonicNow() < operation.deadline;
      if (!phasePersisted) expireOperation(session, operation);
    }
  } catch {
    if (monotonicNow() >= operation.deadline) expireOperation(session, operation);
    failure(session, true, 'Operation phase receipt failed');
  } finally {
    if (!phasePersisted || session.incomplete || session.gate.closed) await disposeOwnedSession(session);
  }
  operation.original = original.settlement;
  operation.complete = phasePersisted && !operation.timedOut && original.settlement !== 'pending'
    && operationTasks(session, operation).every(task => task.settlement !== 'pending')
    && session.readers.filter(reader => reader.operation === operation.token).every(reader => reader.released)
    && !session.incomplete;
  if (session.gate.active === operation.token) session.gate.settle(operation.token, operation.complete);
  session.active = null;
  return operation;
}

export async function runOwnedSdkOperation(session: SessionOwnership, agent: HttpAgent,
  parameters: RunAgentParameters): Promise<OperationSettlement> {
  const operation = admitOperation(session, 'sdk', agent);
  const permits = taskGroup(session, 'normal', ['sdk-finalized-notification', 'sdk-operation-setup'].map(label => ({ label, owner: `operation-${operation.token}` })));
  const finalized = deferredTask<void>(session, 'sdk-finalized-notification', operation.token, permits[0]!);
  operation.finalize = () => { finalized.resolve(); };
  const setup = launch(session, 'sdk-operation-setup', operation.token, async () => {
    try {
      const subscription = launch(session, 'sdk-subscribe', operation.token, () => agent.subscribe(subscriberFor(operation)));
      operation.unsubscribe = (await subscription.original!).unsubscribe;
      await writeReceipt(session); // Settles before original HTTP effect.
      requireActive(session);
      operation.publicTask = launch(session, 'sdk-public-run-agent', operation.token, () => agent.runAgent(parameters));
    } catch {
      finalized.reject(new Error('No SDK original invoked')); failure(session, false, 'SDK setup failed'); throw new Error('SDK setup failed');
    }
  }, permits[1]!);
  await within(session, setup.observed, operation.deadline, () => { expireOperation(session, operation); });
  // Setup timeout remains an original pending task; it can never launch HTTP
  // later because requireActive denies the closed/aborted operation.
  operation.publicTask ??= setup;
  return settleOperation(session, operation);
}

export async function runOwnedRawOperation(session: SessionOwnership, requestBody: string): Promise<OperationSettlement> {
  const operation = admitOperation(session, 'raw', null);
  const setup = launch(session, 'raw-operation-setup', operation.token, async () => {
    try {
    if (requestBody.length > CAPTURE_LIMITS.bodyBytes || Buffer.byteLength(requestBody) > CAPTURE_LIMITS.bodyBytes) throw new Error('Raw request body limit');
    capture(session, operation.request, Buffer.from(requestBody));
    await writeReceipt(session);
    requireActive(session);
    operation.publicTask = launch(session, 'raw-public-fetch-body', operation.token, async () => {
      operation.requests++;
      const task = launch(session, 'raw-fetch', operation.token, () => fetch(session.proxyUrl!, {
        method: 'POST', body: requestBody, headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        signal: operation.controller.signal, redirect: 'error',
      }));
      const response = await task.original!;
      const reader = ownReader(session, response, operation.controller, operation.response, operation.token);
      try {
        captureResponseHeaders(session, operation, response);
        while (!(await readOwned(session, reader)).done) { /* Bounds/capture occur in readOwned. */ }
      }
      catch (error) { failure(session, false, 'Raw response read failed'); throw error; }
      finally { await disposeReader(session, reader); }
    });
    } catch { failure(session, false, 'Raw setup failed'); throw new Error('Raw setup failed'); }
  });
  await within(session, setup.observed, operation.deadline, () => { expireOperation(session, operation); });
  operation.publicTask ??= setup;
  return settleOperation(session, operation);
}

export interface FinalValidation { operationTokens: readonly number[]; assertionOutcome: 'passed' | 'failed' }
export function writeReceipt(session: SessionOwnership, validation?: FinalValidation): Promise<void> {
  // Small trusted-driver assertion evidence, copied before any await. It does
  // not replace the external semantic assertions or independent closure proof.
  let ownedValidation: FinalValidation | null = null;
  if (validation !== undefined) {
    if (!session.closing || session.disposal?.settlement !== 'fulfilled'
      || validation.operationTokens.length !== 8 || validation.operationTokens.some((token, index) => token !== index + 1)
      || !['passed', 'failed'].includes(validation.assertionOutcome)) throw new Error('Invalid final validation binding');
    ownedValidation = { operationTokens: [...validation.operationTokens], assertionOutcome: validation.assertionOutcome };
  }
  if (session.closing) return writeTerminalReceipt(session, 2, ownedValidation);
  const deadline = session.closing && session.disposalDeadline !== null ? session.disposalDeadline
    : Math.min(monotonicNow() + DISPOSAL_MS, session.active?.deadline ?? Infinity);
  const permits = taskGroup(session, 'normal', ['receipt-write', 'receipt-deadline-observation', 'watchdog'].map(label => ({ label, owner: 'session' })));
  const assertOpenDeadline = () => {
    if (monotonicNow() >= deadline) throw new Error('Receipt deadline expired');
  };
  const task = launch(session, 'receipt-write', null, async () => {
    await session.receiptTail;
    assertOpenDeadline();
    await mkdir(dirname(session.receiptPath), { recursive: true });
    for (const operation of session.operations) {
      for (const evidence of [operation.request, operation.proxyRequest, operation.upstreamRequest, operation.response, operation.proxyResponse]) {
        if (evidence.persistenceFailed) continue;
        if (evidence.persistedChunks === evidence.chunks.length) continue;
        // One bounded body-writer original owns all serial append originals.
        // Each append settles before the next; partial failure is never retried.
        const saved = launch(session, 'raw-evidence-write', null, async () => {
          try {
            while (evidence.persistedChunks < evidence.chunks.length) {
              assertOpenDeadline();
              if (session.closing || session.capacity.normalClosed) throw new Error('Raw persistence closing');
              const chunk = evidence.chunks[evidence.persistedChunks]!;
              reserveCaptureBytes(session.budget, null, chunk.byteLength);
              await appendFile(join(dirname(session.receiptPath), `${evidence.domain.replace(':', '-')}.bin`), chunk);
              evidence.persistedChunks++; evidence.persistedBytes += chunk.byteLength;
            }
          } catch (error) {
            evidence.persistenceFailed = true; evidence.persistenceIncomplete = true; session.incomplete = true;
            failure(session, true, 'Raw evidence write failed'); throw error;
          }
        });
        await saved.original;
      }
    }
    const bytes = JSON.stringify({
      identity: session.admission, incomplete: session.incomplete, closing: session.closing,
      // This immutable snapshot precedes its own publication. The outside
      // driver must await writeReceipt's ORIGINAL bounded public result; the
      // artifact and that result witness publication, never this payload itself.
      publication: { state: 'pending', horizon: 'pre-publication', originalWriteTask: task.id },
      transportComplete: session.disposal?.settlement === 'fulfilled' && !session.incomplete
        && !session.captureFailed && session.primaryFailures.length === 0 && session.cleanupFailures.length === 0
        && session.operations.length === 8 && session.operations.every(operation => operation.complete),
      admissionClosed: session.gate.closed, admitted: session.gate.admitted,
      disposal: session.disposal?.settlement ?? 'not-started', initial: session.operations.length === 0,
      primaryFailures: session.primaryFailures, cleanupFailures: session.cleanupFailures,
      captureFailed: session.captureFailed, retainedBytes: session.budget.retainedBytes,
      operations: session.operations.map(operation => ({
        token: operation.token, kind: operation.kind, original: operation.original, complete: operation.complete,
        finalized: operation.finalized, timedOut: operation.timedOut, status: operation.status, contentType: operation.contentType,
        requests: operation.requests, proxyRequests: operation.proxyRequests, upstreamRequests: operation.upstreamRequests,
        requestHeaders: operation.requestHeaders, captureFailed: operation.recorder.captureFailed,
        callbackCounts: { events: operation.recorder.events.length, errors: operation.recorder.errors.length },
        observations: { events: operation.recorder.events, errors: operation.recorder.errors, failures: operation.recorder.failures },
        bodies: [operation.request, operation.proxyRequest, operation.upstreamRequest, operation.response, operation.proxyResponse]
          .map(value => ({ domain: value.domain, bytes: value.bytes, sha256: digest(value),
            persistedChunks: value.persistedChunks, persistedBytes: value.persistedBytes, chunks: value.chunks.length,
            persistenceFailed: value.persistenceFailed, persistenceIncomplete: value.persistenceIncomplete })),
      })),
      readers: session.readers.map(reader => ({ operation: reader.operation, ...reader.state, terminal: reader.terminal })),
      responses: session.responses.map(response => ({ finished: response.finished, closed: response.closed })),
      sockets: session.sockets.map(socket => ({ closed: socket.closed })),
      tasks: session.tasks.map(owned => ({ id: owned.id, label: owned.label, owner: owned.owner, lane: owned.lane, operation: owned.operation, settlement: owned.settlement })),
    });
    reserveCaptureBytes(session.budget, null, Buffer.byteLength(bytes));
    session.normalReceipt.bytes = Buffer.byteLength(bytes);
    session.normalReceipt.sha256 = createHash('sha256').update(bytes).digest('hex');
    assertOpenDeadline();
    await writeFile(session.receiptPath, bytes, { encoding: 'utf8', flag: 'w' });
    if (session.operations.length === 0) session.initialReceipt = true;
  }, permits[0]!);
  session.normalReceipt.task = task;
  // Preserve serialization even following a failure; do not hide that failure.
  session.receiptTail = task.observed;
  const bounded = launch(session, 'receipt-deadline-observation', null, async () => {
    const persisted = await within(session, task.observed, deadline, () => {
      session.incomplete = true; session.gate.close(); session.active?.controller.abort(); session.active?.agent?.abortRun();
      failure(session, true, 'Receipt write incomplete');
    }, permits[2]!);
    if (!persisted) throw new Error('Receipt original remains incomplete');
    if (task.settlement === 'rejected') { session.incomplete = true; failure(session, true, 'Receipt write rejected'); }
    await task.original;
  }, permits[1]!);
  return bounded.original!;
}

function operationBodies(operation: OperationSettlement): BodyEvidence[] {
  return [operation.request, operation.proxyRequest, operation.upstreamRequest, operation.response, operation.proxyResponse];
}
function writeTerminalReceipt(session: SessionOwnership, slot: 1 | 2, validation: FinalValidation | null): Promise<void> {
  const prior = session.terminalReceipts[slot - 1]; if (prior) return prior.original!;
  const deadline = session.disposalDeadline;
  if (deadline === null) throw new Error('Terminal publication requires owned disposal');
  const horizon = session.tasks.length;
  const owner = `receipt-${slot}`;
  const permits = taskGroup(session, 'terminal', ['terminal-receipt-write', 'terminal-receipt-observation', 'terminal-receipt-watchdog']
    .map(label => ({ label, owner })));
  const written = launch(session, 'terminal-receipt-write', null, async () => {
    await Promise.resolve(); // All three owned group rows register before effects.
    if (monotonicNow() >= deadline) throw new Error('Terminal publication deadline expired');
    const previous = session.tasks.slice(0, horizon);
    const counts: Record<string, { pending: number; fulfilled: number; rejected: number }> = Object.create(null) as Record<string, { pending: number; fulfilled: number; rejected: number }>;
    for (const task of previous) {
      const count = counts[task.label] ??= { pending: 0, fulfilled: 0, rejected: 0 }; count[task.settlement]++;
    }
    const persisted = session.operations.every(operation => operationBodies(operation).every(body =>
      body.persistedBytes === body.bytes && body.persistedChunks === body.chunks.length
      && !body.persistenceFailed && !body.persistenceIncomplete));
    const complete = slot === 2 && session.disposal?.settlement === 'fulfilled'
      && !session.incomplete && !session.captureFailed && !session.primaryFailures.length && !session.cleanupFailures.length
      && session.operations.length === 8 && session.operations.every(operation => operation.complete && operation.publicTask !== null
        && operation.publicTask.settlement !== 'pending' && operation.requests === 1 && operation.proxyRequests === 1 && operation.upstreamRequests === 1)
      && persisted && session.readers.every(reader => reader.released)
      && session.sockets.every(socket => socket.closed) && session.responses.every(response => response.closed)
      && session.servers.every(server => server.close.settlement === 'fulfilled') && previous.every(task => task.settlement !== 'pending')
      && session.normalReceipt.task?.settlement === 'fulfilled';
    const summary = {
      scope: 'terminal-disposition-summary', completeWireOracle: false,
      identity: session.admission, incomplete: session.incomplete, captureFailed: session.captureFailed,
      publication: { state: 'pending', horizon: 'pre-publication', slot, originalWriteTask: written.id },
      transportComplete: complete, qualification: complete && validation?.assertionOutcome === 'passed', validation,
      fullObservations: { file: 'receipt.json', task: session.normalReceipt.task?.id ?? null,
        disposition: session.normalReceipt.task?.settlement ?? 'not-started', bytes: session.normalReceipt.bytes, sha256: session.normalReceipt.sha256 },
      rawPersistenceComplete: persisted,
      operations: session.operations.map(operation => ({ token: operation.token, kind: operation.kind,
        original: operation.publicTask?.settlement ?? 'not-invoked', complete: operation.complete,
        finalized: operation.finalized, timedOut: operation.timedOut, status: operation.status,
        captureFailed: operation.recorder.captureFailed,
        requests: operation.requests, callbackCounts: { events: operation.recorder.events.length, errors: operation.recorder.errors.length },
        bodies: operationBodies(operation).map(body => ({ domain: body.domain, bytes: body.bytes, sha256: digest(body),
          persistedBytes: body.persistedBytes, persistedChunks: body.persistedChunks, chunks: body.chunks.length,
          persistenceFailed: body.persistenceFailed, persistenceIncomplete: body.persistenceIncomplete || body.persistedBytes !== body.bytes
            || body.persistedChunks !== body.chunks.length })) })),
      readers: session.readers.map(reader => ({ id: reader.id, operation: reader.operation, ...reader.state, terminal: reader.terminal })),
      resources: { servers: session.servers.length, closedServers: session.servers.filter(server => server.close.settlement === 'fulfilled').length,
        sockets: session.sockets.length, closedSockets: session.sockets.filter(socket => socket.closed).length,
        responses: session.responses.length, finishedResponses: session.responses.filter(response => response.finished).length,
        closedResponses: session.responses.filter(response => response.closed).length },
      taskDispositionCounts: counts, primaryFailures: session.primaryFailures, cleanupFailures: session.cleanupFailures,
      taskCapacity: { normalUsed: session.capacity.normalUsed, terminalUsed: session.capacity.terminalUsed, totalCap: TASK_LIMITS.total },
    };
    // Candidate projection/serialization is bounded transient data. Keep only
    // the admitted serialized buffer, with its disk copy separately prepaid.
    const encoded = encodeTerminalSummary(session.capacity, slot, summary, session.admission);
    if (encoded.reduced) { session.incomplete = true; session.captureFailed = true; failure(session, true, 'Terminal summary bound exceeded'); }
    await mkdir(dirname(session.receiptPath), { recursive: true });
    if (monotonicNow() >= deadline) throw new Error('Terminal publication deadline expired');
    await writeFile(join(dirname(session.receiptPath), `terminal-${slot}.json`), encoded.serialized, { encoding: 'utf8', flag: 'wx' });
  }, permits[0]!);
  const observed = launch(session, 'terminal-receipt-observation', null, async () => {
    const persisted = await within(session, written.observed, deadline, () => {
      session.incomplete = true; failure(session, true, 'Terminal publication incomplete');
    }, permits[2]!);
    if (!persisted || written.settlement === 'rejected') {
      session.incomplete = true; failure(session, true, 'Terminal publication failed'); throw new Error('Terminal publication failed');
    }
    await written.original;
  }, permits[1]!);
  session.terminalReceipts[slot - 1] = observed;
  return observed.original!;
}

export function disposeOwnedSession(session: SessionOwnership): Promise<void> {
  if (session.disposal) return session.disposal.original!;
  const deadline = monotonicNow() + DISPOSAL_MS;
  const registered = deferredTask<void>(session, 'session-dispose', null, undefined, 'session'); session.disposal = registered.task;
  session.closing = true; session.gate.close();
  session.capacity.normalClosed = true;
  session.disposalDeadline = deadline;
  // Synchronous abort precedes every await; no private SDK promise is claimed.
  for (const controller of session.controllers) controller.abort();
  session.active?.agent?.abortRun();
  for (const operation of session.operations) {
    for (const remove of operation.removeListeners.splice(0)) remove();
    unsubscribeOwned(session, operation);
  }
  registered.resolve((async () => {
    const cleanup = launch(session, 'session-resource-cleanup', null, async () => {
      const cancellations = session.readers.map(reader => disposeReader(session, reader));
      for (const response of session.responses) if (!response.closed && !response.response.destroyed) response.response.destroy();
      for (const socket of session.sockets) if (!socket.closed) socket.socket.destroy();
      for (const server of session.servers) server.requestClose();
      await Promise.allSettled(cancellations);
      for (;;) {
        const tasks = session.tasks.filter(task => task !== registered.task && task.label !== 'session-resource-cleanup'
          && !task.label.includes('watchdog'));
        await Promise.all(tasks.map(task => task.observed));
        // A normal setup original may have published a subscription handle
        // while abort/cleanup was already underway. Adopt it exactly once too.
        for (const operation of session.operations) unsubscribeOwned(session, operation);
        if (tasks.length === session.tasks.filter(task => task !== registered.task && task.label !== 'session-resource-cleanup'
          && !task.label.includes('watchdog')).length) break;
      }
    }, undefined, 'session');
    // Publish the bounded disposal snapshot while originals are still being
    // observed. It waits neither cleanup nor the normal receipt tail, so an
    // unsettled original cannot consume the whole window before failure evidence
    // starts. Terminal2 is the later outside post-disposal witness.
    const receipt = launch(session, 'disposal-receipt-observation', null, () => writeTerminalReceipt(session, 1, null), undefined, 'session');
    const watchdog = taskGroup(session, 'terminal', [{ label: 'terminal-cleanup-watchdog', owner: 'session' }])[0]!;
    const complete = await within(session, cleanup.observed, deadline, () => {
      session.incomplete = true; failure(session, true, 'Owned disposal incomplete');
    }, watchdog);
    if (!complete || cleanup.settlement === 'rejected') { session.incomplete = true; failure(session, true, 'Owned cleanup failed or incomplete'); }
    for (const task of session.tasks) {
      if (task.settlement === 'rejected' && !session.operations.some(operation => task === operation.publicTask)) failure(session, true, `Rejected owned ${task.label}`);
    }
    await receipt.observed; // Its own fixed receipt-owner watchdog enforces the same absolute deadline.
    if (receipt.settlement === 'rejected') session.incomplete = true;
  })());
  return registered.task.original!;
}
