import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'

import {
  CONTENT_SNAPSHOT_PUBLIC_METADATA,
  CONTENT_SNAPSHOT_TOKEN_AUDIENCE,
  CONTENT_SNAPSHOT_TOKEN_ISSUER,
  contentSnapshotObjectKey
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { SignJWT } from 'jose'
import { expect, it, vi } from 'vitest'

import { startLocalR2 } from '../../apis/tests/localR2.js'
import { serveContentSnapshot } from './contentSnapshots.js'

it('delivers the shared local fixture gzip objects with metadata and scoped authorization', async () => {
  const fixture = await startLocalR2()
  const localOrigin = 'http://127.0.0.1:8026'
  const nativeFetch = globalThis.fetch
  // Keep the real HTTP transport while avoiding the lifecycle fixture's occupied port.
  const bridgeFetch = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input, init) =>
      nativeFetch(
        typeof input === 'string' ? input.replace(localOrigin, fixture.endpoint) : input,
        init
      )
    )
  try {
    const sourceId = '00000000-0000-4000-8000-000000000403'
    const publicKey = contentSnapshotObjectKey(
      { format: 2, scope: 'SOURCE', scopeId: sourceId, kind: 'RACE', part: 'index' },
      'a'.repeat(64)
    )
    const privateKey = publicKey.replace('a'.repeat(64), 'b'.repeat(64))
    const json = '{"roots":["local snapshot"]}'
    const body = gzipSync(json)
    const authorization = 'AWS4-HMAC-SHA256 Credential=local-media-access-key/local-fixture'
    for (const key of [publicKey, privateKey]) {
      const response = await nativeFetch(
        `${fixture.endpoint}/artificer-local-content-snapshots/${key}`,
        {
          method: 'PUT',
          body,
          headers: {
            authorization,
            'content-type': 'application/json',
            'content-encoding': 'gzip',
            ...(key === publicKey
              ? { 'x-amz-meta-access': CONTENT_SNAPSHOT_PUBLIC_METADATA.access }
              : {})
          }
        }
      )
      expect(response.status).toBe(200)
    }
    const secret = 'local-content-test-secret-with-at-least-thirty-two-bytes'
    const get = vi.fn<R2Bucket['get']>()
    const environment = {
      LOCAL_CONTENT_SNAPSHOT_ORIGIN: localOrigin,
      CONTENT_SNAPSHOT_TOKEN_SECRET: secret,
      LIVE_SESSION_ALLOWED_ORIGINS: 'http://localhost:3000',
      CONTENT_SNAPSHOTS: { get }
    }
    const token = await new SignJWT({ userSourceIds: [sourceId], campaignIds: [] })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(CONTENT_SNAPSHOT_TOKEN_ISSUER)
      .setAudience(CONTENT_SNAPSHOT_TOKEN_AUDIENCE)
      .setSubject('00000000-0000-4000-8000-000000000401')
      .setJti(crypto.randomUUID())
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(secret))
    const request = (key: string, authorization?: string, host = '127.0.0.1:8787') =>
      new Request(`http://${host}/content/${key}`, {
        headers: { origin: 'http://localhost:3000', ...(authorization ? { authorization } : {}) }
      })
    expect((await serveContentSnapshot(request(privateKey), environment)).status).toBe(401)
    expect(
      (await serveContentSnapshot(request(publicKey, 'Bearer malformed'), environment)).status
    ).toBe(401)
    for (const [key, credential, visibility] of [
      [publicKey, undefined, 'public'],
      [privateKey, `Bearer ${token}`, 'private']
    ] as const) {
      const response = await serveContentSnapshot(request(key, credential), environment)
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe(
        `${visibility}, max-age=31536000, immutable`
      )
      expect(response.headers.get('content-type')).toBe('application/json')
      expect(response.headers.get('content-encoding')).toBe('gzip')
      expect(response.headers.get('etag')).toBe(`"${createHash('md5').update(body).digest('hex')}"`)
      expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
      const delivered = Buffer.from(await response.arrayBuffer())
      expect(delivered).toEqual(body)
      expect(gunzipSync(delivered).toString()).toBe(json)
    }
    const foreignKey = privateKey.replace(sourceId, '00000000-0000-4000-8000-000000000404')
    const privateObject = fixture.contentSnapshotObjects.get(privateKey)
    if (!privateObject) throw new Error('Private fixture object was not stored.')
    fixture.contentSnapshotObjects.set(foreignKey, privateObject)
    expect(
      (await serveContentSnapshot(request(foreignKey, `Bearer ${token}`), environment)).status
    ).toBe(403)
    const reads = fixture.methods.length
    expect(
      (await serveContentSnapshot(request(publicKey, undefined, 'session.example'), environment))
        .status
    ).toBe(503)
    for (const origin of [
      'http://localhost:8026',
      'https://127.0.0.1:8026',
      'http://127.0.0.1:8027',
      ''
    ])
      expect(
        (
          await serveContentSnapshot(request(publicKey), {
            ...environment,
            LOCAL_CONTENT_SNAPSHOT_ORIGIN: origin
          })
        ).status
      ).toBe(503)
    expect(fixture.methods.length).toBe(reads)
    expect(get).not.toHaveBeenCalled()
  } finally {
    bridgeFetch.mockRestore()
    await fixture.close()
  }
})
