import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {derivePostfixSelectionV1 as deriveLocalPostfixSelectionV1,selectPostfixV1 as selectLocalPostfixDependenciesV1} from '../threadplane-local-experiments/selection-engine-v1.mjs';
export {deriveLocalPostfixSelectionV1,selectLocalPostfixDependenciesV1};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(await selectLocalPostfixDependenciesV1(process.argv.slice(2))));}catch(error){console.error(String(error?.message??error));process.exitCode=1;}}
