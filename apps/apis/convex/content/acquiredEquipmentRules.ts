import { acquiredEquipmentRulesSchema } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { canonicalizeRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { canReadAuthoredRoot, readAuthoredVersion, readPublishedDocument } from './documents'
import { compileCurrentEquipment } from './equipmentRelationships'
import { matchesSpellFilter } from '@artificer-toolkit/rules-runtime/character/chosenGrantChoiceResolver'
import { toCharacterBuilderSpellCatalogRecord } from '@artificer-toolkit/rules-runtime/character/builderCatalog'

/** Capture raw acquired mechanics while the caller's current source authority still exists. */
export async function captureAcquiredEquipmentRules(
  ctx: QueryCtx,
  input: {
    equipmentId: string
    systemId: string
    userId: string | null
    sourceIds: ReadonlySet<string>
    canReadSharedRoot?: (root: Doc<'authoredRoots'>) => Promise<boolean>
    spellRoots: () => Promise<readonly Doc<'authoredRoots'>[]>
  }
): Promise<string> {
  async function readRoot(id: string, kind: 'EQUIPMENT' | 'SPELL') {
    const root = await ctx.db
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
    const version = await readAuthoredVersion(ctx, root)
    const document = await readPublishedDocument(ctx, root, version)
    return { root, version, document }
  }
  const leaf = await readRoot(input.equipmentId, 'EQUIPMENT')
  const document = equipmentAuthoredDtoSchema.parse(leaf.document)
  if (document.status !== undefined && document.status !== 'ACTIVE')
    throw new Error('Acquired Equipment must have an active publication.')
  const compiled = await compileCurrentEquipment(
    ctx,
    document,
    input.userId,
    input.sourceIds,
    input.canReadSharedRoot
  )
  const sources: Array<{
    subjectKind: 'EQUIPMENT' | 'SPELL'
    subjectId: string
    versionId: string
    version: number
    checksum: string
    documentJson: string
  }> = []
  for (const id of compiled.documentsById.keys()) {
    const {
      root,
      version,
      document: sourceDocument
    } = id === leaf.root.id ? leaf : await readRoot(id, 'EQUIPMENT')
    sources.push({
      subjectKind: 'EQUIPMENT',
      subjectId: id,
      versionId: root.currentVersionPublicId,
      version: version.version,
      checksum: root.checksum,
      documentJson: canonicalizeRuleDocument(sourceDocument)
    })
  }
  const grants = (compiled.effective.features ?? []).flatMap((feature) => [
    ...(feature.grants?.spells ?? []),
    ...('options' in feature
      ? (feature.options ?? []).flatMap((option) => option.grants?.spells ?? [])
      : [])
  ])
  const spellIds = new Set<string>()
  const allGrants = [] as typeof grants
  for (const grant of grants) {
    const targets = grant.scalingKind === 'PER_LEVEL' ? grant.progression.levels : [grant]
    for (const target of targets) {
      if (target.authoringModeKind === 'SELECTED') target.spellIds.forEach((id) => spellIds.add(id))
      else if (!allGrants.includes(grant)) allGrants.push(grant)
    }
  }
  if (allGrants.length) {
    for (const root of await input.spellRoots()) {
      const loaded = await readRoot(root.id, 'SPELL')
      const spell = spellAuthoredDtoSchema.parse(loaded.document)
      const record = toCharacterBuilderSpellCatalogRecord(spell)
      if (allGrants.some((grant) => matchesSpellFilter(record, grant.filters)))
        spellIds.add(spell.id)
    }
  }
  if (spellIds.size > 500)
    throw new Error('Acquired Equipment Spell dependencies exceed the complete catalogue limit.')
  for (const id of [...spellIds].sort()) {
    const { root, version, document: raw } = await readRoot(id, 'SPELL')
    spellAuthoredDtoSchema.parse(raw)
    sources.push({
      subjectKind: 'SPELL',
      subjectId: id,
      versionId: root.currentVersionPublicId,
      version: version.version,
      checksum: root.checksum,
      documentJson: canonicalizeRuleDocument(raw)
    })
  }
  return JSON.stringify(
    acquiredEquipmentRulesSchema.parse({
      equipmentId: input.equipmentId,
      systemId: input.systemId,
      sources
    })
  )
}
