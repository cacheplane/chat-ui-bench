// Separate unqualified diagnostic. No SDK, browser or provider at entry load.
import {runScrollCauseAction} from '../tests/support/hosted-copilot-scroll-cause-launch.ts';
try {
 if(process.argv.length!==3)throw null;
 await runScrollCauseAction(process.argv[2]);
} catch {
 // Derived outward metadata uses a fixed code, never foreign Error getters.
 process.stderr.write('scroll-cause-diagnostic-refused\n');
 process.exitCode=1;
}
