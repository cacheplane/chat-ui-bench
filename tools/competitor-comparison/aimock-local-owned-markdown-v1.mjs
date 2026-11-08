import path from 'node:path';
import {pathToFileURL} from 'node:url';
// Closed named owned-markdown entry points; authority is bound in the private engine.
import {admitOwnedMarkdownCaseV1 as admitLocalOwnedMarkdownCaseV1,decideOwnedMarkdownBenefitV1 as decideLocalOwnedMarkdownBenefitV1,runOwnedMarkdownInvocationV1 as runAimockLocalOwnedMarkdownInvocationV1} from '../threadplane-local-experiments/coordinator-engine-v1.mjs';
export {admitLocalOwnedMarkdownCaseV1,decideLocalOwnedMarkdownBenefitV1,runAimockLocalOwnedMarkdownInvocationV1};
import {SEMANTIC_LARGE_FLAGS_V3 as FLAGS} from './four-profile-stock036-large-v3.mjs';
const reason=e=>String(e?.message??e).slice(0,2048);
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)runAimockLocalOwnedMarkdownInvocationV1(process.argv.slice(2)).then(v=>{console.log(JSON.stringify({schema:v.schema,status:v.status,complete:v.complete,attempted:v.attempted,decision:v.decision.decision,eligible:v.decision.eligible,finalPublication:v.finalPublication,...FLAGS}));if(!v.complete)process.exitCode=1;},e=>{console.error(JSON.stringify(e.localOwnedMarkdownDiagnostic??{schema:'threadplane-local-owned-markdown-terminal-failure-v1',failure:reason(e),unsafeOutstanding:e?.unsafeOutstanding===true,...FLAGS}));process.exitCode=1;});
