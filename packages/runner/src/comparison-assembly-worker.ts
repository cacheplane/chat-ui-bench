import {assembleComparisonInstaller} from './comparison-installer.js';
import {pathToFileURL} from 'node:url';
import type {Readable, Writable} from 'node:stream';

const inputCap = 2 * 6 * 65536 + 7 + 8;
const outputCap = 2 * 6 * 1048576 + 174;

/** Internal wire primitive; the standalone entry has no parent-module imports. */
export async function writeWorkerWire(stream: Writable, bytes: Buffer): Promise<void> {
  for (let offset = 0; offset < bytes.length; offset += 65536) {
    const chunk = bytes.subarray(offset, Math.min(offset + 65536, bytes.length));
    await new Promise<void>((resolve, reject) => {
      let returned = false, needsDrain = false, callback = false, drained = false, settled = false;
      const remove = () => {
        stream.off('error', fail); stream.off('close', closed); stream.off('drain', drain);
      };
      const fail = () => {if (!settled) {settled = true; remove(); reject(new Error('worker-write-failed'));}};
      const closed = () => fail();
      const finish = () => {
        if (!settled && returned && callback && (!needsDrain || drained)) {settled = true; remove(); resolve();}
      };
      const drain = () => {drained = true; finish();};
      stream.on('error', fail); stream.on('close', closed); stream.on('drain', drain);
      try {
        needsDrain = !stream.write(chunk, error => {if (error) fail(); else {callback = true; finish();}});
        returned = true; finish();
      } catch {fail();}
    });
  }
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const remove = () => {stream.off('error', fail); stream.off('close', fail); stream.off('finish', finish);};
    const fail = () => {if (!settled) {settled = true; remove(); reject(new Error('worker-end-failed'));}};
    const finish = () => {if (!settled) {settled = true; remove(); resolve();}};
    stream.on('error', fail); stream.on('close', fail); stream.on('finish', finish);
    try {stream.end();} catch {fail();}
  });
}

export async function runComparisonAssemblyWorker(input: Readable, output: Writable): Promise<void> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const value of input) {
    if (!Buffer.isBuffer(value) || value.length > inputCap - length) throw new Error('worker-input-limit');
    length += value.length; chunks.push(value);
  }
  const bytes = Buffer.concat(chunks, length);
  const decoded = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
  const tuple: unknown = JSON.parse(decoded);
  if (!Array.isArray(tuple) || (tuple.length !== 2 && tuple.length !== 3) || tuple.slice(0,2).some(value => typeof value !== 'string' || value.length > 65536 || Buffer.byteLength(value, 'utf8') > 65536) || (tuple.length===3 && tuple[2]!=='2.0.0' && tuple[2]!=='2.1.0')) throw new Error('worker-input-grammar');
  if (!bytes.equals(Buffer.from(JSON.stringify(tuple), 'utf8'))) throw new Error('worker-input-encoding');
  const pair = assembleComparisonInstaller(tuple[0] as string, tuple[1] as string, tuple.length===2?'2.0.0':tuple[2] as '2.0.0'|'2.1.0');
  const wire = Buffer.from(JSON.stringify({preNavigation: pair.preNavigation, main: pair.main, preNavigationByteLength: pair.preNavigationByteLength, mainByteLength: pair.mainByteLength, installerSha256: pair.installerSha256}), 'utf8');
  if (wire.length > outputCap) throw new Error('worker-output-limit');
  await writeWorkerWire(output, wire);
}

// Importing this file's internal helpers cannot activate the stdin lane.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fail = () => {
    process.exitCode = 1;
    process.stdin.destroy();
  };
  // A write callback can fail before Node emits its deferred stream error.
  // Keep entry observers installed after temporary latch listeners are removed.
  process.stdin.on('error', fail); process.stdout.on('error', fail);
  void runComparisonAssemblyWorker(process.stdin, process.stdout).catch(fail);
}
