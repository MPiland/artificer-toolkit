/**
 * The local-origin marker is absent from every deployed environment. Local development is an
 * `http://127.0.0.1:<port>` fixture origin: any port, but never https, `localhost` or another host.
 * It lives here, free of Worker globals, because Convex tests import this module's types.
 */
export function isLocalDevelopment(environment: {
  LOCAL_CONTENT_SNAPSHOT_ORIGIN?: string | undefined
}): boolean {
  const port = /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/.exec(
    environment.LOCAL_CONTENT_SNAPSHOT_ORIGIN ?? ''
  )?.[1]
  return port !== undefined && Number(port) <= 65535
}

/** The raw R2 surface used by room hydration and browser delivery. */
export interface ContentSnapshotObjectBody {
  body: ReadableStream<Uint8Array>
  customMetadata?: Record<string, string>
  httpMetadata?: { contentType?: string; contentEncoding?: string }
  httpEtag: string
}

export interface ContentSnapshotStorageEnvironment {
  LOCAL_CONTENT_SNAPSHOT_ORIGIN?: string
  CONTENT_SNAPSHOTS: { get(key: string): Promise<ContentSnapshotObjectBody | null> }
}

export async function readContentSnapshotObject(
  environment: ContentSnapshotStorageEnvironment,
  key: string
): Promise<ContentSnapshotObjectBody | null> {
  const localOrigin = environment.LOCAL_CONTENT_SNAPSHOT_ORIGIN
  if (localOrigin === undefined) return environment.CONTENT_SNAPSHOTS.get(key)
  if (!isLocalDevelopment(environment))
    throw new Error('Local content snapshot delivery is not available.')
  const response = await fetch(`${localOrigin}/artificer-local-content-snapshots/${key}`, {
    redirect: 'manual',
    headers: {
      authorization: 'AWS4-HMAC-SHA256 Credential=local-media-access-key/local-fixture',
      // The fixture omits Content-Encoding to prevent fetch decoding the stored gzip bytes.
      'x-artificer-local-raw-body': '1'
    }
  })
  if (response.status !== 200) {
    await response.body?.cancel()
    if (response.status === 404) return null
    throw new Error('Content snapshot is not available.')
  }
  if (!response.body) throw new Error('Content snapshot is not available.')
  return {
    body: response.body,
    customMetadata: Object.fromEntries(
      [...response.headers].flatMap(([name, value]) =>
        name.startsWith('x-amz-meta-') ? [[name.slice('x-amz-meta-'.length), value]] : []
      )
    ),
    httpMetadata: {
      contentType: response.headers.get('content-type') ?? 'application/json',
      contentEncoding: response.headers.get('x-artificer-content-encoding') ?? undefined
    },
    httpEtag: response.headers.get('etag') ?? ''
  }
}
