import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  PROFICIENCY_KIND,
  SCALING,
  type AuthoringSelectionDuplicatePolicy
} from '@artificer-toolkit/shared/core'
import {
  getCharacterChosenGrantSelectionIdentityKey,
  isSameCharacterProvenanceIdentity,
  type CharacterAcquisitionTiming,
  type CharacterAuthored,
  type CharacterProvenance
} from '@artificer-toolkit/shared/subjects/authored'
import type { FacetAuthored } from '@artificer-toolkit/shared/authored'
import type {
  CompiledFeatGrant,
  CompiledFeature,
  CompiledProficiencyGrant,
  CompiledSenseGrant,
  CompiledSpellGrant
} from '@artificer-toolkit/shared/compilers'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type {
  CharacterBuilderEquipmentCatalogRecord,
  CharacterBuilderFeatCatalogRecord,
  CharacterBuilderSpellCatalogRecord
} from './builderCatalog.js'
import { findCurrentCharacterFeatureAcquisition } from './characterBuilderSelections.js'

type ChoiceGrant =
  | CompiledProficiencyGrant
  | CompiledSpellGrant
  | CompiledFeatGrant
  | CompiledSenseGrant

/** One selection a chosen grant asks for: the grant itself, or one of its progression levels. */
type ChoiceSlot = {
  progressionLevel?: number
  count: number
  duplicatePolicy: AuthoringSelectionDuplicatePolicy
  /** The ids the author listed, or null when every pool record of the grant's kind is a candidate. */
  candidateIds: readonly string[] | null
}

type ListedTarget<K extends string> =
  | { authoringModeKind: typeof AUTHORING_MODE_KIND.ALL }
  | ({ authoringModeKind: typeof AUTHORING_MODE_KIND.SELECTED } & Record<K, readonly string[]>)

export type CharacterChosenGrantOwner = {
  label: string
  ownerFeatureId?: string
  sourceLabel: string
  source: CharacterProvenance
  timing: CharacterAcquisitionTiming
  activeLevel: number
  /** The owning record's choice grants; a record without any asks for none. */
  grants: {
    proficiencies?: readonly CompiledProficiencyGrant[]
    spells?: readonly CompiledSpellGrant[]
    feats?: readonly CompiledFeatGrant[]
    senses?: readonly CompiledSenseGrant[]
  }
}

export type CharacterBuilderChosenGrantChoice = {
  id: string
  grantId: string
  grantKind:
    | typeof GRANT_KIND.PROFICIENCY_GRANT
    | typeof GRANT_KIND.SPELL_GRANT
    | typeof GRANT_KIND.FEAT_GRANT
    | typeof GRANT_KIND.SENSE_GRANT
  label: string
  ownerFeatureId?: string
  proficiencyKind?: string
  proficiencyLevel?: 'HALF' | 'FULL' | 'DOUBLE'
  displayCategory?: string
  sourceLabel: string
  source: CharacterProvenance
  timing: CharacterAcquisitionTiming
  progressionLevel?: number
  requiredCount: number
  duplicatePolicy: AuthoringSelectionDuplicatePolicy
  selectedTargetIds: string[]
  options: Array<{ id: string; label: string; disabled?: boolean; disabledReason?: string }>
}

export type CharacterChosenGrantChoiceRegistry = {
  system: SystemAuthoredDto | null
  equipment: CharacterBuilderEquipmentCatalogRecord[]
  spells: CharacterBuilderSpellCatalogRecord[]
  feats: CharacterBuilderFeatCatalogRecord[]
}

export function resolveCharacterChosenGrantChoices(
  character: CharacterAuthored,
  registry: CharacterChosenGrantChoiceRegistry,
  owners: CharacterChosenGrantOwner[]
): CharacterBuilderChosenGrantChoice[] {
  const choices = owners
    .flatMap((owner) =>
      flattenOwnerGrants(owner).flatMap((grant) =>
        choiceSlots(grant, owner.activeLevel).map((slot) =>
          createChoice(character, registry, owner, grant, slot)
        )
      )
    )
    .filter((choice) => choice.requiredCount > 0)

  const fixedRanks = getFixedProficiencyRanks(owners, registry)
  return choices.map((choice) => applyProficiencyEligibility(choice, choices, fixedRanks))
}

/**
 * Catalogue facts, beyond the records a Character references, that decide its chosen-grant
 * outcomes: whether an empty choice has any candidate in the complete pool, and whether each
 * selected Equipment property is offered by each property grant. A found witness record is added
 * to a restricted catalogue; adding records from the complete pool never removes an option.
 */
type ChosenGrantWitnessQuestion =
  | {
      kind: 'EQUIPMENT'
      candidateIds: readonly string[] | null
      matches(record: CharacterBuilderEquipmentCatalogRecord): boolean
    }
  | {
      kind: 'SPELL'
      candidateIds: readonly string[] | null
      matches(record: CharacterBuilderSpellCatalogRecord): boolean
    }
  | {
      kind: 'FEAT'
      candidateIds: readonly string[] | null
      matches(record: CharacterBuilderFeatCatalogRecord): boolean
    }

export function getChosenGrantWitnessQuestions(
  character: CharacterAuthored,
  registry: CharacterChosenGrantChoiceRegistry,
  owners: CharacterChosenGrantOwner[]
): ChosenGrantWitnessQuestion[] {
  const only = (pool: Partial<CharacterChosenGrantChoiceRegistry>) => ({
    ...registry,
    equipment: [],
    spells: [],
    feats: [],
    ...pool
  })

  const questions: ChosenGrantWitnessQuestion[] = []
  const selectedProperties = new Set<string>()
  for (const owner of owners) {
    for (const grant of flattenOwnerGrants(owner)) {
      for (const slot of choiceSlots(grant, owner.activeLevel)) {
        const choice = createChoice(character, registry, owner, grant, slot)
        if (choice.requiredCount <= 0) continue
        const isPropertyGrant =
          grant.grantKind === GRANT_KIND.PROFICIENCY_GRANT &&
          grant.proficiencyKind === PROFICIENCY_KIND.EQUIPMENT_PROPERTY
        if (isPropertyGrant) for (const id of choice.selectedTargetIds) selectedProperties.add(id)
        if (choice.options.length > 0) continue
        const hasOption = (pool: Partial<CharacterChosenGrantChoiceRegistry>) =>
          getGrantOptions(grant, slot.candidateIds, only(pool)).length > 0
        if (grant.grantKind === GRANT_KIND.SPELL_GRANT)
          questions.push({
            kind: 'SPELL',
            candidateIds: slot.candidateIds,
            matches: (record) => hasOption({ spells: [record] })
          })
        else if (grant.grantKind === GRANT_KIND.FEAT_GRANT)
          questions.push({
            kind: 'FEAT',
            candidateIds: slot.candidateIds,
            matches: (record) => hasOption({ feats: [record] })
          })
        else if (
          grant.grantKind === GRANT_KIND.PROFICIENCY_GRANT &&
          (grant.proficiencyKind === PROFICIENCY_KIND.EQUIPMENT || isPropertyGrant)
        )
          questions.push({
            kind: 'EQUIPMENT',
            candidateIds: isPropertyGrant ? null : slot.candidateIds,
            matches: (record) => hasOption({ equipment: [record] })
          })
      }
    }
  }
  // Selected properties are validated, and disabled by granted ranks, through each property
  // grant's options, which a property joins only when some pool Equipment carries it.
  for (const owner of owners) {
    for (const grant of owner.grants.proficiencies ?? []) {
      if (grant.proficiencyKind !== PROFICIENCY_KIND.EQUIPMENT_PROPERTY) continue
      const candidateIds = proficiencyCandidateIds(grant)
      for (const property of selectedProperties) {
        const offers = (equipment: CharacterBuilderEquipmentCatalogRecord[]) =>
          getProficiencyOptions(grant, candidateIds, only({ equipment })).some(
            (option) => option.id === property
          )
        if (offers(registry.equipment)) continue
        if (candidateIds && !candidateIds.includes(property)) continue
        questions.push({
          kind: 'EQUIPMENT',
          candidateIds: null,
          matches: (record) => offers([record])
        })
      }
    }
  }
  return questions
}

function flattenOwnerGrants(owner: CharacterChosenGrantOwner): ChoiceGrant[] {
  return [
    ...(owner.grants.proficiencies ?? []),
    ...(owner.grants.spells ?? []),
    ...(owner.grants.feats ?? []),
    ...(owner.grants.senses ?? [])
  ]
}

/** The selections a chosen grant asks for at the owner's active level; a granted grant asks none. */
function choiceSlots(grant: ChoiceGrant, activeLevel: number): ChoiceSlot[] {
  if (grant.selectionKind !== AUTHORING_SELECTION_KIND.CHOSEN) return []
  // Proficiency grants compile without scaling.
  if (grant.grantKind === GRANT_KIND.PROFICIENCY_GRANT)
    return [
      {
        count: grant.count,
        duplicatePolicy: grant.selectionDuplicatePolicy,
        candidateIds: proficiencyCandidateIds(grant)
      }
    ]
  if (grant.scalingKind === SCALING.NONE) {
    const slot = { count: grant.count, duplicatePolicy: grant.selectionDuplicatePolicy }
    switch (grant.grantKind) {
      case GRANT_KIND.SPELL_GRANT:
        return [{ ...slot, candidateIds: listedIds(grant, 'spellIds') }]
      case GRANT_KIND.FEAT_GRANT:
        return [{ ...slot, candidateIds: listedIds(grant, 'featIds') }]
      case GRANT_KIND.SENSE_GRANT:
        return [{ ...slot, candidateIds: listedIds(grant, 'senseIds') }]
    }
  }
  switch (grant.grantKind) {
    case GRANT_KIND.SPELL_GRANT:
      return levelSlots(grant.levels, 'spellIds', activeLevel)
    case GRANT_KIND.FEAT_GRANT:
      return levelSlots(grant.levels, 'featIds', activeLevel)
    case GRANT_KIND.SENSE_GRANT:
      return levelSlots(grant.levels, 'senseIds', activeLevel)
  }
}

function levelSlots<K extends string>(
  levels: ReadonlyArray<
    {
      level: number
      count: number
      selectionDuplicatePolicy: AuthoringSelectionDuplicatePolicy
    } & ListedTarget<K>
  >,
  key: K,
  activeLevel: number
): ChoiceSlot[] {
  return levels
    .filter((entry) => entry.level <= activeLevel)
    .map((entry) => ({
      progressionLevel: entry.level,
      count: entry.count,
      duplicatePolicy: entry.selectionDuplicatePolicy,
      candidateIds: listedIds(entry, key)
    }))
}

function listedIds<K extends string>(target: ListedTarget<K>, key: K): readonly string[] | null {
  return target.authoringModeKind === AUTHORING_MODE_KIND.ALL ? null : target[key]
}

function proficiencyCandidateIds(grant: CompiledProficiencyGrant): readonly string[] | null {
  switch (grant.proficiencyKind) {
    case PROFICIENCY_KIND.SKILL:
      return listedIds(grant, 'skillIds')
    case PROFICIENCY_KIND.SAVE_ABILITY:
      return listedIds(grant, 'abilities')
    case PROFICIENCY_KIND.LANGUAGE:
      return listedIds(grant, 'languageIds')
    case PROFICIENCY_KIND.EQUIPMENT:
      return listedIds(grant, 'equipmentIds')
    case PROFICIENCY_KIND.EQUIPMENT_PROPERTY:
      return listedIds(grant, 'properties')
  }
}

function createChoice(
  character: CharacterAuthored,
  registry: CharacterChosenGrantChoiceRegistry,
  owner: CharacterChosenGrantOwner,
  grant: ChoiceGrant,
  slot: ChoiceSlot
): CharacterBuilderChosenGrantChoice {
  const { progressionLevel } = slot
  const selection = character.intent.chosenGrantSelections?.find(
    (record) =>
      record.grantId === grant.id &&
      record.progressionLevel === progressionLevel &&
      isSameCharacterProvenanceIdentity(record.source, owner.source)
  )
  const proficiency = grant.grantKind === GRANT_KIND.PROFICIENCY_GRANT ? grant : undefined

  return {
    id: getCharacterChosenGrantSelectionIdentityKey({
      grantId: grant.id,
      source: owner.source,
      progressionLevel
    }),
    grantId: grant.id,
    grantKind: grant.grantKind,
    label: getGrantChoiceLabel(owner.label, grant),
    ownerFeatureId: owner.ownerFeatureId,
    proficiencyKind: proficiency?.proficiencyKind,
    proficiencyLevel: proficiency?.level,
    displayCategory:
      proficiency?.proficiencyKind === PROFICIENCY_KIND.EQUIPMENT ||
      proficiency?.proficiencyKind === PROFICIENCY_KIND.EQUIPMENT_PROPERTY
        ? proficiency.category
        : undefined,
    sourceLabel: owner.sourceLabel,
    source: owner.source,
    timing: owner.timing,
    progressionLevel,
    requiredCount: slot.count,
    duplicatePolicy: slot.duplicatePolicy,
    selectedTargetIds: selection?.targetIds ?? [],
    options: getGrantOptions(grant, slot.candidateIds, registry)
  }
}

function getFixedProficiencyRanks(
  owners: CharacterChosenGrantOwner[],
  registry: CharacterChosenGrantChoiceRegistry
): Map<string, ProficiencyLevels> {
  const levelsByTarget = new Map<string, ProficiencyLevels>()
  for (const owner of owners) {
    for (const grant of owner.grants.proficiencies ?? []) {
      if (grant.selectionKind !== AUTHORING_SELECTION_KIND.GRANTED) continue
      for (const option of getProficiencyOptions(grant, proficiencyCandidateIds(grant), registry)) {
        const key = `${grant.proficiencyKind}:${option.id}`
        addProficiencyLevel(levelsByTarget, key, grant.level, owner.sourceLabel)
      }
    }
  }
  return levelsByTarget
}

function applyProficiencyEligibility(
  choice: CharacterBuilderChosenGrantChoice,
  choices: CharacterBuilderChosenGrantChoice[],
  fixedLevels: Map<string, ProficiencyLevels>
): CharacterBuilderChosenGrantChoice {
  if (!choice.proficiencyKind || !choice.proficiencyLevel) return choice
  const otherLevels = new Map([...fixedLevels].map(([key, levels]) => [key, { ...levels }]))
  for (const other of choices) {
    if (other.id === choice.id || !other.proficiencyKind || !other.proficiencyLevel) continue
    for (const targetId of other.selectedTargetIds) {
      const key = `${other.proficiencyKind}:${targetId}`
      addProficiencyLevel(otherLevels, key, other.proficiencyLevel, other.sourceLabel)
    }
  }
  return {
    ...choice,
    options: choice.options.map((option) => {
      const existing = otherLevels.get(`${choice.proficiencyKind}:${option.id}`)
      const reason = getProficiencyDisabledReason(choice.proficiencyLevel!, existing)
      return reason ? { ...option, disabled: true, disabledReason: reason } : option
    })
  }
}

type ProficiencyLevels = {
  half: boolean
  full: boolean
  double: boolean
  halfSourceLabel?: string
  fullSourceLabel?: string
  doubleSourceLabel?: string
}

function addProficiencyLevel(
  levelsByTarget: Map<string, ProficiencyLevels>,
  key: string,
  level: CompiledProficiencyGrant['level'],
  sourceLabel: string
) {
  const levels = levelsByTarget.get(key) ?? { half: false, full: false, double: false }
  if (level === 'HALF') {
    levels.half = true
    levels.halfSourceLabel ??= sourceLabel
  }
  if (level === 'FULL') {
    levels.full = true
    levels.fullSourceLabel ??= sourceLabel
  }
  if (level === 'DOUBLE') {
    levels.double = true
    levels.doubleSourceLabel ??= sourceLabel
  }
  levelsByTarget.set(key, levels)
}

function getProficiencyDisabledReason(
  level: 'HALF' | 'FULL' | 'DOUBLE',
  existing: ProficiencyLevels | undefined
): string | undefined {
  if (level === 'HALF' && (existing?.half || existing?.full)) {
    return `Granted by ${existing.fullSourceLabel ?? existing.halfSourceLabel ?? 'another source'}`
  }
  if (level === 'FULL' && existing?.full) {
    return `Granted by ${existing.fullSourceLabel ?? 'another source'}`
  }
  if (level === 'DOUBLE' && !existing?.full) return 'Requires full proficiency first.'
  if (level === 'DOUBLE' && existing?.double) {
    return `Granted by ${existing.doubleSourceLabel ?? 'another source'}`
  }
  return undefined
}

function getGrantChoiceLabel(ownerLabel: string, grant: ChoiceGrant): string {
  if (grant.grantKind !== GRANT_KIND.PROFICIENCY_GRANT) return ownerLabel

  switch (grant.proficiencyKind) {
    case PROFICIENCY_KIND.SKILL:
      return 'Skill Proficiencies'
    case PROFICIENCY_KIND.LANGUAGE:
      return 'Languages'
    case PROFICIENCY_KIND.SAVE_ABILITY:
      return 'Saving Throw Proficiencies'
    case PROFICIENCY_KIND.EQUIPMENT:
      return 'Equipment Proficiencies'
    case PROFICIENCY_KIND.EQUIPMENT_PROPERTY:
      return 'Equipment Proficiencies'
  }
}

function getGrantOptions(
  grant: ChoiceGrant,
  candidateIds: readonly string[] | null,
  registry: CharacterChosenGrantChoiceRegistry
): Array<{ id: string; label: string }> {
  switch (grant.grantKind) {
    case GRANT_KIND.PROFICIENCY_GRANT:
      return getProficiencyOptions(grant, candidateIds, registry)
    case GRANT_KIND.SPELL_GRANT: {
      const eligible = registry.spells.filter((spell) => matchesSpellFilter(spell, grant.filters))
      return labelIds(
        getTargetIds(
          candidateIds,
          eligible.map((spell) => spell.id)
        ),
        eligible
      )
    }
    case GRANT_KIND.FEAT_GRANT:
      return labelIds(
        getTargetIds(
          candidateIds,
          registry.feats.map((feat) => feat.id)
        ),
        registry.feats
      )
    case GRANT_KIND.SENSE_GRANT: {
      const senses = registry.system?.senses ?? []
      return labelIds(
        getTargetIds(
          candidateIds,
          senses.map((sense) => sense.id)
        ),
        senses
      )
    }
  }
}

function getProficiencyOptions(
  grant: CompiledProficiencyGrant,
  candidateIds: readonly string[] | null,
  registry: CharacterChosenGrantChoiceRegistry
): Array<{ id: string; label: string }> {
  switch (grant.proficiencyKind) {
    case PROFICIENCY_KIND.SKILL: {
      const skills = registry.system?.skills ?? []
      return labelIds(
        getTargetIds(
          candidateIds,
          skills.map((skill) => skill.id)
        ),
        skills
      )
    }
    case PROFICIENCY_KIND.LANGUAGE: {
      const languages = registry.system?.languages ?? []
      return labelIds(
        getTargetIds(
          candidateIds,
          languages.map((language) => language.id)
        ),
        languages
      )
    }
    case PROFICIENCY_KIND.SAVE_ABILITY: {
      const abilities = (registry.system?.abilities ?? []).map(({ code, label }) => ({
        id: code,
        label
      }))
      return labelIds(
        getTargetIds(
          candidateIds,
          abilities.map((ability) => ability.id)
        ),
        abilities
      )
    }
    case PROFICIENCY_KIND.EQUIPMENT: {
      const eligible = registry.equipment.filter(
        (item) =>
          (!grant.category || item.category === grant.category) &&
          (!grant.properties?.length ||
            grant.properties.every((property) =>
              item.properties.some((itemProperty) => itemProperty === property)
            ))
      )
      return labelIds(
        getTargetIds(
          candidateIds,
          eligible.map((item) => item.id)
        ),
        eligible
      )
    }
    case PROFICIENCY_KIND.EQUIPMENT_PROPERTY:
      return getTargetIds(candidateIds, [
        ...new Set(
          registry.equipment
            .filter((item) => !grant.category || item.category === grant.category)
            .flatMap((item) => item.properties)
        )
      ]).map((property) => ({
        id: property,
        label: formatCode(property)
      }))
  }
}

export function matchesSpellFilter(
  spell: Pick<CharacterBuilderSpellCatalogRecord, 'id' | 'magicSchoolId' | 'level' | 'attributes'>,
  filter: FacetAuthored<'SPELL'> | undefined
): boolean {
  if (!filter || filter.groups.length === 0) return true

  return filter.groups.some((group) =>
    group.contexts.every((context) => {
      const identityMatches =
        context.authoringModeKind === AUTHORING_MODE_KIND.ALL || context.spellIds.includes(spell.id)
      if (!identityMatches) return false

      return (context.conditions ?? []).every((condition) => {
        if (condition.kind !== 'PREDICATE') return false

        let matches = false
        switch (condition.predicateCode) {
          case 'MAGIC_SCHOOL':
            matches =
              condition.authoringModeKind === AUTHORING_MODE_KIND.ALL ||
              condition.magicSchoolIds.includes(spell.magicSchoolId)
            break
          case 'SPELL_LEVEL':
            matches =
              spell.level >= condition.min &&
              (condition.max === undefined || spell.level <= condition.max)
            break
          case 'CONCENTRATION':
            matches = spell.attributes?.includes('CONCENTRATION') ?? false
            break
          case 'RITUAL':
            matches = spell.attributes?.includes('RITUAL') ?? false
            break
          case 'SAVING_THROW_DC':
            matches = false
            break
        }

        return condition.constraint === 'EXCLUDE' ? !matches : matches
      })
    })
  )
}

function getTargetIds(candidateIds: readonly string[] | null, allIds: string[]): string[] {
  if (candidateIds === null) return allIds
  const availableIds = new Set(allIds)
  return candidateIds.filter((id) => availableIds.has(id))
}

function labelIds(
  ids: string[],
  records: ReadonlyArray<{ id: string; label: string }>
): Array<{ id: string; label: string }> {
  const labels = new Map(records.map((record) => [record.id, record.label]))
  return ids.map((id) => ({ id, label: labels.get(id) ?? formatCode(id) }))
}

function formatCode(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

export function getSelectedFeatureOptionIds(
  feature: CompiledFeature,
  character: CharacterAuthored,
  source: CharacterProvenance
): string[] {
  const acquisition = findCurrentCharacterFeatureAcquisition(character, feature.id, source)

  return (
    acquisition?.selections
      ?.filter((selection) => selection.selectionKey === 'options')
      .flatMap((selection) =>
        selection.values.flatMap((value) => {
          if (value.kind === 'ID') return [value.id]
          if (value.kind === 'IDS') return value.ids
          return []
        })
      ) ?? []
  )
}
