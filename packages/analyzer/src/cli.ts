import { analyzeInvocation } from "./report.js";
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--artifact-dir" || !args[1])
  throw new Error("Usage: bench:analyze --artifact-dir directory");
const result = await analyzeInvocation(args[1]);
console.log(
  `${result.directory}\nAnalysis: ${result.status}; ${result.runs.length} repetitions. See summary.md and metrics.json.`,
);
if (result.status === "failed") process.exitCode = 1;
