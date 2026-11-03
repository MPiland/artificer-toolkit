import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import type { FunctionArgs } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { retryRateLimitedAuth } from '../tests/developmentAuthRequest'
import { convexTest } from '../tests/convexTest'
import { reviewScenariosForSet, REVIEW_SCENARIOS } from '../tests/developmentReviewDataScenarios'
import {
  reviewRoster,
  reviewTarget,
  reviewTargetSteps,
  type AdminCall
} from '../tests/developmentReviewTarget'
import { components, internal } from './_generated/api'
import authSchema from './betterAuth/schema'
import schema from './schema'

const managedEnv = {
  CONVEX_URL: 'https://tester-staging-123.convex.cloud',
  CONVEX_SITE_URL: 'https://tester-staging-123.convex.site',
  REVIEW_MANAGED_CONFIRM: 'tester-staging-123',
  REVIEW_MANAGED_ADMIN_KEY: 'managed-admin-key-value',
  REVIEW_WORKER_CONTROL_SECRET: 'worker-control-secret-value',
  REVIEW_MAILBOX: 'mekhit02@gmail.com'
}
const localEnv = {
  CONVEX_DEPLOYMENT: 'local:phase82-local-linux',
  CONVEX_URL: 'http://127.0.0.1:3210',
  CONVEX_SITE_URL: 'http://127.0.0.1:3211'
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.stubEnv('SITE_URL', 'http://localhost:3000')
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3231')
  vi.stubEnv('BETTER_AUTH_SECRET', 'review-target-test-secret-with-sufficient-length')
  vi.stubEnv('PUBLIC_SIGN_UP_ENABLED', 'false')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

// Real auth routes and component adapter on convex-test; only the clock is faked. The admin calls
// are recorded so a test can prove what the managed path sent to the deployment.
function backend() {
  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  registerRateLimiter(t)
  const auth = retryRateLimitedAuth(
    (path, body, session) =>
      t.withRequestMetadata({ ip: '127.0.0.1' }).fetch(`/api/auth${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
          ...(session ? { authorization: `Bearer ${session}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      }),
    async (milliseconds) => void vi.setSystemTime(Date.now() + milliseconds)
  )
  const calls: { name: string; args: Record<string, unknown> }[] = []
  const adminCall: AdminCall = async (name, args) => {
    calls.push({ name, args })
    const adapter = components.betterAuth.adapter
    if (name === 'adapter:findOne')
      return t.run((ctx) =>
        ctx.runQuery(adapter.findOne, args as FunctionArgs<typeof adapter.findOne>)
      )
    if (name === 'adapter:create')
      return t.run((ctx) =>
        ctx.runMutation(adapter.create, args as FunctionArgs<typeof adapter.create>)
      )
    if (name === 'adapter:updateOne')
      return t.run((ctx) =>
        ctx.runMutation(adapter.updateOne, args as FunctionArgs<typeof adapter.updateOne>)
      )
    if (name === 'accountEntitlements:setTier')
      return t.mutation(
        internal.accountEntitlements.setTier,
        args as FunctionArgs<typeof internal.accountEntitlements.setTier>
      )
    throw new Error(`Unexpected admin call ${name}.`)
  }
  return { t, auth, adminCall, calls }
}

async function buildSet(
  world: ReturnType<typeof backend>,
  set: number,
  options: { rebuild?: boolean; password?: string } = {}
) {
  const announced: string[] = []
  const target = reviewTarget(
    { ...managedEnv, REVIEW_SET_PASSWORD: options.password },
    { set, rebuild: options.rebuild }
  )
  const roster = reviewRoster(target)
  const steps = reviewTargetSteps(target, {
    auth: world.auth,
    adminCall: world.adminCall,
    announcePassword: (password) => void announced.push(password)
  })
  const specs = [roster.gm, ...roster.players, ...roster.spares]
  await steps.prepare(specs)
  const sessions: string[] = []
  for (const spec of specs) sessions.push(await steps.session(spec))
  return { announced, roster, sessions, steps }
}

const signIn = (world: ReturnType<typeof backend>, email: string, password: string) =>
  world.auth('/sign-in/email', { email, password })

describe('managed tester set accounts', () => {
  it('creates two sets with their own verified accounts and generated passwords', async () => {
    const world = backend()
    const log = vi.spyOn(console, 'log')
    const first = await buildSet(world, 1)
    const second = await buildSet(world, 2)

    expect(first.roster.gm.email).toBe('mekhit02+t1-gm@gmail.com')
    expect(first.roster.players.map((spec) => spec.email)).toEqual([
      'mekhit02+t1-p1@gmail.com',
      'mekhit02+t1-p2@gmail.com',
      'mekhit02+t1-p3@gmail.com'
    ])
    expect(second.roster.spares.map((spec) => spec.email)).toEqual(['mekhit02+t2-spare@gmail.com'])
    expect(first.roster.admin).toBeUndefined()
    expect(first.sessions).toHaveLength(5)
    expect(first.announced).toHaveLength(1)
    expect(second.announced).toHaveLength(1)
    expect(first.announced[0]).not.toBe(second.announced[0])
    // Each set's password opens only that set's accounts; the sign-in needs no email (verified).
    expect((await signIn(world, 'mekhit02+t1-gm@gmail.com', first.announced[0]!)).status).toBe(200)
    expect((await signIn(world, 'mekhit02+t1-gm@gmail.com', second.announced[0]!)).status).toBe(401)
    const users = await world.t.run((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: 'user',
        paginationOpts: { cursor: null, numItems: 50 }
      })
    )
    expect(
      users.page.filter((user: { emailVerified?: boolean }) => user.emailVerified)
    ).toHaveLength(10)

    // The password reaches only `announcePassword`: not an admin call, a log line or a thrown error.
    const sent = JSON.stringify(world.calls)
    for (const password of [first.announced[0]!, second.announced[0]!]) {
      expect(sent).not.toContain(password)
      expect(JSON.stringify(log.mock.calls)).not.toContain(password)
    }
  })

  it('re-runs an existing set without a new password, and only with the one it was given', async () => {
    const world = backend()
    const built = await buildSet(world, 1)
    await expect(buildSet(world, 1)).rejects.toThrow(/REVIEW_SET_PASSWORD/)

    const again = await buildSet(world, 1, { password: built.announced[0] })
    expect(again.announced).toEqual([])
    expect(again.sessions).toHaveLength(5)
    await expect(buildSet(world, 1, { password: 'not-the-set-password-1' })).rejects.toThrow()
    expect(world.calls.filter((call) => call.name === 'adapter:updateOne')).toEqual([])
  })

  it('rebuilds one set with a new password and leaves the other set alone', async () => {
    const world = backend()
    const first = await buildSet(world, 1)
    const second = await buildSet(world, 2)
    const rebuilt = await buildSet(world, 1, { rebuild: true })

    expect(rebuilt.announced).toHaveLength(1)
    const [oldPassword, newPassword] = [first.announced[0]!, rebuilt.announced[0]!]
    expect(newPassword).not.toBe(oldPassword)
    expect((await signIn(world, 'mekhit02+t1-p2@gmail.com', oldPassword)).status).toBe(401)
    expect((await signIn(world, 'mekhit02+t1-p2@gmail.com', newPassword)).status).toBe(200)
    expect((await signIn(world, 'mekhit02+t2-p2@gmail.com', second.announced[0]!)).status).toBe(200)
    expect(JSON.stringify(world.calls)).not.toContain(newPassword)
  })
})

describe('review target selection', () => {
  it('names a set in each Campaign and keeps set 0 on the local names', () => {
    expect(reviewScenariosForSet(0)).toBe(REVIEW_SCENARIOS)
    expect(reviewScenariosForSet(3).map((scenario) => scenario.campaign)).toEqual(
      REVIEW_SCENARIOS.map((scenario) => `${scenario.campaign} (set 3)`)
    )
  })

  it('keeps the local roster: shared review accounts with an admin and two spares', () => {
    const roster = reviewRoster(reviewTarget(localEnv))
    expect(roster.admin?.username).toBe('Review_Admin_Sol')
    expect(roster.spares).toHaveLength(2)
    expect(roster.gm.email).toBeUndefined()
  })

  it('refuses superadmin grants and unsafe managed inputs', async () => {
    const world = backend()
    const target = reviewTarget(managedEnv, { set: 1 })
    const steps = reviewTargetSteps(target, {
      auth: world.auth,
      adminCall: world.adminCall,
      announcePassword: () => {}
    })
    await expect(steps.grantSuperadmin('user')).rejects.toThrow(/local review admin/)
    expect(world.calls).toEqual([])

    const rejected: [Record<string, string | undefined>, { set: number }][] = [
      [{ ...managedEnv, REVIEW_MANAGED_CONFIRM: undefined }, { set: 1 }],
      [{ ...managedEnv, REVIEW_MANAGED_CONFIRM: 'other-staging-1' }, { set: 1 }],
      [{ ...managedEnv, CONVEX_URL: 'http://127.0.0.1:3210' }, { set: 1 }],
      [{ ...managedEnv, CONVEX_SITE_URL: 'https://other.convex.site' }, { set: 1 }],
      [{ ...managedEnv, CONVEX_SELF_HOSTED_ADMIN_KEY: 'x' }, { set: 1 }],
      [{ ...managedEnv, CONVEX_DEPLOY_KEY: 'x' }, { set: 1 }],
      [{ ...managedEnv, REVIEW_MANAGED_ADMIN_KEY: undefined }, { set: 1 }],
      [{ ...managedEnv, REVIEW_WORKER_CONTROL_SECRET: undefined }, { set: 1 }],
      [{ ...managedEnv, REVIEW_MAILBOX: 'not-a-mailbox' }, { set: 1 }],
      [managedEnv, { set: 0 }]
    ]
    for (const [env, managed] of rejected) expect(() => reviewTarget(env, managed)).toThrow()
  })
})
