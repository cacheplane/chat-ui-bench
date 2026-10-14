/** Release-only matrix. Static runtime imports are Vitest and inert admission. */
import { expect, test } from 'vitest';
import { readHostedAdmission } from '../support/hosted-httpagent-context.ts';
import { admitAndLoad, parseRecordedSse, reserveCaptureBytes } from '../support/hosted-httpagent-contract.ts';
import { equalChunkBytes } from '../support/hosted-chunk-equality.js';
import type { Message } from '@ag-ui/client';
import type { BodyEvidence, OperationSettlement, SessionOwnership } from './httpagent-transport.js';

const admission = readHostedAdmission();
const runtime = await admitAndLoad(admission, async () => {
  const [transport, client, aimock, fixtures, factory, contract, crypto, fs, path, fsConstants] = await Promise.all([
    import('./httpagent-transport.js'), import('@ag-ui/client'), import('@copilotkit/aimock/agui'),
    import('../fixtures/aimock.js'), import('../fixtures/copilotkit-httpagent.js'), import('@chat-ui-bench/contract'),
    import('node:crypto'), import('node:fs/promises'), import('node:path'), import('node:fs'),
  ]);
  return { transport, client, aimock, fixtures, factory, contract, crypto, fs, path, fsConstants };
});

test('released eight-operation direct HttpAgent transport profile', async () => {
  const matrixDeadline = performance.now() + 180_000;
  const assertPublicationDeadline = (deadline: number): void => {
    if (performance.now() >= deadline) throw new Error('Absolute matrix publication deadline expired');
  };
  const { transport, client, aimock, fixtures, factory, contract, crypto, fs, path, fsConstants } = runtime;
  const threadId = 'hosted-canonical-thread';
  const restoreId = 'hosted-restore-run';
  const continuationId = 'hosted-continuation-run';
  const epochMs = 1_700_000_000_000;
  const source = contract.createLongThreadFixture({ historyCount: 100, responseBytes: 6400, journey: 'follow', seed: 1 });
  const history: Message[] = source.history.map(({ id, role, text }) => ({ id, role, content: text }));
  const deltas = source.events.slice(1, -1).map(event => event.text);
  const responseText = deltas.join('');
  const hash = (value: string | Uint8Array): string => crypto.createHash('sha256').update(value).digest('hex');
  const chunkHash = (body: BodyEvidence): string => {
    const digest = crypto.createHash('sha256');
    for (const chunk of body.chunks) digest.update(chunk);
    return digest.digest('hex');
  };
  const semantic = (runId: string, messages: readonly Message[], selectedThread = threadId) => ({
    threadId: selectedThread, runId, protocolVersion: '1.0', tools: [], context: [], forwardedProps: {}, state: {}, messages,
  });
  const clock = (scheduledMs: number) => ({ timestamp: epochMs + scheduledMs,
    metadata: { clock: 'synthetic-canonical-replay-ms', epochMs, scheduledMs } });
  const restoreEvents = [
    { type: 'RUN_STARTED', threadId, runId: restoreId, timestamp: epochMs,
      metadata: { clock: 'synthetic-canonical-history-restore-ms', epochMs, scheduledMs: 0 } },
    { type: 'MESSAGES_SNAPSHOT', messages: history, timestamp: epochMs + 1,
      metadata: { clock: 'synthetic-canonical-history-restore-ms', epochMs, scheduledMs: 1 } },
    { type: 'RUN_FINISHED', threadId, runId: restoreId, timestamp: epochMs + 2,
      metadata: { clock: 'synthetic-canonical-history-restore-ms', epochMs, scheduledMs: 2 } },
  ];
  const continuationEvents = [
    { type: 'RUN_STARTED', threadId, runId: continuationId, ...clock(0) },
    { type: 'TEXT_MESSAGE_START', messageId: 'response-100', role: 'assistant', ...clock(0) },
    ...deltas.map((delta, index) => ({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'response-100', delta, ...clock((index + 1) * 50) })),
    { type: 'TEXT_MESSAGE_END', messageId: 'response-100', ...clock(10000) },
    { type: 'RUN_FINISHED', threadId, runId: continuationId, ...clock(10000) },
  ];
  const session = transport.createOwnedSession(admission, process.env['RUNNER_TEMP'] ?? '', process.env['GITHUB_RUN_ID'] ?? '');
  let assertionsPassed = false;
  let semanticFailure: unknown;
  let cleanupFailure: unknown;
  // All diagnostic joins/decoded durable values reserve before retention.
  const assertRequest = (operation: OperationSettlement, expected: unknown): void => {
    expect(equalChunkBytes(operation.request.chunks, operation.proxyRequest.chunks)).toBe(true);
    expect(equalChunkBytes(operation.request.chunks, operation.upstreamRequest.chunks)).toBe(true);
    expect(chunkHash(operation.proxyRequest)).toBe(chunkHash(operation.request));
    expect(chunkHash(operation.upstreamRequest)).toBe(chunkHash(operation.request));
    const original = transport.joinedBody(session, operation.request);
    reserveCaptureBytes(session.budget, null, original.byteLength);
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(original);
    reserveCaptureBytes(session.budget, null, original.byteLength);
    const actual: unknown = JSON.parse(raw);
    expect(actual).toEqual(expected);
    if (operation.kind === 'sdk') expect(operation.requestHeaders).toEqual({ 'content-type': 'application/json', accept: 'text/event-stream' });
    expect(operation.requests).toBe(1); expect(operation.proxyRequests).toBe(1); expect(operation.upstreamRequests).toBe(1);
  };
  const assertSettled = (operation: OperationSettlement, disposition: 'fulfilled' | 'rejected'): void => {
    expect(operation.complete).toBe(true); expect(operation.original).toBe(disposition);
    expect(operation.publicTask?.settlement).toBe(disposition);
    expect(operation.timedOut).toBe(false); expect(operation.recorder.captureFailed).toBe(false);
    expect(operation.recorder.failures).toEqual([]);
    const readers = session.readers.filter(reader => reader.operation === operation.token);
    expect(readers).toHaveLength(2);
    for (const reader of readers) { expect(reader.terminal).toBe('eof'); expect(reader.released).toBe(true); }
    expect(session.tasks.filter(task => task.operation === operation.token).every(task => task.settlement !== 'pending')).toBe(true);
    // Every phase awaits original HTTP finish separately from reader EOF.
    expect(session.responses.every(response => response.finished)).toBe(true);
    expect(session.incomplete).toBe(false); expect(session.captureFailed).toBe(false);
    expect(session.primaryFailures).toEqual([]); expect(session.cleanupFailures).toEqual([]);
  };
  const assertResponse = (operation: OperationSettlement): string => {
    expect(equalChunkBytes(operation.response.chunks, operation.proxyResponse.chunks)).toBe(true);
    expect(chunkHash(operation.response)).toBe(chunkHash(operation.proxyResponse));
    const clientBytes = transport.joinedBody(session, operation.response);
    reserveCaptureBytes(session.budget, null, clientBytes.byteLength);
    return new TextDecoder('utf-8', { fatal: true }).decode(clientBytes);
  };
  const assertSse = (operation: OperationSettlement, expected: readonly unknown[], fixtureDigest?: string): void => {
    expect(operation.status).toBe(200); expect(operation.contentType).toBe('text/event-stream');
    const raw = assertResponse(operation);
    const parsed = parseRecordedSse(raw, session.budget, `oracle-${operation.token}`);
    expect(parsed).toEqual(expected);
    // Literal grammar and independent serialization do not use AIMock encoder.
    expect(raw).toBe(expected.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''));
    expect(hash(contract.canonicalSerialize(parsed))).toBe(hash(contract.canonicalSerialize(expected)));
    if (fixtureDigest !== undefined) expect(hash(contract.canonicalSerialize(parsed))).toBe(fixtureDigest);
  };
  const assertSdk = (operation: OperationSettlement, agent: InstanceType<typeof client.HttpAgent>): void => {
    expect(operation.finalized).toBe(true); expect(agent.isRunning).toBe(false); expect(agent.state).toEqual({});
  };
  const assert404 = (operation: OperationSettlement, sdk: boolean): void => {
    expect(operation.status).toBe(404); expect(operation.contentType).toBe('application/json');
    const raw = assertResponse(operation);
    expect(raw).toBe('{"error":"No matching AG-UI fixture"}');
    if (sdk) {
      expect(operation.recorder.events).toEqual([]);
      expect(operation.recorder.errors).toHaveLength(1);
      expect(operation.recorder.errors[0]).toMatchObject({ status: 404, payload: { error: 'No matching AG-UI fixture' } });
    } else { expect(operation.recorder.events).toEqual([]); expect(operation.recorder.errors).toEqual([]); }
  };
  try {
    await transport.writeReceipt(session);
    const mock = new aimock.AGUIMock();
    const restore = fixtures.registerCanonicalHistoryRestoreFixture(mock, source, { threadId, runId: restoreId, epochMs });
    const continuation = fixtures.registerCanonicalLongThreadFixture(mock, source, { threadId, runId: continuationId, epochMs });
    fixtures.registerDeterministicErrorFixture(mock);
    await transport.openOwnedMockEndpoint(session, mock);
    const url = await transport.openOwnedProxy(session);
    const configuration = factory.createCanonicalHttpAgentConfiguration(source,
      { threadId, runId: restoreId, epochMs }, { threadId, runId: continuationId, epochMs }, url);
    expect(configuration.config.initialMessages).toEqual([]);
    const agent = new client.HttpAgent({ ...configuration.config, fetch: transport.createScopedFetch(session) });
    expect(agent.messages).toEqual([]);
    const restored = await transport.runOwnedSdkOperation(session, agent, configuration.restoreRun);
    assertRequest(restored, semantic(restoreId, [])); assertSse(restored, restoreEvents, restore.digests.eventsSha256);
    assertSettled(restored, 'fulfilled'); assertSdk(restored, agent);
    expect(agent.messages).toEqual(history);
    expect(hash(contract.canonicalSerialize(agent.messages))).toBe(restore.digests.historySha256);
    expect(restored.recorder.events.map(event => event.type)).toEqual(['RUN_STARTED', 'MESSAGES_SNAPSHOT', 'RUN_FINISHED']);
    expect(restored.recorder.events[1]?.messageCount).toBe(100); expect(restored.recorder.errors).toEqual([]);
    expect(restored.recorder.events.filter(event => event.type === 'RUN_FINISHED')).toHaveLength(1);

    const continuing = transport.runOwnedSdkOperation(session, agent, configuration.continuationRun);
    // The helper admits synchronously before its first await. Reject only the
    // duplicate harness token, without another SDK/fetch invocation.
    const admittedBefore = session.gate.admitted;
    const requestsBefore = session.operations.reduce((sum, operation) => sum + operation.requests, 0);
    expect(() => session.gate.admit()).toThrow();
    expect(session.gate.admitted).toBe(admittedBefore);
    expect(session.operations.reduce((sum, operation) => sum + operation.requests, 0)).toBe(requestsBefore);
    const continued = await continuing;
    assertRequest(continued, semantic(continuationId, history)); assertSse(continued, continuationEvents, continuation.digests.eventsSha256);
    assertSettled(continued, 'fulfilled'); assertSdk(continued, agent);
    expect(continued.recorder.events).toEqual(continuationEvents.map(({ role: _role, ...event }: { role?: string; [key: string]: unknown }) => event));
    expect(continued.recorder.errors).toEqual([]);
    expect(continued.recorder.events.filter(event => event.type === 'TEXT_MESSAGE_CONTENT').map(event => event.delta)).toEqual(deltas);
    expect(continued.recorder.events.filter(event => event.type === 'RUN_FINISHED')).toHaveLength(1);
    expect(deltas).toHaveLength(200); expect(deltas.every(delta => Buffer.byteLength(delta) === 32)).toBe(true);
    expect(Buffer.byteLength(responseText)).toBe(6400); expect(hash(responseText)).toBe(continuation.digests.responseSha256);
    expect(agent.messages).toHaveLength(101); expect(agent.messages.slice(0, 100)).toEqual(history);
    const response = agent.messages[100]!;
    expect({ id: response.id, role: response.role, content: response.content }).toEqual({ id: 'response-100', role: 'assistant', content: responseText });
    expect(response.metadata).toEqual(clock(10000).metadata);

    const errorHistory: Message[] = [{ id: 'agent-error-user', role: 'user', content: 'Demonstrate a deterministic agent error.' }];
    const errorAgent = new client.HttpAgent({ url, threadId: 'agent-error-thread', agentId: 'hosted-error', initialMessages: errorHistory, fetch: transport.createScopedFetch(session) });
    const errorOperation = await transport.runOwnedSdkOperation(session, errorAgent, { runId: 'agent-error-run' });
    assertRequest(errorOperation, semantic('agent-error-run', errorHistory, 'agent-error-thread'));
    assertSse(errorOperation, [
      { type: 'RUN_STARTED', threadId: 'agent-error-thread', runId: 'agent-error-run', timestamp: 0, metadata: { clock: 'synthetic-agent-error-ms' } },
      { type: 'RUN_ERROR', code: 'FIXTURE_ERROR', message: 'Deterministic agent failure', timestamp: 1, metadata: { clock: 'synthetic-agent-error-ms' } },
    ]);
    assertSettled(errorOperation, 'fulfilled'); assertSdk(errorOperation, errorAgent);
    expect(errorAgent.messages).toEqual(errorHistory);
    expect(errorOperation.recorder.events.map(event => event.type)).toEqual(['RUN_STARTED', 'RUN_ERROR']);
    expect(errorOperation.recorder.errors).toEqual([{ code: 'FIXTURE_ERROR', message: 'Deterministic agent failure' }]);

    const contentMismatch: Message[] = history.map(message => ({ ...message }));
    contentMismatch[0] = { id: history[0]!.id, role: 'assistant', content: `X${String(history[0]!.content).slice(1)}` };
    expect(contentMismatch[0]!.content).not.toBe(history[0]!.content);
    const contentAgent = new client.HttpAgent({ url, threadId, agentId: 'hosted-content-negative', initialMessages: contentMismatch, fetch: transport.createScopedFetch(session) });
    const contentMiss = await transport.runOwnedSdkOperation(session, contentAgent, { runId: continuationId });
    assertRequest(contentMiss, semantic(continuationId, contentMismatch)); assert404(contentMiss, true);
    assertSettled(contentMiss, 'rejected'); assertSdk(contentMiss, contentAgent); expect(contentAgent.messages).toEqual(contentMismatch);

    const metadataMismatch: Message[] = history.map(message => ({ ...message }));
    metadataMismatch[0] = { ...metadataMismatch[0]!, metadata: { hostedMatcherDeviation: true } };
    const metadataAgent = new client.HttpAgent({ url, threadId, agentId: 'hosted-metadata-negative', initialMessages: metadataMismatch, fetch: transport.createScopedFetch(session) });
    const metadataMiss = await transport.runOwnedSdkOperation(session, metadataAgent, { runId: continuationId });
    assertRequest(metadataMiss, semantic(continuationId, metadataMismatch)); assert404(metadataMiss, true);
    assertSettled(metadataMiss, 'rejected'); assertSdk(metadataMiss, metadataAgent); expect(metadataAgent.messages).toEqual(metadataMismatch);

    const wrongInput = semantic('hosted-wrong-run', history);
    const wrong = await transport.runOwnedRawOperation(session, JSON.stringify(wrongInput));
    assertRequest(wrong, wrongInput); assert404(wrong, false); assertSettled(wrong, 'fulfilled');
    expect(session.active).toBe(null);
    expect(session.operations).toHaveLength(6);
    expect(session.operations.every(operation => operation.complete)).toBe(true);
    expect(session.tasks.every(task => task.settlement !== 'pending' || task.label === 'server-close' || task.label === 'socket-close')).toBe(true);
    mock.reset(); // Exactly once, only after all six public originals/readers settle.
    const restorationInput = semantic(restoreId, []);
    const restoreMiss = await transport.runOwnedRawOperation(session, JSON.stringify(restorationInput));
    assertRequest(restoreMiss, restorationInput); assert404(restoreMiss, false); assertSettled(restoreMiss, 'fulfilled');
    const continuationInput = semantic(continuationId, history);
    const continuationMiss = await transport.runOwnedRawOperation(session, JSON.stringify(continuationInput));
    assertRequest(continuationMiss, continuationInput); assert404(continuationMiss, false); assertSettled(continuationMiss, 'fulfilled');
    expect(session.operations.map(operation => operation.token)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(session.gate.admitted).toBe(8); expect(session.active).toBe(null);
    assertionsPassed = true;
  } catch (error) { semanticFailure = error; }
  finally {
    try { await transport.disposeOwnedSession(session); }
    catch (error) { cleanupFailure = error; }
  }
  try {
    expect(session.disposal?.settlement).toBe('fulfilled');
    expect(session.tasks.every(task => task.settlement !== 'pending')).toBe(true);
    expect(session.readers.every(reader => reader.released)).toBe(true);
    expect(session.sockets.every(socket => socket.closed)).toBe(true);
    expect(session.responses.every(response => response.closed)).toBe(true);
    expect(session.servers.every(server => server.close.settlement === 'fulfilled')).toBe(true);
    expect(session.incomplete).toBe(false); expect(session.captureFailed).toBe(false);
    expect(session.primaryFailures).toEqual([]); expect(session.cleanupFailures).toEqual([]);
  } catch (error) { cleanupFailure ??= error; assertionsPassed = false; }
  // Never fabricate eight tokens for a partial/failed matrix. Disposal already
  // retains terminal1; terminal2 records failed semantics where its binding exists.
  const tokens = session.operations.map(operation => operation.token);
  const validation = tokens.length === 8 && session.disposal?.settlement === 'fulfilled'
    ? { operationTokens: tokens, assertionOutcome: assertionsPassed && semanticFailure === undefined && cleanupFailure === undefined ? 'passed' as const : 'failed' as const }
    : undefined;
  try {
    await transport.writeReceipt(session, validation);
    const readArtifact = async (filename: string, maximum: number, deadline: number): Promise<Uint8Array> => {
      assertPublicationDeadline(deadline);
      const artifactPath = path.join(path.dirname(session.receiptPath), filename);
      const info = await fs.lstat(artifactPath);
      if (!info.isFile() || info.isSymbolicLink() || info.size > maximum) throw new Error('Artifact bound');
      reserveCaptureBytes(session.budget, null, info.size);
      assertPublicationDeadline(deadline);
      const bytes = await fs.readFile(artifactPath);
      assertPublicationDeadline(deadline);
      expect(bytes.byteLength).toBe(info.size);
      return bytes;
    };
    const terminalBytes = await readArtifact('terminal-2.json', 32_768, matrixDeadline);
    assertPublicationDeadline(matrixDeadline);
    reserveCaptureBytes(session.budget, null, terminalBytes.byteLength * 2);
    const terminal = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(terminalBytes)) as {
      qualification: boolean; transportComplete: boolean; validation: unknown; identity: unknown;
      publication: { state: string; horizon: string }; completeWireOracle: boolean;
      rawPersistenceComplete: boolean; fullObservations: { file: string; bytes: number; sha256: string; disposition: string };
    };
    expect(terminal.publication).toMatchObject({ state: 'pending', horizon: 'pre-publication' });
    expect(terminal.completeWireOracle).toBe(false);
    expect(session.terminalReceipts[1]?.settlement).toBe('fulfilled'); // Outside original publication witness.
    expect(terminal.identity).toEqual(admission); expect(terminal.validation).toEqual(validation ?? null);
    if (validation?.assertionOutcome === 'passed') {
      expect(terminal.qualification).toBe(true); expect(terminal.transportComplete).toBe(true); expect(terminal.rawPersistenceComplete).toBe(true);
      expect(terminal.fullObservations.file).toBe('receipt.json'); expect(terminal.fullObservations.disposition).toBe('fulfilled');
      // Outside disposed transport, still inside this one 180s test: one
      // prepaid scratch is reused by serial public FD read originals. Borrowed
      // views are hashed synchronously before the next read, never retained.
      assertPublicationDeadline(matrixDeadline);
      reserveCaptureBytes(session.budget, null, 65_536);
      const scratch = new Uint8Array(65_536);
      const observeArtifact = async (filename: string, maximum: number, expectedBytes: number, expectedHash: string, deadline: number): Promise<void> => {
        assertPublicationDeadline(deadline);
        if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0 || expectedBytes > maximum || !/^[a-f0-9]{64}$/.test(expectedHash)) throw new Error('Published scalar bound');
        reserveCaptureBytes(session.budget, null, 512); // Bounded before/after FD scalars and digest.
        const handle = await fs.open(path.join(path.dirname(session.receiptPath), filename),
          fsConstants.constants.O_RDONLY | fsConstants.constants.O_NOFOLLOW);
        let readFailure: unknown; let closeFailure: unknown;
        try {
          const statIdentity = async () => {
            assertPublicationDeadline(deadline);
            const value = await handle.stat({ bigint: true });
            if (!value.isFile() || value.size > BigInt(maximum) || value.size !== BigInt(expectedBytes)) throw new Error('Published FD size/type mismatch');
            return { dev: value.dev, ino: value.ino, size: value.size, mtimeNs: value.mtimeNs, ctimeNs: value.ctimeNs };
          };
          const initial = await statIdentity();
          const { dev, ino, size, mtimeNs, ctimeNs } = initial;
          const digest = crypto.createHash('sha256'); let offset = 0; let readCount = 0;
          while (offset < expectedBytes) {
            assertPublicationDeadline(deadline);
            if (++readCount > expectedBytes) throw new Error('Published read-count bound');
            const { bytesRead } = await handle.read(scratch, 0, Math.min(scratch.byteLength, expectedBytes - offset), offset);
            if (bytesRead <= 0) throw new Error('Published artifact truncated');
            digest.update(scratch.subarray(0, bytesRead)); offset += bytesRead;
          }
          assertPublicationDeadline(deadline);
          const eof = await handle.read(scratch, 0, 1, offset);
          if (eof.bytesRead !== 0) throw new Error('Published artifact grew');
          const final = await statIdentity();
          if (final.dev !== dev || final.ino !== ino || final.size !== size
            || final.mtimeNs !== mtimeNs || final.ctimeNs !== ctimeNs) throw new Error('Published FD changed');
          expect(offset).toBe(expectedBytes); expect(digest.digest('hex')).toBe(expectedHash);
        } catch (error) { readFailure = error; }
        // Closing an already owned handle remains mandatory after expiry; no
        // replacement read/stat/open is admitted, and no original is raced away.
        finally { try { await handle.close(); } catch (error) { closeFailure = error; } }
        if (readFailure === undefined && closeFailure === undefined) {
          try { assertPublicationDeadline(deadline); } catch (error) { readFailure = error; }
        }
        if (readFailure !== undefined || closeFailure !== undefined) throw new AggregateError(
          [readFailure, closeFailure].filter(error => error !== undefined), 'Publication observation and/or original FD close failed');
      };
      await observeArtifact('receipt.json', 8 * 1024 * 1024, terminal.fullObservations.bytes, terminal.fullObservations.sha256, matrixDeadline);
      // Every raw file has exact count, EOF, immutable FD identity and digest.
      for (const operation of session.operations) {
        for (const body of [operation.request, operation.proxyRequest, operation.upstreamRequest, operation.response, operation.proxyResponse]) {
          await observeArtifact(`${body.domain.replace(':', '-')}.bin`, 512_000, body.bytes, chunkHash(body), matrixDeadline);
        }
      }
    }
  } catch (error) { cleanupFailure ??= error; }
  if (semanticFailure !== undefined || cleanupFailure !== undefined) {
    throw new AggregateError([semanticFailure, cleanupFailure].filter(error => error !== undefined), 'Semantic and/or owned-disposal/publication failure');
  }
  expect(assertionsPassed).toBe(true);
}, 180_000);
