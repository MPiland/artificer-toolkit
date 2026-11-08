import { describe, expect, it } from 'vitest'
import {
  SMOKE_BOUNDS,
  SSR_CPU_LIMITS,
  evaluateSsrCpu,
  parseSmokeArguments,
  percentile,
  resolveSmokeTarget
} from './managedSmokePolicy.mjs'

const environment = {
  CONVEX_URL: 'https://happy-otter-123.convex.cloud',
  CONVEX_SITE_URL: 'https://happy-otter-123.convex.site',
  REVIEW_MANAGED_CONFIRM: 'happy-otter-123',
  REVIEW_MANAGED_ADMIN_KEY: 'admin-key-for-test',
  REVIEW_MAILBOX: 'smoke@example.com'
}
const webOrigin = 'https://staging.example.com'

describe('managed smoke target (defaults to nothing)', () => {
  it('accepts an explicit staging target and applies the bounded defaults', () => {
    expect(resolveSmokeTarget({ webOrigin }, environment)).toEqual({
      webOrigin,
      convexSlug: 'happy-otter-123',
      rounds: 1,
      idleMinutes: SMOKE_BOUNDS.minIdleMinutes
    })
  })

  it.each([
    ['no web origin', { webOrigin: undefined }, {}],
    ['an http origin', { webOrigin: 'http://staging.example.com' }, {}],
    ['an origin with a path', { webOrigin: 'https://staging.example.com/home' }, {}],
    ['a trailing slash', { webOrigin: 'https://staging.example.com/' }, {}],
    ['a loopback host', { webOrigin: 'https://127.0.0.1' }, {}],
    ['localhost', { webOrigin: 'https://localhost' }, {}],
    ['a Convex host as the web origin', { webOrigin: 'https://happy-otter-123.convex.site' }, {}],
    ['a missing admin key', {}, { REVIEW_MANAGED_ADMIN_KEY: undefined }],
    ['a missing mailbox', {}, { REVIEW_MAILBOX: undefined }],
    ['a deployment confirmation that differs', {}, { REVIEW_MANAGED_CONFIRM: 'other-deployment' }],
    ['a site URL of another deployment', {}, { CONVEX_SITE_URL: 'https://other-1.convex.site' }],
    ['a non-cloud Convex URL', {}, { CONVEX_URL: 'https://convex.example.com' }],
    ['a deploy key in the environment', {}, { CONVEX_DEPLOY_KEY: 'x' }],
    [
      'a self-hosted target in the environment',
      {},
      { CONVEX_SELF_HOSTED_URL: 'http://127.0.0.1:3210' }
    ],
    ['too many rounds', { rounds: SMOKE_BOUNDS.maxRounds + 1 }, {}],
    ['zero rounds', { rounds: 0 }, {}],
    ['an idle gap below the minimum', { idleMinutes: SMOKE_BOUNDS.minIdleMinutes - 1 }, {}],
    ['an idle gap above the maximum', { idleMinutes: SMOKE_BOUNDS.maxIdleMinutes + 1 }, {}]
  ])('refuses %s', (_name, input, environmentChange) => {
    expect(() =>
      resolveSmokeTarget({ webOrigin, ...input }, { ...environment, ...environmentChange })
    ).toThrow()
  })
})

describe('managed smoke arguments', () => {
  it('parses run and evaluate options', () => {
    expect(
      parseSmokeArguments(['run', '--web-origin=https://a.example.com', '--rounds=2'])
    ).toEqual({
      command: 'run',
      options: { 'web-origin': 'https://a.example.com', rounds: '2' }
    })
    expect(parseSmokeArguments(['evaluate', '--requests=a.json', '--cpu=b.json']).command).toBe(
      'evaluate'
    )
  })

  it.each([
    [[]],
    [['deploy']],
    [['run', '--web-origin']],
    [['run', '--cpu=x']],
    [['evaluate', '--rounds=2']]
  ])('refuses %j', (argv) => {
    expect(() => parseSmokeArguments(argv)).toThrow()
  })
})

const request = (index, overrides = {}) => ({
  path: `/page-${index}`,
  round: 0,
  cold: index === 0,
  status: 200,
  cacheControl: 'private, no-store',
  cfRay: `ray-${index}`,
  ...overrides
})
const row = (index, cpuTimeMs, outcome = 'ok') => ({ cfRay: `ray-${index}`, cpuTimeMs, outcome })

describe('signed-in SSR CPU verdict (C2, D75)', () => {
  it('passes when p75 and every request, cold included, are within the limit', () => {
    const verdict = evaluateSsrCpu({
      requests: [0, 1, 2, 3].map((index) => request(index)),
      cpuRows: [row(0, 9), row(1, 4), row(2, 5), row(3, 3)],
      cleanup: 'deleted'
    })
    expect(verdict.violations).toEqual([])
    expect(verdict.figures).toMatchObject({ p75Ms: 5, maxMs: 9, coldRequests: 1, coldMaxMs: 9 })
  })

  it('fails a cold request over the per-invocation limit', () => {
    const verdict = evaluateSsrCpu({
      requests: [0, 1].map((index) => request(index)),
      cpuRows: [row(0, SSR_CPU_LIMITS.requestMs + 1), row(1, 2)],
      cleanup: 'deleted'
    })
    expect(verdict.pass).toBe(false)
    expect(verdict.violations.join()).toContain('on a cold isolate')
  })

  it('fails when p75 is over the limit even if no request is over', () => {
    const verdict = evaluateSsrCpu({
      requests: [0, 1, 2, 3].map((index) => request(index)),
      cpuRows: [row(0, 1), row(1, 10), row(2, 10), row(3, 10)],
      cleanup: 'deleted'
    })
    expect(verdict.violations.join()).not.toContain('p75')
    const over = evaluateSsrCpu({
      requests: [0, 1, 2, 3].map((index) => request(index)),
      cpuRows: [row(0, 11), row(1, 11), row(2, 11), row(3, 1)],
      cleanup: 'deleted'
    })
    expect(over.violations.some((entry) => entry.startsWith('p75'))).toBe(true)
  })

  it('fails an exceeded-CPU outcome, a missing row, a wrong status and an undeleted fixture', () => {
    const verdict = evaluateSsrCpu({
      requests: [0, 1, 2].map((index) => request(index, index === 2 ? { status: 302 } : {})),
      cpuRows: [row(0, 3, 'exceededCpu'), row(2, 3)],
      cleanup: 'unverified'
    })
    expect(verdict.violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('exceededCpu'),
        expect.stringContaining('no CPU row for cf-ray ray-1'),
        expect.stringContaining('answered 302'),
        expect.stringContaining('Fixture cleanup is unverified')
      ])
    )
  })

  it('refuses a measurement with no cold request or no requests', () => {
    expect(
      evaluateSsrCpu({
        requests: [request(0, { cold: false })],
        cpuRows: [row(0, 2)],
        cleanup: 'deleted'
      }).violations
    ).toEqual(['No request is marked cold, so no cold-isolate measurement was taken.'])
    expect(evaluateSsrCpu({ requests: [], cpuRows: [], cleanup: 'deleted' }).pass).toBe(false)
  })

  it('computes nearest-rank percentiles', () => {
    expect(percentile([1, 2, 3, 4], 0.75)).toBe(3)
    expect(percentile([7], 0.75)).toBe(7)
    expect(() => percentile([], 0.75)).toThrow()
  })
})
