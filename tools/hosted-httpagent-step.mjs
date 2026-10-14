// Hosted workflow-only fixed command runner. Never invoked in local preparation.
// Admission precedes child commands; no package runtime modules are imported.
import { readHostedAdmission } from '../tests/support/hosted-httpagent-context.ts';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
readHostedAdmission();
const runId = process.env.GITHUB_RUN_ID ?? '';
const runnerTemp = process.env.RUNNER_TEMP ?? '';
if (!/^[1-9][0-9]{0,19}$/.test(runId) || !/^\/[a-zA-Z0-9_./-]+$/.test(runnerTemp)
  || runnerTemp.length > 2048 || runnerTemp.split('/').some(part => part === '..' || part === '.')) throw new Error('Artifact identity');
const directory = join(runnerTemp, `hosted-httpagent-${runId}-1`);
const commands = {
  install: ['ci'], audit: ['audit', '--audit-level=high'],
  contract: ['run', 'build', '--workspace', '@chat-ui-bench/contract'],
  types: ['run', 'typecheck:fixtures'], test: ['run', 'test:hosted:httpagent'],
};
const label = process.argv[2];
if (process.argv.length !== 3 || !Object.hasOwn(commands, label)) throw new Error('Unsupported fixed step');
// This independently persisted initial evidence must already exist.
const initial = await readFile(join(directory, 'workflow-admission.json'));
if (initial.byteLength > 32768) throw new Error('Admission artifact bound');
if (label === 'install') {
  // Direct node invocations need no npm parent; verify actual npm in its own
  // fixed child command before installing and record its bounded result.
  const npmVersion = await new Promise((resolve, reject) => {
    const child = spawn('npm', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let text = ''; let overflow = false; let launchFailed = false;
    child.stdout.on('data', chunk => { if (Buffer.byteLength(text) + chunk.length <= 1024) text += chunk.toString(); else overflow = true; });
    child.stderr.on('data', () => { overflow = true; });
    child.on('error', () => { launchFailed = true; });
    child.on('close', (code, signal) => code === 0 && signal === null && !overflow && !launchFailed ? resolve(text.trim()) : reject(new Error('npm version observation failed')));
  });
  if (!/^11\.[0-9]+\.[0-9]+$/.test(npmVersion)) throw new Error('Released npm11 required');
  await writeFile(join(directory, 'runtime.json'), JSON.stringify({ node: process.version, npm: npmVersion }), { flag: 'wx' });
}
const limit = 131072; // Per-step merged stdout/stderr, all five logs <=640KiB.
let retained = 0; let overflow = false; const chunks = [];
const outcome = await new Promise(resolve => {
  const child = spawn('npm', commands[label], { stdio: ['ignore', 'pipe', 'pipe'] });
  let launchFailed = false;
  const capture = chunk => {
    const available = limit - retained;
    if (chunk.length > available) overflow = true;
    if (available > 0) { const copy = Buffer.from(chunk.subarray(0, available)); chunks.push(copy); retained += copy.length; }
    // Continue draining after overflow; do not signal/retry or leave a reader.
  };
  child.stdout.on('data', capture); child.stderr.on('data', capture);
  child.on('error', () => { launchFailed = true; });
  // Even launch failure is retained only after Node's actual close notification.
  child.on('close', (code, signal) => resolve({ code, signal, launchFailed }));
});
const bytes = Buffer.concat(chunks, retained);
await writeFile(join(directory, `${label}.log`), bytes, { flag: 'wx' });
await writeFile(join(directory, `${label}-result.json`), JSON.stringify({ ...outcome, bytes: retained, logIncomplete: overflow }), { flag: 'wx' });
process.stdout.write(bytes);
if (label === 'install' && outcome.code === 0 && !overflow) {
  // Metadata-only reads qualify the actual installed graph; no module evaluation.
  const facts = {};
  for (const [name, expected] of [['@ag-ui/client', '1.0.2'], ['@copilotkit/aimock', '1.45.1'], ['vitest', '5.0.3'], ['typescript', '7.0.2']]) {
    const raw = await readFile(`node_modules/${name}/package.json`, 'utf8');
    if (Buffer.byteLength(raw) > 65536) throw new Error('Package metadata bound');
    const metadata = JSON.parse(raw);
    if (metadata.version !== expected) throw new Error('Installed profile drift');
    facts[name] = metadata.version;
  }
  await writeFile(join(directory, 'installed-profile.json'), JSON.stringify(facts), { flag: 'wx' });
}
if (outcome.code !== 0 || outcome.signal !== null || outcome.launchFailed || overflow) process.exitCode = 1;
