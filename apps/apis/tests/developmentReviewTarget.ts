import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { jsonToConvex } from 'convex/values'
import { z } from 'zod'
import type { AuthRequest } from './developmentAuthRequest'
import { reviewAccountSession } from './developmentReviewAccounts'
import {
  REVIEW_ADMIN,
  REVIEW_GM,
  REVIEW_PLAYERS,
  REVIEW_SPARES,
  type ReviewAccountSpec
} from './developmentReviewDataScenarios'
import { developmentTarget } from './developmentTarget'

/**
 * The target of a review-data build. Local is set 0: the review accounts under the shared review
 * password. A managed (staging) target builds one numbered tester set: five accounts on the
 * operator's mailbox (`<name>+t<N>-<role>@<domain>`), a password generated per set, and the set's own
 * copy of the review Campaigns.
 */
export type ReviewTarget =
  | { mode: 'local'; set: 0; deploymentUrl: URL; siteUrl: URL }
  | {
      mode: 'managed'
      set: number
      rebuild: boolean
      deploymentUrl: URL
      siteUrl: URL
      mailbox: { name: string; domain: string }
      /** Deployment admin key, in memory only; it reaches the invitation, tier and password steps. */
      adminKey: string
      /** The Session Worker control secret the operator supplies; never read from the deployment. */
      workerControlSecret: string
      /** The password printed when the set was created; required to re-run an existing set. */
      suppliedPassword: string | undefined
    }

/**
 * Selects the target. A managed target is never inferred: the operator names the deployment twice
 * (URLs and `REVIEW_MANAGED_CONFIRM`) and supplies the admin key, Worker secret and mailbox; ambient
 * deploy and self-hosted keys must be absent.
 */
export function reviewTarget(
  env: Record<string, string | undefined>,
  managed?: { set: number; rebuild?: boolean }
): ReviewTarget {
  if (!managed) {
    const target = developmentTarget(env)
    assert.equal(
      target.mode,
      'local',
      'Review data is built on the local Docker backend by default.'
    )
    assert.equal(env.CONVEX_DEPLOY_KEY, undefined)
    return { mode: 'local', set: 0, deploymentUrl: target.deploymentUrl, siteUrl: target.siteUrl }
  }
  assert.ok(Number.isInteger(managed.set) && managed.set >= 1, 'A tester set is a number from 1.')
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
  const mailbox = /^([A-Za-z0-9._-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})$/.exec(
    env.REVIEW_MAILBOX ?? ''
  )
  assert.ok(mailbox, 'REVIEW_MAILBOX is the throwaway mailbox, for example name@gmail.com.')
  assert.ok(env.REVIEW_MANAGED_ADMIN_KEY, 'REVIEW_MANAGED_ADMIN_KEY is required.')
  assert.ok(env.REVIEW_WORKER_CONTROL_SECRET, 'REVIEW_WORKER_CONTROL_SECRET is required.')
  return {
    mode: 'managed',
    set: managed.set,
    rebuild: managed.rebuild ?? false,
    deploymentUrl,
    siteUrl,
    mailbox: { name: mailbox[1]!, domain: mailbox[2]! },
    adminKey: env.REVIEW_MANAGED_ADMIN_KEY,
    workerControlSecret: env.REVIEW_WORKER_CONTROL_SECRET,
    suppliedPassword: env.REVIEW_SET_PASSWORD || undefined
  }
}

export type ReviewRoster = {
  gm: ReviewAccountSpec
  players: readonly ReviewAccountSpec[]
  admin?: ReviewAccountSpec
  spares: readonly ReviewAccountSpec[]
}

/** The accounts of the target's set. A managed set has no superadmin and one spare. */
export function reviewRoster(target: ReviewTarget): ReviewRoster {
  if (target.mode === 'local')
    return { gm: REVIEW_GM, players: REVIEW_PLAYERS, admin: REVIEW_ADMIN, spares: REVIEW_SPARES }
  const named = (spec: ReviewAccountSpec, role: string): ReviewAccountSpec => ({
    key: spec.key,
    username: `${spec.username}_t${target.set}`,
    email: `${target.mailbox.name}+t${target.set}-${role}@${target.mailbox.domain}`
  })
  return {
    gm: named(REVIEW_GM, 'gm'),
    players: REVIEW_PLAYERS.map((spec, index) => named(spec, `p${index + 1}`)),
    spares: [named(REVIEW_SPARES[0]!, 'spare')]
  }
}

export type AdminCall = (
  name: string,
  args: Record<string, unknown>,
  component?: boolean
) => Promise<unknown>

/** Calls a deployment function with the managed admin key, which stays in memory and out of errors. */
export function managedAdminCall(target: ReviewTarget & { mode: 'managed' }): AdminCall {
  return async (name, args, component = false) => {
    assert.match(name, /^[\w./-]+:[\w]+$/, 'The admin function name is invalid.')
    const response = await fetch(new URL('/api/function', target.deploymentUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Convex ${target.adminKey}` },
      body: JSON.stringify({
        path: name,
        componentPath: component ? 'betterAuth' : undefined,
        format: 'convex_encoded_json',
        args: z.record(z.string(), z.json()).parse(JSON.parse(JSON.stringify(args)))
      }),
      signal: AbortSignal.timeout(60_000)
    })
    if (!response.ok)
      throw new Error(`The managed admin call ${name} failed (HTTP ${response.status}).`)
    const result = z
      .object({ status: z.literal('success'), value: z.json() })
      .parse(await response.json())
    return jsonToConvex(result.value)
  }
}

/**
 * Per-target account and operator steps. Local provisions accounts by invitation under the shared
 * review password and grants the GM tier and superadmin through deployment-admin functions. A managed
 * set does the same with a password generated for the set: `announcePassword` receives it once and
 * it is neither returned, stored nor logged. Re-running an existing set needs that password
 * (`suppliedPassword`); a rebuild generates a new one and resets the set's accounts to it.
 */
export function reviewTargetSteps(
  target: ReviewTarget,
  deps: { auth: AuthRequest; adminCall: AdminCall; announcePassword: (password: string) => void }
) {
  const { auth, adminCall } = deps
  let password: string | undefined
  const findUser = async (email: string) => {
    const user = await adminCall(
      'adapter:findOne',
      { model: 'user', where: [{ field: 'email', value: email }] },
      true
    )
    return typeof user === 'object' && user !== null ? user : null
  }
  const resetPassword = async (user: object, next: string) => {
    const userId: unknown = Reflect.get(user, '_id')
    assert.equal(typeof userId, 'string', 'The account has no id.')
    await adminCall(
      'adapter:updateOne',
      {
        input: {
          model: 'account',
          where: [
            { field: 'userId', value: userId },
            { field: 'providerId', value: 'credential' }
          ],
          update: { password: await hashPassword(next), updatedAt: Date.now() }
        }
      },
      true
    )
  }
  return {
    /** Fixes the set's password before any account is touched; managed only, a no-op locally. */
    prepare: async (specs: readonly ReviewAccountSpec[]) => {
      if (target.mode === 'local') return
      const users = await Promise.all(specs.map((spec) => findUser(spec.email!)))
      const exists = users.some(Boolean)
      if (!target.rebuild && exists && !target.suppliedPassword)
        throw new Error(
          `Set ${target.set} already has accounts: pass REVIEW_SET_PASSWORD, or rebuild the set to reset its password.`
        )
      if (target.rebuild || !exists) {
        password = randomBytes(18).toString('base64url')
        deps.announcePassword(password)
        for (const user of users) if (user && target.rebuild) await resetPassword(user, password)
      } else password = target.suppliedPassword
    },
    session: (spec: ReviewAccountSpec): Promise<string> =>
      reviewAccountSession(
        spec,
        auth,
        (data) => adminCall('adapter:create', { input: { model: 'verification', data } }, true),
        target.mode === 'local' ? undefined : password
      ),
    grantGmTier: async (userId: string) => {
      await adminCall('accountEntitlements:setTier', { userId, tier: 'GM' })
    },
    grantSuperadmin: async (userId: string) => {
      assert.equal(target.mode, 'local', 'Superadmin is granted only to the local review admin.')
      await adminCall('authAdmin:setRole', { userId, role: 'superadmin' })
    }
  }
}
