// Source-only fixed profile entry. Actual imports and metafile inputs are pinned by preparation.
import {compileSourceFixture as compileHistory100} from './fixture-entry.mjs';
import {compileHistory1000SourceFixtureV1,compileHistory10000SourceFixtureV1,inspectLargeFixtureV1,readLargeFixtureChunkV1} from './large-fixture-source-v1.mjs';
export function compileSourceFixture(profile){
 if(profile==='native-history100-v1')return compileHistory100();
 if(profile==='native-history1000-v1')return compileHistory1000SourceFixtureV1();
 if(profile==='native-history10000-v1')return compileHistory10000SourceFixtureV1();
 throw Error('native-request-window-fixture-profile');
}
export function inspectSourceFixture(fixture,profile){return inspectLargeFixtureV1(fixture,profile);}
export function readSourceFixtureChunk(fixture,profile,index){return readLargeFixtureChunkV1(fixture,profile,index);}
