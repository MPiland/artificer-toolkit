import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage } from 'node:http'

// Independent SigV4 verification for presigned PUTs. Actual R2 enforcement is
// also checked in the bounded dev integration; local tests never use real keys.
function validPutSignature(url: URL, request: IncomingMessage) {
  const encode = (value: string) =>
    encodeURIComponent(value).replace(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
    )
  const credential = url.searchParams.get('X-Amz-Credential')?.split('/')
  const signedHeaders = url.searchParams.get('X-Amz-SignedHeaders') ?? ''
  const signature = url.searchParams.get('X-Amz-Signature') ?? ''
  if (!credential || credential.length !== 5 || !/^[a-f0-9]{64}$/.test(signature)) return false
  const headers = signedHeaders
    .split(';')
    .map((name) => {
      const value = request.headers[name]
      return `${name}:${String(value ?? '')
        .trim()
        .replace(/\s+/g, ' ')}\n`
    })
    .join('')
  const query = [...url.searchParams]
    .filter(([key]) => key !== 'X-Amz-Signature')
    .map(([key, value]) => `${encode(key)}=${encode(value)}`)
    .sort()
    .join('&')
  const canonical = [
    'PUT',
    url.pathname,
    query,
    headers,
    signedHeaders,
    url.searchParams.get('X-Amz-Content-Sha256') ?? 'UNSIGNED-PAYLOAD'
  ].join('\n')
  const scope = credential.slice(1).join('/')
  const toSign = [
    'AWS4-HMAC-SHA256',
    url.searchParams.get('X-Amz-Date'),
    scope,
    createHash('sha256').update(canonical).digest('hex')
  ].join('\n')
  let key = Buffer.from('AWS4local-media-secret-key')
  for (const part of credential.slice(1)) key = createHmac('sha256', key).update(part).digest()
  return timingSafeEqual(
    createHmac('sha256', key).update(toSign).digest(),
    Buffer.from(signature, 'hex')
  )
}

/** Local protocol substitute. Container callers must publish only on host loopback.
 * Cloudflare signature enforcement remains promotion proof. */
export async function startLocalR2(
  options: { port?: number; host?: '127.0.0.1' | '0.0.0.0' } = {}
) {
  type StoredObject = {
    body: Buffer
    contentType: string
    // S3 user metadata (`x-amz-meta-*`), which R2 exposes as custom metadata.
    metadata?: Record<string, string>
    modified: Date
  }
  const objects = new Map<string, StoredObject>()
  // ADR 0036 content snapshots live in their own private bucket, apart from media.
  const contentSnapshotObjects = new Map<string, StoredObject>()
  const buckets = new Map([
    ['/artificer-local-media/', objects],
    ['/artificer-local-content-snapshots/', contentSnapshotObjects]
  ])
  const methods: string[] = []
  const faults: { rejectDeletes: boolean; rejectPutKey: string | null; getStatus: number | null } =
    {
      rejectDeletes: false,
      rejectPutKey: null,
      getStatus: null
    }
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')

      // Identifies this fixture to scripts/localConvexFixtures.ps1; it exposes no object state.
      if (url.pathname === '/health' && request.method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'text/plain' }).end('artificer-local-r2')
        return
      }
      const [prefix, bucket] = [...buckets].find(([path]) => url.pathname.startsWith(path)) ?? []
      if (!prefix || !bucket) {
        response.writeHead(404).end()
        return
      }
      const browserOrigin = request.headers.origin
      if (browserOrigin === 'http://localhost:3000' || browserOrigin === 'http://127.0.0.1:3000') {
        response.setHeader('Access-Control-Allow-Origin', browserOrigin)
        response.setHeader('Vary', 'Origin')
        if (request.method === 'OPTIONS') {
          response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, DELETE')
          response.setHeader('Access-Control-Allow-Headers', 'content-type')
          response.writeHead(204).end()
          return
        }
      }
      const credential =
        url.searchParams.get('X-Amz-Credential') ?? request.headers.authorization ?? ''
      if (!credential.includes('local-media-access-key/')) {
        response.writeHead(403).end()
        return
      }
      const key = decodeURIComponent(url.pathname.slice(prefix.length))
      methods.push(request.method ?? '')
      if (request.method === 'PUT') {
        if (faults.rejectPutKey === key) {
          response.writeHead(403).end()
          return
        }
        if (url.searchParams.has('X-Amz-Signature') && !validPutSignature(url, request)) {
          response.writeHead(403).end()
          return
        }
        const chunks: Buffer[] = []
        let length = 0
        for await (const chunk of request) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          length += buffer.byteLength
          if (length > 25 * 1024 * 1024) {
            response.writeHead(413).end()
            return
          }
          chunks.push(buffer)
        }
        const body = Buffer.concat(chunks)
        bucket.set(key, {
          body,
          contentType: request.headers['content-type'] ?? 'application/octet-stream',
          metadata: Object.fromEntries(
            Object.entries(request.headers).flatMap(([name, value]) =>
              name.startsWith('x-amz-meta-') && typeof value === 'string'
                ? [[name.slice('x-amz-meta-'.length), value]]
                : []
            )
          ),
          modified: new Date()
        })
        response.setHeader('ETag', `"${createHash('md5').update(body).digest('hex')}"`)
        response.writeHead(200).end()
        return
      }
      if (request.method === 'DELETE') {
        if (faults.rejectDeletes) {
          response.writeHead(403).end()
          return
        }
        bucket.delete(key)
        response.writeHead(204).end()
        return
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405).end()
        return
      }
      if (request.method === 'GET' && faults.getStatus !== null) {
        response.writeHead(faults.getStatus).end()
        return
      }
      const object = bucket.get(key)
      if (!object) {
        response.writeHead(404).end()
        return
      }
      response.setHeader('Content-Length', object.body.byteLength)
      response.setHeader('Content-Type', object.contentType)
      response.setHeader('Last-Modified', object.modified.toUTCString())
      response.writeHead(200).end(request.method === 'HEAD' ? undefined : object.body)
    })().catch(() => {
      if (!response.headersSent) response.writeHead(500)
      response.end()
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port ?? 0, options.host ?? '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Local R2 did not bind a port.')
  return {
    endpoint: `http://127.0.0.1:${address.port}`,
    objects,
    contentSnapshotObjects,
    methods,
    faults,
    close: async () => {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    }
  }
}
