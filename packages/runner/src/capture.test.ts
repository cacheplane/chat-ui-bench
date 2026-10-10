import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCalibrationFixture, PRESENTATION_TRACE_CATEGORIES } from '@chat-ui-bench/contract';
import { ArtifactWriter } from './artifacts.js';
import { captureRepetition } from './capture.js';

vi.mock('./environment.js', async importOriginal => ({
  ...await importOriginal<typeof import('./environment.js')>(),
  collectEnvironment: async (_root: string, _assets: string, session: any) => {
    await session.send('Browser.getVersion');
    return { git: { revision: 'a'.repeat(40), dirty: true }, assets: { 'index.html': 'b'.repeat(64) },
      browser: { executable: '/chrome', version: 'Chrome/156.0.8078.4', revision: 'real-revision', flags: ['--enable-automation'] },
      environment: { os: 'test', architecture: 'test', cpu: { status: 'unavailable', reason: 'test' }, gpu: { status: 'unavailable', reason: 'test' } },
      chromiumDownloadRevision: '1248', playwrightVersion: '1.64.0', browserProtocol: {} };
  },
}));
afterEach(() => vi.unstubAllGlobals());

async function failedReplay(options: { closeError?: boolean; drainError?: boolean; frameError?: boolean } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'bench-page-capture-'));
  const calls: string[] = [];
  const requests: { method: string; parameters: any }[] = [];
  const frameTree = { frameTree: { frame: { id: 'actual-frame', url: 'http://127.0.0.1:1234/', loaderId: 'actual-loader', securityOrigin: 'http://127.0.0.1:1234' } } };
  let completion: ((event: any) => void) | undefined;
  const renderer = {
    once: (_name: string, callback: typeof completion) => { completion = callback; }, off: () => {},
    send: async (method: string, parameters?: any) => {
      calls.push(`page:${method}`);
      requests.push({ method, parameters });
      if (method === 'Page.getFrameTree') { if (options.frameError) throw new Error('unsupported frame tree'); return frameTree; }
      if (method === 'Target.getTargetInfo') return { targetInfo: { targetId: 'actual-target', type: 'page', url: frameTree.frameTree.frame.url } };
      if (method === 'Tracing.end') completion!({ stream: 'actual-page-stream' });
      if (method === 'IO.read') return { data: '{"traceEvents":[{"name":"raw-evidence"}]}', eof: true };
      return {};
    },
  };
  let closed = false;
  const end = { schemaVersion: 1, kind: 'phase-end', repetition: '1-clean', phase: 'streaming-auto-follow', clockDomain: 'page-performance-ms', sequence: null, timestampMs: 20, data: { instanceId: '0' } };
  vi.stubGlobal('window', { chatBench: {
    ready: true, configure: () => {}, loadHistory: () => {}, setPhase: () => {}, connectReplay: () => {},
    closeScoredPhase: () => { calls.push('close-phase'); closed = true; if (options.closeError) throw new Error('close failure'); },
    drainObservations: () => { calls.push('drain'); if (closed && options.drainError) throw new Error('drain failure'); return closed ? [end] : []; },
    replayState: 'failed', probes: { lastAppliedSequence: 0 },
  } });
  const page = { on: () => {}, goto: async () => {}, waitForFunction: async () => {}, evaluate: async (fn: any, arg: any) => fn(arg) };
  const context = { newPage: async () => page, newCDPSession: async () => renderer, pages: () => [page] };
  const browser = { newBrowserCDPSession: async () => ({ once: renderer.once, off: renderer.off, send: async (method: string) => {
    calls.push(`browser:${method}`);
    if (method === 'Tracing.end') completion!({ stream: 'wrong-browser-stream' });
    if (method === 'IO.read') return { data: '{"traceEvents":[{"name":"raw-evidence"}]}', eof: true };
    return {};
  } }), newContext: async () => context, contexts: () => [context] };
  let error: unknown;
  try { await captureRepetition({ browser: browser as any, server: { drain: () => [], url: 'http://replay', state: 'running' } as any,
    writer: await ArtifactWriter.create(directory), fixture: createCalibrationFixture(), run: { id: '1-clean', round: 1, variant: 'clean' },
    mode: 'headless', root: directory, assetDirectory: directory, assetURL: frameTree.frameTree.frame.url, setupRemainingMs: 10000,
    isolatedBrowserProcess: true, registerDisposal: () => {} }); } catch (caught) { error = caught; }
  const json = async (name: string) => JSON.parse(await readFile(join(directory, name), 'utf8'));
  return { directory, calls, requests, frameTree, error, json };
}

it('captures actual page target evidence and uses that same session for tracing and IO, even after replay failure', async () => {
  const h = await failedReplay();
  expect(String(h.error)).toContain('Page replay failed');
  const evidence = await h.json('evidence.json');
  expect(evidence.collectorVersion).toBe('1.1.0');
  expect((await h.json('manifest.json'))).toMatchObject({ collectorVersion: '1.1.0', analyzerVersion: '1.1.0', suiteVersion: '0.1.0' });
  expect(evidence.trace.categories).toEqual([...PRESENTATION_TRACE_CATEGORIES]);
  expect(evidence.trace.presentation).toEqual({ capability: 'rendererVisualUpdateFps', contractVersion: '1.1.0', sessionTarget: 'page', targetId: 'actual-target', appURL: h.frameTree.frameTree.frame.url, frameTree: h.frameTree, frameTreeCapturePoint: 'before-tracing', isolatedBrowserProcess: true, singleWorkloadPage: true });
  expect(h.calls.filter(call => call.startsWith('browser:'))).toEqual(['browser:Browser.getVersion']);
  expect(h.calls.indexOf('page:Page.getFrameTree')).toBeLessThan(h.calls.indexOf('page:Tracing.start'));
  expect(h.calls.indexOf('close-phase')).toBeLessThan(h.calls.indexOf('page:Tracing.end'));
  expect(h.calls.slice(h.calls.indexOf('close-phase'), h.calls.indexOf('page:Tracing.end'))).toContain('drain');
  expect(h.calls).toContain('page:IO.read'); expect(h.calls).toContain('page:IO.close');
  expect(h.requests.find(request => request.method === 'Tracing.start')?.parameters).toEqual({ categories: PRESENTATION_TRACE_CATEGORIES.join(','), transferMode: 'ReturnAsStream', streamFormat: 'json' });
  expect(h.requests.filter(request => request.method.startsWith('IO.')).map(request => request.parameters.handle)).toEqual(['actual-page-stream', 'actual-page-stream']);
  expect(await readFile(join(h.directory, 'page-observations.jsonl'), 'utf8')).toContain('phase-end');
  expect((await h.json('trace.json')).traceEvents[0].name).toBe('raw-evidence');
  expect(evidence.trace.complete).toBe(true);
});
it.each(['closeError', 'drainError'] as const)('retains %s as capture failure while completing the trace and raw evidence', async key => {
  const h = await failedReplay({ [key]: true });
  expect(String(h.error)).toContain(key === 'closeError' ? 'close failure' : 'drain failure');
  expect(String(h.error)).toContain('Page replay failed');
  expect(h.calls).toContain('page:Tracing.end');
  expect((await h.json('evidence.json')).trace.complete).toBe(true);
  expect((await h.json('trace.json')).traceEvents).toHaveLength(1);
});
it('records missing protocol capability without fabricating frame metadata or preventing raw capture', async () => {
  const h = await failedReplay({ frameError: true });
  const evidence = await h.json('evidence.json');
  expect(evidence.trace.presentation).toBeUndefined();
  expect((await h.json(evidence.files.presentationAvailability))).toMatchObject({ status: 'unavailable', reason: expect.stringContaining('unsupported frame tree') });
  expect(evidence.trace.complete).toBe(true);
});
