import { createServer, type ServerResponse } from 'node:http';
import { validateFixture, type Observation } from '@chat-ui-bench/contract';
import { startReplay, type ReplaySession } from './replay.js';

export interface ReplayServerOptions { fixture: unknown; repetition: string; port?: number }
export interface ReplayServer {
  readonly url: string;
  readonly state: 'waiting' | 'running' | 'complete' | 'failed' | 'disposed';
  drain(): Observation[];
  close(): Promise<void>;
}
/** One server owns exactly one fixture/repetition; the runner owns shutdown. */
export async function createReplayServer(options: ReplayServerOptions): Promise<ReplayServer> {
  const fixture = validateFixture(options.fixture);
  let entries: Observation[] = [];
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
    session = startReplay(fixture, {
      repetition: options.repetition, writer: { write: frame => res.write(frame), end: () => res.end() },
      record: observation => entries.push(observation),
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
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
