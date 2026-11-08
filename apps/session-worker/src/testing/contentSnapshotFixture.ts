import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'

import {
  contentSnapshotDocumentsObjectSchema,
  contentSnapshotIndexObjectSchema,
  contentSnapshotObjectKey,
  type ContentSnapshotDocumentsObject,
  type ContentSnapshotHeader,
  type ContentSnapshotHead
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { compilePublicationDocument } from '@artificer-toolkit/rules-runtime/authoredPublicationCompile'
import { parsePublicationDocument } from '@artificer-toolkit/rules-runtime/authoredPublicationRead'

import { type ContentSnapshotObjectBody } from '../contentSnapshotStorage.js'

export const contentSnapshotFixtureIds = {
  systemId: '00000000-0000-4000-8000-000000000001',
  sourceId: '00000000-0000-4000-8000-000000000002',
  rootId: '00000000-0000-4000-8000-000000000004'
}
const { systemId, sourceId, rootId } = contentSnapshotFixtureIds

export function headerOf({ format, scope, scopeId, kind, part }: ContentSnapshotHeader) {
  return { format, scope, scopeId, kind, part }
}

/** A published RACE documents object holding one root, as the snapshot builder stores it. */
export function raceDocuments(
  scope: 'SOURCE' | 'CAMPAIGN',
  scopeId: string,
  label = 'Source race'
) {
  const root = {
    id: rootId,
    label,
    userId: sourceId,
    systemId,
    category: 'BASE',
    selectionMode: 'DIRECT',
    size: 'MEDIUM',
    speeds: []
  }
  const compilation = compilePublicationDocument(parsePublicationDocument('RACE', root))
  return contentSnapshotDocumentsObjectSchema.parse({
    format: 3,
    scope,
    scopeId,
    kind: 'RACE',
    part: 'documents',
    roots: [root],
    versions: [
      {
        identity: {
          subjectKind: 'RACE',
          subjectId: rootId,
          systemId,
          contentSourceId: scope === 'SOURCE' ? scopeId : sourceId,
          versionId: rootId,
          checksum: compilation.authoredChecksum
        },
        version: 1,
        storedParentId: null
      }
    ],
    compilations: [compilation]
  })
}

export function raceIndex(object: ContentSnapshotDocumentsObject) {
  return contentSnapshotIndexObjectSchema.parse({
    ...headerOf(object),
    part: 'index',
    roots: object.roots.map(({ id, label }) => ({
      id,
      label,
      category: 'BASE',
      selectionMode: 'DIRECT',
      size: 'MEDIUM',
      speeds: [],
      abilityScoreIncreaseFacts: []
    }))
  })
}

/** An in-memory content snapshot bucket: `add` stores a head's objects, `get` reads them like R2. */
export function contentSnapshotBucket() {
  const stored = new Map<string, { bytes: Uint8Array; gzip: boolean }>()
  function add(object: ContentSnapshotDocumentsObject, gzip = false) {
    const parts = [raceIndex(object), object].map((part) => {
      const json = canonicalizeJson(part)
      const ref = {
        sha256: createHash('sha256').update(json).digest('hex'),
        byteLength: new TextEncoder().encode(json).byteLength,
        rootCount: part.roots.length
      }
      const key = contentSnapshotObjectKey(headerOf(part), ref.sha256)
      stored.set(key, { bytes: gzip ? gzipSync(json) : new TextEncoder().encode(json), gzip })
      return { key, ref }
    })
    const head: ContentSnapshotHead = {
      scope: object.scope,
      scopeId: object.scopeId,
      revision: 1,
      builtRevision: 1,
      kinds: { RACE: { index: parts[0]!.ref, list: parts[1]!.ref, documents: parts[1]!.ref } }
    }
    return { head, documentsKey: parts[1]!.key }
  }
  async function get(key: string): Promise<ContentSnapshotObjectBody | null> {
    const object = stored.get(key)
    return object
      ? {
          body: new Blob([object.bytes]).stream(),
          httpEtag: 'fixture-etag',
          customMetadata: {},
          httpMetadata: {
            contentType: 'application/json',
            contentEncoding: object.gzip ? 'gzip' : undefined
          }
        }
      : null
  }
  return { stored, add, get }
}
