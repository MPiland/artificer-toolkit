import {
  contentSnapshotDocumentsObjectSchema,
  contentSnapshotIndexObjectSchema,
  contentSnapshotKindSchema,
  contentSnapshotManifestDtoSchema,
  contentSnapshotObjectKey,
  type ContentSnapshotObject,
  type ContentSnapshotHead,
  type ContentSnapshotManifestDto
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'

import {
  readContentSnapshotObject,
  type ContentSnapshotStorageEnvironment
} from './contentSnapshotStorage.js'

async function boundedBytes(
  body: ReadableStream<Uint8Array>,
  maximum: number
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maximum) {
        await reader.cancel()
        throw new Error('Content snapshot exceeds its manifest byte length.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

/** Reads current, epoch-authorized SOURCE/CAMPAIGN index and document heads supplied by Convex. */
export async function loadRoomContentSnapshots(
  environment: ContentSnapshotStorageEnvironment & { CONVEX_SITE_URL: string },
  manifest: ContentSnapshotManifestDto,
  campaignId: string
): Promise<ContentSnapshotObject[]> {
  const checked = contentSnapshotManifestDtoSchema.parse(manifest)
  if (!checked.campaign || checked.campaign.id !== campaignId)
    throw new Error('Content snapshot manifest Campaign does not match the room.')
  if (environment.LOCAL_CONTENT_SNAPSHOT_ORIGIN !== undefined) {
    const site = new URL(environment.CONVEX_SITE_URL)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(site.hostname))
      throw new Error('Local content snapshots require a loopback Convex site.')
  }
  const heads: ContentSnapshotHead[] = []
  const sources = new Set<string>()
  const requireHead = (
    head: ContentSnapshotHead | null,
    scope: 'SOURCE' | 'CAMPAIGN',
    id: string
  ) => {
    if (
      !head ||
      head.scope !== scope ||
      head.scopeId !== id ||
      (head.builtRevision === 0 && Object.keys(head.kinds).length > 0) ||
      head.builtRevision !== head.revision
    )
      throw new Error('Content snapshot head is unavailable, stale or outside the room scope.')
    heads.push(head)
  }
  for (const source of checked.sources) {
    if (sources.has(source.contentSourceId))
      throw new Error('Content snapshot source is duplicated.')
    sources.add(source.contentSourceId)
    requireHead(source.head, 'SOURCE', source.contentSourceId)
  }
  requireHead(checked.campaign.head, 'CAMPAIGN', campaignId)
  const objects: ContentSnapshotObject[] = []
  const hashes = new Set<string>()
  for (const head of heads) {
    for (const kind of contentSnapshotKindSchema.options) {
      const refs = head.kinds[kind]
      if (!refs) continue
      for (const part of ['index', 'documents'] as const) {
        const ref = refs[part]
        if (hashes.has(ref.sha256)) throw new Error('Content snapshot object is duplicated.')
        hashes.add(ref.sha256)
        const header = {
          format: 2 as const,
          scope: head.scope,
          scopeId: head.scopeId,
          kind,
          part
        }
        const object = await readContentSnapshotObject(
          environment,
          contentSnapshotObjectKey(header, ref.sha256)
        )
        if (!object) throw new Error('Content snapshot object is unavailable.')
        const encoding = object.httpMetadata?.contentEncoding
        if (encoding !== undefined && encoding !== 'gzip') {
          await object.body.cancel()
          throw new Error('Content snapshot encoding is unsupported.')
        }
        // Gzip framing can exceed a small JSON body; both stored and decoded reads remain bounded.
        const stored = await boundedBytes(
          object.body,
          encoding === 'gzip' ? ref.byteLength * 2 + 1024 : ref.byteLength
        )
        const bytes =
          encoding === 'gzip'
            ? await boundedBytes(
                new Blob([stored]).stream().pipeThrough(new DecompressionStream('gzip')),
                ref.byteLength
              )
            : stored
        if (bytes.byteLength !== ref.byteLength)
          throw new Error('Content snapshot byte length does not match its manifest.')
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
        const hash = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
        if (hash !== ref.sha256)
          throw new Error('Content snapshot hash does not match its manifest.')
        const json = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
        const parsed =
          part === 'index'
            ? contentSnapshotIndexObjectSchema.parse(JSON.parse(json))
            : contentSnapshotDocumentsObjectSchema.parse(JSON.parse(json))
        if (
          parsed.scope !== header.scope ||
          parsed.scopeId !== header.scopeId ||
          parsed.kind !== kind ||
          parsed.part !== part ||
          parsed.format !== 2
        )
          throw new Error('Content snapshot header does not match its manifest.')
        if (parsed.roots.length !== ref.rootCount)
          throw new Error('Content snapshot root count does not match its manifest.')
        if (parsed.roots.some((root, index) => index > 0 && parsed.roots[index - 1]!.id >= root.id))
          throw new Error('Content snapshot roots are duplicated or unordered.')
        if (
          parsed.part === 'documents' &&
          parsed.roots.some((root) => root.systemId !== checked.systemId)
        )
          throw new Error('Content snapshot documents are outside the System.')
        if (canonicalizeJson(parsed) !== json)
          throw new Error('Content snapshot document is not canonical.')
        objects.push(parsed)
      }
    }
  }
  return objects
}
