import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROCESSOR_PINS, runDiagnostic } from './run.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const concat = (...parts) => Buffer.concat(parts);
const varint = value => {
  const bytes = [];
  do { const byte = Number(value & 127n); value >>= 7n; bytes.push(byte | (value ? 128 : 0)); } while (value);
  return Buffer.from(bytes);
};
const uint = (field, value) => concat(varint(BigInt(field) * 8n), varint(value));
const body = (field, bytes) => concat(varint(BigInt(field) * 8n + 2n), varint(BigInt(bytes.length)), bytes);
const text = (field, value) => body(field, Buffer.from(value));

// Pure authored protobuf fixture, never a captured trace or performance sample.
export function authoredClockFixture() {
  const clock = (id, ts, unit) => body(1, concat(uint(1, id), uint(2, ts), uint(3, 0n), uint(4, unit)));
  const packet = (...fields) => body(1, concat(uint(10, 1n), ...fields));
  const mark = (name, ts) => packet(uint(8, ts), uint(58, 64n), body(11, concat(uint(9, 3n), uint(11, 7n), text(22, 'blink.user_timing'), text(23, name))));
  return concat(
    packet(uint(13, 1n), body(6, concat(clock(6n, 1000000n, 1n), clock(64n, 1000n, 1000n), uint(2, 6n)))),
    packet(body(60, concat(uint(1, 7n), body(4, concat(uint(1, 1n), uint(2, 1n)))))),
    mark('authored-start', 1001n), mark('authored-end', 1021n));
}

export async function runSmoke({ processor, out }) {
  if (![processor, out].every(p => typeof p === 'string' && isAbsolute(p) && resolve(p) === p)) throw new Error('normalized absolute processor and fresh output paths required');
  await mkdir(out, { mode: 0o700 });
  const summary = { status: 'failure', authoredOnly: true, nativeSupported: false, fps: null, duration: null, scoring: false };
  try {
    const bytes = authoredClockFixture();
    assert.equal(bytes.length, 153);
    assert.equal(digest(bytes), '177a183ab43040d16379243c2185cf324a2e49edd8ab1c9d17034b9276f3199d');
    const path = join(out, 'authored-clock-fixture.pftrace');
    await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
    const result = await runDiagnostic({ trace: { path, bytes: bytes.length, sha256: digest(bytes) }, processor: { path: processor, sha256: PROCESSOR_PINS[`${process.platform}-${process.arch}`] }, phases: ['authored-start', 'authored-end'], out: join(out, 'diagnostic') });
    assert.equal(result.status, 'success', result.error);
    assert.equal(result.officialProcessor, true); assert.equal(result.authoredFixture, false);
    assert.equal(result.nativeSupported, false); assert.equal(result.fps, null); assert.equal(result.duration, null); assert.equal(result.scoring, false);
    for (const name of ['version', 'query']) {
      const proc = result.processes[name]; assert.equal(proc.code, 0); assert.equal(proc.signal, null); assert.equal(proc.closed, true); assert.equal(proc.error, null);
      for (const state of Object.values(proc.streams)) { assert.equal(state.eof, true); assert.equal(state.closed, true); assert.equal(state.forcedDestroy, false); assert.equal(state.error, null); }
    }
    const csv = await readFile(join(out, 'diagnostic', 'query.stdout'), 'utf8');
    const lines = csv.trim().split(/\r?\n/);
    assert.equal(lines.filter(line => line.includes('"authored-start"') || line.includes('"authored-end"')).length, 2);
    assert.ok(lines.some(line => /^\d+,1001000,0,"authored-start",\d+,/.test(line)), 'expected authored start timestamp');
    assert.ok(lines.some(line => /^\d+,1021000,0,"authored-end",\d+,/.test(line)), 'expected authored end timestamp');
    assert.ok(lines.includes('1001000,1021000'), 'expected authored trace bounds');
    assert.ok(lines.includes('"Graphics.Pipeline",0'), 'expected zero authored graphics pipeline events');
    summary.status = 'success'; summary.fixtureBytes = bytes.length; summary.fixtureSha256 = digest(bytes);
  } catch (error) { summary.error = error.message; }
  await writeFile(join(out, 'smoke.json'), `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== '--processor' || args[2] !== '--out') throw new Error('usage: node tools/perfetto-import/smoke.mjs --processor /absolute/trace_processor_shell --out /absolute/fresh-output');
    const summary = await runSmoke({ processor: args[1], out: args[3] });
    process.stdout.write(`${JSON.stringify(summary)}\n`); if (summary.status !== 'success') process.exitCode = 1;
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
