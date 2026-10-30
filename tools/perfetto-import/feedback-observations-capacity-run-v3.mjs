import { constants } from 'node:fs';
import { open, lstat, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {runTargetFeedbackCapacityExportV3,runScopeFeedbackCapacityExportV3,inspectFeedbackCapacityExportV3,verifyFeedbackCapacityExportV3,EXPECTED_VERSION,PROCESSOR_PINS} from './feedback-observations-capacity-export-v3.mjs';

const SCHEMA = 'browser-presentation-feedback-observations-capacity-v3';
const MODEL_HASH='02807672dea27faa9f09bb1bc820c629d25ff97713b972d8f45b16f919c887ca';
const CORE_HASH='eca4313c09dc65b8fe9e40fb822cbad3834666327888292458b97c3d6d344697';
const BASE = dirname(fileURLToPath(import.meta.url));
const SHA = /^[a-f0-9]{64}$/;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const identity = s => Object.fromEntries(['dev', 'ino', 'mode', 'nlink', 'size', 'mtimeNs', 'ctimeNs'].map(k => [k, String(s[k])]));
const ensure = (condition, reason) => { if (!condition) throw Error(reason); };
// Union of the literal fixed SQL census families; available before any I/O.
const SQL_FAMILIES = new Set(['BeginFrame', 'FrameCommittedInBrowser', 'FrameDeletedInBrowser', 'Graphics.Pipeline', 'PipelineReporter', 'ProcessReadyInBrowser', 'SetLayerTreeId', 'TracingStartedInBrowser', 'DrawFrame', 'MainFrame.Draw', 'Scheduler::BeginFrame', 'Scheduler::BeginImplFrame']);
const pathOK = p => typeof p === 'string' && p.isWellFormed() && Buffer.byteLength(p) <= 4096 && isAbsolute(p) && resolve(p) === p && !/[\x00-\x1f\x7f-\x9f]/.test(p);
const nameOK = p => typeof p === 'string' && p.isWellFormed() && p.length > 0 && Buffer.byteLength(p) <= 256 && !/[\x00-\x1f\x7f-\x9f]/.test(p);
function configOf(raw) {
  ensure(typeof raw === 'string' && raw.length <= 16384 && Buffer.byteLength(raw) <= 16384, 'invalid-config');
  const c = JSON.parse(raw);
  ensure(c && c.schema === SCHEMA && c.capacityProfile==='whole-graph-capacity-v3' && c.wireFormat==='compact-v2' && c.trace && c.processor && c.target && c.phaseNames, 'invalid-config');
  const canonical = { schema: c.schema, capacityProfile:c.capacityProfile, wireFormat:c.wireFormat, trace: { path: c.trace.path, bytes: c.trace.bytes, sha256: c.trace.sha256 }, processor: { path: c.processor.path, sha256: c.processor.sha256 }, target: { frameId: c.target.frameId, loaderId: c.target.loaderId }, phaseNames: { start: c.phaseNames.start, end: c.phaseNames.end }, out: c.out, deadlineMs: c.deadlineMs };
  ensure(JSON.stringify(canonical) === raw, 'invalid-config');
  ensure(pathOK(c.trace.path) && pathOK(c.processor.path) && pathOK(c.out), 'invalid-config');
  ensure(Number.isSafeInteger(c.trace.bytes) && c.trace.bytes >= 0 && c.trace.bytes <= 33554432 && typeof c.trace.sha256 === 'string' && SHA.test(c.trace.sha256) && typeof c.processor.sha256 === 'string' && SHA.test(c.processor.sha256), 'invalid-config');
  ensure(nameOK(c.target.frameId) && nameOK(c.target.loaderId) && nameOK(c.phaseNames.start) && nameOK(c.phaseNames.end) && c.phaseNames.start !== c.phaseNames.end && !SQL_FAMILIES.has(c.phaseNames.start) && !SQL_FAMILIES.has(c.phaseNames.end), 'invalid-config');
  ensure(Number.isSafeInteger(c.deadlineMs) && c.deadlineMs >= 1 && c.deadlineMs <= 60000, 'invalid-config');
  const paths = [c.trace.path, c.processor.path];
  ensure(paths.every(p => c.out !== p && !c.out.startsWith(p + '/') && !p.startsWith(c.out + '/')), 'invalid-config');
  ensure(c.trace.path !== c.processor.path, 'invalid-config');
  return canonical;
}
function refused(stage, reason, evidence = null) {
  const observation = { schema: SCHEMA, capacityProfile:'whole-graph-capacity-v3',wireFormat:'compact-v2', status: 'unavailable', stage, reason, metric: 'observed-successful-browser-feedback-hz', executionEvidence: 'untrusted-supplied-csv', inputOrigin: 'caller-supplied-csv', traceOrigin: 'unestablished', clockContract: 'supplied-imported-nanoseconds', count: null, interval: null, observedHz: null, fps: null, exhaustivePopulation: false, nativeSupported: false, captureQualified: false, evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false, coverage: null, events: [], diagnostics: [], evidence };
  return { status: 'unavailable', stage, reason, publication: null, observation };
}
// The snapshot owns a no-follow descriptor, checks identity before/after EOF,
// and closes it before returning. It never follows a caller replacement.
async function snapshot(path, limit, check, expected = null, retain = true) {
  check(); const ls = await lstat(path, { bigint: true }); check();
  ensure(ls.isFile() && ls.nlink === 1n && ls.size <= BigInt(limit), 'file-custody');
  const h = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    check(); const first = await h.stat({ bigint: true }); const id = identity(first);
    ensure(first.isFile() && first.nlink === 1n && first.size <= BigInt(limit) && equal(id, identity(ls)), 'file-custody');
    ensure(equal(id, identity(await lstat(path, { bigint: true }))), 'file-custody');
    const digest = createHash('sha256'); const parts = []; const chunk = Buffer.alloc(65536); let bytes = 0;
    for (;;) { check(); const n = (await h.read(chunk, 0, Math.min(chunk.length, limit + 1 - bytes), bytes)).bytesRead; check(); if (!n) break; bytes += n; ensure(bytes <= limit, 'file-limit'); digest.update(chunk.subarray(0, n)); if (retain) parts.push(Buffer.from(chunk.subarray(0, n))); }
    ensure(BigInt(bytes) === first.size && equal(id, identity(await h.stat({ bigint: true }))) && equal(id, identity(await lstat(path, { bigint: true }))), 'file-custody');
    const observed = { path, bytes, sha256: digest.digest('hex'), identity: id };
    if (expected) ensure((expected.sha256 === undefined || observed.sha256 === expected.sha256) && (expected.bytes === undefined || Number.isSafeInteger(expected.bytes) && observed.bytes === expected.bytes) && (expected.identity === undefined || equal(observed.identity, expected.identity)), 'file-commitment');
    check(); return { observed, contents: retain ? Buffer.concat(parts) : null };
  } finally { await h.close(); check(); }
}
function boundedJSON(value, limits) {
  let nodes = 0, strings = 0, width = 0; const stack = [value];
  while (stack.length) {
    const v = stack.pop(); ensure(++nodes <= limits.resultNodes, 'result-limit');
    if (typeof v === 'string') { strings += Buffer.byteLength(v); width += Buffer.byteLength(JSON.stringify(v)); }
    else if (v === null || typeof v === 'boolean' || typeof v === 'number') { width += String(v).length; }
    else if (Array.isArray(v)) { width += v.length + 2; stack.push(...v); }
    else { const keys = Object.keys(v); width += keys.length * 2 + 2; for (const k of keys) { stack.push(k, v[k]); } }
    ensure(strings <= limits.resultStringBytes && width <= limits.resultBytes, 'result-limit');
  }
  const bytes = Buffer.from(JSON.stringify(value)); ensure(bytes.length <= limits.resultBytes, 'result-limit'); return bytes;
}
async function sourceBookend(roles, check) {
  const result = {}; let total = 0;
  for (const [name, role] of Object.entries(roles)) { const s = await snapshot(role.path, 262144, check, role.expected); total += s.observed.bytes; ensure(total <= 1048576, 'source-limit'); result[name] = s.observed; }
  return result;
}
function validateProcess(record, args, processName, deadlineMs) {
  ensure(record && equal(record.args, args) && record.code === 0 && record.signal === null && record.closed === true && record.error === null && !record.killError, 'process-evidence');
  ensure(equal(record.exit,{code:0,signal:null})&&equal(record.close,{code:0,signal:null}),'original-exit-close');
  ensure(record.timedOut===false&&record.groupAbsent===true&&record.original&&['pid','ppid','pgid'].every(key=>Number.isSafeInteger(record.original[key])&&record.original[key]>0)&&record.original.ppid===process.pid&&record.original.pgid===record.original.pid,'original-process-closure');
  ensure(record.elapsedDeadlineExceeded===false&&[record.closeElapsedMs,record.elapsedMs].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<deadlineMs)&&record.closeElapsedMs<=record.elapsedMs,'original-process-elapsed');
  for (const [name, limit] of [['stdout', processName==='query'?2097152:262144], ['stderr', 65536]]) { const s = record.streams?.[name]; ensure(s && s.eof === true && s.closed === true && s.forcedDestroy === false && s.error === null && Number.isInteger(s.bytes) && s.bytes >= 0 && s.bytes <= limit && s.observedBytes === s.bytes && Number.isSafeInteger(s.chunks)&&s.chunks>=0&&s.chunks<=8192&&(s.bytes===0||s.chunks>0) && SHA.test(s.sha256), 'process-stream-evidence'); }
}
async function admit(original, name, config, model, sources, check, runtime) {
  const owned=inspectFeedbackCapacityExportV3(original);ensure(owned.manifest===original&&await verifyFeedbackCapacityExportV3(original)===owned,'original-exporter-capability');check();const manifest=owned.manifest;
  const dir = join(config.out, name); const sqlPolicy = model.sql[name];
  ensure(manifest.sourceBookends?.stable===true&&equal(manifest.sourceBookends.before,manifest.sourceBookends.after)&&manifest.runtime?.before&&equal(manifest.runtime.before,manifest.runtime.after),'exporter-source-runtime-bookends');
  ensure(equal(manifest.runtime.before,runtime)&&equal(Object.keys(manifest.sourceBookends.before).sort(),['executedSql','exporter','modelSource','sqlSource']),'exporter-source-membership');
  for(const [key,expected]of [['exporter',sources.originalExporter],['modelSource',sources.model],['sqlSource',sources[name+'SQL']]])ensure(equal(manifest.sourceBookends.before[key],expected),'exporter-wrapper-source-join');
  ensure(manifest.status === 'success' && manifest.authoredFixture === false && manifest.officialProcessor === true && manifest.platform === `${process.platform}-${process.arch}` && manifest.queryPolicy === sqlPolicy.policy && manifest.expectedVersion === model.importer.versionText && manifest.observedVersion.trim() === model.importer.versionText && PROCESSOR_PINS[manifest.platform] === config.processor.sha256, 'official-runner-evidence');
  ensure(manifest.rawRowsExported===false&&manifest.compactWholeGraph===true&&manifest.capacityProfile==='whole-graph-capacity-v3'&&manifest.wireFormat==='compact-v2','compact-whole-graph-export');
  ensure(manifest.fps === null && manifest.nativeSupported === false && manifest.captureQualified === false && manifest.evaluationEligibility === false && manifest.scoringEligibility === false && manifest.rankingEligibility === false, 'runner-boundaries');
  ensure(equal(manifest.expected, { trace: config.trace, processor: config.processor }) && equal(manifest.phases, [config.phaseNames.start, config.phaseNames.end]), 'runner-input-evidence');
  ensure(equal(manifest.before, manifest.after) && manifest.before?.trace && manifest.before?.processor, 'runner-input-bookends');
  for (const [role, limit] of [['trace', 33554432], ['processor', 67108864]]) {
    const original = manifest.before[role]; ensure(original.path === config[role].path && original.sha256 === config[role].sha256 && (role !== 'trace' || original.bytes === config.trace.bytes), 'runner-input-identity');
    await snapshot(original.path, limit, check, original, false);
  }
  const literals = [config.phaseNames.start, config.phaseNames.end].map(p => `'${p.replaceAll("'", "''")}'`).join(', ');
  const source = await snapshot(join(BASE, sqlPolicy.path), 16384, check, sources[name + 'SQL']);
  const sql = Buffer.from(new TextDecoder('utf-8', { fatal: true }).decode(source.contents).replace('__PHASE_LITERALS__', literals));
  ensure(equal(manifest.sql, { path: join(dir, 'diagnostic.sql'), sha256: hash(sql), sourceSha256: sqlPolicy.sha256 }), 'executed-sql-evidence');
  const files = {};const expectedFiles={sql:join(dir,'diagnostic.sql'),'version.stdout':join(dir,'version.stdout'),'version.stderr':join(dir,'version.stderr'),'query.stdout':join(dir,'query.stdout'),'query.stderr':join(dir,'query.stderr'),manifest:join(dir,'manifest.json')};ensure(owned.files&&equal(Object.keys(owned.files).sort(),Object.keys(expectedFiles).sort()),'original-exporter-files');for(const[name,path]of Object.entries(expectedFiles))ensure(owned.files[name].path===path,'original-exporter-path');
  files.sql = (await snapshot(manifest.sql.path, 16384, check, owned.files.sql)).observed;ensure(files.sql.bytes===sql.length&&files.sql.sha256===hash(sql),'original-executed-sql');
  ensure(equal(manifest.sourceBookends.before.executedSql,files.sql),'exporter-executed-source-join');
  let csv;
  for (const [processName, args] of [['version', ['--version']], ['query', ['query', '-f', manifest.sql.path, config.trace.path]]]) {
    const r = manifest.processes[processName]; validateProcess(r, args, processName, config.deadlineMs);
    for (const stream of ['stdout', 'stderr']) { const f = await snapshot(join(dir, `${processName}.${stream}`), stream === 'stdout' ? (processName==='query'?2097152:262144) : 65536, check, owned.files[`${processName}.${stream}`]);ensure(f.observed.bytes===r.streams[stream].bytes&&f.observed.sha256===r.streams[stream].sha256,'original-process-file'); files[processName + '.' + stream] = f.observed; if (processName === 'query' && stream === 'stdout') csv = f.contents; if (processName === 'version' && stream === 'stdout') ensure(f.contents.toString('utf8').trim() === EXPECTED_VERSION, 'version-evidence'); }
  }
  const mf = await snapshot(join(dir, 'manifest.json'), 262144, check,owned.files.manifest);
  ensure(equal(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(mf.contents)),manifest),'manifest-file-evidence'); files.manifest = mf.observed;
  await verifyFeedbackCapacityExportV3(original);check();return { csv, original, evidence: { originalReturnedManifest: manifest, files } };
}
async function recheckFiles(evidence, check) {
  for (const [name,x] of Object.entries(evidence.files)) await snapshot(x.path,name==='query.stdout'?2097152:name==='sql'?16384:name.endsWith('.stderr')?65536:262144,check,x,false);
}

// Production composition only accepts canonical primitive JSON. No supplied
// manifest, callback, replacement runner or promotion function enters this path.
export async function runBrowserPresentationFeedbackObservationsCapacityV3(configJSON) {
  let config; try { config = configOf(configJSON); } catch { return refused('config', 'invalid-config'); }
  const started = performance.now(); const check = () => ensure(performance.now() - started < 240000, 'elapsed-budget-exceeded');
  let roles; let stage = 'output'; const evidence = { sourceBookendsMeaning: 'persisted-files-only', sourceExecutionAssumption: 'fresh-trusted-process-reviewed-modules', executedSQLAssurance: 'fixed-source-render-and-post-run-readback', inQuerySQLBookends: false, localExecutionAssumption: 'fresh-trusted-process-no-concurrent-local-mutation', browserSourceCorrespondence: 'vendor-assumed', runtime: { version: process.version, versions: { ...process.versions }, platform: process.platform, arch: process.arch }, executions: {} };
  try {
    await mkdir(config.out, { mode: 0o700 }); check(); stage = 'source';
    const modelFile = await snapshot(join(BASE, 'feedback-observations-capacity-source-model-v3.json'), 262144, check,{bytes:15907,sha256:MODEL_HASH});
    const model = JSON.parse(modelFile.contents.toString('utf8'));
    ensure(model.schema === SCHEMA && model.capacityProfile==='whole-graph-capacity-v3' && model.wireFormat==='compact-v2' && model.importer.versionText === EXPECTED_VERSION && equal(model.importer.processorPins, PROCESSOR_PINS), 'source-model');
    ensure(model.sql.target.path==='feedback-target-compact-v2.sql'&&model.sql.scope.path==='feedback-scope-compact-v2.sql'&&model.sql.target.policy==='target-feedback-compact-v2'&&model.sql.scope.policy==='scope-feedback-compact-v2','source-policy');
    roles = { wrapper: { path: fileURLToPath(import.meta.url) }, core: { path: join(BASE, 'feedback-observations-capacity-core-v3.mjs'),expected:{sha256:CORE_HASH} }, model: { path: modelFile.observed.path, expected: modelFile.observed }, originalExporter: { path: join(BASE, 'feedback-observations-capacity-export-v3.mjs') }, targetSQL: { path: join(BASE, model.sql.target.path), expected: model.sql.target }, scopeSQL: { path: join(BASE, model.sql.scope.path), expected: model.sql.scope } };
    evidence.sourcesBefore = await sourceBookend(roles, check);
    evidence.runtime.before = (await snapshot(process.execPath, 268435456, check, null, false)).observed;
    const admitted = {};
    for (const [name, runner] of [['target', runTargetFeedbackCapacityExportV3], ['scope', runScopeFeedbackCapacityExportV3]]) {
      stage = name; check(); const deadlineMs = Math.min(config.deadlineMs, Math.floor((240000 - (performance.now() - started)) / 2)); ensure(deadlineMs >= 1, 'elapsed-budget-exceeded');
      // Await the unchanged original runner through all child and pipe closures.
      const original = await runner({schema:SCHEMA,capacityProfile:'whole-graph-capacity-v3',wireFormat:'compact-v2', trace: config.trace, processor: config.processor, phases: [config.phaseNames.start, config.phaseNames.end], out: join(config.out, name), deadlineMs });
      evidence.executions[name] = { originalReturnedManifest: original }; check();
      ensure(original.status === 'success', name + '-runner-refused');
      admitted[name] = await admit(original, name, config, model, evidence.sourcesBefore, check,evidence.runtime.before); evidence.executions[name] = admitted[name].evidence;
    }
    ensure(admitted.target.csv.length+admitted.scope.csv.length<=4194304,'paired-csv-capacity');
    stage = 'core'; check();
    const { evaluateBrowserFeedbackObservationsCapacityV3 } = await import('./feedback-observations-capacity-core-v3.mjs');
    const result = evaluateBrowserFeedbackObservationsCapacityV3(admitted.target.csv, admitted.scope.csv, JSON.stringify({ target: config.target, phaseNames: config.phaseNames })); check();
    const bookends = async () => {
      for (const role of ['trace', 'processor']) await snapshot(config[role].path, role === 'trace' ? 33554432 : 67108864, check, admitted.target.evidence.originalReturnedManifest.before[role], false);
      for (const name of ['target', 'scope']) {await verifyFeedbackCapacityExportV3(admitted[name].original);check();await recheckFiles(admitted[name].evidence, check);}
      evidence.sourcesAfter = await sourceBookend(roles, check); ensure(equal(evidence.sourcesBefore, evidence.sourcesAfter), 'source-bookend-mismatch');
      evidence.runtime.after = (await snapshot(process.execPath, 268435456, check, evidence.runtime.before, false)).observed; check();
    };
    stage = 'custody'; await bookends();
    ensure(result?.schema===SCHEMA&&result.capacityProfile==='whole-graph-capacity-v3'&&result.wireFormat==='compact-v2','core-profile');
    if (result?.status === 'unavailable') {
      return { status: 'unavailable', stage: 'core', reason: result.reason, publication: null, observation: { ...result, evidence } };
    }
    ensure(result?.status === 'observed', 'core-refused');
    const observation = { ...result, executionEvidence: 'source-owned-official-run', inputOrigin: 'verified-generated-official-compact-csv', traceOrigin: 'caller-supplied-persisted-trace', clockContract: model.importer.clockContract, sourceBookendsMeaning: evidence.sourceBookendsMeaning, sourceExecutionAssumption: evidence.sourceExecutionAssumption, executedSQLAssurance: evidence.executedSQLAssurance, inQuerySQLBookends: false, localExecutionAssumption: evidence.localExecutionAssumption, browserSourceCorrespondence: 'vendor-assumed', fps: null, exhaustivePopulation: false, nativeSupported: false, captureQualified: false, evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false, evidence };
    stage = 'publication'; check();
    // This is a provisional snapshot. Only the separately returned receipt seals
    // completion; the file cannot attest its own publication or contain its hash.
    const payload = boundedJSON({ schema: SCHEMA, capacityProfile:'whole-graph-capacity-v3',wireFormat:'compact-v2', publicationState: 'provisional-snapshot-requires-original-returned-receipt', observation }, model.limits);
    const path = join(config.out, 'result.json'); const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    let writtenIdentity;
    try { let offset = 0; while (offset < payload.length) { check(); const n = (await handle.write(payload, offset, payload.length - offset, offset)).bytesWritten; ensure(n > 0, 'publication-write'); offset += n; } await handle.sync(); writtenIdentity = identity(await handle.stat({ bigint: true })); check(); } finally { await handle.close(); check(); }
    const publication = { path, bytes: payload.length, sha256: hash(payload) };
    await snapshot(path, model.limits.resultBytes, check, { ...publication, identity: writtenIdentity }, false);
    await bookends(); await snapshot(path, model.limits.resultBytes, check, { ...publication, identity: writtenIdentity }, false); check();
    check();return { status: 'observed', stage: null, reason: null, publication, observation };
  } catch (error) {
    // A late failure withdraws all numerical fields. Preserve owned failure
    // artifacts and caller replacements; no cleanup ever unlinks their data.
    let reason = typeof error?.message === 'string' && /^[a-z][a-z0-9-]{0,95}$/.test(error.message) ? error.message : 'operation-failed';
    if (roles && evidence.sourcesBefore) {
      try {
        evidence.sourcesAfter = await sourceBookend(roles, check);
        ensure(equal(evidence.sourcesBefore, evidence.sourcesAfter), 'source-bookend-mismatch');
        if (evidence.runtime.before) evidence.runtime.after = (await snapshot(process.execPath, 268435456, check, evidence.runtime.before, false)).observed;
      } catch (custodyError) { stage = 'custody'; reason = 'late-source-or-runtime-custody'; evidence.failureBookendError = typeof custodyError?.message === 'string' && /^[a-z-]{1,96}$/.test(custodyError.message) ? custodyError.message : 'bookend-failed'; }
    }
    return refused(stage, reason, evidence);
  }
}

// Importing this module performs no I/O or process execution.
if (import.meta.main === true) {
  try {
    const args = process.argv.slice(2); ensure(args.length === 2 && args[0] === '--config' && pathOK(args[1]), 'usage: --config /absolute/config.json');
    const started = performance.now(); const check = () => ensure(performance.now() - started < 240000, 'elapsed-budget-exceeded');
    const config = await snapshot(args[1], 16384, check); const raw = new TextDecoder('utf-8', { fatal: true }).decode(config.contents); configOf(raw);
    const result = await runBrowserPresentationFeedbackObservationsCapacityV3(raw);
    // Config custody remains required through completion, too.
    try { await snapshot(args[1], 16384, check, config.observed, false); } catch { const failure = refused('config', 'config-custody'); process.stdout.write(`${JSON.stringify({ status: failure.status, stage: failure.stage, reason: failure.reason, fps: null, publication: null })}\n`); process.exitCode = 1; }
    if (!process.exitCode) { process.stdout.write(`${JSON.stringify({ status: result.status, stage: result.stage, reason: result.reason, fps: null, publication: result.publication })}\n`); if (result.status !== 'observed') process.exitCode = 1; }
  } catch { process.stderr.write('feedback observations config or execution refused\n'); process.exitCode = 1; }
}
