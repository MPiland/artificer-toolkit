import {
  acquiredEquipmentRulesSchema,
  type AcquiredPresentation
} from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { canonicalizeRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import type { CompiledEquipment } from '@artificer-toolkit/shared/subjects/compilers'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import {
  canReadAuthoredRoot,
  readAuthoredVersionCompilation,
  readPublishedRootDocument,
  type PublishedDocumentReads
} from './documents'
import { requireEquipmentParents } from './relationshipReads'
import {
  acquiredEquipmentSpellDependencies,
  equipmentPresentation,
  spellPresentation
} from '@artificer-toolkit/rules-runtime/character/acquiredEquipmentRules'

/**
 * Pin acquired mechanics while the caller's current source authority still exists: the stored
 * compilations of the held Equipment and its granted Spells, with their prose (D163).
 */
export async function captureAcquiredEquipmentRules(
  ctx: QueryCtx,
  input: {
    equipmentId: string
    systemId: string
    userId: string | null
    sourceIds: ReadonlySet<string>
    canReadSharedRoot?: (root: Doc<'authoredRoots'>) => Promise<boolean>
    spellRoots: () => Promise<readonly Doc<'authoredRoots'>[]>
    /** A transaction-scoped root lookup; commit reuses the roots it has already read. */
    lookupRoot?: (id: string) => Promise<Doc<'authoredRoots'> | null>
    /** Stored documents the caller's transaction already read; commit reads each once. */
    documents?: PublishedDocumentReads
  }
): Promise<string> {
  async function readRoot(id: string, kind: 'EQUIPMENT' | 'SPELL') {
    const root = input.lookupRoot
      ? await input.lookupRoot(id)
      : await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .unique()
    if (
      !root ||
      root.subjectKind !== kind ||
      root.systemId !== input.systemId ||
      !(
        (input.sourceIds.has(root.contentSourceId) &&
          (await canReadAuthoredRoot(ctx, root, input.userId))) ||
        (await input.canReadSharedRoot?.(root))
      )
    )
      throw new Error('Acquired Equipment dependency is unavailable.')
    return { root, ...(await readPublishedRootDocument(ctx, root, input.documents)) }
  }
  async function pin(
    subjectKind: 'EQUIPMENT' | 'SPELL',
    loaded: Awaited<ReturnType<typeof readRoot>>,
    presentation: AcquiredPresentation
  ) {
    const compilation = await readAuthoredVersionCompilation(ctx, loaded.version)
    if (!compilation || compilation.authoredChecksum !== loaded.root.checksum)
      throw new Error('Acquired source compilation is missing or stale.')
    return {
      subjectKind,
      subjectId: loaded.root.id,
      versionId: loaded.root.currentVersionPublicId,
      version: loaded.version.version,
      checksum: loaded.root.checksum,
      compilation,
      presentation
    }
  }
  const leaf = await readRoot(input.equipmentId, 'EQUIPMENT')
  const document = equipmentAuthoredDtoSchema.parse(leaf.document)
  if (document.status !== undefined && document.status !== 'ACTIVE')
    throw new Error('Acquired Equipment must have an active publication.')
  // Authorizes every variant parent; the stored compilation already holds their resolved rules.
  const ancestors = await requireEquipmentParents(
    ctx,
    document,
    input.userId,
    input.sourceIds,
    input.canReadSharedRoot,
    undefined,
    undefined,
    input.lookupRoot,
    input.documents
  )
  const equipment = await pin('EQUIPMENT', leaf, equipmentPresentation(document))
  const compiled = JSON.parse(equipment.compilation.projectionJson) as CompiledEquipment
  if (
    canonicalizeRuleDocument(compiled.parentEquipmentIds) !==
    canonicalizeRuleDocument([...ancestors.keys()].slice(1))
  )
    throw new Error('Acquired Equipment compilation has stale variant parents.')
  const dependencies = acquiredEquipmentSpellDependencies(compiled)
  const spellIds = new Set(dependencies.selectedSpellIds)
  if (dependencies.hasOpenGrants) {
    for (const root of await input.spellRoots()) {
      const loaded = await readRoot(root.id, 'SPELL')
      const spell = spellAuthoredDtoSchema.parse(loaded.document)
      if (dependencies.matchesOpenGrant(spell)) spellIds.add(spell.id)
    }
  }
  if (spellIds.size > 500)
    throw new Error('Acquired Equipment Spell dependencies exceed the complete catalogue limit.')
  const sources = [equipment]
  for (const id of [...spellIds].sort()) {
    const loaded = await readRoot(id, 'SPELL')
    const spell = spellAuthoredDtoSchema.parse(loaded.document)
    if (spell.status !== undefined && spell.status !== 'ACTIVE')
      throw new Error('Acquired Spell must have an active publication.')
    sources.push(await pin('SPELL', loaded, spellPresentation(spell)))
  }
  return JSON.stringify(
    acquiredEquipmentRulesSchema.parse({
      equipmentId: input.equipmentId,
      systemId: input.systemId,
      sources
    })
  )
}
