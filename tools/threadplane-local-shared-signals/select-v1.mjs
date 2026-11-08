import path from 'node:path';
import {fileURLToPath} from 'node:url';
// Stable named legacy entry points; authority is bound in the private engine.
import {deriveSharedSignalsSelectionV1 as deriveLocalSharedSignalsSelectionV1,selectSharedSignalsV1 as selectLocalSharedSignalsDependenciesV1} from '../threadplane-local-experiments/selection-engine-v1.mjs';
export {deriveLocalSharedSignalsSelectionV1,selectLocalSharedSignalsDependenciesV1};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(await selectLocalSharedSignalsDependenciesV1(process.argv.slice(2))));}catch(error){console.error(String(error?.message??error));process.exitCode=1;}}
