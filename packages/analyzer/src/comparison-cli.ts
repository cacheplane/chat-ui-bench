import {isAbsolute, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {publishComparisonReport} from './comparison-report-files.js';
import {comparisonReportErrorCategory} from './comparison-report.js';

export function parseComparisonReportArgs(args: readonly string[]): {input: string; output: string} {
  if (args.length !== 4 || args[0] !== '--artifact-dir' || args[2] !== '--out' || !args[1] || !args[3]) throw new Error('Usage: bench:analyze:comparison --artifact-dir ABSOLUTE_ORIGINAL --out ABSOLUTE_NEW_EXTERNAL_DIRECTORY');
  if (!isAbsolute(args[1]) || !isAbsolute(args[3])) throw new Error('Comparison report requires absolute original/output paths');
  return {input: args[1], output: args[3]};
}

async function writeReceipt(stream: NodeJS.WriteStream, value: unknown) {
  const encoded = JSON.stringify(value) + '\n';
  if (Buffer.byteLength(encoded) > 65536) throw new Error('Comparison report terminal receipt exceeds64KiB');
  await new Promise<void>((resolve, reject) => {
    const onError = (error: unknown) => reject(error); stream.once('error', onError);
    stream.write(encoded, error => {stream.removeListener('error', onError); if (error !== undefined && error !== null) reject(error); else resolve();});
  });
}

export async function runComparisonReportCli(args: readonly string[]): Promise<number> {
  const paths = parseComparisonReportArgs(args);
  const receipt = await publishComparisonReport(paths.input, paths.output);
  await writeReceipt(process.stdout, receipt);
  // The maintained loader has only partial/unavailable collection variants.
  // Complete publication does not turn this unfinished scientific scope green.
  return 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {process.exitCode = await runComparisonReportCli(process.argv.slice(2));}
  catch (error) {
    process.exitCode = 2;
    await writeReceipt(process.stderr, {publicationStatus: 'failed', scoringEligibility: false, error: comparisonReportErrorCategory(error)});
  }
}
