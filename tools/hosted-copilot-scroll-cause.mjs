// Separate unqualified diagnostic. No SDK, browser or provider at entry load.
import {runScrollCauseAction} from '../tests/support/hosted-copilot-scroll-cause-launch.ts';
import {diagnosticRefusalLine,isDiagnosticAction} from '../tests/support/hosted-copilot-scroll-cause-refusal.ts';
const action=process.argv.length===3&&isDiagnosticAction(process.argv[2])?process.argv[2]:null;
try {
 if(action===null)throw null;
 await runScrollCauseAction(action);
} catch (error) {
 // Derived outward metadata uses a fixed code, never foreign Error getters.
 process.stderr.write(action!==null?diagnosticRefusalLine(error,action):'scroll-cause-diagnostic-refused\n');
 process.exitCode=1;
}
