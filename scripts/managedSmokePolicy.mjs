// Policy for the bounded managed (staging) smoke and the cold-isolate signed-in SSR CPU
// measurement (RELEASE-3.T1; D75, D80, D210; web-worker-hosting.md gate C2). Pure functions only:
// target refusal, request bounds and the CPU verdict. scripts/managedSmoke.mjs and
// apps/apis/tests/developmentManagedSmokeCli.ts import them, and the unit test imports them too.

// C2 (docs/runbooks/web-worker-hosting.md): p75 SSR CPU at most 10 ms with no "exceeded CPU" errors.
// Workers Free also stops any single invocation at 10 ms, so a request above it is a failure,
// cold or warm (D75 expects signed-in skeleton SSR near the anonymous pages' 2-8 ms).
export const SSR_CPU_LIMITS = { p75Ms: 10, requestMs: 10 }

// The smoke is bounded: at most three rounds, each a sign-in-free walk of the signed-in pages with a
// single disposable account. Every round after the first waits an idle gap so the isolate that served
// the last round is evicted; Cloudflare gives no way to force a cold isolate.
export const SMOKE_BOUNDS = { maxRounds: 3, minIdleMinutes: 5, maxIdleMinutes: 30 }

const FORBIDDEN_ENVIRONMENT = [
  'CONVEX_DEPLOY_KEY',
  'CONVEX_SELF_HOSTED_URL',
  'CONVEX_SELF_HOSTED_ADMIN_KEY'
]
const REQUIRED_ENVIRONMENT = [
  'CONVEX_URL',
  'CONVEX_SITE_URL',
  'REVIEW_MANAGED_CONFIRM',
  'REVIEW_MANAGED_ADMIN_KEY',
  'REVIEW_MAILBOX'
]

/**
 * Validates an explicit staging target and returns it. Nothing defaults: the web origin comes from
 * the operator's argument, the Convex deployment from the environment and named a second time in
 * `REVIEW_MANAGED_CONFIRM`. Throws a reason for the first thing it refuses.
 */
export function resolveSmokeTarget({ webOrigin, rounds, idleMinutes }, environment) {
  if (!webOrigin) throw new Error('--web-origin=<https staging web origin> is required.')
  const origin = parseHttpsOrigin(webOrigin, '--web-origin')
  if (isLoopback(origin.hostname) || origin.hostname.endsWith('.localhost'))
    throw new Error('--web-origin must be the managed staging host, not a local one.')
  if (origin.hostname.endsWith('.convex.cloud') || origin.hostname.endsWith('.convex.site'))
    throw new Error('--web-origin is the web Worker, not a Convex deployment.')

  for (const name of FORBIDDEN_ENVIRONMENT)
    if (environment[name]) throw new Error(`${name} must not be set for a managed target.`)
  for (const name of REQUIRED_ENVIRONMENT)
    if (!environment[name]) throw new Error(`${name} is required.`)

  const deploymentUrl = parseHttpsOrigin(environment.CONVEX_URL, 'CONVEX_URL')
  const siteUrl = parseHttpsOrigin(environment.CONVEX_SITE_URL, 'CONVEX_SITE_URL')
  const slug = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.convex\.cloud$/u.exec(deploymentUrl.hostname)?.[1]
  if (!slug) throw new Error('CONVEX_URL must be a *.convex.cloud deployment.')
  if (siteUrl.hostname !== `${slug}.convex.site`)
    throw new Error('CONVEX_SITE_URL must be the same deployment on *.convex.site.')
  if (environment.REVIEW_MANAGED_CONFIRM !== slug)
    throw new Error('Set REVIEW_MANAGED_CONFIRM to the deployment name to run the managed smoke.')
  if (!/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/u.test(environment.REVIEW_MAILBOX))
    throw new Error('REVIEW_MAILBOX is the throwaway mailbox, for example name@gmail.com.')

  const roundCount = rounds ?? 1
  if (!Number.isInteger(roundCount) || roundCount < 1 || roundCount > SMOKE_BOUNDS.maxRounds)
    throw new Error(`--rounds must be an integer from 1 to ${SMOKE_BOUNDS.maxRounds}.`)
  const idle = idleMinutes ?? SMOKE_BOUNDS.minIdleMinutes
  if (
    !Number.isFinite(idle) ||
    idle < SMOKE_BOUNDS.minIdleMinutes ||
    idle > SMOKE_BOUNDS.maxIdleMinutes
  )
    throw new Error(
      `--idle-minutes must be from ${SMOKE_BOUNDS.minIdleMinutes} to ${SMOKE_BOUNDS.maxIdleMinutes}.`
    )
  return { webOrigin: origin.origin, convexSlug: slug, rounds: roundCount, idleMinutes: idle }
}

function parseHttpsOrigin(value, label) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${label} must be an exact HTTPS origin.`)
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    value.endsWith('/')
  )
    throw new Error(`${label} must be an exact HTTPS origin.`)
  return url
}

function isLoopback(hostname) {
  return hostname === 'localhost' || hostname === '[::1]' || /^127\./u.test(hostname)
}

/** Nearest-rank percentile of a non-empty list. */
export function percentile(values, fraction) {
  if (values.length === 0) throw new Error('A percentile needs at least one value.')
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)]
}

/**
 * Joins the smoke's recorded requests to the CPU rows the operator exported from Workers Logs (by
 * `cf-ray`) and applies the C2 limits. The smoke also fails unless its disposable account was deleted. `cold` marks the first request after a deploy or an idle gap.
 * Returns the violations (empty when the measurement passes) and the figures to record.
 */
export function evaluateSsrCpu({ requests, cpuRows, cleanup }) {
  const violations = []
  if (cleanup !== 'deleted') violations.push(`Fixture cleanup is ${cleanup}, not deleted.`)
  const rowsByRay = new Map()
  for (const row of cpuRows) {
    if (rowsByRay.has(row.cfRay)) violations.push(`Duplicate CPU row for cf-ray ${row.cfRay}.`)
    rowsByRay.set(row.cfRay, row)
  }
  const measured = []
  for (const request of requests) {
    const label = `${request.path} (round ${request.round})`
    if (request.status !== 200 || !/no-store/u.test(request.cacheControl ?? ''))
      violations.push(`${label}: SSR answered ${request.status} instead of a private render.`)
    const row = rowsByRay.get(request.cfRay)
    if (!row) {
      violations.push(`${label}: no CPU row for cf-ray ${request.cfRay}.`)
      continue
    }
    if (row.outcome !== 'ok')
      violations.push(`${label}: the invocation ended ${row.outcome}, not ok.`)
    if (row.cpuTimeMs > SSR_CPU_LIMITS.requestMs)
      violations.push(
        `${label}: ${row.cpuTimeMs} ms CPU exceeds ${SSR_CPU_LIMITS.requestMs} ms${request.cold ? ' on a cold isolate' : ''}.`
      )
    measured.push({ cold: request.cold, cpuTimeMs: row.cpuTimeMs })
  }
  const cold = measured.filter((entry) => entry.cold).map((entry) => entry.cpuTimeMs)
  if (requests.length > 0 && !requests.some((request) => request.cold))
    violations.push('No request is marked cold, so no cold-isolate measurement was taken.')
  const all = measured.map((entry) => entry.cpuTimeMs)
  const p75 = all.length > 0 ? percentile(all, 0.75) : undefined
  if (p75 !== undefined && p75 > SSR_CPU_LIMITS.p75Ms)
    violations.push(`p75 SSR CPU ${p75} ms exceeds ${SSR_CPU_LIMITS.p75Ms} ms.`)
  if (requests.length === 0) violations.push('The smoke recorded no requests.')
  return {
    pass: violations.length === 0,
    violations,
    figures: {
      requests: requests.length,
      measured: all.length,
      p75Ms: p75,
      maxMs: all.length > 0 ? Math.max(...all) : undefined,
      coldRequests: cold.length,
      coldMaxMs: cold.length > 0 ? Math.max(...cold) : undefined
    }
  }
}

/** Parses `run|evaluate` and its `--name=value` options. Unknown options and a missing command refuse. */
export function parseSmokeArguments(argv) {
  const [command, ...rest] = argv
  if (command !== 'run' && command !== 'evaluate')
    throw new Error('Usage: managedSmoke.mjs run|evaluate --name=value ...')
  const options = {}
  for (const argument of rest) {
    const match = /^--([a-z-]+)=(.+)$/u.exec(argument)
    if (!match) throw new Error(`Unrecognised argument ${argument}.`)
    options[match[1]] = match[2]
  }
  const allowed =
    command === 'run'
      ? ['web-origin', 'rounds', 'idle-minutes', 'system-id', 'out']
      : ['requests', 'cpu', 'out']
  for (const name of Object.keys(options))
    if (!allowed.includes(name)) throw new Error(`--${name} is not an option of ${command}.`)
  return { command, options }
}
