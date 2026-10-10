import { runCalibration } from "./index.js";
import { analyzeInvocation } from "@chat-ui-bench/analyzer";
const args = process.argv.slice(2);
let mode: "headed" | "headless" = "headless";
let repetitions = 3;
let out = "artifacts";
for (let index = 0; index < args.length; index++) {
  const flag = args[index];
  const value = args[++index];
  if (flag === "--mode" && (value === "headed" || value === "headless"))
    mode = value;
  else if (
    flag === "--repetitions" &&
    value &&
    Number.isInteger(Number(value)) &&
    Number(value) > 0
  )
    repetitions = Number(value);
  else if (flag === "--out" && value) out = value;
  else
    throw new Error(
      "Usage: bench:calibrate [--mode headless|headed] [--repetitions positive-integer] [--out directory]",
    );
}
const directory = await runCalibration({ mode, repetitions, out });
console.log(directory);
const analysis = await analyzeInvocation(directory);
console.log(`Analysis: ${analysis.status}; see metrics.json and summary.md.`);
if (analysis.status === "failed") process.exitCode = 1;
