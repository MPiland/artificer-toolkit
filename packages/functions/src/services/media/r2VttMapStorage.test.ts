import { describe, expect, it } from 'vitest'

import { R2VttMapStorage } from './r2VttMapStorage.js'

describe('R2 VTT map storage', () => {
  it('pins multipart part URLs and keeps credentials server-side', async () => {
    const requests: Request[] = []
    const fetchImplementation = (async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input)
      requests.push(request.clone())
      const url = new URL(request.url)
      if (request.method === 'POST' && url.searchParams.has('uploads')) {
        return new Response(
          '<InitiateMultipartUploadResult><UploadId>upload-1</UploadId></InitiateMultipartUploadResult>'
        )
      }
      if (request.method === 'GET' && url.searchParams.get('list-type') === '2') {
        return new Response(
          '<ListBucketResult><Contents><Key>ready/user/a&amp;b.webp</Key></Contents></ListBucketResult>'
        )
      }
      return new Response('', { status: 200 })
    }) as typeof fetch
    const storage = new R2VttMapStorage(
      {
        accessKeyId: 'access-key',
        bucket: 'vtt-map-test',
        endpoint: 'https://account.r2.cloudflarestorage.com',
        secretAccessKey: 'secret-key'
      },
      fetchImplementation
    )

    expect(await storage.createMultipartUpload('raw/user/map.png', 'image/png')).toBe('upload-1')
    const parts = await storage.createMultipartPartUrls('raw/user/map.png', 'upload-1', 2, 7200)
    expect(parts.map((part) => part.partNumber)).toEqual([1, 2])
    for (const part of parts) {
      const url = new URL(part.url)
      expect(url.searchParams.get('partNumber')).toBe(String(part.partNumber))
      expect(url.searchParams.get('uploadId')).toBe('upload-1')
      expect(url.searchParams.get('X-Amz-Expires')).toBe('7200')
      expect(url.searchParams.has('X-Amz-Signature')).toBe(true)
      expect(part.url).not.toContain('secret-key')
    }

    await storage.completeMultipartUpload('raw/user/map.png', 'upload-1', [
      { partNumber: 1, etag: '"one&two"' },
      { partNumber: 2, etag: '"three"' }
    ])
    expect(await requests[1]!.text()).toContain('<ETag>&quot;one&amp;two&quot;</ETag>')
    expect(await storage.list('ready/user/')).toEqual(['ready/user/a&b.webp'])

    const delivery = new URL(await storage.signedDownloadUrl('ready/user/map.webp', 3600))
    expect(delivery.searchParams.get('X-Amz-Expires')).toBe('3600')
    expect(delivery.searchParams.has('X-Amz-Signature')).toBe(true)
  })
})
