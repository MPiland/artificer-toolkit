import {
  ABILITY_OPTIONS,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
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
import type {
  FacetAuthored,
  FeatGrantAuthored,
  FeatureAuthored,
  ProficiencyGrantAuthored,
  SenseGrantAuthored,
  SpellGrantAuthored
} from '@artificer-toolkit/shared/authored'
import type { SystemSeedRecord } from '@artificer-toolkit/db'
import type {
  CharacterBuilderEquipmentCatalogRecord,
  CharacterBuilderFeatCatalogRecord,
  CharacterBuilderSpellCatalogRecord
} from './builderCatalog.js'

type ChoiceGrantShape = {
  id: string
  grantKind: CharacterBuilderChosenGrantChoice['grantKind']
  selectionKind: string
  scalingKind?: string
  count?: number
  selectionDuplicatePolicy?: AuthoringSelectionDuplicatePolicy
  authoringModeKind?: string
  progression?: {
    levels: Array<{
      level: number
      count?: number
      selectionDuplicatePolicy?: AuthoringSelectionDuplicatePolicy
      authoringModeKind?: string
      skillIds?: string[]
      languageIds?: string[]
      equipmentIds?: string[]
      properties?: string[]
      abilities?: string[]
      spellIds?: string[]
      featIds?: string[]
      senseIds?: string[]
    }>
  }
  proficiencyKind?: string
  skillIds?: string[]
  languageIds?: string[]
  equipmentIds?: string[]
  properties?: string[]
  category?: string
  abilities?: string[]
  spellIds?: string[]
  featIds?: string[]
  senseIds?: string[]
  filters?: FacetAuthored<'SPELL'>
}

export type CharacterChosenGrantOwner = {
  label: string
  sourceLabel: string
  source: CharacterProvenance
  timing: CharacterAcquisitionTiming
  activeLevel: number
  grants: {
    proficiencies?: ProficiencyGrantAuthored[]
    spells?: SpellGrantAuthored[]
    feats?: FeatGrantAuthored[]
    senses?: SenseGrantAuthored[]
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
  sourceLabel: string
  source: CharacterProvenance
  timing: CharacterAcquisitionTiming
  progressionLevel?: number
  requiredCount: number
  duplicatePolicy: AuthoringSelectionDuplicatePolicy
  selectedTargetIds: string[]
  options: Array<{ id: string; label: string }>
}

export type CharacterChosenGrantChoiceRegistry = {
  system: SystemSeedRecord | null
  equipment: CharacterBuilderEquipmentCatalogRecord[]
  spells: CharacterBuilderSpellCatalogRecord[]
  feats: CharacterBuilderFeatCatalogRecord[]
}

export function resolveCharacterChosenGrantChoices(
  character: CharacterAuthored,
  registry: CharacterChosenGrantChoiceRegistry,
  owners: CharacterChosenGrantOwner[]
): CharacterBuilderChosenGrantChoice[] {
  return owners
    .flatMap((owner) =>
      flattenOwnerGrants(owner).flatMap((grant) => {
        const shape = grant
        if (shape.selectionKind !== AUTHORING_SELECTION_KIND.CHOSEN) return []

        if (shape.scalingKind === SCALING.PER_LEVEL) {
          return (shape.progression?.levels ?? [])
            .filter((entry) => entry.level <= owner.activeLevel)
            .map((entry) => createChoice(character, registry, owner, shape, entry))
        }

        return [createChoice(character, registry, owner, shape)]
      })
    )
    .filter((choice) => choice.requiredCount > 0)
}

function flattenOwnerGrants(owner: CharacterChosenGrantOwner): ChoiceGrantShape[] {
  return [
    ...(owner.grants.proficiencies ?? []).map((grant) => grant as unknown as ChoiceGrantShape),
    ...(owner.grants.spells ?? []).map((grant) => grant as unknown as ChoiceGrantShape),
    ...(owner.grants.feats ?? []).map((grant) => grant as unknown as ChoiceGrantShape),
    ...(owner.grants.senses ?? []).map((grant) => grant as unknown as ChoiceGrantShape)
  ]
}

function createChoice(
  character: CharacterAuthored,
  registry: CharacterChosenGrantChoiceRegistry,
  owner: CharacterChosenGrantOwner,
  grant: ChoiceGrantShape,
  progression?: NonNullable<ChoiceGrantShape['progression']>['levels'][number]
): CharacterBuilderChosenGrantChoice {
  const progressionLevel = progression?.level
  const selection = character.intent.chosenGrantSelections?.find(
    (record) =>
      record.grantId === grant.id &&
      record.progressionLevel === progressionLevel &&
      isSameCharacterProvenanceIdentity(record.source, owner.source)
  )
  const targetSource = progression ?? grant

  return {
    id: getCharacterChosenGrantSelectionIdentityKey({
      grantId: grant.id,
      source: owner.source,
      progressionLevel
    }),
    grantId: grant.id,
    grantKind: grant.grantKind,
    label: getGrantChoiceLabel(owner.label, grant),
    sourceLabel: owner.sourceLabel,
    source: owner.source,
    timing: owner.timing,
    progressionLevel,
    requiredCount: targetSource.count ?? 0,
    duplicatePolicy:
      targetSource.selectionDuplicatePolicy ?? AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
    selectedTargetIds: selection?.targetIds ?? [],
    options: getGrantOptions(grant, targetSource, registry)
  }
}

function getGrantChoiceLabel(ownerLabel: string, grant: ChoiceGrantShape): string {
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
    default:
      return ownerLabel
  }
}

function getGrantOptions(
  grant: ChoiceGrantShape,
  target: ChoiceGrantShape | NonNullable<ChoiceGrantShape['progression']>['levels'][number],
  registry: CharacterChosenGrantChoiceRegistry
): Array<{ id: string; label: string }> {
  const targetShape = target as ChoiceGrantShape

  switch (grant.grantKind) {
    case GRANT_KIND.PROFICIENCY_GRANT:
      return getProficiencyOptions(grant, targetShape, registry)
    case GRANT_KIND.SPELL_GRANT:
      return getSpellOptions(grant, targetShape, registry.spells)
    case GRANT_KIND.FEAT_GRANT:
      return labelIds(
        getTargetIds(
          targetShape.authoringModeKind,
          targetShape.featIds,
          registry.feats.map((feat) => feat.id)
        ),
        registry.feats
      )
    case GRANT_KIND.SENSE_GRANT:
      return labelVocabularyIds(
        getTargetIds(
          targetShape.authoringModeKind,
          targetShape.senseIds,
          registry.system?.senses.map((sense) => sense.id) ?? []
        ),
        registry.system?.senses ?? []
      )
  }
}

function getProficiencyOptions(
  grant: ChoiceGrantShape,
  target: ChoiceGrantShape,
  registry: CharacterChosenGrantChoiceRegistry
): Array<{ id: string; label: string }> {
  switch (grant.proficiencyKind) {
    case PROFICIENCY_KIND.SKILL:
      return labelVocabularyIds(
        getTargetIds(
          target.authoringModeKind,
          target.skillIds,
          registry.system?.skills.map((skill) => skill.id) ?? []
        ),
        registry.system?.skills ?? []
      )
    case PROFICIENCY_KIND.LANGUAGE:
      return labelVocabularyIds(
        getTargetIds(
          target.authoringModeKind,
          target.languageIds,
          registry.system?.languages.map((language) => language.id) ?? []
        ),
        registry.system?.languages ?? []
      )
    case PROFICIENCY_KIND.SAVE_ABILITY:
      return labelIds(
        getTargetIds(
          target.authoringModeKind,
          target.abilities,
          ABILITY_OPTIONS.map((ability) => ability.code)
        ),
        ABILITY_OPTIONS.map((ability) => ({ id: ability.code, label: ability.label }))
      )
    case PROFICIENCY_KIND.EQUIPMENT:
      return getEquipmentOptions(target, registry.equipment)
    case PROFICIENCY_KIND.EQUIPMENT_PROPERTY:
      return getTargetIds(target.authoringModeKind, target.properties, [
        ...new Set(
          registry.equipment
            .filter((item) => !target.category || item.category === target.category)
            .flatMap((item) => item.properties)
        )
      ]).map((property) => ({
        id: property,
        label: formatCode(property)
      }))
    default:
      return []
  }
}

function getEquipmentOptions(
  target: ChoiceGrantShape,
  equipment: CharacterBuilderEquipmentCatalogRecord[]
): Array<{ id: string; label: string }> {
  const eligible = equipment.filter(
    (item) =>
      (!target.category || item.category === target.category) &&
      (!target.properties?.length ||
        target.properties.every((property) =>
          item.properties.some((itemProperty) => itemProperty === property)
        ))
  )

  return labelIds(
    getTargetIds(
      target.authoringModeKind,
      target.equipmentIds,
      eligible.map((item) => item.id)
    ),
    eligible
  )
}

function getSpellOptions(
  grant: ChoiceGrantShape,
  target: ChoiceGrantShape,
  spells: CharacterBuilderSpellCatalogRecord[]
): Array<{ id: string; label: string }> {
  const eligible = spells.filter((spell) => matchesSpellFilter(spell, grant.filters))
  return labelIds(
    getTargetIds(
      target.authoringModeKind,
      target.spellIds,
      eligible.map((spell) => spell.id)
    ),
    eligible
  )
}

function matchesSpellFilter(
  spell: CharacterBuilderSpellCatalogRecord,
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

function getTargetIds(
  authoringModeKind: string | undefined,
  selectedIds: string[] | undefined,
  allIds: string[]
): string[] {
  return authoringModeKind === AUTHORING_MODE_KIND.ALL ? allIds : (selectedIds ?? [])
}

function labelVocabularyIds(
  ids: string[],
  records: ReadonlyArray<{ id: string; label: string }>
): Array<{ id: string; label: string }> {
  return labelIds(ids, records)
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
  feature: FeatureAuthored,
  character: CharacterAuthored,
  source: CharacterProvenance
): string[] {
  const acquisition = character.intent.featureAcquisitions.find(
    (record) =>
      record.featureId === feature.id && isSameCharacterProvenanceIdentity(record.source, source)
  )

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
