import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMediaStorage } from './storage'

function local() {
  vi.stubEnv('MEDIA_STORAGE_MODE', 'local')
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3221')
  vi.stubEnv('LOCAL_R2_ENDPOINT', 'http://127.0.0.1:8026')
  vi.stubEnv('R2_ACCESS_KEY_ID', 'must-not-be-used')
  vi.stubEnv('R2_SECRET_ACCESS_KEY', 'must-not-be-used')
}

afterEach(() => vi.unstubAllEnvs())

describe('R2 media environment boundary', () => {
  it('uses the official component for exact-key single PUT and bounded signed GET', async () => {
    local()
    const r2 = createMediaStorage()
    const key = `pending/${crypto.randomUUID()}`
    const upload = await r2.generateUploadUrl(key)
    const url = new URL(upload.url)
    expect(upload.key).toBe(key)
    expect(url.origin).toBe('http://127.0.0.1:8026')
    expect(url.pathname).toBe(`/artificer-local-media/${key}`)
    expect(url.searchParams.get('X-Amz-Credential')).toContain('local-media-access-key/')
    expect(url.searchParams.has('uploadId')).toBe(false)
    expect(upload.url).not.toContain('must-not-be-used')
    expect(Number(url.searchParams.get('X-Amz-Expires'))).toBeGreaterThan(0)
    expect(Number(url.searchParams.get('X-Amz-Expires'))).toBeLessThanOrEqual(900)
    const read = new URL(await r2.getUrl(key, { expiresIn: 300 }))
    expect(read.searchParams.get('X-Amz-Expires')).toBe('300')
  })

  it('fails closed for mixed local/managed endpoints and unknown modes', () => {
    local()
    vi.stubEnv('LOCAL_R2_ENDPOINT', 'https://storage.example.test')
    expect(createMediaStorage).toThrow('loopback')
    local()
    vi.stubEnv('CONVEX_SITE_URL', 'https://example.convex.site')
    expect(createMediaStorage).toThrow('loopback')
    local()
    vi.stubEnv('MEDIA_STORAGE_MODE', 'r2')
    expect(createMediaStorage).toThrow('local media provider')
    vi.stubEnv('MEDIA_STORAGE_MODE', 'typo')
    expect(createMediaStorage).toThrow('must be local or r2')
  })

  it('rejects credentials in endpoints and invalid managed config without echoing secrets', () => {
    local()
    vi.stubEnv('LOCAL_R2_ENDPOINT', 'http://secret:private@127.0.0.1:8026')
    expect(createMediaStorage).toThrow('without credentials')
    vi.stubEnv('LOCAL_R2_ENDPOINT', 'secret-invalid-url')
    expect(createMediaStorage).toThrow('LOCAL_R2_ENDPOINT must be a valid HTTP(S) origin.')
    vi.stubEnv('MEDIA_STORAGE_MODE', 'r2')
    vi.stubEnv('CONVEX_SITE_URL', 'https://example.convex.site')
    vi.stubEnv('R2_ENDPOINT', 'https://attacker.example.test')
    expect(createMediaStorage).toThrow('Cloudflare R2 account')
    vi.stubEnv('R2_ENDPOINT', 'https://0123456789abcdef.r2.cloudflarestorage.com')
    vi.stubEnv('R2_BUCKET', 'valid-bucket')
    vi.stubEnv('R2_ACCESS_KEY_ID', '')
    expect(createMediaStorage).toThrow('R2_ACCESS_KEY_ID must be configured')
  })
})
