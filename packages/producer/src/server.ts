import { createServer, type ServerResponse } from 'node:http';
import { LONG_THREAD_SUITE, validateFixture, validateCanonicalLongThreadFixture, type Observation, type ComparisonObservation } from '@chat-ui-bench/contract';
import { startReplay, startLongThreadReplay, type ReplaySession, type SSEWriter } from './replay.js';

export interface ReplayServerOptions { fixture: unknown; repetition: string; port?: number }
export interface ReplayServer {
  readonly url: string;
  readonly state: 'waiting' | 'running' | 'complete' | 'failed' | 'disposed';
  drain(): Observation[];
  close(): Promise<void>;
}
export interface LongThreadReplayServer extends Omit<ReplayServer, 'drain'> {
  readonly suite: typeof LONG_THREAD_SUITE;
  readonly repetition: string;
  drain(): ComparisonObservation[];
}
/** One server owns exactly one fixture/repetition; the runner owns shutdown. */
export async function createReplayServer(options: ReplayServerOptions): Promise<ReplayServer> {
  const fixture = validateFixture(options.fixture);
  return createTimedReplayServer(options.port, (writer, record) => startReplay(fixture, {repetition: options.repetition, writer, record}));
}

/** Validate canonical generator provenance before creating or listening on a socket. */
export async function createLongThreadReplayServer(options: ReplayServerOptions): Promise<LongThreadReplayServer> {
  const fixture = validateCanonicalLongThreadFixture(options.fixture);
  const repetition = options.repetition;
  if (!repetition.trim()) throw new Error('Repetition must not be empty');
  const server = await createTimedReplayServer<ComparisonObservation>(options.port,
    (writer, record) => startLongThreadReplay(fixture, {repetition, writer, record}));
  return {get suite() {return LONG_THREAD_SUITE;}, get repetition() {return repetition;},
    get url() {return server.url;}, get state() {return server.state;}, drain: () => server.drain(), close: () => server.close()};
}

async function createTimedReplayServer<T>(port: number | undefined,
  replay: (writer: SSEWriter, record: (entry: T) => void) => ReplaySession): Promise<Omit<ReplayServer, 'drain'> & {drain(): T[]}> {
  let entries: T[] = [];
  let connected = false;
  let session: ReplaySession | undefined;
  let response: ServerResponse | undefined;
  let closed = false;
  const server = createServer((request, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (request.url !== '/replay' || request.method !== 'GET') { res.writeHead(404); res.end(); return; }
    if (connected) { res.writeHead(409); res.end('This repetition has already connected'); return; }
    connected = true; response = res;
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    res.on('close', () => session?.disconnect());
    session = replay({write: frame => res.write(frame), end: () => res.end()}, observation => entries.push(observation));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port ?? 0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a loopback TCP server address');
  return {
    url: `http://127.0.0.1:${address.port}/replay`,
    get state() { return closed ? 'disposed' : session?.state ?? 'waiting'; },
    drain: () => { const result = entries; entries = []; return result; },
    close: async () => {
      if (closed) return;
      closed = true; session?.dispose(); response?.destroy();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
