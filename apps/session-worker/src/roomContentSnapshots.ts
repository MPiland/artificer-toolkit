import {
  contentSnapshotDocumentsObjectSchema,
  contentSnapshotIndexObjectSchema,
  contentSnapshotKindSchema,
  contentSnapshotManifestDtoSchema,
  contentSnapshotObjectKey,
  type ContentSnapshotObject,
  type ContentSnapshotHead,
  type ContentSnapshotHeader,
  type ContentSnapshotManifestDto,
  type ContentSnapshotObjectRef
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

type ContentSnapshotObjectHeader = ContentSnapshotHeader & { part: 'index' | 'documents' }

/**
 * Concurrent storage reads one room keeps open. Workers allow six simultaneous open connections per
 * invocation; more would only queue there.
 */
const CONTENT_READ_CONCURRENCY = 6

/** Reads, bounds, decodes and verifies one stored object against its manifest reference. */
async function readVerifiedObject(
  environment: ContentSnapshotStorageEnvironment,
  header: ContentSnapshotObjectHeader,
  ref: ContentSnapshotObjectRef
): Promise<ContentSnapshotObject> {
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
  if (hash !== ref.sha256) throw new Error('Content snapshot hash does not match its manifest.')
  const json = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  const parsed =
    header.part === 'index'
      ? contentSnapshotIndexObjectSchema.parse(JSON.parse(json))
      : contentSnapshotDocumentsObjectSchema.parse(JSON.parse(json))
  if (
    parsed.scope !== header.scope ||
    parsed.scopeId !== header.scopeId ||
    parsed.kind !== header.kind ||
    parsed.part !== header.part ||
    parsed.format !== 3
  )
    throw new Error('Content snapshot header does not match its manifest.')
  if (parsed.roots.some((root, index) => index > 0 && parsed.roots[index - 1]!.id >= root.id))
    throw new Error('Content snapshot roots are duplicated or unordered.')
  if (canonicalizeJson(parsed) !== json)
    throw new Error('Content snapshot document is not canonical.')
  return parsed
}

/**
 * The room's content snapshot loader. Objects are content-addressed, so the Campaign and every
 * Character manifest that share a source share its objects: each is read and verified once, at most
 * {@link CONTENT_READ_CONCURRENCY} at a time. Only the latest object of each scope, kind and part
 * is kept, so memory stays bounded by the room's current heads. The objects live as long as the
 * room instance; a room woken from hibernation reads them again.
 */
export class RoomContentSnapshots {
  readonly #environment: ContentSnapshotStorageEnvironment & { CONVEX_SITE_URL: string }
  readonly #objects = new Map<string, { key: string; object: Promise<ContentSnapshotObject> }>()
  readonly #waiting: (() => void)[] = []
  #reading = 0

  constructor(environment: ContentSnapshotStorageEnvironment & { CONVEX_SITE_URL: string }) {
    this.#environment = environment
  }

  /** Reads current, epoch-authorized SOURCE/CAMPAIGN index and document heads supplied by Convex. */
  async load(
    manifest: ContentSnapshotManifestDto,
    campaignId: string
  ): Promise<ContentSnapshotObject[]> {
    const checked = contentSnapshotManifestDtoSchema.parse(manifest)
    if (!checked.campaign || checked.campaign.id !== campaignId)
      throw new Error('Content snapshot manifest Campaign does not match the room.')
    if (this.#environment.LOCAL_CONTENT_SNAPSHOT_ORIGIN !== undefined) {
      const site = new URL(this.#environment.CONVEX_SITE_URL)
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
    const entries: { header: ContentSnapshotObjectHeader; ref: ContentSnapshotObjectRef }[] = []
    const hashes = new Set<string>()
    for (const head of heads) {
      for (const kind of contentSnapshotKindSchema.options) {
        const refs = head.kinds[kind]
        if (!refs) continue
        for (const part of ['index', 'documents'] as const) {
          const ref = refs[part]
          if (hashes.has(ref.sha256)) throw new Error('Content snapshot object is duplicated.')
          hashes.add(ref.sha256)
          entries.push({
            header: { format: 3, scope: head.scope, scopeId: head.scopeId, kind, part },
            ref
          })
        }
      }
    }
    const objects = await Promise.all(entries.map(({ header, ref }) => this.#object(header, ref)))
    return objects.map((object, index) => {
      if (object.roots.length !== entries[index]!.ref.rootCount)
        throw new Error('Content snapshot root count does not match its manifest.')
      if (
        object.part === 'documents' &&
        object.roots.some((root) => root.systemId !== checked.systemId)
      )
        throw new Error('Content snapshot documents are outside the System.')
      return object
    })
  }

  /** The verified object, shared with every manifest that references the same stored bytes. */
  #object(header: ContentSnapshotObjectHeader, ref: ContentSnapshotObjectRef) {
    const slot = canonicalizeJson([header.scope, header.scopeId, header.kind, header.part])
    const key = canonicalizeJson([ref.sha256, ref.byteLength])
    const held = this.#objects.get(slot)
    if (held?.key === key) return held.object
    const entry = {
      key,
      object: this.#limited(() => readVerifiedObject(this.#environment, header, ref))
    }
    this.#objects.set(slot, entry)
    // A failed read is not kept, so the next load reads it again.
    entry.object.catch(() => {
      if (this.#objects.get(slot) === entry) this.#objects.delete(slot)
    })
    return entry.object
  }

  async #limited<T>(read: () => Promise<T>): Promise<T> {
    if (this.#reading < CONTENT_READ_CONCURRENCY) this.#reading++
    else await new Promise<void>((resolve) => this.#waiting.push(resolve))
    try {
      return await read()
    } finally {
      // A finished read hands its slot straight to the next waiting one.
      const next = this.#waiting.shift()
      if (next) next()
      else this.#reading--
    }
  }
}
