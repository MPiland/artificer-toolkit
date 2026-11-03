import { describe, expect, it, vi } from 'vitest'
import {
  assertLocalOnlyStep,
  REVIEW_ROLE_SPECS,
  reviewTarget,
  reviewTargetSteps
} from '../tests/developmentReviewTarget'
import { REVIEW_ADMIN, REVIEW_GM, REVIEW_PASSWORD } from '../tests/developmentReviewDataScenarios'

const managedEnv = {
  CONVEX_URL: 'https://tester-staging-123.convex.cloud',
  CONVEX_SITE_URL: 'https://tester-staging-123.convex.site',
  REVIEW_MANAGED_CONFIRM: 'tester-staging-123',
  REVIEW_WORKER_CONTROL_SECRET: 'worker-control-secret-value'
}
const roleMap = Object.fromEntries(
  REVIEW_ROLE_SPECS.map((spec) => [
    spec.key,
    { email: `${spec.key}@testers.example`, password: `${spec.key}-Tester-Pass-1!` }
  ])
)
const localEnv = {
  CONVEX_DEPLOYMENT: 'local:phase82-local-linux',
  CONVEX_URL: 'http://127.0.0.1:3210',
  CONVEX_SITE_URL: 'http://127.0.0.1:3211'
}

function steps(target: ReturnType<typeof reviewTarget>) {
  const auth = vi.fn(async (_path: string, body?: Record<string, unknown>) =>
    Response.json({ token: `session-for-${String(body?.email)}` })
  )
  const issueInvitation = vi.fn(async () => undefined)
  const adminCall = vi.fn(async () => undefined)
  const verify = {
    tier: vi.fn(async () => 'GM'),
    role: vi.fn(async () => 'superadmin')
  }
  return {
    auth,
    issueInvitation,
    adminCall,
    verify,
    ...reviewTargetSteps(target, { auth, issueInvitation, adminCall, verify })
  }
}

describe('review target', () => {
  it('binds the given accounts on a managed target without creating anything', async () => {
    const target = reviewTarget(managedEnv, { roleMap })
    const run = steps(target)
    for (const spec of REVIEW_ROLE_SPECS)
      expect(await run.session(spec)).toBe(`session-for-${spec.key}@testers.example`)
    await run.grantGmTier('user-gm', REVIEW_GM)
    await run.grantSuperadmin('user-admin', REVIEW_ADMIN)

    expect(run.auth.mock.calls.map(([path]) => path)).toEqual(
      REVIEW_ROLE_SPECS.map(() => '/sign-in/email')
    )
    expect(JSON.stringify(run.auth.mock.calls)).not.toContain(REVIEW_PASSWORD)
    expect(run.issueInvitation).not.toHaveBeenCalled()
    expect(run.adminCall).not.toHaveBeenCalled()
    expect(run.verify.tier).toHaveBeenCalledWith(REVIEW_GM)
    expect(run.verify.role).toHaveBeenCalledWith(REVIEW_ADMIN)
  })

  it('fails instead of creating an account whose invitation was not redeemed', async () => {
    const run = steps(reviewTarget(managedEnv, { roleMap }))
    run.auth.mockResolvedValueOnce(new Response(null, { status: 401 }))
    await expect(run.session(REVIEW_GM)).rejects.toThrow(/redeem its invitation/)
    expect(run.issueInvitation).not.toHaveBeenCalled()
  })

  it('verifies, never grants, the GM tier and superadmin role', async () => {
    const run = steps(reviewTarget(managedEnv, { roleMap }))
    run.verify.tier.mockResolvedValueOnce('FREE')
    await expect(run.grantGmTier('user-gm', REVIEW_GM)).rejects.toThrow(/GM tier/)
    run.verify.role.mockResolvedValueOnce('user')
    await expect(run.grantSuperadmin('user-admin', REVIEW_ADMIN)).rejects.toThrow(/superadmin/)
    expect(run.adminCall).not.toHaveBeenCalled()
  })

  it('refuses the local-only steps on a managed target', () => {
    expect(() => assertLocalOnlyStep(reviewTarget(managedEnv, { roleMap }), 'Fixtures')).toThrow(
      /only against the local Docker backend/
    )
    expect(() => assertLocalOnlyStep(reviewTarget(localEnv), 'Fixtures')).not.toThrow()
  })

  it('rejects unsafe managed inputs', () => {
    const rejected: [Record<string, string | undefined>, unknown][] = [
      [{ ...managedEnv, REVIEW_MANAGED_CONFIRM: undefined }, roleMap],
      [{ ...managedEnv, REVIEW_MANAGED_CONFIRM: 'other-staging-1' }, roleMap],
      [{ ...managedEnv, CONVEX_URL: 'http://127.0.0.1:3210' }, roleMap],
      [{ ...managedEnv, CONVEX_SITE_URL: 'https://other.convex.site' }, roleMap],
      [{ ...managedEnv, CONVEX_SELF_HOSTED_ADMIN_KEY: 'x' }, roleMap],
      [{ ...managedEnv, CONVEX_DEPLOY_KEY: 'x' }, roleMap],
      [{ ...managedEnv, REVIEW_WORKER_CONTROL_SECRET: undefined }, roleMap],
      [managedEnv, { ...roleMap, gm: { ...roleMap.gm, password: REVIEW_PASSWORD } }],
      [managedEnv, { ...roleMap, player1: roleMap.gm }],
      [managedEnv, { ...roleMap, spare2: undefined }]
    ]
    for (const [env, map] of rejected) expect(() => reviewTarget(env, { roleMap: map })).toThrow()
  })

  it('keeps the local path on provisioning and deployment-admin grants', async () => {
    const run = steps(reviewTarget(localEnv))
    await run.grantGmTier('user-gm', REVIEW_GM)
    await run.grantSuperadmin('user-admin', REVIEW_ADMIN)
    expect(run.adminCall.mock.calls).toEqual([
      ['accountEntitlements:setTier', { userId: 'user-gm', tier: 'GM' }],
      ['authAdmin:setRole', { userId: 'user-admin', role: 'superadmin' }]
    ])
    expect(run.verify.tier).not.toHaveBeenCalled()
  })
})
