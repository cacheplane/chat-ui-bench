import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createArtifactInvocation, ArtifactWriter } from './artifacts.js';

describe('durable raw artifacts', () => {
  it('never reuses an invocation directory even within the same millisecond', async () => {
    const base = await mkdtemp(join(tmpdir(), 'bench-artifacts-'));
    const a = await createArtifactInvocation(base); const b = await createArtifactInvocation(base);
    expect(a).not.toBe(b);
    expect(JSON.parse(await readFile(join(a, 'invocation.json'), 'utf8')).schemaVersion).toBe(1);
  });
  it('persists partial observations independently of final collection success', async () => {
    const base = await mkdtemp(join(tmpdir(), 'bench-artifacts-'));
    const writer = await ArtifactWriter.create(base);
    await writer.append('producer-events.jsonl', [{ sequence: 1 }, { sequence: 2 }]);
    await writer.append('producer-events.jsonl', [{ sequence: 3 }]);
    await writer.json('validation.json', { status: 'failed', reasons: ['Tracing.end timed out'] });
    expect((await readFile(join(base, 'producer-events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)).toEqual([{ sequence: 1 }, { sequence: 2 }, { sequence: 3 }]);
    expect(JSON.parse(await readFile(join(base, 'validation.json'), 'utf8')).status).toBe('failed');
  });
});
