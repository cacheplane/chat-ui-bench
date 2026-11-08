import path from 'node:path';
import {pathToFileURL} from 'node:url';
// Stable named legacy entry points; authority is bound in the private engine.
import {admitSharedSignalsCaseV1 as admitLocalSharedSignalsCaseV1,decideSharedSignalsBenefitV1 as decideLocalSharedSignalsBenefitV1,runSharedSignalsInvocationV1 as runAimockLocalSharedSignalsInvocationV1} from '../threadplane-local-experiments/coordinator-engine-v1.mjs';
export {admitLocalSharedSignalsCaseV1,decideLocalSharedSignalsBenefitV1,runAimockLocalSharedSignalsInvocationV1};
import {SEMANTIC_LARGE_FLAGS_V3 as FLAGS} from './four-profile-stock036-large-v3.mjs';
const reason=e=>String(e?.message??e).slice(0,2048);
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)runAimockLocalSharedSignalsInvocationV1(process.argv.slice(2)).then(v=>{console.log(JSON.stringify({schema:v.schema,status:v.status,complete:v.complete,attempted:v.attempted,decision:v.decision.decision,eligible:v.decision.eligible,finalPublication:v.finalPublication,...FLAGS}));if(!v.complete)process.exitCode=1;},e=>{console.error(JSON.stringify(e.localSharedSignalsDiagnostic??{schema:'threadplane-local-shared-signals-terminal-failure-v1',failure:reason(e),unsafeOutstanding:e?.unsafeOutstanding===true,...FLAGS}));process.exitCode=1;});
