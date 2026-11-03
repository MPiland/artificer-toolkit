import assert from 'node:assert/strict'
import { z } from 'zod'
import type { AuthRequest } from './developmentAuthRequest'
import { reviewAccountSession, tokenOf } from './developmentReviewAccounts'
import {
  REVIEW_ADMIN,
  REVIEW_GM,
  REVIEW_PASSWORD,
  REVIEW_PLAYERS,
  REVIEW_SPARES,
  type ReviewAccountSpec
} from './developmentReviewDataScenarios'
import { developmentTarget } from './developmentTarget'

const credentialSchema = z.strictObject({ email: z.email(), password: z.string().min(12) })

/** Already-invited tester accounts, one per review role, keyed by `ReviewAccountSpec.key`. */
export const reviewRoleMapSchema = z.strictObject({
  gm: credentialSchema,
  player1: credentialSchema,
  player2: credentialSchema,
  player3: credentialSchema,
  admin: credentialSchema,
  spare1: credentialSchema,
  spare2: credentialSchema
})
export type ReviewRoleMap = z.infer<typeof reviewRoleMapSchema>

export type ReviewTarget =
  | { mode: 'local'; deploymentUrl: URL; siteUrl: URL }
  | {
      mode: 'managed'
      deploymentUrl: URL
      siteUrl: URL
      roles: ReviewRoleMap
      /** The Session Worker control secret the operator supplies in memory; never read from the deployment. */
      workerControlSecret: string
    }

/**
 * Selects the target. A managed (staging) target is never inferred: the operator names the
 * deployment twice (URLs and `REVIEW_MANAGED_CONFIRM`), supplies the invited accounts as a role map,
 * and the local-only inputs (self-hosted admin key, deploy key) must be absent.
 */
export function reviewTarget(
  env: Record<string, string | undefined>,
  managed?: { roleMap: unknown }
): ReviewTarget {
  if (!managed) {
    const target = developmentTarget(env)
    assert.equal(
      target.mode,
      'local',
      'Review data is built on the local Docker backend by default.'
    )
    assert.equal(env.CONVEX_DEPLOY_KEY, undefined)
    return { mode: 'local', deploymentUrl: target.deploymentUrl, siteUrl: target.siteUrl }
  }
  for (const name of [
    'CONVEX_DEPLOY_KEY',
    'CONVEX_SELF_HOSTED_URL',
    'CONVEX_SELF_HOSTED_ADMIN_KEY'
  ])
    assert.equal(env[name], undefined, `${name} must not be set for a managed target.`)
  const [deploymentUrl, siteUrl] = [env.CONVEX_URL, env.CONVEX_SITE_URL].map((value) => {
    assert.ok(value, 'Both Convex URLs are required for a managed target.')
    const url = new URL(value)
    assert.equal(url.protocol, 'https:')
    assert.ok(!url.username && !url.password && !url.search && !url.hash && url.pathname === '/')
    return url
  }) as [URL, URL]
  const slug = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.convex\.cloud$/.exec(deploymentUrl.hostname)?.[1]
  assert.ok(slug, 'A managed target is a *.convex.cloud deployment.')
  assert.equal(siteUrl.hostname, `${slug}.convex.site`)
  assert.equal(
    env.REVIEW_MANAGED_CONFIRM,
    slug,
    'Set REVIEW_MANAGED_CONFIRM to the deployment name to build review data on a managed target.'
  )
  const roles = reviewRoleMapSchema.parse(managed.roleMap)
  const emails = Object.values(roles).map((role) => role.email.toLowerCase())
  assert.equal(new Set(emails).size, emails.length, 'Each role needs its own invited account.')
  for (const role of Object.values(roles))
    assert.notEqual(role.password, REVIEW_PASSWORD, 'The shared review password is local only.')
  const workerControlSecret = env.REVIEW_WORKER_CONTROL_SECRET
  assert.ok(workerControlSecret, 'REVIEW_WORKER_CONTROL_SECRET is required for a managed target.')
  return { mode: 'managed', deploymentUrl, siteUrl, roles, workerControlSecret }
}

/** The accounts, in the order the builder binds them. */
export const REVIEW_ROLE_SPECS: readonly ReviewAccountSpec[] = [
  REVIEW_GM,
  ...REVIEW_PLAYERS,
  REVIEW_ADMIN,
  ...REVIEW_SPARES
]

/**
 * Per-target account and operator steps. Local provisions accounts by invitation under the shared
 * review password and grants the GM tier and superadmin through deployment-admin functions. Managed
 * signs in to the given accounts only (a missing invite fails, nothing is created) and verifies the
 * GM tier and superadmin role the operator already gave them.
 */
export function reviewTargetSteps(
  target: ReviewTarget,
  deps: {
    auth: AuthRequest
    /** Local only: writes the invitation verification row through the admin function API. */
    issueInvitation: Parameters<typeof reviewAccountSession>[2]
    /** Local only: deployment-admin function call. */
    adminCall: (name: string, args: Record<string, unknown>) => Promise<unknown>
    /** Managed only: the signed-in role verification reads. */
    verify: {
      tier: (spec: ReviewAccountSpec) => Promise<string>
      role: (spec: ReviewAccountSpec) => Promise<string>
    }
  }
) {
  return {
    session: async (spec: ReviewAccountSpec): Promise<string> => {
      if (target.mode === 'local')
        return reviewAccountSession(spec, deps.auth, deps.issueInvitation)
      const role = target.roles[spec.key as keyof ReviewRoleMap]
      assert.ok(role, `No invited account is mapped to the ${spec.key} role.`)
      const response = await deps.auth('/sign-in/email', {
        email: role.email,
        password: role.password
      })
      const session = await tokenOf(response)
      assert.ok(
        session,
        `The ${spec.key} account could not sign in (HTTP ${response.status}); redeem its invitation first.`
      )
      return session
    },
    grantGmTier: async (userId: string, gm: ReviewAccountSpec) => {
      if (target.mode === 'local')
        return void (await deps.adminCall('accountEntitlements:setTier', { userId, tier: 'GM' }))
      const tier = await deps.verify.tier(gm)
      assert.ok(
        ['GM', 'PRO_GM'].includes(tier),
        `The ${gm.key} account needs the GM tier (has ${tier}).`
      )
    },
    grantSuperadmin: async (userId: string, admin: ReviewAccountSpec) => {
      if (target.mode === 'local')
        return void (await deps.adminCall('authAdmin:setRole', { userId, role: 'superadmin' }))
      const role = await deps.verify.role(admin)
      assert.equal(role, 'superadmin', `The ${admin.key} account needs the superadmin role.`)
    }
  }
}

/** Local fixtures, admin-key generation and the email sink never run against a managed target. */
export function assertLocalOnlyStep(target: ReviewTarget, action: string) {
  assert.equal(
    target.mode,
    'local',
    `${action}: This step runs only against the local Docker backend.`
  )
}
