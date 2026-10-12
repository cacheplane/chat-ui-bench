import {afterEach, expect, it} from 'vitest';
import {spawn} from 'node:child_process';
import {mkdir, mkdtemp, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {comparisonSchemasForVersionPair, longThreadCaseOrder} from '@chat-ui-bench/contract';
import {parseComparisonReportArgs} from './comparison-cli.js';

const owned: string[] = [];
afterEach(async () => {for (const path of owned.splice(0)) await rm(path, {recursive: true, force: true});});
it('requires explicit original and new output paths', () => {
  expect(parseComparisonReportArgs(['--artifact-dir', '/original', '--out', '/new-report'])).toEqual({input: '/original', output: '/new-report'});
});
it.each([[], ['--artifact-dir', '/original'], ['--artifact-dir', '/original', '--artifact-dir', '/other'], ['--artifact-dir', '/original', '--out', 'relative'], ['--out', '/new', '--artifact-dir', '/original'], ['--artifact-dir', '/original', '--out', '/new', '--allow-partial']].map(args => ({args})))('rejects malformed closed arguments $args', ({args}) => {
  expect(() => parseComparisonReportArgs(args)).toThrow(/Usage|absolute/);
});

async function compiled(args: string[]) {
  const child = spawn(process.execPath, [resolve('packages/analyzer/dist/comparison-cli.js'), ...args], {stdio: ['ignore', 'pipe', 'pipe']});
  const stdout: Buffer[] = [], stderr: Buffer[] = [];
  child.stdout.on('data', bytes => stdout.push(bytes)); child.stderr.on('data', bytes => stderr.push(bytes));
  const code = await new Promise<number | null>((resolve, reject) => {child.once('error', reject); child.once('close', resolve);});
  return {code, stdout: Buffer.concat(stdout).toString(), stderr: Buffer.concat(stderr).toString()};
}
it('compiled private CLI publishes unavailable diagnostics with actual partial exit1', async () => {
  const parent = await mkdtemp(join(await realpath(tmpdir()), 'comparison-report-cli-')); owned.push(parent);
  const input = join(parent, 'original'), output = join(parent, 'output'); await mkdir(input); await writeFile(join(input, 'invocation.json'), '{}\n');
  const result = await compiled(['--artifact-dir', input, '--out', output]);
  expect(result.code).toBe(1); expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toMatchObject({publicationStatus: 'complete', analysisStatus: 'unavailable', scoringEligibility: false});
  expect(JSON.parse(await readFile(join(output, 'comparison-results.json'), 'utf8'))).toMatchObject({rowsAdmitted: false, rows: [], scoringEligibility: false});
  expect(await readFile(join(input, 'invocation.json'), 'utf8')).toBe('{}\n');
});
it('compiled private CLI reports usage failure without successful publication receipt', async () => {
  const result = await compiled(['--allow-partial']); expect(result.code).not.toBe(0); expect(result.stdout).toBe('');
  expect(result.stderr).toContain('Usage');
});

it('compiled CLI retains all12 supported failed rows and reports partial exit1', async () => {
  const parent = await mkdtemp(join(await realpath(tmpdir()), 'comparison-report-cli-supported-')); owned.push(parent);
  const input = join(parent, 'original'), output = join(parent, 'output'); await mkdir(input);
  const schemas = comparisonSchemasForVersionPair({collectorVersion: '2.1.0', analyzerVersion: '2.1.0'}), order = longThreadCaseOrder(1);
  const ledger = schemas.comparisonCaptureInvocationSchema.parse({...schemas.versions, createdAt: '2026-10-10T00:00:00.000Z', purpose: 'conformance', status: 'failed',
    configuration: {schemaVersion: 2, suite: 'long-thread-prose-v1', seed: 1, rounds: 1, adapterProfiles: ['threadplane-langgraph-custom-transport'], caseOrder: order, mode: 'headless', deadlinesMs: {historySetup: 60000, replay: 30000, disposal: 10000}},
    runs: order.map((scenarioId, caseIndex) => ({round: 1, caseIndex, scenarioId, adapterProfile: 'threadplane-langgraph-custom-transport', repetition: '1-' + caseIndex, artifactDirectory: `runs/round-1/case-${caseIndex}/profile-0`, status: 'failed', reasons: ['Original independent fixture not started']}))});
  const bytes = JSON.stringify(ledger); await writeFile(join(input, 'invocation.json'), bytes);
  const result = await compiled(['--artifact-dir', input, '--out', output]); expect(result.code).toBe(1); expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toMatchObject({analysisStatus: 'partial', publicationStatus: 'complete', scoringEligibility: false});
  const report = JSON.parse(await readFile(join(output, 'comparison-results.json'), 'utf8'));
  expect(report.rows).toHaveLength(12); expect(report.scheduledRows).toBe(12);
  expect(report.rows.map((row: {reportedLedgerStatus: string}) => row.reportedLedgerStatus)).toEqual(Array(12).fill('failed'));
  expect(await readFile(join(input, 'invocation.json'), 'utf8')).toBe(bytes);
});

it('compiled CLI preserves an existing destination and emits only a failed publication receipt', async () => {
  const parent = await mkdtemp(join(await realpath(tmpdir()), 'comparison-report-cli-collision-')); owned.push(parent);
  const input = join(parent, 'original'), output = join(parent, 'output'); await mkdir(input); await mkdir(output);
  await writeFile(join(input, 'invocation.json'), '{}'); await writeFile(join(output, 'original.txt'), 'preserve me');
  const result = await compiled(['--artifact-dir', input, '--out', output]); expect(result.code).toBe(2); expect(result.stdout).toBe('');
  expect(JSON.parse(result.stderr)).toMatchObject({publicationStatus: 'failed', scoringEligibility: false});
  expect(await readFile(join(output, 'original.txt'), 'utf8')).toBe('preserve me');
});
