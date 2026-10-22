import type { CharacterSheetCurrencyOptionDto } from '@artificer-toolkit/schema/api/characterSheetData'
import {
  createCharacterCurrencyIdentityKey,
  characterCurrencyIdentity,
  currencyOptionIdentity
} from '@artificer-toolkit/schema/shared/characterCurrency'
import {
  ABILITIES,
  AUTHORED_RECORD_STATUS,
  CHARACTER_EXTRA_KIND_OPTIONS,
  CHARACTER_EXTRA_KIND_REGISTRY,
  CREATURE_ORIGIN_KIND_OPTIONS,
  CREATURE_ORIGIN_KIND_REGISTRY,
  CREATURE_RELATIONSHIP_KIND_REGISTRY,
  EQUIPMENT_PROPERTY_REGISTRY,
  FEATURE_ATTRIBUTE,
  formatLengthMeasurement,
  MEASUREMENT_UNIT_REGISTRY,
  VEHICLE_CATEGORY_REGISTRY,
  type LengthUnitCode,
  type MeasurementUnitCode
} from '@artificer-toolkit/shared/core'
import {
  createCharacterDefinitionSourceInstanceId,
  createCharacterResourceOwnerKey,
  createCharacterSpellSourceKey,
  clampCharacterCurrentHitPoints,
  resolveCharacterEffectiveMaximumHitPoints,
  type CharacterSheetAdjustment
} from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { CharacterBuilderResolution } from './builderTypes.js'
import type { CharacterPresentationLookup } from './characterRuleContext.js'
import type { ConcentrationListingDto } from '@artificer-toolkit/schema/shared/activeGrantListing'
import { listActiveGrantListings } from '../activeGrantListings.js'
import { listHitPointMaximumReductions } from './hitPointMaximumReductions.js'
import { labelCharacterConditions } from './characterConditionLabels.js'
import { effectiveHitPointMaximum } from './activeEffectGrantTotals.js'
import {
  CHARACTER_ABILITY_ALIASES,
  DND5E_2014_EXHAUSTION_PRESENTATION,
  getAbilityDerivedTotal,
  isAbilityCode,
  classSpellSelectionKey,
  createSkillReference,
  getClassSpellSelectionSources
} from './characterSheetVocabulary.js'
import {
  clamp,
  formatCodeLabel,
  formatModifier,
  getHitPointAdjustment,
  getSpellSlotKey,
  parseSlotLevel,
  type SheetSpell,
  type SheetSpellSlot,
  type SheetSpellSource
} from './sheetCommandReducer.js'
import type { CharacterSheetProjectedMechanic } from './characterSheetMechanic.js'
import { projectCharacterSheetNotes } from './sheetNotes.js'
import type {
  CharacterRuleProficiency,
  CharacterRuleSense,
  CharacterSheetRuleProjection
} from './characterSheetRuleProjection.js'
import {
  projectCharacterRuleActionMechanic,
  type CharacterRuleActionPresentationReferences
} from './characterRuleActionProjection.js'
import type { CharacterRuleEvaluationResult } from './characterRuleEvaluation.js'
import { createCharacterSheetMechanicPresentationSources } from './characterSheetMechanicPresentation.js'
import { projectCharacterRulePolicyToSheetProjection } from './characterRulePolicyAdapter.js'
import { projectCharacterRuleResources } from './characterRuleResourceProjection.js'
import { createCharacterSpellCastCandidateId } from './characterSpellCastRuleFacts.js'
import { getProficiencyTargetKind } from './sheetProficiency.js'
import { addClassRitualSources, type CharacterSheetSpellSource } from './sheetSpellSource.js'
import {
  getPreparedAndKnownSpellIds,
  getKnownSpellIdsForClassIntent,
  getPreparationCapableClassIds,
  getSheetSpellIdsByClass
} from './sheetSpellIds.js'

function createVocabularyLabelMap(
  records: ReadonlyArray<{ id: string; code?: string; label: string }> | undefined
): Map<string, string> {
  const labels = new Map<string, string>()
  for (const record of records ?? []) {
    labels.set(record.id, record.label)
    if (record.code) labels.set(record.code, record.label)
  }
  return labels
}

function formatProficiencyScaling(scaling: CharacterRuleProficiency['scaling']): string {
  switch (scaling) {
    case 'DOUBLE':
      return 'Expertise'
    case 'HALF':
      return 'Half proficiency'
    case 'FULL':
      return 'Proficient'
  }
}

function formatProficiencyKind(kind: string): string {
  switch (kind) {
    case 'EQUIPMENT':
      return 'Equipment'
    case 'EQUIPMENT_PROPERTY':
      return 'Equipment property'
    case 'LANGUAGE':
      return 'Language'
    case 'SAVE_ABILITY':
      return 'Saving throw'
    case 'SKILL':
      return 'Skill'
    default:
      return formatCodeLabel(kind)
  }
}

function formatAllProficiencyLabel(kind: string): string {
  switch (kind) {
    case 'EQUIPMENT':
      return 'All equipment'
    case 'EQUIPMENT_PROPERTY':
      return 'All equipment properties'
    case 'LANGUAGE':
      return 'All languages'
    case 'SAVE_ABILITY':
      return 'All saving throws'
    case 'SKILL':
      return 'All skills'
    default:
      return `All ${formatCodeLabel(kind).toLowerCase()}`
  }
}

function formatProficiencyLabel(params: {
  equipmentLabels: ReadonlyMap<string, string>
  languageLabels: ReadonlyMap<string, string>
  proficiency: CharacterRuleProficiency
  skillLabels: ReadonlyMap<string, string>
}): string {
  const { proficiency } = params
  if (proficiency.subjectId === '*') return formatAllProficiencyLabel(proficiency.kind)

  switch (proficiency.kind) {
    case 'EQUIPMENT':
      return params.equipmentLabels.get(proficiency.subjectId) ?? 'Unknown equipment'
    case 'EQUIPMENT_PROPERTY': {
      const propertyLabel = formatCodeLabel(proficiency.subjectId)
      if (proficiency.category === 'ARMOR') return `${propertyLabel} Armor`
      if (proficiency.category === 'WEAPON') return `${propertyLabel} Weapons`
      return propertyLabel
    }
    case 'LANGUAGE':
      return params.languageLabels.get(proficiency.subjectId) ?? 'Unknown language'
    case 'SAVE_ABILITY':
      return isAbilityCode(proficiency.subjectId)
        ? `${ABILITIES[proficiency.subjectId].label} saves`
        : 'Unknown saving throw'
    case 'SKILL':
      return params.skillLabels.get(proficiency.subjectId) ?? 'Unknown skill'
    default:
      return formatCodeLabel(proficiency.subjectId)
  }
}

function formatSenseRange(sense: CharacterRuleSense): string {
  if (sense.range.rangeKind === 'UNLIMITED') return 'Unlimited'
  return formatLengthMeasurement(sense.range)
}

type CharacterBuilderGrantFeature = CharacterBuilderResolution['grants']['features'][number]

const STANDARD_PASSIVE_SKILLS = [
  { code: 'PASSIVE_PERCEPTION', label: 'Passive Perception', skillCode: 'PERCEPTION' },
  { code: 'PASSIVE_INVESTIGATION', label: 'Passive Investigation', skillCode: 'INVESTIGATION' },
  { code: 'PASSIVE_INSIGHT', label: 'Passive Insight', skillCode: 'INSIGHT' }
] as const

function resolvePassiveSkillCode(passive: { code?: string; label: string }): string | undefined {
  const value = `${passive.code ?? ''} ${passive.label}`.toUpperCase()
  if (value.includes('PERCEPTION')) return 'PERCEPTION'
  if (value.includes('INVESTIGATION')) return 'INVESTIGATION'
  if (value.includes('INSIGHT')) return 'INSIGHT'
  return undefined
}

function buildPassiveOverviewFacts(params: {
  passives?: ReadonlyArray<{ code?: string; label: string }>
  passiveChecks: Readonly<Record<string, number>>
}): Array<{ label: string; value: string }> {
  const passiveDefinitions = params.passives?.length ? params.passives : STANDARD_PASSIVE_SKILLS
  const seenSkillCodes = new Set<string>()

  return passiveDefinitions.flatMap((passive) => {
    const skillCode = resolvePassiveSkillCode(passive)
    if (!skillCode || seenSkillCodes.has(skillCode)) return []
    const total = params.passiveChecks[skillCode.toLowerCase()]
    if (total === undefined) return []

    seenSkillCodes.add(skillCode)
    return [{ label: passive.label, value: String(total) }]
  })
}

function hasFeatureAttribute(feature: CharacterBuilderGrantFeature, attribute: string): boolean {
  return feature.attributes?.includes(attribute) === true
}

function isSheetVisibleFeature(feature: CharacterBuilderGrantFeature): boolean {
  return !hasFeatureAttribute(feature, FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET)
}

function toSheetActionKind(
  mechanic: CharacterSheetProjectedMechanic
): CharacterSheetResponseDto['actions']['items'][number]['kind'] {
  switch (mechanic.activation?.kind) {
    case 'ACTION':
      return 'ACTION'
    case 'BONUS_ACTION':
      return 'BONUS_ACTION'
    case 'REACTION':
      return 'REACTION'
    default:
      return 'OTHER'
  }
}

function formatClassSummary(resolution: CharacterBuilderResolution): string {
  const summary = resolution.summary.classes
    .map((classSummary) => {
      const subclass = classSummary.subclassLabel ? ` (${classSummary.subclassLabel})` : ''
      return `${classSummary.classLabel}${subclass} ${classSummary.classLevel}`
    })
    .join(' / ')

  return summary || 'No class selected'
}

function formatSlotLabel(slotKey: string, level: number | null): string {
  if (slotKey === 'PACT') return 'Pact Magic'
  return level == null ? slotKey : `Level ${level}`
}

/** Labels only title a source on the Sheet; a reader that does not show sources passes none. */
export function getSpellSourcesBySpellId(
  character: CharacterAuthored,
  sheetSpellIdsByClassId: ReadonlyMap<string, ReadonlySet<string>>,
  preparationCapableClassIds: ReadonlySet<string>,
  spellAccess: readonly CharacterSheetRuleProjection['spellAccess'][number][],
  classRitualSources: Parameters<typeof addClassRitualSources>[1],
  classLabels: ReadonlyMap<string, string> = new Map(),
  featureLabels: ReadonlyMap<string, string> = new Map()
): Map<string, CharacterSheetSpellSource[]> {
  const classStateById = new Map(
    (character.state.classes ?? []).map((classState) => [classState.classId, classState])
  )
  const knownSpellIdsByClassId = new Map(
    character.intent.classes.map((classIntent) => [
      classIntent.classId,
      getKnownSpellIdsForClassIntent(character, classIntent.classId)
    ])
  )
  const classOrder = new Map(
    character.intent.classes.map((classIntent, index) => [classIntent.classId, index])
  )
  const activeClassIds = new Set(character.intent.classes.map((classIntent) => classIntent.classId))
  const classSelectionSources = getClassSpellSelectionSources(character)
  const sourcesBySpellId = new Map<string, Map<string, CharacterSheetSpellSource>>()

  function addSpellSource(
    spellId: string,
    classId: string,
    sourceId?: string,
    provenance: 'CLASS' | 'SUBCLASS' = 'CLASS'
  ) {
    if (!activeClassIds.has(classId)) return
    if (!sheetSpellIdsByClassId.get(classId)?.has(spellId)) return
    const sources = sourcesBySpellId.get(spellId) ?? new Map<string, CharacterSheetSpellSource>()
    const classState = classStateById.get(classId)
    const prepared = classState?.spells?.prepared?.includes(spellId) ?? false
    const known = knownSpellIdsByClassId.get(classId)?.has(spellId) ?? false
    const selectedSource =
      sourceId === undefined
        ? classSelectionSources.get(classSpellSelectionKey(classId, spellId))
        : undefined
    const effectiveProvenance = selectedSource?.sourceKind ?? provenance
    const sourceInstanceId = createCharacterDefinitionSourceInstanceId(
      effectiveProvenance,
      sourceId ?? selectedSource?.sourceRecordId ?? classId
    )
    const source = {
      spellId,
      sourceKind: effectiveProvenance,
      sourceInstanceId
    }
    const sourceKey = createCharacterSpellSourceKey(source)
    const current = sources.get(sourceKey)
    sources.set(sourceKey, {
      id: sourceInstanceId,
      classId,
      label: classLabels.get(classId) ?? 'Class',
      source,
      provenance: effectiveProvenance,
      ...(prepared
        ? { acquisition: 'PREPARED' as const }
        : known
          ? { acquisition: 'KNOWN' as const }
          : {}),
      castMode: 'SPELL_SLOT',
      canPrepare: preparationCapableClassIds.has(classId),
      prepared: current?.prepared || prepared
    })
    sourcesBySpellId.set(spellId, sources)
  }

  for (const classIntent of character.intent.classes) {
    if (!preparationCapableClassIds.has(classIntent.classId)) continue
    for (const spellId of sheetSpellIdsByClassId.get(classIntent.classId) ?? []) {
      addSpellSource(spellId, classIntent.classId)
    }
  }

  for (const selection of character.intent.spellSelections ?? []) {
    const source = selection.source
    if (source.kind === 'CLASS') {
      for (const spellId of selection.spells) addSpellSource(spellId, source.classId, selection.id)
      continue
    }

    if (source.kind === 'SUBCLASS') {
      const owningClass = character.intent.classes.find(
        (classIntent) => classIntent.subclassId === source.subclassId
      )
      if (!owningClass) continue
      for (const spellId of selection.spells)
        addSpellSource(spellId, owningClass.classId, selection.id, 'SUBCLASS')
      continue
    }

    for (const spellId of selection.spells) {
      const existing = sourcesBySpellId.get(spellId) ?? new Map<string, CharacterSheetSpellSource>()
      const sourceInstanceId = createCharacterDefinitionSourceInstanceId(source.kind, selection.id)
      const spellSource = {
        spellId,
        sourceKind: source.kind,
        sourceInstanceId
      }
      existing.set(createCharacterSpellSourceKey(spellSource), {
        id: sourceInstanceId,
        label: source.kind === 'FEATURE' ? 'Feature' : 'Option',
        source: spellSource,
        provenance: source.kind,
        acquisition: 'GRANTED',
        castMode: 'SPELL_SLOT',
        canPrepare: false,
        prepared: true
      })
      sourcesBySpellId.set(spellId, existing)
    }
  }

  for (const classState of character.state.classes ?? []) {
    for (const spellId of classState.spells?.learned ?? []) {
      if (sheetSpellIdsByClassId.get(classState.classId)?.has(spellId))
        addSpellSource(spellId, classState.classId)
    }
    for (const spellId of classState.spells?.prepared ?? []) {
      if (sheetSpellIdsByClassId.get(classState.classId)?.has(spellId))
        addSpellSource(spellId, classState.classId)
    }
  }

  addClassRitualSources(sourcesBySpellId, classRitualSources, classLabels)

  for (const access of spellAccess) {
    const sources =
      sourcesBySpellId.get(access.spellId) ?? new Map<string, CharacterSheetSpellSource>()
    const attributes = new Set(access.attributes ?? [])
    const source = {
      spellId: access.spellId,
      sourceKind: 'FEATURE' as const,
      sourceInstanceId: access.sourceInstanceId
    }
    sources.set(createCharacterSpellSourceKey(source), {
      id: access.id,
      label:
        featureLabels.get(access.sourceFeatureId) ??
        (access.source.kind === 'CLASS'
          ? (classLabels.get(access.source.classId) ?? 'Feature')
          : 'Feature'),
      source,
      provenance: 'FEATURE',
      acquisition: attributes.has('PREPARED')
        ? 'ALWAYS_PREPARED'
        : attributes.has('KNOWN')
          ? 'KNOWN'
          : 'GRANTED',
      castMode: attributes.has('LIMITED_USE')
        ? 'LIMITED_USE'
        : attributes.has('CAST_AT_WILL')
          ? 'AT_WILL'
          : attributes.has('CAST_AT_LEVEL')
            ? 'FIXED_LEVEL'
            : attributes.has('RITUAL')
              ? 'RITUAL'
              : 'SPELL_SLOT',
      ...(attributes.has('CAST_AT_LEVEL') && access.castAtLevel !== undefined
        ? { fixedLevel: access.castAtLevel }
        : {}),
      ...(access.charges ? { resourceGrantId: access.id } : {}),
      canPrepare: false,
      prepared: attributes.has('PREPARED')
    })
    sourcesBySpellId.set(access.spellId, sources)
  }

  return new Map(
    [...sourcesBySpellId.entries()].map(([spellId, sources]) => [
      spellId,
      [...sources.values()].sort((left, right) => {
        const leftOrder = left.classId
          ? (classOrder.get(left.classId) ?? Number.MAX_SAFE_INTEGER)
          : Number.MAX_SAFE_INTEGER
        const rightOrder = right.classId
          ? (classOrder.get(right.classId) ?? Number.MAX_SAFE_INTEGER)
          : Number.MAX_SAFE_INTEGER
        return leftOrder - rightOrder || left.label.localeCompare(right.label)
      })
    ])
  )
}

/** Whether the Sheet lists a spell from this source among the Character's castable spells. */
export function isActiveSpellSource(spellLevel: number, source: SheetSpellSource): boolean {
  if (source.acquisition === 'ALWAYS_PREPARED' || source.acquisition === 'GRANTED') return true
  if (spellLevel === 0) return source.acquisition === 'KNOWN' || Boolean(source.prepared)
  if (source.canPrepare) return Boolean(source.prepared)
  return source.acquisition === 'KNOWN' || Boolean(source.prepared)
}

function getSpellPrimaryEffect(
  mechanics: readonly CharacterSheetProjectedMechanic[],
  castLevel: number
): string | undefined {
  const outcomes = mechanics.flatMap((mechanic) => mechanic.outcomes)
  const damage = outcomes.find((outcome) => outcome.kind === 'DAMAGE')
  if (damage?.kind === 'DAMAGE') {
    const expression =
      damage.scaling?.find((entry) => entry.level === castLevel)?.expression ?? damage.expression
    return `${expression} ${damage.damageTypeLabel}`
  }

  return undefined
}

/** The slot levels a Character owns: a spell may be cast at the levels it scales at among them. */
export function getOwnedSpellSlotLevels(
  spellSlots: CharacterRuleEvaluationResult['output']['spellSlots']
): ReadonlySet<number> {
  return new Set([
    ...spellSlots.maxByLevel.flatMap((slot) => (slot.slotCount > 0 ? [slot.spellLevel] : [])),
    ...(spellSlots.pactMagic && spellSlots.pactMagic.slots > 0 ? [spellSlots.pactMagic.level] : [])
  ])
}

/** The spells whose authored effects read the level they are cast at. */
export function getCastLevelReaderSpellIds(
  spellReferenceMechanics: readonly { spellId: string; readsCastLevel: boolean }[]
): Set<string> {
  return new Set(
    spellReferenceMechanics.filter((spell) => spell.readsCastLevel).map((spell) => spell.spellId)
  )
}

/**
 * The levels a spell is cast at from one source: its own, and, when a higher level changes what it
 * does, every higher level whose slot is owned.
 */
export function getSpellCastLevels(
  spell: { level: number; readsCastLevel: boolean },
  source: SheetSpellSource,
  ownedSlotLevels: ReadonlySet<number>
): number[] {
  const baseLevel = source.fixedLevel ?? spell.level
  if (
    (source.castMode ?? 'SPELL_SLOT') !== 'SPELL_SLOT' ||
    spell.level === 0 ||
    !spell.readsCastLevel
  )
    return [baseLevel]
  return [baseLevel, ...[...ownedSlotLevels].filter((level) => level > baseLevel)].sort(
    (left, right) => left - right
  )
}

type SpellCastAvailability = {
  available: boolean
  unavailableReason?: string
  slotKey?: string
}

function projectSpellCastDecision(
  decision: CharacterRuleEvaluationResult['output']['spellCastDecisions'][number],
  castLevel: number,
  slots: readonly SheetSpellSlot[]
): SpellCastAvailability {
  if (decision.status === 'AVAILABLE') {
    return {
      available: true,
      ...(decision.slotKey ? { slotKey: decision.slotKey } : {})
    }
  }

  switch (decision.reasonCode) {
    case 'SPELLCASTING_LOCKED':
      return { available: false, unavailableReason: "You can't cast spells right now." }
    case 'RESOURCE_OWNER_MISSING':
      return { available: false, unavailableReason: 'No linked uses are available.' }
    case 'RESOURCE_EXHAUSTED':
      return { available: false, unavailableReason: 'No uses remaining.' }
    case 'NO_ELIGIBLE_SPELL_SLOT':
      return {
        available: false,
        unavailableReason: `No level ${castLevel} spell slot is available.`
      }
    case 'SPELL_SLOT_EXHAUSTED': {
      const slot = slots.find((candidate) => candidate.slotKey === decision.slotKey)
      return {
        available: false,
        unavailableReason: slot
          ? `${slot.label} spell slots are exhausted.`
          : 'Spell slots are exhausted.',
        ...(decision.slotKey ? { slotKey: decision.slotKey } : {})
      }
    }
    default:
      throw new Error(
        `Spell cast decision "${decision.candidateId}" is unavailable for an invalid reason: ${decision.reasonCode}`
      )
  }
}

function buildActiveSpellGroups(params: {
  spells: readonly SheetSpell[]
  slots: readonly SheetSpellSlot[]
  spellCastDecisions: CharacterRuleEvaluationResult['output']['spellCastDecisions']
  spellCastMechanics: CharacterRuleEvaluationResult['output']['spellCastMechanics']
  ownedSlotLevels: ReadonlySet<number>
  castLevelReaderSpellIds: ReadonlySet<string>
  actionReferences: CharacterRuleActionPresentationReferences
}): CharacterSheetResponseDto['spells']['activeGroups'] {
  const { ownedSlotLevels, castLevelReaderSpellIds } = params
  const spellCastDecisionsByCandidateId = new Map(
    params.spellCastDecisions.map((decision) => [decision.candidateId, decision])
  )
  if (spellCastDecisionsByCandidateId.size !== params.spellCastDecisions.length) {
    throw new Error('Character rule evaluation returned duplicate spell cast decisions.')
  }
  const spellCastMechanicsByCandidateId = new Map(
    params.spellCastMechanics.map((mechanics) => [mechanics.candidateId, mechanics])
  )
  if (spellCastMechanicsByCandidateId.size !== params.spellCastMechanics.length) {
    throw new Error('Character rule evaluation returned duplicate spell cast mechanics.')
  }
  const rows = params.spells.flatMap((spell) =>
    (spell.sources ?? []).flatMap((source) => {
      if (!isActiveSpellSource(spell.level, source)) return []
      const castLevels = getSpellCastLevels(
        { level: spell.level, readsCastLevel: castLevelReaderSpellIds.has(spell.id) },
        source,
        ownedSlotLevels
      )
      return castLevels.map((castLevel) => {
        const candidateId = createCharacterSpellCastCandidateId(source.source, castLevel)
        const decision = spellCastDecisionsByCandidateId.get(candidateId)
        if (!decision) {
          throw new Error(`Character rule evaluation omitted spell cast decision "${candidateId}".`)
        }
        const availability = projectSpellCastDecision(decision, castLevel, params.slots)
        const policyCastMechanics = spellCastMechanicsByCandidateId.get(candidateId)
        if (!policyCastMechanics) {
          throw new Error(
            `Character rule evaluation omitted spell cast mechanics "${candidateId}".`
          )
        }
        const projectedMechanics = policyCastMechanics.mechanics.map((mechanic) =>
          projectCharacterRuleActionMechanic(mechanic, params.actionReferences)
        )
        const displayName = source.customName ?? spell.label
        const primaryEffect = getSpellPrimaryEffect(projectedMechanics, castLevel)
        const activation = projectedMechanics
          .map((mechanic) => mechanic.activation)
          .find((candidate) => candidate?.kind.trim())
        const activationType: 'ACTION' | 'BONUS_ACTION' | 'REACTION' | 'FREE' | undefined =
          activation?.kind === 'ACTION'
            ? 'ACTION'
            : activation?.kind === 'BONUS_ACTION'
              ? 'BONUS_ACTION'
              : activation?.kind === 'REACTION'
                ? 'REACTION'
                : activation?.kind === 'FREE'
                  ? 'FREE'
                  : undefined
        const activationKindLabel = activation ? formatCodeLabel(activation.kind) : undefined
        const activationLabel =
          activation && activationKindLabel
            ? activation.amount === 1
              ? activationKindLabel
              : `${activation.amount} ${activationKindLabel.toLowerCase()}s`
            : undefined
        const rangeLabel = projectedMechanics
          .map((mechanic) => mechanic.rangeLabel?.trim())
          .find((candidate): candidate is string => Boolean(candidate))
        const hasAttack = projectedMechanics.some(
          (mechanic) =>
            mechanic.trigger === 'MELEE_SPELL_ATTACK' ||
            mechanic.trigger === 'RANGED_SPELL_ATTACK' ||
            mechanic.attackBonus !== undefined
        )
        const authoredAttackBonus = projectedMechanics.find(
          (mechanic) => mechanic.attackBonus !== undefined
        )?.attackBonus
        const save = projectedMechanics.find((mechanic) => mechanic.save)?.save
        const attackBonus = authoredAttackBonus
        const saveDc = save?.dc
        const hitOrDcLabel =
          hasAttack && attackBonus !== undefined
            ? formatModifier(attackBonus)
            : save && saveDc !== undefined
              ? `${ABILITIES[save.ability].short} ${saveDc}`
              : undefined
        return {
          rowId: candidateId,
          target: { kind: 'SPELL' as const, source: source.source, castLevel },
          spellId: spell.id,
          source: source.source,
          sourceId: source.id ?? source.source.sourceInstanceId,
          displayName,
          sourceLabel: source.label,
          castLevel,
          ...(activationType ? { activationType } : {}),
          ...(activationLabel ? { activationLabel } : {}),
          ...(rangeLabel ? { rangeLabel } : {}),
          ...(hitOrDcLabel ? { hitOrDcLabel } : {}),
          ...(primaryEffect ? { primaryEffect } : {}),
          ...(projectedMechanics.length ? { mechanics: projectedMechanics } : {}),
          available: availability.available,
          ...(availability.unavailableReason
            ? { unavailableReason: availability.unavailableReason }
            : {}),
          cast: {
            spellId: spell.id,
            sourceId: source.id ?? source.source.sourceInstanceId,
            ...(availability.slotKey ? { slotKey: availability.slotKey } : {})
          }
        }
      })
    })
  )

  const duplicateCounts = new Map<string, number>()
  for (const row of rows) {
    const key = `${row.castLevel}:${row.displayName.toLocaleLowerCase()}`
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1)
  }

  return [...new Set(rows.map((row) => row.castLevel))]
    .sort((left, right) => left - right)
    .map((level) => ({
      level,
      label: level === 0 ? 'Cantrips' : `Level ${level}`,
      entries: rows
        .filter((row) => row.castLevel === level)
        .map((row) => {
          const duplicateKey = `${row.castLevel}:${row.displayName.toLocaleLowerCase()}`
          return (duplicateCounts.get(duplicateKey) ?? 0) > 1
            ? { ...row, sourceQualifier: row.sourceLabel }
            : row
        })
        .sort(
          (left, right) =>
            left.displayName.localeCompare(right.displayName) ||
            left.rowId.localeCompare(right.rowId)
        )
    }))
}

function formatExtraMeasurement(amount: number, unit: MeasurementUnitCode): string {
  return `${amount} ${MEASUREMENT_UNIT_REGISTRY[unit].label.toLowerCase()}`
}

function formatExtraSpeedLabel(
  speeds: ReadonlyArray<{ speedId: string; amount: number; unit: LengthUnitCode }> | undefined,
  speedDefinitions: ReadonlyArray<{ id: string; code?: string; label: string }> | undefined
): string | undefined {
  if (!speeds?.length) return undefined
  const resolvedSpeeds = speeds.map((speed) => {
    const definition = speedDefinitions?.find(
      (candidate) => candidate.id === speed.speedId || candidate.code === speed.speedId
    )
    const normalizedCode = definition?.code?.toUpperCase() ?? speed.speedId.toUpperCase()
    const normalizedLabel = definition?.label.trim().toLowerCase()
    const isWalking =
      normalizedCode === 'WALK' ||
      normalizedCode === 'WALKING' ||
      normalizedLabel === 'walk' ||
      normalizedLabel === 'walking' ||
      normalizedLabel === 'walking speed'
    return { definition, isWalking, speed }
  })
  const selected = resolvedSpeeds.find(({ isWalking }) => !isWalking) ?? resolvedSpeeds[0]
  if (!selected) return undefined

  const measurement = formatLengthMeasurement(selected.speed)
  if (selected.isWalking) return measurement
  const movementLabel = selected.definition?.label.replace(/\s+speed$/i, '')
  return movementLabel ? `${movementLabel} ${measurement}` : measurement
}

function toExtraFeatures(
  features:
    | ReadonlyArray<{ id: string; label: string; description: string; section?: string }>
    | undefined
) {
  return (features ?? [])
    .filter((feature) => feature.section === undefined || feature.section === 'TRAIT')
    .map((feature) => ({
      id: feature.id,
      label: feature.label,
      ...(feature.description ? { description: feature.description } : {})
    }))
}

function toExtraActions(
  features:
    | ReadonlyArray<{ id: string; label: string; description: string; section?: string }>
    | undefined
) {
  return (features ?? [])
    .filter((feature) => feature.section !== undefined && feature.section !== 'TRAIT')
    .map((feature) => ({
      id: feature.id,
      label: feature.label,
      ...(feature.description ? { description: feature.description } : {})
    }))
}

function toCreatureHitDice(
  state: NonNullable<CharacterAuthored['state']['creatures']>[number]['hitDice'] | undefined,
  authored: { hitDice?: { count: number; die: number } }
) {
  const hitDice =
    state ??
    (authored.hitDice
      ? [{ die: authored.hitDice.die, total: authored.hitDice.count, used: 0 }]
      : [])
  return hitDice.map((die) => ({
    ...die,
    used: Math.min(die.used, die.total),
    remaining: Math.max(die.total - die.used, 0)
  }))
}

interface ProjectCharacterSheetBundleParams {
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
  presentation: CharacterPresentationLookup
  streamVersion: number
  hasBuilderDraft?: boolean
  adjustments?: readonly CharacterSheetAdjustment[]
  additionalConditions?: ReadonlyArray<{ conditionTypeId: string; notes?: string }>
  additionalCurrencyOptions?: readonly CharacterSheetCurrencyOptionDto[]
  spellCustomizations?: readonly Pick<
    SheetSpellSource,
    'source' | 'customName' | 'notes' | 'displayAsAttack'
  >[]
  ruleEvaluation: Pick<CharacterRuleEvaluationResult, 'snapshot' | 'registry' | 'facts' | 'output'>
  /** The Character's active effects; their hit point maximum reductions lower `maxHitPoints` and their grants are listed. */
  activeEffects: readonly Pick<
    ActiveRuleEffectRecord,
    'id' | 'createdOrdinal' | 'definition' | 'lifecycle'
  >[]
  /** The Concentration this Character maintains, live in a Run or carried over from one (SPELLS-5.11). */
  concentration: ConcentrationListingDto | null
}

interface CharacterSheetProjectionBundle {
  sheet: CharacterSheetResponseDto
  ruleProjection: CharacterSheetRuleProjection
}

export function projectCharacterSheetBundle(
  params: ProjectCharacterSheetBundleParams
): CharacterSheetProjectionBundle {
  const { character, resolution, presentation, streamVersion, hasBuilderDraft, ruleEvaluation } =
    params
  const adjustments = params.adjustments ?? []
  const spellCustomizations = params.spellCustomizations ?? []
  const totalLevel = Math.max(resolution.summary.totalLevel, 1)
  const { learned, prepared } = getPreparedAndKnownSpellIds(character)
  const knownSpellIds = new Set([...learned, ...prepared])
  const sheetSpellIdsByClassId = getSheetSpellIdsByClass(
    ruleEvaluation.output,
    ruleEvaluation.facts
  )
  const displayedSpellIds = new Set(knownSpellIds)
  for (const spellIds of sheetSpellIdsByClassId.values()) {
    for (const spellId of spellIds) displayedSpellIds.add(spellId)
  }
  const preparationCapableClassIds = getPreparationCapableClassIds(ruleEvaluation.output)
  const ruleProjection = projectCharacterRulePolicyToSheetProjection(ruleEvaluation)
  const itemMechanicsByInstanceId = new Map(
    ruleProjection.itemMechanics.map((item) => [item.itemInstanceId, item])
  )
  const spellCustomizationsBySourceKey = new Map(
    spellCustomizations.map((customization) => [
      createCharacterSpellSourceKey(customization.source),
      customization
    ])
  )
  const proficiencyBonus = ruleProjection.derivedStats.proficiencyBonus
  const hitPointMaximumReductions = listHitPointMaximumReductions(params.activeEffects)
  const maxHitPoints = effectiveHitPointMaximum(
    resolveCharacterEffectiveMaximumHitPoints(ruleProjection.derivedStats.maxHitPoints),
    params.activeEffects
  )
  const conditionOptions = (resolution.registry.system?.conditionTypes ?? []).map((condition) => ({
    id: condition.id,
    code: condition.code,
    label: condition.label,
    ...(condition.description ? { description: condition.description } : {})
  }))
  const equipmentById = new Map(
    resolution.registry.equipment.map((equipment) => [equipment.id, equipment])
  )
  const equipmentForItem = (itemId: string, equipmentId: string) =>
    resolution.registry.acquiredEquipmentByItemId?.get(itemId)?.equipment ??
    equipmentById.get(equipmentId)
  const equipmentLabels = new Map(
    resolution.catalog.equipment.map((equipment) => [equipment.id, equipment.label])
  )
  const skillLabels = createVocabularyLabelMap(resolution.registry.system?.skills)
  const languageLabels = createVocabularyLabelMap(resolution.registry.system?.languages)
  const senseLabels = createVocabularyLabelMap(resolution.registry.system?.senses)
  const damageTypeLabels = createVocabularyLabelMap(resolution.registry.system?.damageTypes)
  const currencyOptions: CharacterSheetCurrencyOptionDto[] = [
    ...(resolution.registry.system?.currencies.map((currency) => ({
      id: currency.id,
      kind: 'RULESET' as const,
      label: currency.label
    })) ?? []),
    ...(params.additionalCurrencyOptions ?? [])
  ]
  const currencyLabels = new Map(
    currencyOptions.map((currency) => [
      createCharacterCurrencyIdentityKey(currencyOptionIdentity(currency)),
      currency.label
    ])
  )
  const skillReference = createSkillReference(resolution.registry.system)
  const spellSlots = [
    ...ruleEvaluation.output.spellSlots.maxByLevel.map((slot) => ({
      slotKey: getSpellSlotKey(slot.spellLevel),
      label: formatSlotLabel(getSpellSlotKey(slot.spellLevel), slot.spellLevel),
      level: slot.spellLevel,
      max: slot.slotCount,
      used: slot.effectiveUsed,
      remaining: slot.remaining
    })),
    ...(ruleEvaluation.output.spellSlots.pactMagic
      ? [
          {
            slotKey: 'PACT',
            label: formatSlotLabel('PACT', ruleEvaluation.output.spellSlots.pactMagic.level),
            level: ruleEvaluation.output.spellSlots.pactMagic.level,
            max: ruleEvaluation.output.spellSlots.pactMagic.slots,
            used: ruleEvaluation.output.spellSlots.pactMagic.effectiveUsed,
            remaining: ruleEvaluation.output.spellSlots.pactMagic.remaining
          }
        ]
      : [])
  ]
    .filter((slot) => slot.max > 0)
    .sort((left, right) => left.level - right.level)
  const classLabels = new Map(
    resolution.registry.classes.map((classRecord) => [classRecord.id, classRecord.label])
  )
  const featureLabels = new Map(
    resolution.grants.features.map((feature) => [feature.id, feature.label])
  )
  const companionMechanicsByInstanceId = new Map(
    ruleProjection.companions.map((companion) => [companion.companionInstanceId, companion])
  )
  const creatureExtras: CharacterSheetResponseDto['extras']['items'] = (
    character.state.creatures ?? []
  ).flatMap((instance) => {
    const creature = presentation.creatures[instance.creatureId]
    if (!creature) return []
    const mechanics = companionMechanicsByInstanceId.get(instance.id)
    if (!mechanics) {
      throw new Error(`Character rule evaluation omitted companion mechanics "${instance.id}".`)
    }
    const maximumHitPoints = Math.max(mechanics.maxHitPoints, 0)
    const currentHitPoints = clamp(
      instance.currentHitPoints ?? maximumHitPoints,
      0,
      maximumHitPoints
    )
    const hitDice = toCreatureHitDice(instance.hitDice, creature)
    return [
      {
        kind: instance.relationshipKind,
        kindLabel: CHARACTER_EXTRA_KIND_REGISTRY[instance.relationshipKind].label,
        id: instance.id,
        creatureId: creature.id,
        relationshipKind: instance.relationshipKind,
        relationshipLabel: CREATURE_RELATIONSHIP_KIND_REGISTRY[instance.relationshipKind].label,
        originKind: instance.originKind,
        originLabel: CREATURE_ORIGIN_KIND_REGISTRY[instance.originKind].label,
        authoredName: creature.label,
        displayName: instance.customName ?? creature.label,
        ...(instance.customName ? { customName: instance.customName } : {}),
        ...(instance.notes ? { notes: instance.notes } : {}),
        isActive: instance.isActive ?? true,
        armorClass: Math.max(mechanics.armorClass, 0),
        ...(mechanics.size ? { size: mechanics.size } : {}),
        ...(mechanics.alignmentId ? { alignmentId: mechanics.alignmentId } : {}),
        ...(mechanics.creatureTypeId ? { creatureTypeId: mechanics.creatureTypeId } : {}),
        ...(formatExtraSpeedLabel(creature.speeds, resolution.registry.system?.speeds)
          ? {
              speedLabel: formatExtraSpeedLabel(creature.speeds, resolution.registry.system?.speeds)
            }
          : {}),
        ...(creature.carryingCapacity
          ? {
              carryingCapacityLabel: formatExtraMeasurement(
                creature.carryingCapacity.amount,
                creature.carryingCapacity.unit
              )
            }
          : {}),
        ...(creature.mountProfile?.riderCount === undefined
          ? {}
          : { riderCapacity: creature.mountProfile.riderCount }),
        hitPoints: {
          current: currentHitPoints,
          maximum: maximumHitPoints,
          temp: Math.max(instance.tempHitPoints ?? 0, 0)
        },
        hitDice,
        actions: toExtraActions(creature.features),
        features: toExtraFeatures(creature.features),
        equipmentItemIds: (character.state.creatureEquipment?.[instance.id] ?? []).map(
          (assignment) => assignment.equipmentItemId
        )
      }
    ]
  })
  const vehicleExtras: CharacterSheetResponseDto['extras']['items'] = (
    character.state.vehicles ?? []
  ).flatMap((instance) => {
    const vehicle = presentation.vehicles[instance.vehicleId]
    if (!vehicle) return []
    const maximumHitPoints = Math.max(vehicle.hitPoints ?? 0, 0)
    return [
      {
        kind: 'VEHICLE' as const,
        kindLabel: CHARACTER_EXTRA_KIND_REGISTRY.VEHICLE.label,
        id: instance.id,
        vehicleId: vehicle.id,
        categoryLabel: VEHICLE_CATEGORY_REGISTRY[vehicle.category].label,
        authoredName: vehicle.label,
        displayName: instance.customName ?? vehicle.label,
        ...(instance.customName ? { customName: instance.customName } : {}),
        ...(instance.notes ? { notes: instance.notes } : {}),
        isActive: instance.isActive ?? true,
        ...(vehicle.speed === undefined
          ? {}
          : {
              speedLabel: `${vehicle.speed}${vehicle.speedNote ? ` (${vehicle.speedNote})` : ''}`
            }),
        ...(vehicle.crewMin === undefined && vehicle.crewMax === undefined
          ? {}
          : {
              crewLabel:
                vehicle.crewMin === vehicle.crewMax || vehicle.crewMax === undefined
                  ? String(vehicle.crewMin ?? vehicle.crewMax)
                  : `${vehicle.crewMin ?? 0}-${vehicle.crewMax}`
            }),
        ...(vehicle.passengerCapacity === undefined
          ? {}
          : { passengerCapacity: vehicle.passengerCapacity }),
        ...(vehicle.cargoCapacity ? { cargoCapacityLabel: vehicle.cargoCapacity } : {}),
        hitPoints: {
          current: clamp(instance.currentHitPoints ?? maximumHitPoints, 0, maximumHitPoints),
          maximum: maximumHitPoints
        },
        actions: toExtraActions(vehicle.features),
        features: toExtraFeatures(vehicle.features),
        equipmentItemIds: (character.state.vehicleEquipment?.[instance.id] ?? []).map(
          (assignment) => assignment.equipmentItemId
        )
      }
    ]
  })
  const sheetExtras = {
    kindOptions: [...CHARACTER_EXTRA_KIND_OPTIONS],
    originOptions: [...CREATURE_ORIGIN_KIND_OPTIONS],
    items: [...creatureExtras, ...vehicleExtras]
  } satisfies CharacterSheetResponseDto['extras']
  for (const access of ruleProjection.spellAccess) displayedSpellIds.add(access.spellId)
  const spellSourcesBySpellId = getSpellSourcesBySpellId(
    character,
    sheetSpellIdsByClassId,
    preparationCapableClassIds,
    ruleProjection.spellAccess,
    ruleEvaluation.snapshot.classRitualSources ?? [],
    classLabels,
    featureLabels
  )
  const spellPreparationSources = ruleEvaluation.output.spellPreparation.sources.flatMap(
    (source) =>
      source.preparedSpellLimit === null
        ? []
        : [
            {
              classId: source.classId,
              label: classLabels.get(source.classId) ?? 'Class',
              preparedSpellLimit: source.preparedSpellLimit,
              preparedSpellIds: source.preparedSpellIds
            }
          ]
  )
  const overviewSkills = Object.entries(ruleProjection.derivedStats.skillBonuses).map(
    ([skill, total]) => {
      const metadata = skillReference.metadataByCanonical.get(skill)
      if (!metadata) throw new Error(`Skill "${skill}" has no System definition.`)
      return {
        skillId: metadata.skillId,
        code: metadata.code,
        label: metadata.label,
        ability: metadata.ability,
        total,
        rollMode: ruleProjection.rollModes.skillChecks[skill],
        proficiency: ruleProjection.calculations.skillProficiencyLevels[skill]?.effective ?? 'NONE'
      }
    }
  )
  const passiveFacts = buildPassiveOverviewFacts({
    passives: resolution.registry.system?.passives,
    passiveChecks: ruleProjection.derivedStats.passiveChecks
  })
  const primarySpeed = ruleProjection.derivedStats.movementSpeeds.find(
    (speed) => speed.speedId === ruleProjection.derivedStats.primaryMovementSpeedId
  )
  const speedValue = formatExtraSpeedLabel(
    primarySpeed ? [primarySpeed] : undefined,
    resolution.registry.system?.speeds
  )
  const sheetReferenceFeatures = resolution.grants.features.filter(isSheetVisibleFeature)
  const mechanicPresentation = createCharacterSheetMechanicPresentationSources(
    resolution,
    presentation
  )
  const spellReferenceMechanicsBySpellId = new Map(
    ruleEvaluation.output.spellReferenceMechanics.map((spell) => [spell.spellId, spell])
  )
  if (
    spellReferenceMechanicsBySpellId.size !== ruleEvaluation.output.spellReferenceMechanics.length
  ) {
    throw new Error('Character rule evaluation returned duplicate spell reference mechanics.')
  }
  const mechanicOwnersByKey = mechanicPresentation.ownersByKey
  const featureSourceLabels = new Map<string, string[]>()
  for (const feature of sheetReferenceFeatures) {
    const labels = featureSourceLabels.get(feature.id) ?? []
    if (!labels.includes(feature.sourceLabel)) labels.push(feature.sourceLabel)
    featureSourceLabels.set(feature.id, labels)
  }
  const optionParentFeatureIds = new Map<string, string>()
  for (const acquisition of character.intent.featureAcquisitions) {
    for (const selection of acquisition.selections ?? []) {
      if (selection.selectionKey !== 'options') continue
      for (const value of selection.values) {
        const optionIds = value.kind === 'ID' ? [value.id] : value.kind === 'IDS' ? value.ids : []
        for (const optionId of optionIds)
          optionParentFeatureIds.set(optionId, acquisition.featureId)
      }
    }
  }
  const inventoryStateById = new Map(
    character.state.equipment.inventory.map((item) => [item.id, item] as const)
  )
  const chargeBearingItemsByEquipmentId = new Map<
    string,
    (typeof character.state.equipment.inventory)[number][]
  >()
  for (const item of character.state.equipment.inventory) {
    if (!equipmentForItem(item.id, item.equipmentId)?.charges) continue
    const copies = chargeBearingItemsByEquipmentId.get(item.equipmentId) ?? []
    copies.push(item)
    chargeBearingItemsByEquipmentId.set(item.equipmentId, copies)
  }
  const equipmentChargeSourceLabelsByItemId = new Map<string, string>()
  for (const copies of chargeBearingItemsByEquipmentId.values()) {
    const copyCountsByLabel = new Map<string, number>()
    for (const item of copies) {
      const label = item.customName ?? equipmentForItem(item.id, item.equipmentId)?.label ?? 'Item'
      copyCountsByLabel.set(label, (copyCountsByLabel.get(label) ?? 0) + 1)
    }
    const copyIndexesByLabel = new Map<string, number>()
    copies.forEach((item) => {
      const baseLabel =
        item.customName ?? equipmentForItem(item.id, item.equipmentId)?.label ?? 'Item'
      const labelIndex = (copyIndexesByLabel.get(baseLabel) ?? 0) + 1
      copyIndexesByLabel.set(baseLabel, labelIndex)
      equipmentChargeSourceLabelsByItemId.set(
        item.id,
        (copyCountsByLabel.get(baseLabel) ?? 0) > 1 ? `${baseLabel} #${labelIndex}` : baseLabel
      )
    })
  }
  const equipmentReferenceFeatures = ruleProjection.equipmentFeatureChargeUses.flatMap((use) => {
    const feature = equipmentForItem(use.itemInstanceId, use.equipmentId)?.features?.find(
      (candidate) => candidate.id === use.featureId
    )
    if (!feature || feature.attributes?.includes(FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET)) return []
    const description = presentation.features[feature.id]?.description

    return [
      {
        id: `${feature.id}:${use.itemInstanceId}`,
        label: feature.label,
        ...(description ? { description } : {}),
        ...(feature.attributes ? { attributes: feature.attributes } : {}),
        sourceLabel: equipmentChargeSourceLabelsByItemId.get(use.itemInstanceId) ?? feature.label,
        source: {
          kind: 'EQUIPMENT_INSTANCE' as const,
          equipmentId: use.equipmentId,
          itemInstanceId: use.itemInstanceId
        },
        resourceCost: use.cost,
        resourceGrantId: createCharacterResourceOwnerKey({
          kind: 'ITEM_INSTANCE',
          chargeId: use.chargeId,
          itemInstanceId: use.itemInstanceId
        })
      }
    ]
  })
  const actionItems: CharacterSheetResponseDto['actions']['items'] = []
  const hiddenOwners = mechanicPresentation.hiddenOwnerKeys
  for (const decision of ruleEvaluation.output.actionDecisions) {
    const ownerKey = `${decision.mechanicsOwner.kind}:${decision.mechanicsOwner.id}`
    if (hiddenOwners.has(ownerKey)) continue
    const owner = mechanicOwnersByKey.get(ownerKey)
    if (!owner) {
      throw new Error(
        `Character rule action presentation is missing or ambiguous: ${decision.actionId}`
      )
    }
    const mechanic = projectCharacterRuleActionMechanic(
      decision.mechanic,
      mechanicPresentation.actionReferences
    )
    const sourceFeatureId =
      decision.mechanicsOwner.kind === 'FEATURE_OPTION'
        ? optionParentFeatureIds.get(decision.mechanicsOwner.id)
        : decision.mechanicsOwner.id
    const equipmentSource = decision.source.kind === 'EQUIPMENT_INSTANCE' ? decision.source : null
    const itemState = equipmentSource
      ? inventoryStateById.get(equipmentSource.itemInstanceId)
      : undefined
    const sourceLabel = equipmentSource
      ? (equipmentChargeSourceLabelsByItemId.get(equipmentSource.itemInstanceId) ??
        itemState?.customName ??
        equipmentForItem(equipmentSource.itemInstanceId, equipmentSource.equipmentId)?.label)
      : decision.mechanicsOwner.kind === 'FEAT'
        ? 'Feat'
        : sourceFeatureId
          ? featureSourceLabels.get(sourceFeatureId)?.join(', ')
          : undefined
    let availability: CharacterSheetResponseDto['actions']['items'][number]['availability']
    if (decision.status === 'AVAILABLE') {
      availability = { status: 'AVAILABLE' }
    } else {
      const reasonCode = decision.reasonCode
      if (reasonCode === null) {
        throw new Error(
          `Character rule action is missing its unavailable reason: ${decision.actionId}`
        )
      }
      availability = { status: 'UNAVAILABLE', reasonCode }
    }
    actionItems.push({
      id: decision.actionId,
      label: owner.label,
      kind: toSheetActionKind(mechanic),
      sourceLabel,
      description: owner.description ?? undefined,
      mechanic,
      availability,
      ...(decision.resourcePoolId && decision.resourceCost
        ? { resourceGrantId: decision.resourcePoolId, resourceCost: decision.resourceCost }
        : {})
    })
  }
  const inventoryItems = character.state.equipment.inventory
    .map((item) => {
      const equipment = equipmentForItem(item.id, item.equipmentId)
      const mechanics = itemMechanicsByInstanceId.get(item.id)
      if (equipment && !mechanics) {
        throw new Error(`Character rule evaluation omitted item mechanics "${item.id}".`)
      }
      if (equipment?.cost && mechanics?.cost === undefined) {
        throw new Error(`Character rule evaluation omitted item cost "${item.id}".`)
      }
      if (equipment?.weight && mechanics?.weight === undefined) {
        throw new Error(`Character rule evaluation omitted item weight "${item.id}".`)
      }
      return {
        id: item.id,
        equipmentId: item.equipmentId,
        label: item.customName ?? equipment?.label ?? 'Unknown item',
        equipmentLabel: equipment?.label,
        description: equipment ? presentation.equipment[equipment.id]?.description : undefined,
        category: equipment?.category,
        properties: equipment?.properties.map((code) => ({
          code,
          label: EQUIPMENT_PROPERTY_REGISTRY[code].label
        })),
        rarityId: equipment?.rarityId,
        cost:
          equipment?.cost && mechanics?.cost !== undefined
            ? { ...equipment.cost, amount: mechanics.cost }
            : undefined,
        costLabel: equipment?.cost
          ? currencyLabels.get(
              createCharacterCurrencyIdentityKey({
                kind: 'RULESET',
                currencyId: equipment.cost.currencyId
              })
            )
          : undefined,
        weight: mechanics?.weight,
        armorClass: equipment?.armorClass,
        degradation: item.degradation,
        customName: item.customName,
        quantity: item.quantity,
        equippedSlot:
          character.state.equipment.equipped.find((entry) => entry.itemId === item.id)?.slot ??
          null,
        attuned: character.state.equipment.attuned.includes(item.id),
        requiresAttunement: equipment?.requiresAttunement ?? false,
        displayAsAttack: mechanics?.displayAsAttack,
        containerId: item.containerId,
        capacity: equipment?.capacity,
        notes: item.notes
      }
    })
    .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id))
  const currencies = character.state.currency.flatMap((group) =>
    group.currencies.map((currency) => {
      const identity = characterCurrencyIdentity(currency)
      return {
        ...identity,
        label: currencyLabels.get(createCharacterCurrencyIdentityKey(identity)) ?? 'Currency',
        amount: currency.amount,
        containerId: group.containerId
      }
    })
  )
  // A Spell only a held item's pinned rules supply is absent from the catalogue; it reads its pinned prose.
  const catalogSpellIds = new Set(resolution.catalog.spells.map((spell) => spell.id))
  const retainedSpells = Object.values(presentation.retainedSpells)
    .filter(({ compiled }) => !catalogSpellIds.has(compiled.id))
    .map(({ compiled, presentation: prose }) => ({
      ...compiled,
      label: prose.label,
      description: prose.description ?? undefined,
      materialDescription: prose.materialDescription
    }))
  const sheetSpells: CharacterSheetResponseDto['spells']['spells'] = [
    ...resolution.catalog.spells,
    ...retainedSpells
  ]
    .filter((spell) => displayedSpellIds.has(spell.id))
    .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id))
    .map((spell) => {
      const policyReferenceMechanics = spellReferenceMechanicsBySpellId.get(spell.id)
      const spellMechanics = (policyReferenceMechanics?.mechanics ?? []).map((mechanic) =>
        projectCharacterRuleActionMechanic(mechanic, mechanicPresentation.actionReferences)
      )
      const sources = (spellSourcesBySpellId.get(spell.id) ?? []).map((source) => {
        const sourceKey = createCharacterSpellSourceKey(source.source)
        const customization = spellCustomizationsBySourceKey.get(sourceKey)
        return {
          ...source,
          ...(source.resourceGrantId
            ? {
                resourceOwner: {
                  kind: 'SPELL_SOURCE' as const,
                  resourceGrantId: source.resourceGrantId,
                  source: source.source
                }
              }
            : {}),
          ...(customization?.customName ? { customName: customization.customName } : {}),
          ...(customization?.notes ? { notes: customization.notes } : {}),
          ...(customization?.displayAsAttack ? { displayAsAttack: true } : {})
        }
      })
      return {
        id: spell.id,
        label: spell.label,
        description: spell.description,
        level: spell.level,
        school: spell.magicSchoolId,
        castingTime: spell.castingTime,
        components: spell.components,
        attributes: spell.attributes,
        materialDescription: spell.materialDescription,
        prepared: prepared.has(spell.id),
        known: learned.has(spell.id),
        sourceLabel: sources.length ? sources.map((source) => source.label).join(', ') : undefined,
        sources: sources.length ? sources : undefined,
        mechanics: spellMechanics.length > 0 ? spellMechanics : undefined
      }
    })
  const sheetSpellSlots: CharacterSheetResponseDto['spells']['slots'] = spellSlots.map((slot) => ({
    ...slot,
    level: slot.level ?? parseSlotLevel(slot.slotKey)
  }))
  const sheetResources = projectCharacterRuleResources({
    policy: ruleEvaluation.output,
    snapshot: ruleEvaluation.snapshot,
    grantFoldFacts: ruleEvaluation.facts.grantFoldFacts,
    character,
    resolution,
    presentation
  })
  const visibleActionItems = actionItems
  const activeSpellGroups = buildActiveSpellGroups({
    spells: sheetSpells,
    slots: sheetSpellSlots,
    spellCastDecisions: ruleEvaluation.output.spellCastDecisions,
    spellCastMechanics: ruleEvaluation.output.spellCastMechanics,
    ownedSlotLevels: getOwnedSpellSlotLevels(ruleEvaluation.output.spellSlots),
    castLevelReaderSpellIds: getCastLevelReaderSpellIds(
      ruleEvaluation.output.spellReferenceMechanics
    ),
    actionReferences: mechanicPresentation.actionReferences
  })
  const displayedProficiencyKeys = new Set<string>()

  const sheet = {
    meta: {
      characterId: character.id,
      viewer: 'CHARACTER_OWNER',
      capabilities: {
        managePlayState: true,
        managePrivateNotes: true,
        manageInventory: true,
        openBuilder: true,
        endActiveEffects: false
      },
      systemId: character.systemId,
      status: character.status ?? AUTHORED_RECORD_STATUS.ACTIVE,
      streamVersion,
      hasBuilderDraft
    },
    identity: {
      label: character.label || 'Untitled Character',
      description: character.description,
      concept: character.profile.backstory,
      classSummary: formatClassSummary(resolution),
      raceLabel:
        resolution.summary.selectedRace?.subraceLabel ?? resolution.summary.selectedRace?.raceLabel,
      backgroundLabel: resolution.summary.selectedBackground?.label,
      totalLevel
    },
    overview: {
      abilities: Object.keys(resolution.summary.abilities).map((ability) => {
        const abilityCode = ability as keyof typeof resolution.summary.abilities
        return {
          ability: abilityCode,
          score: getAbilityDerivedTotal(ruleProjection.derivedStats.abilityScores, abilityCode),
          modifier: getAbilityDerivedTotal(
            ruleProjection.derivedStats.abilityModifiers,
            abilityCode
          ),
          rollMode: ruleProjection.rollModes.abilityChecks[abilityCode]
        }
      }),
      savingThrows: Object.keys(ABILITIES)
        .filter((ability): ability is keyof typeof ABILITIES => isAbilityCode(ability))
        .map((ability) => ({
          ability,
          label: ABILITIES[ability].label,
          total: getAbilityDerivedTotal(ruleProjection.derivedStats.savingThrows, ability),
          rollMode: ruleProjection.rollModes.savingThrows[ability],
          proficiency:
            ruleProjection.calculations.savingThrowProficiencyLevels[ability]?.effective ??
            ruleProjection.calculations.savingThrowProficiencyLevels[
              CHARACTER_ABILITY_ALIASES[ability] ?? ''
            ]?.effective ??
            'NONE'
        })),
      skills: overviewSkills,
      facts: [
        { label: 'Initiative', value: formatModifier(ruleProjection.derivedStats.initiative) },
        { label: 'Proficiency', value: formatModifier(proficiencyBonus) },
        ...(speedValue ? [{ label: 'Speed', value: speedValue }] : []),
        {
          label: 'Hit Dice',
          value:
            character.state.hitpoints.hitDice
              .map((die) => `${die.total - die.used}/${die.total}d${die.die}`)
              .join(', ') || 'None'
        },
        ...passiveFacts
      ],
      armorClass: ruleProjection.derivedStats.armorClass,
      initiative: ruleProjection.derivedStats.initiative,
      initiativeRollMode: ruleProjection.rollModes.initiative,
      proficiencyBonus,
      inspiration: character.state.inspiration ?? false,
      currentHitPoints: clampCharacterCurrentHitPoints(
        character.state.hitpoints.current,
        maxHitPoints
      ),
      maxHitPoints,
      tempHitPoints: character.state.hitpoints.temp,
      deathSaves: character.state.hitpoints.deathSaves,
      maxHitPointsOverride: getHitPointAdjustment(adjustments, 'MAXIMUM_OVERRIDE') ?? null,
      maxHitPointsModifier: getHitPointAdjustment(adjustments, 'MAXIMUM_MODIFIER') ?? 0,
      maxHitPointsModifierAdjustmentId:
        adjustments.find(
          (adjustment) =>
            adjustment.family === 'HIT_POINTS' && adjustment.field === 'MAXIMUM_MODIFIER'
        )?.id ?? null,
      maxHitPointsReductions: hitPointMaximumReductions.map((reduction) => ({
        id: reduction.activeEffectId,
        label: reduction.label,
        sourceHidden: reduction.sourceHidden,
        amount: reduction.amount,
        recoveryTags: reduction.recoveryTags
      })),
      activeGrants: listActiveGrantListings(params.activeEffects),
      concentration: params.concentration,
      exhaustion: {
        label: DND5E_2014_EXHAUSTION_PRESENTATION.label,
        description: DND5E_2014_EXHAUSTION_PRESENTATION.description,
        level: ruleEvaluation.output.rest.currentExhaustion,
        minimumLevel: ruleEvaluation.output.rest.minimumExhaustion,
        maximumLevel: ruleEvaluation.output.rest.maximumExhaustion,
        ...(character.state.exhaustion?.notes ? { notes: character.state.exhaustion.notes } : {})
      },
      conditions: labelCharacterConditions(
        [...(character.state.conditions ?? []), ...(params.additionalConditions ?? [])],
        conditionOptions
      ),
      hitDice: character.state.hitpoints.hitDice.map((die) => ({
        die: die.die,
        total: die.total,
        used: die.used,
        remaining: Math.max(die.total - die.used, 0)
      }))
    },
    actions: {
      items: visibleActionItems
    },
    extras: sheetExtras,
    resources: {
      items: sheetResources,
      hitDice: character.state.hitpoints.hitDice.map((die) => ({
        die: die.die,
        total: die.total,
        used: die.used,
        remaining: Math.max(die.total - die.used, 0)
      }))
    },
    spells: {
      saveDc: ruleProjection.derivedStats.spellSaveDC ?? null,
      attackBonus: ruleProjection.derivedStats.spellAttackBonus ?? null,
      attackRollMode: ruleProjection.rollModes.attacks.SPELL,
      slots: sheetSpellSlots,
      activeGroups: activeSpellGroups,
      spells: sheetSpells,
      preparationSources: spellPreparationSources.length ? spellPreparationSources : undefined
    },
    inventory: {
      items: inventoryItems,
      currencies,
      containers: inventoryItems
        .filter((item) => item.capacity)
        .map((container) => ({
          id: container.id,
          label: container.label,
          capacity: container.capacity,
          itemIds: inventoryItems
            .filter((item) => item.containerId === container.id)
            .map((item) => item.id),
          currencies: currencies.filter((currency) => currency.containerId === container.id)
        }))
    },
    reference: {
      features: [...sheetReferenceFeatures, ...equipmentReferenceFeatures],
      proficiencies: ruleProjection.proficiencies.reduce<
        CharacterSheetResponseDto['reference']['proficiencies']
      >((proficiencies, proficiency) => {
        const kind = getProficiencyTargetKind(proficiency, resolution)
        const label = formatProficiencyLabel({
          equipmentLabels,
          languageLabels,
          proficiency,
          skillLabels
        })
        if (!kind) return proficiencies
        const key = `${kind}:${proficiency.subjectId}`
        if (displayedProficiencyKeys.has(key)) return proficiencies
        displayedProficiencyKeys.add(key)
        proficiencies.push({
          kind,
          label,
          value: `${formatProficiencyKind(proficiency.kind)} · ${formatProficiencyScaling(proficiency.scaling)}`
        })
        return proficiencies
      }, []),
      defenses: ruleProjection.defenses.map((defense) => ({
        kind: defense.kind,
        damageTypeId: defense.damageTypeId,
        label: damageTypeLabels.get(defense.damageTypeId) ?? formatCodeLabel(defense.damageTypeId),
        value: formatCodeLabel(defense.kind)
      })),
      senses: ruleProjection.senses.map((sense) => ({
        senseId: sense.senseDefinitionId,
        label: senseLabels.get(sense.senseDefinitionId) ?? 'Unknown sense',
        value: formatSenseRange(sense)
      })),
      conditionOptions,
      equipmentOptions: resolution.catalog.equipment.map((equipment) => ({
        id: equipment.id,
        label: equipment.label,
        isContainer: equipment.isContainer,
        ...(equipment.maxStack ? { maxStack: equipment.maxStack } : {}),
        requiresAttunement: equipment.requiresAttunement
      })),
      currencyOptions
    },
    notes: projectCharacterSheetNotes(character)
  } satisfies CharacterSheetResponseDto

  return { sheet, ruleProjection }
}
