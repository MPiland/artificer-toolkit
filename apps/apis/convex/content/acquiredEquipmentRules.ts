import {
  acquiredEquipmentRulesSchema,
  type AcquiredPresentation
} from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import { canonicalizeRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import type { CompiledEquipment } from '@artificer-toolkit/shared/subjects/compilers'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import {
  canReadAuthoredRoot,
  readAuthoredVersion,
  readAuthoredVersionCompilation
} from './documents'
import { readRootCatalogue } from './catalogueMetadata'
import { requireParentRoots } from './relationshipReads'
import {
  acquiredEquipmentSpellDependencies,
  equipmentPresentation,
  spellPresentation
} from '@artificer-toolkit/rules-runtime/character/acquiredEquipmentRules'

/**
 * Pin acquired mechanics while the caller's current source authority still exists: the stored
 * compilations of the held Equipment and its granted Spells, with their prose (D163). Reads root
 * rows, their catalogue facts and stored compilations only, never an authored payload.
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
    const catalogue = readRootCatalogue(root)
    if (!catalogue.publishedActive)
      throw new Error(
        `Acquired ${kind === 'EQUIPMENT' ? 'Equipment' : 'Spell'} must have an active publication.`
      )
    return { root, catalogue }
  }
  async function pin(
    subjectKind: 'EQUIPMENT' | 'SPELL',
    root: Doc<'authoredRoots'>,
    presentation: AcquiredPresentation
  ) {
    // Authored payloads are chunked, so the version row carries identity and number only.
    const version = await readAuthoredVersion(ctx, root)
    const compilation = await readAuthoredVersionCompilation(ctx, version)
    if (!compilation || compilation.authoredChecksum !== root.checksum)
      throw new Error('Acquired source compilation is missing or stale.')
    return {
      subjectKind,
      subjectId: root.id,
      versionId: root.currentVersionPublicId,
      version: version.version,
      checksum: root.checksum,
      compilation,
      presentation
    }
  }
  const leaf = await readRoot(input.equipmentId, 'EQUIPMENT')
  if (!leaf.catalogue.equipment) throw new Error('Stored Equipment catalogue facts are missing.')
  // Authorizes every variant parent; the stored compilation already holds their resolved rules.
  const ancestors = await requireParentRoots(ctx, leaf.root, {
    userId: input.userId,
    allowedSourceIds: input.sourceIds,
    canReadSharedRoot: input.canReadSharedRoot,
    readRoot: input.lookupRoot
  })
  const equipment = await pin(
    'EQUIPMENT',
    leaf.root,
    equipmentPresentation({
      label: leaf.root.label,
      description: leaf.catalogue.description,
      ...leaf.catalogue.equipment
    })
  )
  const compiled = JSON.parse(equipment.compilation.projectionJson) as CompiledEquipment
  if (
    canonicalizeRuleDocument(compiled.parentEquipmentIds) !==
    canonicalizeRuleDocument(ancestors.map((ancestor) => ancestor.id))
  )
    throw new Error('Acquired Equipment compilation has stale variant parents.')
  const dependencies = acquiredEquipmentSpellDependencies(compiled)
  const spellIds = new Set(dependencies.selectedSpellIds)
  if (dependencies.hasOpenGrants) {
    for (const root of await input.spellRoots()) {
      const { spell } = (await readRoot(root.id, 'SPELL')).catalogue
      if (spell?.selectionVersion !== 1) throw new Error('Stored Spell selector facts are missing.')
      if (dependencies.matchesOpenGrant({ id: root.id, ...spell })) spellIds.add(root.id)
    }
  }
  if (spellIds.size > 500)
    throw new Error('Acquired Equipment Spell dependencies exceed the complete catalogue limit.')
  const sources = [equipment]
  for (const id of [...spellIds].sort()) {
    const { root, catalogue } = await readRoot(id, 'SPELL')
    if (!catalogue.spell || catalogue.description === null)
      throw new Error('Stored Spell catalogue facts are missing.')
    const { materialDescription } = catalogue.spell
    sources.push(
      await pin(
        'SPELL',
        root,
        spellPresentation({
          label: root.label,
          description: catalogue.description,
          ...(materialDescription === undefined ? {} : { materialDescription })
        })
      )
    )
  }
  return JSON.stringify(
    acquiredEquipmentRulesSchema.parse({
      equipmentId: input.equipmentId,
      systemId: input.systemId,
      sources
    })
  )
}
