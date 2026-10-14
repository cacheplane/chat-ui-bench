/** Source-only Node context adapter. Evaluation performs no I/O or SDK loading. */
import { execFileSync } from 'node:child_process';
import { assertHostedAdmission, deriveReleaseTag } from './hosted-httpagent-contract.ts';
import type { HostedAdmission } from './hosted-httpagent-contract.ts';

export function readHostedAdmission(): Readonly<HostedAdmission> {
  const env = process.env;
  // Validate before using the derived literal tag in the fixed git argv.
  const releaseId = env['HOSTED_RELEASE_ID'] ?? '';
  const tag = deriveReleaseTag(releaseId);
  const resolve = (ref: string): string => execFileSync('git', ['rev-parse', '--verify', ref], {
    encoding: 'utf8', maxBuffer: 1024, timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  return assertHostedAdmission({
    candidateSha: env['HOSTED_CANDIDATE_SHA'] ?? '', checkoutSha: resolve('HEAD'),
    githubSha: env['GITHUB_SHA'] ?? '', workflowSha: env['GITHUB_WORKFLOW_SHA'] ?? '',
    tagResolvedSha: resolve(`refs/tags/${tag}^{commit}`), githubRef: env['GITHUB_REF'] ?? '',
    workflowRef: env['GITHUB_WORKFLOW_REF'] ?? '', repository: env['GITHUB_REPOSITORY'] ?? '',
    eventName: env['GITHUB_EVENT_NAME'] ?? '', actions: env['GITHUB_ACTIONS'] ?? '',
    platform: process.platform, runnerOs: env['RUNNER_OS'] ?? '', runnerMarker: env['HOSTED_RUNNER_MARKER'] ?? '',
    releaseId, attempt: env['GITHUB_RUN_ATTEMPT'] ?? '',
  });
}
