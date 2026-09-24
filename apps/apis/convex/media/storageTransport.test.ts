// @vitest-environment node
import { register } from '@convex-dev/r2/test'
import type { R2 } from '@convex-dev/r2'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import { convexTest } from 'convex-test'
import { afterEach, expect, it, vi } from 'vitest'
import { startLocalR2 } from '../../tests/localR2'
import schema from '../schema'
import { createMediaStorage } from './storage'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

it('transfers real loopback bytes through the R2 component, syncs metadata, and deletes asynchronously', async () => {
  const server = await startLocalR2()
  try {
    vi.stubEnv('MEDIA_STORAGE_MODE', 'local')
    vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3221')
    vi.stubEnv('LOCAL_R2_ENDPOINT', server.endpoint)
    const t = convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))
    register(t)
    registerRetrier(t, 'r2/actionRetrier')
    // convex-test also accepts inline callbacks; the component uses only function references.
    type ComponentContext = Parameters<R2['store']>[0]
    const ctx: ComponentContext = {
      runQuery: t.query as ComponentContext['runQuery'],
      runMutation: t.mutation as ComponentContext['runMutation'],
      runAction: t.action as ComponentContext['runAction']
    }
    const r2 = createMediaStorage()
    const original = Buffer.from('local upload fixture')
    const upload = await r2.generateUploadUrl(`pending/${crypto.randomUUID()}`)
    const preflight = await fetch(upload.url, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'PUT',
        'access-control-request-headers': 'content-type'
      }
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
    expect(preflight.headers.get('access-control-allow-methods')).toContain('PUT')
    const foreignPreflight = await fetch(upload.url, {
      method: 'OPTIONS',
      headers: { origin: 'https://unrelated.example', 'access-control-request-method': 'PUT' }
    })
    expect(foreignPreflight.headers.get('access-control-allow-origin')).toBeNull()
    expect(
      (
        await fetch(upload.url, {
          method: 'PUT',
          body: original,
          headers: { 'Content-Type': 'text/plain' }
        })
      ).status
    ).toBe(200)
    await r2.syncMetadata(ctx, upload.key)
    expect(await r2.getMetadata(ctx, upload.key)).toMatchObject({
      key: upload.key,
      size: original.length,
      contentType: 'text/plain'
    })
    const delivered = await fetch(await r2.getUrl(upload.key, { expiresIn: 300 }), {
      headers: { origin: 'http://localhost:3000' }
    })
    expect(delivered.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
    expect(await delivered.text()).toBe(original.toString())

    const normalized = Buffer.from('processed fixture')
    const readyKey = await r2.store(ctx, normalized, {
      key: `ready/${crypto.randomUUID()}`,
      type: 'text/plain'
    })
    expect(server.objects.get(readyKey)?.body).toEqual(normalized)
    expect(await r2.getMetadata(ctx, readyKey)).toMatchObject({ size: normalized.length })

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await r2.deleteObject(ctx, upload.key)
    await r2.deleteObject(ctx, readyKey)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()
    expect(server.objects.size).toBe(0)
    expect(await r2.getMetadata(ctx, upload.key)).toBeNull()
    expect(await r2.getMetadata(ctx, readyKey)).toBeNull()
    expect(server.methods).toEqual(expect.arrayContaining(['PUT', 'HEAD', 'GET', 'DELETE']))
  } finally {
    vi.useRealTimers()
    await server.close()
  }
}, 15_000)
