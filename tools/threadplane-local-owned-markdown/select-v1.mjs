import path from 'node:path';
import {fileURLToPath} from 'node:url';
// Closed named owned-markdown entry points; authority is bound in the private engine.
import {deriveOwnedMarkdownSelectionV1 as deriveLocalOwnedMarkdownSelectionV1,selectOwnedMarkdownV1 as selectLocalOwnedMarkdownDependenciesV1} from '../threadplane-local-experiments/selection-engine-v1.mjs';
export {deriveLocalOwnedMarkdownSelectionV1,selectLocalOwnedMarkdownDependenciesV1};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(await selectLocalOwnedMarkdownDependenciesV1(process.argv.slice(2))));}catch(error){console.error(String(error?.message??error));process.exitCode=1;}}
