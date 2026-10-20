import type { AuthoredPublicationDocument } from '@artificer-toolkit/schema/api/authoredPublication'
import { parsePublicationDocument } from '../authoredPublicationRead.js'
import { storedCompilationOf } from './storedCompilations.js'

const DEFAULT_SOURCE_VERSION_ID = '00000000-0000-4000-8000-00000000e002'

function variantAncestors(
  document: unknown,
  lookupParent: (id: string) => unknown,
  depth = 0
): AuthoredPublicationDocument[] {
  const publication = parsePublicationDocument('EQUIPMENT', document)
  if (publication.subjectKind !== 'EQUIPMENT' || publication.document.category !== 'VARIANT')
    return []
  if (depth > 16) throw new Error('Equipment variant ancestry is too deep.')
  const parent = lookupParent(publication.document.parentEquipmentId)
  // A missing parent is left for the resolver to report.
  return parent === undefined
    ? []
    : [
        parsePublicationDocument('EQUIPMENT', parent),
        ...variantAncestors(parent, lookupParent, depth + 1)
      ]
}

/**
 * The Equipment source a reader serves for a published version (D163): its document and the real
 * compiler's stored compilation. A variant is compiled against the ancestors `lookupParent` finds,
 * as publication resolves it.
 */
export function storedEquipmentSource(
  document: unknown,
  lookupParent: (id: string) => unknown = () => undefined,
  identity: { version?: number; versionId?: string } = {}
) {
  const compilation = storedCompilationOf(
    parsePublicationDocument('EQUIPMENT', document),
    variantAncestors(document, lookupParent)
  )
  return {
    document,
    checksum: compilation.authoredChecksum,
    version: identity.version ?? 1,
    versionId: identity.versionId ?? DEFAULT_SOURCE_VERSION_ID,
    compilation
  }
}
