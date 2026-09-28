'use node'

import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  CONTENT_SNAPSHOT_TOKEN_AUDIENCE,
  CONTENT_SNAPSHOT_TOKEN_ISSUER,
  CONTENT_SNAPSHOT_TOKEN_TTL_SECONDS,
  contentSnapshotAccessDtoSchema,
  contentSnapshotTokenGrantSchema,
  type ContentSnapshotAccessDto
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { SignJWT } from 'jose'
import { internal } from '../_generated/api'
import { action } from '../_generated/server'

/**
 * A content token for the session Worker's private snapshot objects (ADR 0036). Revoked access
 * stays readable for at most one token lifetime; the caller re-issues before expiry.
 */
export const issueAccess = action({
  args: {},
  returns: zodToConvex(contentSnapshotAccessDtoSchema),
  handler: async (ctx): Promise<ContentSnapshotAccessDto> => {
    const secret = process.env.CONTENT_SNAPSHOT_TOKEN_SECRET
    const key = new TextEncoder().encode(secret ?? '')
    if (key.byteLength < 32)
      throw new Error('CONTENT_SNAPSHOT_TOKEN_SECRET must contain at least 32 bytes.')
    const grant = contentSnapshotTokenGrantSchema.parse(
      await ctx.runQuery(internal.contentSnapshots.manifest.readTokenGrant, {})
    )
    const issuedAt = Math.floor(Date.now() / 1_000)
    const expiresAt = issuedAt + CONTENT_SNAPSHOT_TOKEN_TTL_SECONDS
    const token = await new SignJWT({
      userSourceIds: grant.userSourceIds,
      campaignIds: grant.campaignIds
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setAudience(CONTENT_SNAPSHOT_TOKEN_AUDIENCE)
      .setExpirationTime(expiresAt)
      .setIssuedAt(issuedAt)
      .setIssuer(CONTENT_SNAPSHOT_TOKEN_ISSUER)
      .setJti(crypto.randomUUID())
      .setSubject(grant.sub)
      .sign(key)
    return contentSnapshotAccessDtoSchema.parse({
      expiresAt: new Date(expiresAt * 1_000).toISOString(),
      token
    })
  }
})
