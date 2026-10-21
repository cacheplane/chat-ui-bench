// Source-only A entry. The real worker is not installed or released.
import {createLongThreadFixture} from '../../packages/contract/dist/index.js';
import {compileCanonicalHistoryRestoreFixture} from '../../tests/fixtures/aimock.ts';
import {projectCompiledHistory} from './source-model.mjs';
export function compileSourceFixture(){
 const source=createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:'history-reading'});
 const identity={threadId:'native-chat-source-A',runId:'native-chat-source-A',epochMs:0};
 const compiled=compileCanonicalHistoryRestoreFixture(source,identity);
 return projectCompiledHistory(source,compiled,identity);
}
