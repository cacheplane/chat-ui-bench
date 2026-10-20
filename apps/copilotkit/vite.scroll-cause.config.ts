import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createScrollCauseViteConfiguration} from '../../tests/support/hosted-copilot-scroll-cause-build.ts';
const workspace=process.env.SCROLL_CAUSE_BUILD_WORKSPACE;
if(!workspace)throw Error('diagnostic-build-workspace-required');
export default createScrollCauseViteConfiguration(resolve(fileURLToPath(new URL('../..',import.meta.url))),workspace);
