import { expect, it, vi } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArtifactWriter } from './artifacts.js';
import { runCalibration } from './run.js';
const owned = vi.hoisted(() => ({ captures: [] as any[], launches: [] as any[], closes: 0 }));
vi.mock('playwright', () => ({ chromium: { launch: async (options: any) => { const browser = { close: async () => { owned.closes++; } }; owned.launches.push({ options, browser }); return browser; } } }));
vi.mock('@chat-ui-bench/producer', () => ({ createReplayServer: async () => ({ drain: () => [], close: async () => {} }) }));
vi.mock('./server.js', () => ({ serveAssets: async () => ({ url: 'http://actual-assets', close: async () => {} }) }));
vi.mock('./capture.js', () => ({ captureRepetition: async (options: any) => { owned.captures.push(options); return { schemaVersion: 1, status: 'valid', reasons: [], checks: {} }; } }));

it('writes collector 1.1.0 at every invocation update and owns a fresh browser for each repetition', async () => {
  const records: any[] = [];
  const original = ArtifactWriter.prototype.json;
  const spy = vi.spyOn(ArtifactWriter.prototype, 'json').mockImplementation(async function(file, record) {
    if (file === 'invocation.json' && (record as any).collectorVersion) records.push(record);
    return original.call(this, file, record);
  });
  try {
    const directory = await runCalibration({ repetitions: 2, mode: 'headless', selectedVariants: ['clean'], out: await mkdtemp(join(tmpdir(), 'bench-invocation-version-')) });
    expect(records).toHaveLength(4);
    expect(records.map(record => record.collectorVersion)).toEqual(['1.1.0', '1.1.0', '1.1.0', '1.1.0']);
    expect(records.map(record => record.status)).toEqual(['running', 'running', 'running', 'complete']);
    expect(owned.launches).toHaveLength(2); expect(owned.closes).toBe(2);
    expect(owned.captures.map(capture => capture.browser)).toEqual(owned.launches.map(launch => launch.browser));
    expect(owned.captures[0].browser).not.toBe(owned.captures[1].browser);
    expect(owned.captures.every(capture => capture.isolatedBrowserProcess === true)).toBe(true);
    expect(owned.launches.every(launch => launch.options.headless && launch.options.args.includes('--enable-automation'))).toBe(true);
    expect(JSON.parse(await readFile(join(directory, 'invocation.json'), 'utf8')).collectorVersion).toBe('1.1.0');
  } finally { spy.mockRestore(); }
});
