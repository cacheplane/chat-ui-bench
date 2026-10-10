import { analyzeInvocation } from '../packages/analyzer/dist/report.js';
import { argumentsFor, artifactDirectory, inventory, assertEqual } from './artifact-checks.mjs';

try {
  const args = argumentsFor(process.argv.slice(2), ['--artifact-dir']);
  const directory = await artifactDirectory(args['--artifact-dir']);
  const raw = await inventory(directory, 'raw');
  let first;
  for (let pass = 1; pass <= 2; pass++) {
    let analysisError;
    try { await analyzeInvocation(directory); } catch (error) { analysisError = error; }
    assertEqual(await inventory(directory, 'raw'), raw, `Raw inventory after analysis ${pass}`);
    if (analysisError) throw new Error(`Analysis rejected input; raw unchanged: ${analysisError.message}`);
    const derived = await inventory(directory, 'derived');
    if (pass === 1) first = derived;
    else assertEqual(derived, first, 'Derived metrics/summaries across two analyses');
  }
  console.log(`PASS: ${Object.keys(raw).length} raw files unchanged; all derived metrics and summaries deterministic across two analyses`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
