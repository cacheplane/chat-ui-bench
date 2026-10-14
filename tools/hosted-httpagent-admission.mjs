// Node24 native TypeScript stripping: no dependency loader or compiled fallback.
import { readHostedAdmission } from '../tests/support/hosted-httpagent-context.ts';
import { mkdir, readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const admission = readHostedAdmission();
if (process.versions.node.split('.')[0] !== '24') throw new Error('Released Node24 required');
if (process.argv.length > 3 || (process.argv[2] !== undefined && !['--initialize-evidence', '--admit-artifacts'].includes(process.argv[2]))) throw new Error('Unsupported guard argument');
if (process.argv[2] !== undefined) {
  const runnerTemp = process.env.RUNNER_TEMP ?? '';
  const runId = process.env.GITHUB_RUN_ID ?? '';
  if (!/^\/[a-zA-Z0-9_./-]+$/.test(runnerTemp) || runnerTemp.length > 2048
    || runnerTemp.split('/').some(part => part === '..' || part === '.') || !/^[1-9][0-9]{0,19}$/.test(runId)) throw new Error('Invalid fixed artifact identity');
  const directory = join(runnerTemp, `hosted-httpagent-${runId}-1`);
  if (process.argv[2] === '--admit-artifacts') {
    const ownedDirectory = await lstat(directory);
    if (!ownedDirectory.isDirectory() || ownedDirectory.isSymbolicLink()) throw new Error('Owned artifact directory denied');
    const entries = await readdir(directory);
    const facts = [];
    let total = 0; let admitted = entries.length <= 64;
    for (const name of entries.slice(0, 64)) {
      const maximum = /^[1-8]-(original-request|proxy-request|upstream-request|client-response|proxy-response)\.bin$/.test(name) ? 512000
        : /^(install|audit|contract|types|test)\.log$/.test(name) ? 131072
          : /^(install|audit|contract|types|test)-result\.json$/.test(name) || /^(runtime|installed-profile)\.json$/.test(name) ? 4096
            : /^(terminal-[12]|workflow-admission)\.json$/.test(name) ? 32768
              : name === 'receipt.json' ? 8388608 : 0;
      const info = await lstat(join(directory, name)); // Never follow a link or recurse.
      const allowed = maximum > 0 && info.isFile() && !info.isSymbolicLink() && info.size <= maximum;
      admitted &&= allowed; total += info.size;
      facts.push({ name: maximum > 0 ? name : 'unexpected-file', bytes: info.size, admitted: allowed });
    }
    const inventory = JSON.stringify({ scope: 'actual-file-size-admission-only', qualification: false,
      identity: admission, count: entries.length, bytesBeforeInventory: total,
      inventoryComplete: entries.length <= 64, admitted: admitted && total <= 8388608, files: facts });
    if (Buffer.byteLength(inventory) > 32768 || total + Buffer.byteLength(inventory) > 8388608) admitted = false;
    // Keep all original files intact on denial. Bounded inventory/console facts
    // explain why upload was denied; this never certifies transport disposal.
    const retained = admitted ? inventory : JSON.stringify({ scope: 'actual-file-size-admission-only', qualification: false,
      admitted: false, incomplete: true, count: entries.length, bytesBeforeInventory: total, reason: 'Artifact inventory/bound failure' });
    await writeFile(join(directory, 'artifact-inventory.json'), retained, { flag: 'wx' });
    console.log(retained);
    if (!admitted) process.exitCode = 1;
  } else {
    await mkdir(directory, { recursive: true });
    const ownedDirectory = await lstat(directory);
    if (!ownedDirectory.isDirectory() || ownedDirectory.isSymbolicLink()) throw new Error('Owned artifact directory denied');
    const lock = await readFile('package-lock.json');
    const receipt = JSON.stringify({
      scope: 'workflow-admission-only', initial: true, incomplete: true, qualification: false,
      identity: admission, runId, attempt: '1', artifact: `hosted-httpagent-${runId}-1`,
      artifactDirectory: directory, nodeVersion: process.version,
      lockSha256: createHash('sha256').update(lock).digest('hex'),
      profile: { client: '1.0.2', aimock: '1.45.1', operations: 8, operationMs: 15000, disposalMs: 10000,
        bodyBytes: 512000, aggregateBytes: 8388608, testMs: 180000, hookMs: 30000,
        normalTaskCap: 7680, terminalTaskCap: 512, terminalSummaryBytes: 32768, terminalPrepaidCopies: 2 },
    });
    if (Buffer.byteLength(receipt) > 32768) throw new Error('Admission receipt bound');
    await writeFile(join(directory, 'workflow-admission.json'), receipt, { flag: 'wx' });
  }
}
