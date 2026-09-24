import { acquiredEquipmentRulesSchema } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { resolveEquipmentAuthored } from '@artificer-toolkit/shared/subjects/compilers'
import type { EquipmentAuthored, SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { toCharacterBuilderSpellCatalogRecord } from './builderCatalog.js'
import { matchesSpellFilter } from './chosenGrantChoiceResolver.js'

/** Rehydrates only the validated raw mechanics belonging to this acquired Equipment. */
export function readAcquiredEquipmentRules(
  retainedRulesJson: string,
  equipmentId: string,
  systemId: string
) {
  const retained = acquiredEquipmentRulesSchema.parse(JSON.parse(retainedRulesJson))
  if (retained.equipmentId !== equipmentId || retained.systemId !== systemId)
    throw new Error('Acquired Equipment scope mismatch.')
  const documentsById = new Map<string, EquipmentAuthored>()
  const spellsById = new Map<string, SpellAuthored>()
  for (const source of retained.sources) {
    const raw: unknown = JSON.parse(source.documentJson)
    if (checksumRuleDocument(raw) !== source.checksum)
      throw new Error('Acquired source checksum mismatch.')
    if (source.subjectKind === 'EQUIPMENT') {
      const document = equipmentAuthoredDtoSchema.parse(raw)
      if (
        document.id !== source.subjectId ||
        document.systemId !== systemId ||
        (document.status !== undefined && document.status !== 'ACTIVE')
      )
        throw new Error('Acquired Equipment source identity mismatch.')
      // The current DTO checks conditional charge fields before this compiler-type bridge.
      documentsById.set(document.id, document as EquipmentAuthored)
    } else {
      const document = spellAuthoredDtoSchema.parse(raw)
      if (
        document.id !== source.subjectId ||
        document.systemId !== systemId ||
        (document.status !== undefined && document.status !== 'ACTIVE')
      )
        throw new Error('Acquired Spell source identity mismatch.')
      spellsById.set(document.id, document as SpellAuthored)
    }
  }
  const leaf = documentsById.get(equipmentId)
  if (!leaf) throw new Error('Acquired Equipment root is missing.')
  const requiredEquipmentIds = new Set<string>()
  let current = leaf
  while (true) {
    if (requiredEquipmentIds.has(current.id)) throw new Error('Acquired Equipment variant cycle.')
    requiredEquipmentIds.add(current.id)
    if (current.category !== 'VARIANT') break
    const parent = documentsById.get(current.parentEquipmentId)
    if (!parent) throw new Error('Acquired Equipment parent is missing.')
    current = parent
  }
  if (requiredEquipmentIds.size !== documentsById.size)
    throw new Error('Unrelated acquired Equipment source.')
  const equipment = resolveEquipmentAuthored(leaf, (id) => documentsById.get(id))
  const grants = (equipment.features ?? []).flatMap((feature) => [
    ...(feature.grants?.spells ?? []),
    ...('options' in feature
      ? (feature.options ?? []).flatMap((option) => option.grants?.spells ?? [])
      : [])
  ])
  const requiredSpellIds = new Set<string>()
  const allSpellGrants = [] as typeof grants
  for (const grant of grants) {
    const targets = grant.scalingKind === 'PER_LEVEL' ? grant.progression.levels : [grant]
    for (const target of targets) {
      if (target.authoringModeKind === 'SELECTED')
        target.spellIds.forEach((id) => requiredSpellIds.add(id))
      else if (!allSpellGrants.includes(grant)) allSpellGrants.push(grant)
    }
  }
  for (const id of requiredSpellIds)
    if (!spellsById.has(id)) throw new Error('Acquired Spell dependency is missing.')
  for (const [id, spell] of spellsById)
    if (
      !requiredSpellIds.has(id) &&
      !allSpellGrants.some((grant) =>
        matchesSpellFilter(toCharacterBuilderSpellCatalogRecord(spell), grant.filters)
      )
    )
      throw new Error('Unrelated acquired Spell source.')
  return { equipment, spellsById, sources: retained.sources }
}
