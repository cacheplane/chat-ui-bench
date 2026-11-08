import path from 'node:path';
import {pathToFileURL} from 'node:url';
// Closed named owned-markdown entry points; authority is bound in the private engine.
import {admitOwnedMarkdownCaseV2 as admitLocalOwnedMarkdownCaseV2,decideOwnedMarkdownBenefitV2 as decideLocalOwnedMarkdownBenefitV2,runOwnedMarkdownInvocationV2 as runAimockLocalOwnedMarkdownInvocationV2} from '../threadplane-local-experiments/coordinator-engine-v1.mjs';
export {admitLocalOwnedMarkdownCaseV2,decideLocalOwnedMarkdownBenefitV2,runAimockLocalOwnedMarkdownInvocationV2};
import {SEMANTIC_LARGE_FLAGS_V3 as FLAGS} from './four-profile-stock036-large-v3.mjs';
const reason=e=>String(e?.message??e).slice(0,2048);
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)runAimockLocalOwnedMarkdownInvocationV2(process.argv.slice(2)).then(v=>{console.log(JSON.stringify({schema:v.schema,status:v.status,complete:v.complete,attempted:v.attempted,decision:v.decision.decision,eligible:v.decision.eligible,finalPublication:v.finalPublication,...FLAGS}));if(!v.complete)process.exitCode=1;},e=>{console.error(JSON.stringify(e.localOwnedMarkdownDiagnosticV2??{schema:'threadplane-local-owned-markdown-terminal-failure-v2',failure:reason(e),unsafeOutstanding:e?.unsafeOutstanding===true,...FLAGS}));process.exitCode=1;});
