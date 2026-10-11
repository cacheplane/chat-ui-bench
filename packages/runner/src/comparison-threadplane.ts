import {comparisonAdapterSchema, type ComparisonAdapter} from '@chat-ui-bench/contract';
import {requireComparisonProvenanceSession, type ComparisonProvenanceSession} from './comparison-provenance.js';

// Complete-file identities of the reviewed single supported configuration.
// These are declarations/configuration evidence, not browser measurements.
const knownConfiguration = {
  'apps/threadplane/src/app.ts': '9f9680c921700d764c4a5cd312efa12cbbc4940f7c91ef3b34d06fc75017101a',
  'apps/threadplane/src/main.ts': 'bf34029550f938e42df33b7323cd11b3db039d9297c85191596404152a4d61fa',
  'apps/threadplane/src/host.ts': 'd912408fbdd96712ecf638d0c28e25c64cf9cff3526460d43804278081e07c17',
  'apps/threadplane/angular.json': '2f44e3bbf0d34dbf3c5c9f467d7bee638cca7c4c832d91f1448d2745fbc14838',
  'apps/threadplane/src/index.html': 'bdf214c931d38b277ffcfb32f17661db891a4f6219645739334b949331b4a05a',
  'apps/threadplane/src/styles.css': '0b92bab5449a23801ce5e8657b34d94c929682ea9b73f50f01a00443b9139d2b',
} as const;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Missing Threadplane metadata');
  return value as Record<string, unknown>;
}
/** Resolve only after genuine acquisition, repeating original facts and reads. */
export async function resolveComparisonThreadplaneProfile(session: ComparisonProvenanceSession): Promise<ComparisonAdapter> {
  const authority = requireComparisonProvenanceSession(session);
  if (authority.descriptor.adapterProfile !== 'threadplane-langgraph-custom-transport') throw new Error('Unsupported Threadplane profile');
  const {build} = await authority.recheck(); authority.lifecycle.assertActive();
  if (build.framework.name !== 'Angular' || build.framework.version !== '21.2.25' || build.settings.optimization !== true || build.settings.sourceMaps !== false) throw new Error('Unsupported Threadplane framework/settings');
  for (const [key, expected] of Object.entries(knownConfiguration)) {
    const current = await authority.read(key); authority.lifecycle.assertActive();
    if (current.sha256 !== expected || build.sourceHashes[key] !== expected) throw new Error('Unknown Threadplane configuration');
  }
  const chat = build.packages.find(row => row.name === '@threadplane/chat');
  if (!chat || chat.version !== '0.3.2' || !chat.resolutionPath) throw new Error('Unsupported genuine Threadplane chat package');
  const metadata = object(JSON.parse((await authority.read(`${chat.resolutionPath}/package.json`)).bytes.toString('utf8')));
  const app = object(JSON.parse((await authority.read('apps/threadplane/package.json')).bytes.toString('utf8')));
  const lock = object(JSON.parse((await authority.read('package-lock.json')).bytes.toString('utf8')));
  const row = object(object(lock.packages)[chat.resolutionPath]);
  if (metadata.name !== '@threadplane/chat' || metadata.version !== '0.3.2' || object(app.dependencies)['@threadplane/chat'] !== '0.3.2' || row.version !== '0.3.2' || row.integrity !== chat.integrity) throw new Error('Threadplane physical pin/lock differs');
  authority.lifecycle.assertActive();
  return comparisonAdapterSchema.parse({id: 'threadplane', profile: 'threadplane-langgraph-custom-transport', capabilities: {rendering: 'all-mounted', scrollPolicy: 'bottom-follow', returnToResponse: 'native-control'}, build: structuredClone(build), configuration: {markdown: 'default', pinThresholdCssPx: 150, telemetry: 'disabled'}});
}
export async function recheckComparisonThreadplaneProfile(session: ComparisonProvenanceSession): Promise<ComparisonAdapter> {
  return resolveComparisonThreadplaneProfile(session);
}
