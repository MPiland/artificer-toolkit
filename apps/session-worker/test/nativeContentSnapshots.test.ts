import {
  CONTENT_SNAPSHOT_PUBLIC_METADATA,
  contentSnapshotObjectKey,
  CONTENT_SNAPSHOT_TOKEN_AUDIENCE,
  CONTENT_SNAPSHOT_TOKEN_ISSUER
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { SELF } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { SignJWT } from 'jose'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { readContentSnapshotObject } from '../src/contentSnapshotStorage.js'

// ADR 0036 S3 delivery: the authorization matrix of `GET /content/v2/...`.

const secret = 'test-secret-that-contains-at-least-thirty-two-bytes-content'
const allowedOrigin = 'https://app.test'
const userId = '00000000-0000-4000-8000-000000000401'
const platformSourceId = '00000000-0000-4000-8000-000000000402'
const userSourceId = '00000000-0000-4000-8000-000000000403'
const foreignSourceId = '00000000-0000-4000-8000-000000000404'
const campaignId = '00000000-0000-4000-8000-000000000405'
const json = '{"roots":[]}'

function keyOf(scope: 'SOURCE' | 'CAMPAIGN', scopeId: string, seed: string) {
  return contentSnapshotObjectKey(
    { format: 3, scope, scopeId, kind: 'RACE', part: 'index' },
    seed.repeat(64)
  )
}
const keys = {
  platform: keyOf('SOURCE', platformSourceId, 'a'),
  user: keyOf('SOURCE', userSourceId, 'b'),
  foreign: keyOf('SOURCE', foreignSourceId, 'c'),
  campaign: keyOf('CAMPAIGN', campaignId, 'd')
}

beforeAll(async () => {
  const body = await new Response(
    new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))
  ).arrayBuffer()
  const httpMetadata = { contentType: 'application/json', contentEncoding: 'gzip' }
  await env.CONTENT_SNAPSHOTS.put(keys.platform, body, {
    httpMetadata,
    customMetadata: { ...CONTENT_SNAPSHOT_PUBLIC_METADATA }
  })
  for (const key of [keys.user, keys.foreign, keys.campaign])
    await env.CONTENT_SNAPSHOTS.put(key, body, { httpMetadata })
})

async function tokenFor(
  claims: { userSourceIds?: string[]; campaignIds?: string[] } = {},
  options: { audience?: string; expiresIn?: number; key?: string } = {}
) {
  const now = Math.floor(Date.now() / 1_000)
  return new SignJWT({
    userSourceIds: claims.userSourceIds ?? [userSourceId],
    campaignIds: claims.campaignIds ?? [campaignId]
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(CONTENT_SNAPSHOT_TOKEN_ISSUER)
    .setAudience(options.audience ?? CONTENT_SNAPSHOT_TOKEN_AUDIENCE)
    .setSubject(userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt(now - 700)
    .setExpirationTime(now + (options.expiresIn ?? 600))
    .sign(new TextEncoder().encode(options.key ?? secret))
}

function get(path: string, headers: Record<string, string> = {}, method = 'GET') {
  return SELF.fetch(`https://session.test/content/${path}`, {
    method,
    headers: { origin: allowedOrigin, ...headers }
  })
}

const bearer = async (...args: Parameters<typeof tokenFor>) => ({
  authorization: `Bearer ${await tokenFor(...args)}`
})

async function text(response: Response) {
  const bytes = new Uint8Array(await response.arrayBuffer())
  // The stored gzip body is sent as is; decode it the way a browser would.
  return bytes[0] === 0x1f && bytes[1] === 0x8b
    ? new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(bytes)
}

describe('content snapshot delivery', () => {
  it('reads raw local gzip with native Request options and refuses fixture redirects', async () => {
    const bytes = new Uint8Array(
      await new Response(
        new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))
      ).arrayBuffer()
    )
    let redirect = false
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      // Native Request validation catches options that Node's fetch accepts but workerd rejects.
      const request = new Request(input, init)
      expect(request.headers.get('x-artificer-local-raw-body')).toBe('1')
      return redirect
        ? new Response(null, { status: 302, headers: { location: 'https://foreign.test/' } })
        : new Response(bytes, {
            headers: {
              'content-type': 'application/json',
              'x-artificer-content-encoding': 'gzip',
              'x-amz-meta-access': CONTENT_SNAPSHOT_PUBLIC_METADATA.access,
              etag: 'local-fixture'
            }
          })
    })
    const get = vi.fn<R2Bucket['get']>()
    const environment = {
      LOCAL_CONTENT_SNAPSHOT_ORIGIN: 'http://127.0.0.1:8026',
      CONTENT_SNAPSHOTS: { get }
    }
    try {
      const object = await readContentSnapshotObject(environment, keys.platform)
      expect(object?.httpMetadata?.contentEncoding).toBe('gzip')
      expect(object?.customMetadata?.access).toBe(CONTENT_SNAPSHOT_PUBLIC_METADATA.access)
      expect(await new Response(object?.body).arrayBuffer()).toEqual(bytes.buffer)
      redirect = true
      await expect(readContentSnapshotObject(environment, keys.platform)).rejects.toThrow(
        'Content snapshot is not available.'
      )
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(get).not.toHaveBeenCalled()
    } finally {
      fetch.mockRestore()
    }
  })

  it('serves PLATFORM source objects publicly, immutable and cacheable', async () => {
    const response = await get(keys.platform)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(response.headers.get('content-encoding')).toBe('gzip')
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin)
    expect(response.headers.get('vary')).toBe('Origin')
    expect(await text(response)).toBe(json)
  })

  it('serves a private object only to a token naming its USER source, never edge-cacheable', async () => {
    const anonymous = await get(keys.user)
    expect(anonymous.status).toBe(401)
    expect(anonymous.headers.get('cache-control')).toBe('no-store')

    const foreign = await get(keys.foreign, await bearer())
    expect(foreign.status).toBe(403)

    const owned = await get(keys.user, await bearer())
    expect(owned.status).toBe(200)
    expect(owned.headers.get('cache-control')).toBe('private, max-age=31536000, immutable')
    expect(owned.headers.get('content-encoding')).toBe('gzip')
    expect(await text(owned)).toBe(json)
  })

  it('refuses a Campaign object to a token without that Campaign, as after leaving it', async () => {
    const departed = await get(keys.campaign, await bearer({ campaignIds: [] }))
    expect(departed.status).toBe(403)
    const member = await get(keys.campaign, await bearer())
    expect(member.status).toBe(200)
    expect(member.headers.get('cache-control')).toMatch(/^private,/)
    await member.body?.cancel()
  })

  it('rejects expired, wrong-audience, wrongly signed and malformed tokens, even for public objects', async () => {
    for (const headers of [
      await bearer({}, { expiresIn: -1 }),
      await bearer({}, { audience: 'artificer-live-session' }),
      await bearer({}, { key: `${secret}-other` }),
      { authorization: await tokenFor() },
      { authorization: 'Bearer ' }
    ]) {
      expect((await get(keys.user, headers)).status).toBe(401)
      expect((await get(keys.platform, headers)).status).toBe(401)
    }
  })

  it('rejects a token in the query string without serving the object', async () => {
    const token = await tokenFor()
    for (const key of [keys.user, keys.platform]) {
      const response = await get(`${key}?token=${token}`)
      expect(response.status).toBe(400)
      expect(response.headers.get('content-encoding')).toBeNull()
    }
  })

  it('limits CORS to the app origins', async () => {
    const foreign = await get(keys.platform, { origin: 'https://attacker.test' })
    expect(foreign.status).toBe(403)
    expect(foreign.headers.get('access-control-allow-origin')).toBeNull()

    const preflight = await get(keys.user, {}, 'OPTIONS')
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe(allowedOrigin)
    expect(preflight.headers.get('access-control-allow-headers')).toBe('authorization')
    expect(preflight.headers.get('access-control-allow-methods')).toBe('GET')

    const foreignPreflight = await get(keys.user, { origin: 'https://attacker.test' }, 'OPTIONS')
    expect(foreignPreflight.status).toBe(403)
    expect(foreignPreflight.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('refuses non-canonical keys, missing objects and writes', async () => {
    expect((await get(keys.platform.toUpperCase())).status).toBe(404)
    expect((await get(`../${keys.platform}`)).status).toBe(404)
    expect((await get(keyOf('SOURCE', platformSourceId, 'e'))).status).toBe(404)
    expect((await get(keys.platform, {}, 'PUT')).status).toBe(405)
  })
})
