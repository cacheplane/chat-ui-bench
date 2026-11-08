import path from 'node:path';
import {fileURLToPath} from 'node:url';
// Closed named owned-markdown entry points; authority is bound in the private engine.
import {deriveOwnedMarkdownSelectionV2 as deriveLocalOwnedMarkdownSelectionV2,selectOwnedMarkdownV2 as selectLocalOwnedMarkdownDependenciesV2} from '../threadplane-local-experiments/selection-engine-v1.mjs';
export {deriveLocalOwnedMarkdownSelectionV2,selectLocalOwnedMarkdownDependenciesV2};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(await selectLocalOwnedMarkdownDependenciesV2(process.argv.slice(2))));}catch(error){console.error(String(error?.message??error));process.exitCode=1;}}
