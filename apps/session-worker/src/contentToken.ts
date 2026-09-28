import {
  CONTENT_SNAPSHOT_TOKEN_AUDIENCE,
  CONTENT_SNAPSHOT_TOKEN_ISSUER,
  contentSnapshotTokenClaimsSchema,
  type ContentSnapshotTokenClaims
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { jwtVerify } from 'jose'

export async function verifyContentSnapshotToken(
  token: string,
  secret: string,
  currentDate = new Date()
): Promise<ContentSnapshotTokenClaims> {
  const key = new TextEncoder().encode(secret)
  if (key.byteLength < 32) throw new Error('CONTENT_SNAPSHOT_TOKEN_SECRET must contain 32 bytes.')
  const verified = await jwtVerify(token, key, {
    algorithms: ['HS256'],
    audience: CONTENT_SNAPSHOT_TOKEN_AUDIENCE,
    currentDate,
    issuer: CONTENT_SNAPSHOT_TOKEN_ISSUER
  })
  return contentSnapshotTokenClaimsSchema.parse(verified.payload)
}
