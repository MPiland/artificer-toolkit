import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { authInvitationRedeemInputSchema } from '@artificer-toolkit/schema/api/auth'
import type { AuthRequest } from './developmentAuthRequest'
import { REVIEW_PASSWORD, type ReviewAccountSpec } from './developmentReviewDataScenarios'

type InvitationVerification = {
  identifier: string
  value: string
  expiresAt: number
  createdAt: number
  updatedAt: number
}

export async function tokenOf(response: Response): Promise<string | null> {
  if (response.status !== 200) return null
  const body: unknown = await response.json()
  const token = typeof body === 'object' && body !== null ? Reflect.get(body, 'token') : null
  return typeof token === 'string' ? token : null
}

/**
 * Returns a session for a review account. Public signup is closed, so a missing account is created
 * the way an invitation is redeemed; re-runs sign in to what an earlier run made. Only a 401 means
 * the account is missing: any other refusal fails here rather than attempting a second creation.
 * Local accounts share `REVIEW_PASSWORD`; a managed set passes its own generated password.
 */
export async function reviewAccountSession(
  spec: ReviewAccountSpec,
  auth: AuthRequest,
  issueInvitation: (verification: InvitationVerification) => Promise<unknown>,
  password = REVIEW_PASSWORD
): Promise<string> {
  const email = spec.email ?? `${spec.username.toLowerCase()}@example.invalid`
  const signIn = async () => {
    const response = await auth('/sign-in/email', { email, password })
    if (response.status === 401) return null
    const session = await tokenOf(response)
    assert.ok(session, `Review account ${spec.key} could not sign in (HTTP ${response.status}).`)
    return session
  }
  const existing = await signIn()
  if (existing) return existing

  const token = randomBytes(32).toString('hex')
  await issueInvitation({
    identifier: `account-invitation:${email}`,
    value: createHash('sha256').update(token).digest('hex'),
    expiresAt: Date.now() + 15 * 60_000,
    createdAt: Date.now(),
    updatedAt: Date.now()
  })
  const redemption = authInvitationRedeemInputSchema.parse({
    email,
    username: spec.username,
    token,
    password
  })
  const response = await auth('/invitation/redeem', redemption)
  assert.equal(response.status, 200, `Review account ${spec.key} could not be created.`)
  const session = await signIn()
  assert.ok(session, `Review account ${spec.key} could not sign in after creation.`)
  return session
}
