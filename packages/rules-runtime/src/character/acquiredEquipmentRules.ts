import {
  acquiredEquipmentRulesSchema,
  type AcquiredPresentation
} from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { SpellAuthoredDto } from '@artificer-toolkit/schema/subjects/spell'
import type { CompiledSpellGrant } from '@artificer-toolkit/shared/compilers'
import type { CompiledEquipment, CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { createContentMemo } from '@artificer-toolkit/shared/contentMemo'
import { hydrateStoredCompilation } from '../authoredPublicationHydrate.js'
import { matchesSpellFilter } from './chosenGrantChoiceResolver.js'

// Parsed and verified retained rules by their exact JSON: party pages and Sheets re-read the same
// few snapshots on every query.
const retainedRules = createContentMemo<ReturnType<typeof parseAcquiredEquipmentRules>>()

/** Hydrates the pinned compiled mechanics and prose of this acquired Equipment; nothing compiles. */
export function readAcquiredEquipmentRules(
  retainedRulesJson: string,
  equipmentId: string,
  systemId: string
) {
  // A hit was parsed under some caller's scope, so the scope is checked again on every read.
  const rules = retainedRules(retainedRulesJson, (json) =>
    parseAcquiredEquipmentRules(json, equipmentId, systemId)
  )
  if (rules.equipmentId !== equipmentId || rules.systemId !== systemId)
    throw new Error('Acquired Equipment scope mismatch.')
  return {
    equipment: rules.equipment,
    presentation: rules.presentation,
    spellsById: rules.spellsById,
    sources: rules.sources
  }
}

/** The prose a held Equipment keeps after its source changes or is deleted. */
export function equipmentPresentation(
  document: Pick<EquipmentAuthoredDto, 'label' | 'description' | 'quote'>
): AcquiredPresentation {
  return {
    label: document.label,
    description: document.description,
    ...(document.quote === undefined ? {} : { quote: document.quote })
  }
}

/** The prose a retained Spell keeps after its source changes or is deleted. */
export function spellPresentation(
  spell: Pick<SpellAuthoredDto, 'label' | 'description' | 'materialDescription'>
): AcquiredPresentation {
  return {
    label: spell.label,
    description: spell.description,
    ...(spell.materialDescription === undefined
      ? {}
      : { materialDescription: spell.materialDescription })
  }
}

/** The Spells a held Equipment's grants depend on: the ids they name, and the filters they open. */
export function acquiredEquipmentSpellDependencies(equipment: CompiledEquipment) {
  const grants = (equipment.features ?? []).flatMap((feature) => [
    ...(feature.spells ?? []),
    ...(feature.options ?? []).flatMap((option) => option.spells ?? [])
  ])
  const selectedSpellIds = new Set<string>()
  const openGrants: CompiledSpellGrant[] = []
  for (const grant of grants) {
    const targets = grant.scalingKind === 'PER_LEVEL' ? grant.levels : [grant]
    for (const target of targets) {
      if (target.authoringModeKind === 'SELECTED')
        target.spellIds.forEach((id) => selectedSpellIds.add(id))
      else if (!openGrants.includes(grant)) openGrants.push(grant)
    }
  }
  return {
    selectedSpellIds,
    hasOpenGrants: openGrants.length > 0,
    matchesOpenGrant: (spell: Parameters<typeof matchesSpellFilter>[0]) =>
      openGrants.some((grant) => matchesSpellFilter(spell, grant.filters))
  }
}

function parseAcquiredEquipmentRules(
  retainedRulesJson: string,
  equipmentId: string,
  systemId: string
) {
  const retained = acquiredEquipmentRulesSchema.parse(JSON.parse(retainedRulesJson))
  if (retained.equipmentId !== equipmentId || retained.systemId !== systemId)
    throw new Error('Acquired Equipment scope mismatch.')
  let equipment: { compiled: CompiledEquipment; presentation: AcquiredPresentation } | undefined
  const spellsById = new Map<
    string,
    { compiled: CompiledSpell; presentation: AcquiredPresentation }
  >()
  for (const source of retained.sources) {
    const subject = { id: source.subjectId, checksum: source.checksum }
    if (source.subjectKind === 'EQUIPMENT') {
      if (source.subjectId !== equipmentId)
        throw new Error('Acquired Equipment source identity mismatch.')
      equipment = {
        compiled: hydrateStoredCompilation('EQUIPMENT', subject, source.compilation),
        presentation: source.presentation
      }
    } else {
      const compiled = hydrateStoredCompilation('SPELL', subject, source.compilation)
      spellsById.set(compiled.id, { compiled, presentation: source.presentation })
    }
  }
  if (!equipment) throw new Error('Acquired Equipment root is missing.')
  const dependencies = acquiredEquipmentSpellDependencies(equipment.compiled)
  for (const id of dependencies.selectedSpellIds)
    if (!spellsById.has(id)) throw new Error('Acquired Spell dependency is missing.')
  for (const [id, { compiled: spell }] of spellsById)
    if (!dependencies.selectedSpellIds.has(id) && !dependencies.matchesOpenGrant(spell))
      throw new Error('Unrelated acquired Spell source.')
  return {
    equipmentId,
    systemId,
    equipment: equipment.compiled,
    presentation: equipment.presentation,
    spellsById,
    sources: retained.sources
  }
}
