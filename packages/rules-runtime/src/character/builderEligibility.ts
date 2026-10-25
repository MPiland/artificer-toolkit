import {
  CLASS_CATEGORY,
  CHARACTER_ABILITY_GENERATION_METHOD,
  POINT_BUY_SCORE_REGISTRY,
  POINT_BUY_TOTAL_POINTS
} from '@artificer-toolkit/shared/core'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import { evaluateMulticlassRequirements } from '@artificer-toolkit/shared/character'
import {
  getSelectedFeatureOptionIds,
  type CharacterChosenGrantOwner
} from './chosenGrantChoiceResolver.js'
import type {
  CharacterAcquisitionTiming,
  CharacterAuthored,
  CharacterClassIntent,
  CharacterProvenance,
  CharacterResourceGrantRecord
} from '@artificer-toolkit/shared/subjects/authored'
import { isSameCharacterProvenanceIdentity } from '@artificer-toolkit/shared/subjects/authored'
import type {
  CompiledBackground,
  CompiledClass,
  CompiledFeat
} from '@artificer-toolkit/shared/subjects/compilers'
import type { CompiledFeature } from '@artificer-toolkit/shared/compilers'
import type {
  CharacterBuilderClassCatalogRecord,
  CharacterBuilderCatalog
} from './builderCatalog.js'
import { systemCoreCodeRegistry } from '../platformSystemCoreCodes.js'
import type { CharacterBuilderRegistry, CharacterBuilderValidation } from './builderTypes.js'
import { compileCharacterEligibilityRuleFacts } from './characterEligibilityRuleFacts.js'
import {
  getCharacterRaceSelection,
  findCurrentCharacterFeatureAcquisition,
  isCharacterAcquisitionTimingAvailable,
  isCharacterFeatAcquisitionValid,
  type GrantedFeatureRecord,
  type ResolvedClassSelection
} from './characterBuilderSelections.js'

type CharacterBuilderGrantedFeatureLookup = readonly {
  feature: { id: string }
}[]

export function appendAbilityIntentValidationIssues(
  character: CharacterAuthored,
  validations: CharacterBuilderValidation[]
): void {
  const abilities = character.intent.abilities
  const assignments =
    abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
      ? abilities.state.assignments
      : abilities.assignments
  const assignedAbilities = assignments.map((assignment) => assignment.ability)
  const systemAbilities = systemCoreCodeRegistry.abilityCodes(character.systemId)
  const unlisted = assignedAbilities.filter((ability) => !systemAbilities.includes(ability))

  if (unlisted.length > 0) {
    validations.push({
      code: 'UNKNOWN_ABILITY_ASSIGNMENT',
      severity: 'blocking',
      sectionId: 'ABILITIES',
      message: `The Game System does not define the ability "${unlisted[0]}".`
    })
  }

  if (new Set(assignedAbilities).size !== assignedAbilities.length) {
    validations.push({
      code: 'MALFORMED_ABILITY_ASSIGNMENTS',
      severity: 'blocking',
      sectionId: 'ABILITIES',
      message: 'Each ability can be assigned only once.'
    })
  }

  if (abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY) {
    const options = abilities.assignments.map((assignment) => assignment.option)
    if (new Set(options).size !== options.length) {
      validations.push({
        code: 'STANDARD_ARRAY_SCORE_REUSE',
        severity: 'blocking',
        sectionId: 'ABILITIES',
        message: 'Each Standard Array score can be used only once.'
      })
    }
  }

  if (abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY) {
    const spent = abilities.assignments.reduce(
      (total, assignment) => total + POINT_BUY_SCORE_REGISTRY[assignment.option].cost,
      0
    )
    if (spent > POINT_BUY_TOTAL_POINTS) {
      validations.push({
        code: 'POINT_BUY_OVERSPEND',
        severity: 'blocking',
        sectionId: 'ABILITIES',
        message: `Point Buy assignments exceed the ${POINT_BUY_TOTAL_POINTS}-point maximum.`
      })
    }
  }
}

export function getAvailableSubclassesForClass(params: {
  classId: string
  classLevel: number
  catalog: CharacterBuilderCatalog
  registry: CharacterBuilderRegistry
}): CharacterBuilderClassCatalogRecord[] {
  const baseClass = params.registry.classes.find(
    (record): record is Extract<CompiledClass, { category: typeof CLASS_CATEGORY.BASE }> =>
      record.category === CLASS_CATEGORY.BASE && record.id === params.classId
  )

  if (
    baseClass?.subclassSelectionLevel === undefined ||
    params.classLevel < baseClass.subclassSelectionLevel
  ) {
    return []
  }

  return params.catalog.classes.filter(
    (record) =>
      record.category === CLASS_CATEGORY.SUBCLASS && record.parentClassId === params.classId
  )
}

export function validateMulticlass(
  classSelections: ResolvedClassSelection[],
  abilityScores: Partial<Record<string, number>>
): CharacterBuilderValidation[] {
  if (classSelections.length <= 1) return []

  const validations: CharacterBuilderValidation[] = []
  for (const selection of classSelections) {
    const baseClass = selection.baseClass
    if (!baseClass) continue

    if (
      !evaluateMulticlassRequirements(baseClass.multiclass.requirementGroups, abilityScores).passes
    ) {
      validations.push({
        code: 'MULTICLASS_PREREQUISITE_UNMET',
        severity: 'blocking',
        sectionId: 'CLASSES',
        message: `Multiclass prerequisites are not met for ${baseClass.label}.`
      })
    }
  }

  return validations
}

function isClassSourceLevelStillAvailable(
  source: Extract<CharacterProvenance, { kind: 'CLASS' | 'SUBCLASS' }>,
  row: CharacterClassIntent
): boolean {
  return source.classLevel == null || source.classLevel <= row.classLevel
}

function isCharacterBuilderProvenanceStillValid({
  source,
  character,
  registry,
  grantedFeatures = []
}: {
  source: CharacterProvenance
  character: CharacterAuthored
  registry: CharacterBuilderRegistry
  grantedFeatures?: CharacterBuilderGrantedFeatureLookup
}): boolean {
  switch (source.kind) {
    case 'CLASS':
      return character.intent.classes.some(
        (row) => row.classId === source.classId && isClassSourceLevelStillAvailable(source, row)
      )
    case 'SUBCLASS':
      return character.intent.classes.some(
        (row) =>
          row.subclassId === source.subclassId && isClassSourceLevelStillAvailable(source, row)
      )
    case 'RACE':
      return character.intent.race.raceId === source.raceId
    case 'SUBRACE':
      return character.intent.race.subraceId === source.subraceId
    case 'ANCESTRY': {
      const { ancestryRace, selectedAncestry, selectedAncestryOption } = getCharacterRaceSelection(
        character,
        registry
      )
      return Boolean(
        ancestryRace?.ancestry &&
        selectedAncestry &&
        selectedAncestryOption &&
        selectedAncestry.ancestryId === source.ancestryId &&
        selectedAncestry.optionId === source.optionId
      )
    }
    case 'BACKGROUND':
      return character.intent.background.backgroundId === source.backgroundId
    case 'FEAT':
      return registry.feats?.some((feat) => feat.id === source.featId) ?? false
    case 'FEATURE':
      return grantedFeatures.some((record) => record.feature.id === source.featureId)
    case 'OPTION':
      return character.intent.featureAcquisitions.some(
        (record) =>
          record.id === source.acquiredParentId &&
          isCharacterAcquisitionTimingAvailable(character, record.timing) &&
          isCharacterFeatAcquisitionValid(record, registry) &&
          record.selections?.some(
            (selection) =>
              selection.selectionKey === 'options' &&
              selection.values.some((value) =>
                value.kind === 'ID'
                  ? value.id === source.optionId
                  : value.kind === 'IDS' && value.ids.includes(source.optionId)
              )
          )
      )
    case 'MANUAL':
      return true
    default:
      return false
  }
}

export function isProvenanceStillValid(
  source: CharacterProvenance,
  character: CharacterAuthored,
  registry: CharacterBuilderRegistry,
  grantedFeatures: GrantedFeatureRecord[]
): boolean {
  return isCharacterBuilderProvenanceStillValid({
    source,
    character,
    registry,
    grantedFeatures
  })
}

export function getRequiredClassResourceGrants(
  classSelections: ResolvedClassSelection[]
): CharacterResourceGrantRecord[] {
  return classSelections.flatMap((selection) => {
    const grants: CharacterResourceGrantRecord[] = []

    if (
      selection.baseClass?.resources &&
      selection.baseClass.resources.availableAtLevel <= selection.row.classLevel
    ) {
      grants.push({
        id: `resource:${selection.baseClass.id}:${selection.baseClass.resources.id}`,
        resourceId: selection.baseClass.resources.id,
        source: {
          kind: 'CLASS',
          classId: selection.baseClass.id,
          classLevel: selection.baseClass.resources.availableAtLevel
        },
        timing: {
          kind: 'CLASS_LEVEL',
          classId: selection.baseClass.id,
          classLevel: selection.baseClass.resources.availableAtLevel
        }
      })
    }

    if (
      selection.subclass?.resources &&
      selection.subclass.resources.availableAtLevel <= selection.row.classLevel
    ) {
      grants.push({
        id: `resource:${selection.subclass.id}:${selection.subclass.resources.id}`,
        resourceId: selection.subclass.resources.id,
        source: {
          kind: 'SUBCLASS',
          subclassId: selection.subclass.id,
          classLevel: selection.subclass.resources.availableAtLevel
        },
        timing: {
          kind: 'CLASS_LEVEL',
          classId: selection.row.classId,
          classLevel: selection.subclass.resources.availableAtLevel
        }
      })
    }

    return grants
  })
}

export function mergeRequiredResourceGrants(
  currentGrants: CharacterResourceGrantRecord[],
  requiredGrants: CharacterResourceGrantRecord[]
): CharacterResourceGrantRecord[] {
  const grants = [...currentGrants]

  for (const requiredGrant of requiredGrants) {
    const hasGrant = grants.some((grant) => isSameRequiredResourceGrant(grant, requiredGrant))
    if (!hasGrant) {
      grants.push(requiredGrant)
    }
  }

  return grants
}

export function isSameRequiredResourceGrant(
  left: CharacterResourceGrantRecord,
  right: CharacterResourceGrantRecord
): boolean {
  return (
    left.resourceId === right.resourceId &&
    isSameRequiredResourceGrantSource(left.source, right.source)
  )
}

function isSameRequiredResourceGrantSource(
  left: CharacterProvenance,
  right: CharacterProvenance
): boolean {
  if (left.kind !== right.kind) return false

  if (left.kind === 'CLASS' && right.kind === 'CLASS') {
    return left.classId === right.classId
  }

  if (left.kind === 'SUBCLASS' && right.kind === 'SUBCLASS') {
    return left.subclassId === right.subclassId
  }

  return isSameCharacterProvenanceIdentity(left, right)
}

export function getCharacterChosenGrantOwners(
  character: CharacterAuthored,
  classSelections: ResolvedClassSelection[],
  selectedBackground: CompiledBackground | undefined,
  grantedFeatures: GrantedFeatureRecord[],
  feats: readonly CompiledFeat[]
): CharacterChosenGrantOwner[] {
  const owners: CharacterChosenGrantOwner[] = []

  classSelections.forEach((selection, index) => {
    const classProficiencies =
      index === 0
        ? selection.baseClass?.proficiencies
        : selection.baseClass?.multiclass.proficiencies

    if (classProficiencies?.length && selection.baseClass) {
      const source = {
        kind: 'CLASS',
        classId: selection.baseClass.id,
        classLevel: 1
      } as const
      owners.push({
        label: selection.baseClass.label,
        sourceLabel: selection.baseClass.label,
        source,
        timing: {
          kind: 'CLASS_LEVEL',
          classId: selection.baseClass.id,
          classLevel: 1
        },
        activeLevel: selection.row.classLevel,
        grants: { proficiencies: classProficiencies }
      })
    }

    if (selection.subclass?.proficiencies?.length) {
      const subclassSelectionLevel = selection.baseClass?.subclassSelectionLevel ?? 1
      const source = {
        kind: 'SUBCLASS',
        subclassId: selection.subclass.id,
        classLevel: subclassSelectionLevel
      } as const
      owners.push({
        label: selection.subclass.label,
        sourceLabel: selection.subclass.label,
        source,
        timing: {
          kind: 'CLASS_LEVEL',
          classId: selection.row.classId,
          classLevel: subclassSelectionLevel
        },
        activeLevel: selection.row.classLevel,
        grants: { proficiencies: selection.subclass.proficiencies }
      })
    }
  })

  if (selectedBackground?.proficiencies?.length) {
    owners.push({
      label: selectedBackground.label,
      sourceLabel: selectedBackground.label,
      source: { kind: 'BACKGROUND', backgroundId: selectedBackground.id },
      timing: { kind: 'IMMEDIATE' },
      activeLevel: Math.max(
        character.intent.classes.reduce((total, row) => total + row.classLevel, 0),
        1
      ),
      grants: { proficiencies: selectedBackground.proficiencies }
    })
  }

  for (const granted of grantedFeatures) {
    const timing = getChosenGrantOwnerTiming(character, granted)
    owners.push({
      label: granted.feature.label,
      ownerFeatureId: granted.feature.id,
      sourceLabel: granted.sourceLabel,
      source: granted.source,
      timing,
      activeLevel: granted.level,
      grants: granted.feature
    })

    const acquisition = findCurrentCharacterFeatureAcquisition(
      character,
      granted.feature.id,
      granted.source
    )
    const selectedOptionIds = new Set(
      getSelectedFeatureOptionIds(granted.feature, character, granted.source)
    )
    for (const option of granted.feature.options ?? []) {
      if (!acquisition || !selectedOptionIds.has(option.id)) continue
      owners.push({
        label: option.label,
        ownerFeatureId: granted.feature.id,
        sourceLabel: granted.sourceLabel,
        source: {
          kind: 'OPTION',
          acquiredParentId: acquisition.id,
          optionId: option.id
        },
        timing,
        activeLevel: granted.level,
        grants: option
      })
    }
  }

  for (const feat of feats) {
    const acquisitions = character.intent.featureAcquisitions.filter(
      (record) =>
        record.source.kind === 'FEAT' &&
        record.source.featId === feat.id &&
        (record.featureId === feat.id ||
          feat.features?.some((feature) => feature.id === record.featureId)) &&
        isCharacterAcquisitionTimingAvailable(character, record.timing)
    )
    const acquisition =
      acquisitions.find((record) => record.featureId === feat.id) ?? acquisitions[0]
    if (!acquisition) continue
    owners.push({
      label: feat.label,
      sourceLabel: feat.label,
      source: acquisition.source,
      timing: acquisition.timing,
      activeLevel: Math.max(
        character.intent.classes.reduce((sum, row) => sum + row.classLevel, 0),
        1
      ),
      grants: feat
    })
  }
  return owners
}

function getChosenGrantOwnerTiming(
  character: CharacterAuthored,
  granted: GrantedFeatureRecord
): CharacterAcquisitionTiming {
  const availableAtLevel = granted.feature.availableAtLevel ?? 1
  if (granted.source.kind === 'CLASS') {
    return {
      kind: 'CLASS_LEVEL',
      classId: granted.source.classId,
      classLevel: availableAtLevel
    }
  }

  if (granted.source.kind === 'SUBCLASS') {
    const subclassId = granted.source.subclassId
    const owningClass = character.intent.classes.find((record) => record.subclassId === subclassId)
    if (owningClass) {
      return {
        kind: 'CLASS_LEVEL',
        classId: owningClass.classId,
        classLevel: availableAtLevel
      }
    }
  }

  return { kind: 'IMMEDIATE' }
}

export type FeatureOptionEligibility<
  T extends { output: CharacterRulePolicyOutput } = { output: CharacterRulePolicyOutput }
> = {
  character: CharacterAuthored
  optionsByFeatureId: ReadonlyMap<string, NonNullable<CompiledFeature['options']>>
  eligibilityById: ReadonlyMap<string, boolean>
  ruleEvaluation: T | null
}

type EligibilityFacet = CharacterRulePolicyInput['eligibilityFacets'][number]

function featureOptionEvaluationId(featureId: string, optionId: string): string {
  return `feature-option:${featureId}:${optionId}`
}

function compileFeatureOptionEligibilityRuleFacts(
  grantedFeatures: readonly GrantedFeatureRecord[]
): EligibilityFacet[] {
  const seen = new Set<string>()
  const facts: EligibilityFacet[] = []
  for (const { feature } of grantedFeatures) {
    for (const option of feature.options ?? []) {
      if (!option.restrictions) continue
      const evaluationId = featureOptionEvaluationId(feature.id, option.id)
      if (seen.has(evaluationId)) continue
      seen.add(evaluationId)
      facts.push(
        compileCharacterEligibilityRuleFacts({
          evaluationId,
          facet: option.restrictions
        })
      )
    }
  }
  return facts
}

function getFeatureOptionsById(
  grantedFeatures: readonly GrantedFeatureRecord[],
  eligibilityById: ReadonlyMap<string, boolean>
): Map<string, NonNullable<CompiledFeature['options']>> {
  return new Map(
    grantedFeatures.map(({ feature }) => [
      feature.id,
      (feature.options ?? []).filter((option) => {
        if (!option.restrictions) return true
        const evaluationId = featureOptionEvaluationId(feature.id, option.id)
        const passed = eligibilityById.get(evaluationId)
        if (passed === undefined) {
          throw new Error(`Missing Character rule eligibility result "${evaluationId}".`)
        }
        return passed
      })
    ])
  )
}

function filterFeatureOptionSelections(
  character: CharacterAuthored,
  grantedFeatures: readonly GrantedFeatureRecord[],
  optionsByFeatureId: ReadonlyMap<string, NonNullable<CompiledFeature['options']>>
): { character: CharacterAuthored; changed: boolean } {
  let changed = false
  const featureAcquisitions = character.intent.featureAcquisitions.map((acquisition) => {
    if (!isCharacterAcquisitionTimingAvailable(character, acquisition.timing)) return acquisition
    let acquisitionChanged = false
    const granted = grantedFeatures.find(
      (candidate) =>
        candidate.feature.id === acquisition.featureId &&
        isSameCharacterProvenanceIdentity(candidate.source, acquisition.source)
    )
    if (!granted || !acquisition.selections?.length) return acquisition

    const eligibleOptionIds = new Set(
      (optionsByFeatureId.get(granted.feature.id) ?? []).map((option) => option.id)
    )
    const selections: NonNullable<typeof acquisition.selections> = []
    for (const selection of acquisition.selections) {
      if (selection.selectionKey !== 'options') {
        selections.push(selection)
        continue
      }

      const values: typeof selection.values = []
      for (const value of selection.values) {
        if (value.kind === 'ID') {
          if (eligibleOptionIds.has(value.id)) values.push(value)
          else acquisitionChanged = true
          continue
        }
        if (value.kind === 'IDS') {
          const ids = value.ids.filter((id) => eligibleOptionIds.has(id))
          if (ids.length === value.ids.length) values.push(value)
          else {
            acquisitionChanged = true
            if (ids.length > 0) values.push({ ...value, ids })
          }
          continue
        }

        values.push(value)
      }

      if (values.length > 0) selections.push({ ...selection, values })
    }
    if (!acquisitionChanged) return acquisition

    changed = true
    const nextAcquisition = { ...acquisition }
    if (selections.length > 0) nextAcquisition.selections = selections
    else delete nextAcquisition.selections
    return nextAcquisition
  })

  if (!changed) return { character, changed: false }
  return {
    character: {
      ...character,
      intent: {
        ...character.intent,
        featureAcquisitions
      }
    },
    changed: true
  }
}

export async function resolveFeatureOptionEligibility<
  T extends { output: CharacterRulePolicyOutput }
>(params: {
  character: CharacterAuthored
  grantedFeatures: readonly GrantedFeatureRecord[]
  evaluate: (character: CharacterAuthored, eligibilityFacets: EligibilityFacet[]) => Promise<T>
  additionalEligibilityFacets?: readonly EligibilityFacet[]
  requireEvaluation?: boolean
}): Promise<FeatureOptionEligibility<T>> {
  const featureFacets = compileFeatureOptionEligibilityRuleFacts(params.grantedFeatures)
  const eligibilityFacets = [...featureFacets, ...(params.additionalEligibilityFacets ?? [])]
  if (eligibilityFacets.length === 0 && !params.requireEvaluation) {
    const eligibilityById = new Map<string, boolean>()
    return {
      character: params.character,
      optionsByFeatureId: getFeatureOptionsById(params.grantedFeatures, eligibilityById),
      eligibilityById,
      ruleEvaluation: null
    }
  }

  let candidate = params.character
  while (true) {
    const ruleEvaluation = await params.evaluate(candidate, eligibilityFacets)
    const eligibilityById = new Map(
      ruleEvaluation.output.eligibilityFacets.map((evaluation) => [
        evaluation.evaluationId,
        evaluation.passed
      ])
    )
    const optionsByFeatureId = getFeatureOptionsById(params.grantedFeatures, eligibilityById)
    const filtered = filterFeatureOptionSelections(
      candidate,
      params.grantedFeatures,
      optionsByFeatureId
    )
    if (!filtered.changed) {
      return {
        character: candidate,
        optionsByFeatureId,
        eligibilityById,
        ruleEvaluation
      }
    }
    candidate = filtered.character
  }
}

function filterFeatureOptions(
  feature: CompiledFeature,
  optionsByFeatureId: ReadonlyMap<string, NonNullable<CompiledFeature['options']>>
): CompiledFeature {
  const options = optionsByFeatureId.get(feature.id)
  return options ? { ...feature, options: [...options] } : feature
}

export function filterRegistryFeatureOptions(
  registry: CharacterBuilderRegistry,
  optionsByFeatureId: ReadonlyMap<string, NonNullable<CompiledFeature['options']>>
): CharacterBuilderRegistry {
  const mapFeatures = (features: readonly CompiledFeature[] | undefined) =>
    features?.map((feature) => filterFeatureOptions(feature, optionsByFeatureId))

  return {
    ...registry,
    features: mapFeatures(registry.features) ?? [],
    races: registry.races.map((race) => ({
      ...race,
      features: mapFeatures(race.features),
      ancestry: race.ancestry
        ? {
            ...race.ancestry,
            options: race.ancestry.options.map((option) => ({
              ...option,
              features: mapFeatures(option.features)
            }))
          }
        : undefined
    })),
    classes: registry.classes.map((record) => ({
      ...record,
      features: mapFeatures(record.features)
    })),
    backgrounds: registry.backgrounds.map((background) => ({
      ...background,
      features: mapFeatures(background.features)
    }))
  }
}
