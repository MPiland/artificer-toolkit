import type {
  EffectDto,
  PathDto,
  TargetingDto
} from '@artificer-toolkit/schema/effects'
import type { RangeDto } from '@artificer-toolkit/schema/shared/range'
import type { StartingEquipmentDto } from '@artificer-toolkit/schema/shared/startingEquipment'
import type { NodeRuntimeNodeDto } from '@artificer-toolkit/schema/api/nodeRuntime'

export type AuthoringGroupValues = Record<string, unknown>

export type EffectEditorReferenceData = {
  damageTypes: Array<{ value: string, label: string }>
  conditionTypes: Array<{ value: string, label: string }>
  creatures: Array<{ value: string, label: string }>
}

type ResultBlockLike = {
  outcomes?: unknown
}

export type OutcomeDraft = Record<string, unknown>
export type StartingEquipmentItemDto = StartingEquipmentDto['sets'][number]['groups'][number]['options'][number]['items'][number]

export function createDefaultAuthoringArrayItem(
  node: NodeRuntimeNodeDto,
  currentLength: number
): AuthoringGroupValues {
  return createDefaultAuthoringNodeValue(getChildMapId(node), currentLength + 1)
}

export function createDefaultAuthoringObjectItem(node: NodeRuntimeNodeDto): AuthoringGroupValues {
  return createDefaultAuthoringNodeValue(getChildMapId(node), 1)
}

export function createDefaultAuthoringNodeValue(
  childMapId: string,
  order = 1
): AuthoringGroupValues {
  switch (childMapId) {
    case 'abilityScores':
    case 'summonAbilityScores':
      return createAbilityScores()
    case 'capacity':
    case 'creatureCapacity':
      return createMeasurement('POUNDS')
    case 'activation':
    case 'castingTime':
      return {
        amount: 1,
        unit: 'ROUND'
      }
    case 'chargeBonus':
      return createChargeBonus(order)
    case 'charges':
      return createChargeRules()
    case 'classDetail':
    case 'creatureDetail':
    case 'detail':
    case 'raceDetail':
    case 'vehicleDetail':
      return createDetail(order)
    case 'classHitpoint':
      return {
        ability: 'CONSTITUTION',
        dieConfig: '1d8'
      }
    case 'classMulticlass':
      return {
        id: crypto.randomUUID(),
        requirementGroups: { groups: [] },
        proficiencies: []
      }
    case 'classMulticlassRequirement':
      return {
        id: crypto.randomUUID(),
        ability: 'STRENGTH',
        min: 13
      }
    case 'classMulticlassRequirementGroup':
      return {
        id: crypto.randomUUID(),
        requirements: []
      }
    case 'classMulticlassRequirementGroups':
      return { groups: [] }
    case 'classPrepareLimit':
      return {
        methodKinds: [],
        perLevel: []
      }
    case 'classPrepareLimitPerLevel':
      return {
        classLevel: order,
        amount: 0
      }
    case 'classResource':
      return {
        id: crypto.randomUUID(),
        label: '',
        description: '',
        availableAtLevel: 1,
        charges: createChargeRules()
      }
    case 'classSpecialization':
      return {
        id: crypto.randomUUID(),
        label: '',
        order
      }
    case 'classSpellcasting':
      return {
        spellLimits: [],
        details: [],
        maxSpellLevel: 9,
        attributes: [],
        charges: createChargeRules()
      }
    case 'classSpellLimits':
      return {
        classLevel: order,
        slots: []
      }
    case 'classSpellSlot':
      return {
        spellLevel: order,
        slotCount: 0
      }
    case 'classStartingGold':
      return {
        multiplier: 1,
        currencyId: '',
        dieConfig: '1d4'
      }
    case 'contains':
      return {
        equipmentId: '',
        quantity: 1
      }
    case 'cost':
    case 'creatureCost':
      return {
        amount: 0,
        currencyId: ''
      }
    case 'creatureAction':
      return {
        id: crypto.randomUUID(),
        label: '',
        description: ''
      }
    case 'creatureCompanionProfile':
      return {
        bondType: 'ANIMAL_COMPANION',
        initiativeMode: 'USES_PC_INITIATIVE',
        notes: ''
      }
    case 'creatureLairProfile':
      return {
        lairActions: [],
        regionalEffects: []
      }
    case 'creatureLegendaryProfile':
      return {
        actionsCount: 3,
        legendaryResistanceCount: 0
      }
    case 'creatureMountProfile':
      return {
        mountType: 'CONTROLLED',
        riderCount: 1,
        notes: ''
      }
    case 'creatureNpcProfile':
      return {
        bonds: [],
        flaws: [],
        ideals: [],
        personalityTraits: []
      }
    case 'effect':
      return createDefaultEffect(order)
    case 'effectPath':
      return createDefaultPath(order)
    case 'duration':
      return {
        durationKind: 'INSTANTANEOUS'
      }
    case 'durationValue':
      return { amount: 1 }
    case 'facet':
      return {
        id: crypto.randomUUID(),
        groups: []
      }
    case 'facetBody':
      return {
        authoringModeKind: 'ALL',
        groups: []
      }
    case 'facetBodyGroup':
      return { conditions: [] }
    case 'facetContext':
      return { conditions: [] }
    case 'facetExists':
      return {
        constraint: 'REQUIRED',
        relationCode: 'FEATURE',
        authoringModeKind: 'ALL'
      }
    case 'facetGroup':
      return { contexts: [] }
    case 'feature':
    case 'featureBasics':
      return createFeatureLike(order)
    case 'option':
      return createOption(order)
    case 'featureGrants':
      return createFeatureGrants()
    case 'featureOptionChoice':
      return {
        level: order,
        count: 1
      }
    case 'featGrant':
      return createScalingGrant('FEAT_GRANT', order)
    case 'featGrantLevel':
      return createGrantLevel(order)
    case 'featGrantProgression':
      return createGrantProgression()
    case 'modifierChargeLimitLevel':
      return {
        id: crypto.randomUUID(),
        level: order,
        amount: 1
      }
    case 'modifierGrant':
      return createModifierGrant(order)
    case 'modifierGrantDomain':
      return {}
    case 'modifierGrantPayload':
      return {
        valueKind: 'FIXED',
        amount: 1
      }
    case 'invocation':
      return {
        kind: 'ACTION',
        triggerCode: 'ACTIVATED',
        activation: { code: 'ACTION', amount: 1 },
        range: createRange('SELF')
      }
    case 'measurement':
    case 'shapeMeasurement':
      return createMeasurement('FEET')
    case 'nonManifestOutcome':
    case 'outcome':
      return {
        id: crypto.randomUUID(),
        effectKind: 'RULE'
      }
    case 'nonManifestResultBlock':
    case 'resultBlock':
      return {
        id: crypto.randomUUID(),
        resultKind: 'SINGLE',
        outcomes: []
      }
    case 'numericAtom':
    case 'numericExpr':
      return {
        valueKind: 'FIXED',
        amount: 1
      }
    case 'pathLifecycle':
      return {}
    case 'proficiencyGrant':
      return createProficiencyGrant(order)
    case 'raceAncestry':
      return {
        id: crypto.randomUUID(),
        label: '',
        description: '',
        options: []
      }
    case 'raceAncestryOption':
      return {
        id: crypto.randomUUID(),
        label: '',
        description: '',
        order,
        features: []
      }
    case 'range':
      return createRange('DISTANCE')
    case 'savingThrow':
      return {
        id: crypto.randomUUID(),
        ability: 'DEXTERITY',
        dcMethod: 'FIXED_DC',
        baseDc: 10,
        bonuses: []
      }
    case 'savingThrowDcBonus':
      return {
        id: crypto.randomUUID(),
        bonusKind: 'PROFICIENCY_BONUS'
      }
    case 'senseGrant':
      return createScalingGrant('SENSE_GRANT', order)
    case 'senseGrantLevel':
      return createGrantLevel(order)
    case 'senseGrantProgression':
      return createGrantProgression()
    case 'speed':
      return {
        speedId: '',
        amount: 30,
        unit: 'FEET'
      }
    case 'shape':
      return {
        shapeKind: 'SPHERE',
        size: createMeasurement('FEET')
      }
    case 'spellGrant':
      return createScalingGrant('SPELL_GRANT', order)
    case 'spellGrantLevel':
      return createGrantLevel(order)
    case 'spellGrantProgression':
      return createGrantProgression()
    case 'startingEquipment':
      return createEmptyStartingEquipment()
    case 'startingEquipmentCurrency':
      return {
        currencyId: '',
        amount: 1
      }
    case 'startingEquipmentGroup':
      return {
        id: crypto.randomUUID(),
        order,
        options: []
      }
    case 'startingEquipmentItem':
      return createEmptyStartingEquipmentItem(order)
    case 'startingEquipmentOption':
      return {
        id: crypto.randomUUID(),
        order,
        items: []
      }
    case 'startingEquipmentSet':
      return {
        id: crypto.randomUUID(),
        order,
        groups: []
      }
    case 'vehicleString':
    case 'string':
    case 'logisticsNote':
    case 'regionalEffect':
    case 'tag':
      return { value: '' }
    case 'targeting':
      return createTargeting('SELF') as AuthoringGroupValues
    case 'weight':
      return createMeasurement('POUNDS')
    default:
      return {
        id: crypto.randomUUID(),
        order
      }
  }
}

export function createEmptyStartingEquipment(): StartingEquipmentDto {
  return {
    id: crypto.randomUUID(),
    sets: [
      {
        id: crypto.randomUUID(),
        order: 1,
        groups: [
          {
            id: crypto.randomUUID(),
            order: 1,
            options: [
              {
                id: crypto.randomUUID(),
                order: 1,
                items: []
              }
            ]
          }
        ]
      }
    ]
  }
}

export function createEmptyStartingEquipmentItem(order: number): StartingEquipmentItemDto {
  return {
    id: crypto.randomUUID(),
    order,
    startingEquipmentKind: 'EQUIPMENT',
    selectionKind: 'GRANTED',
    quantity: 1,
    authoringModeKind: 'ALL'
  }
}

export function addStartingEquipmentItem(startingEquipment: StartingEquipmentDto | undefined): StartingEquipmentDto {
  const next = startingEquipment ?? createEmptyStartingEquipment()
  const itemCount = getStartingEquipmentItems(next).length

  return appendStartingEquipmentItem(next, createEmptyStartingEquipmentItem(itemCount + 1))
}

export function upsertStartingEquipmentItem(
  startingEquipment: StartingEquipmentDto | undefined,
  item: StartingEquipmentItemDto
): StartingEquipmentDto {
  const next = startingEquipment ?? createEmptyStartingEquipment()
  const hasItem = getStartingEquipmentItems(next).some((current) => current.id === item.id)

  return hasItem
    ? replaceStartingEquipmentItem(next, item.id, item)
    : appendStartingEquipmentItem(next, item)
}

export function replaceStartingEquipmentItem(
  startingEquipment: StartingEquipmentDto,
  itemId: string,
  replacement: StartingEquipmentItemDto
): StartingEquipmentDto {
  return updateStartingEquipmentItems(startingEquipment, (items) => (
    items.map((item) => item.id === itemId ? replacement : item)
  ))
}

export function removeStartingEquipmentItem(startingEquipment: StartingEquipmentDto, itemId: string): StartingEquipmentDto {
  return updateStartingEquipmentItems(startingEquipment, (items) => items.filter((item) => item.id !== itemId))
}

export function getStartingEquipmentItems(startingEquipment: StartingEquipmentDto | undefined): StartingEquipmentItemDto[] {
  if (!startingEquipment) return []

  return startingEquipment.sets.flatMap((set) => (
    set.groups.flatMap((group) => group.options.flatMap((option) => option.items))
  ))
}

export function formatStartingEquipmentTitle(item: StartingEquipmentItemDto): string {
  return item.startingEquipmentKind === 'CURRENCY' ? 'Currency' : 'Equipment'
}

export function formatStartingEquipmentDescription(item: StartingEquipmentItemDto): string {
  if (item.startingEquipmentKind === 'CURRENCY') {
    return item.currencies
      .map((currency) => isRecord(currency) ? `${currency.amount ?? 0} ${currency.currencyId ?? ''}` : '')
      .filter(Boolean)
      .join(', ') || 'No currency selected yet.'
  }

  const amount = item.selectionKind === 'CHOSEN'
    ? `Player chooses ${item.count ?? 1}`
    : `Grants ${item.quantity ?? 1}`
  const equipmentIds = item.authoringModeKind === 'SELECTED' ? item.equipmentIds : []
  const target = item.authoringModeKind === 'SELECTED'
    ? `${equipmentIds.length} selected option${equipmentIds.length === 1 ? '' : 's'}`
    : 'matching equipment'

  return `${amount} from ${target}.`
}

export function createDefaultEffect(order: number): EffectDto {
  return {
    id: crypto.randomUUID(),
    order,
    invocation: {
      kind: 'ACTION',
      triggerCode: 'ACTIVATED',
      activation: { code: 'ACTION', amount: 1 },
      range: createRange('SELF')
    },
    paths: [createDefaultPath(1, 'ON_USE')]
  }
}

export function createDefaultPath(order: number, pathCode: PathDto['pathCode'] = 'ON_USE'): PathDto {
  return {
    id: crypto.randomUUID(),
    order,
    pathCode,
    groupType: 'SINGLE',
    selectionKind: 'FIXED',
    resultBlock: {
      id: crypto.randomUUID(),
      resultKind: 'SINGLE',
      outcomes: []
    }
  } as PathDto
}

export function createPathForSelection({
  id,
  order,
  pathCode,
  selectionKind
}: {
  id: string
  order: number
  pathCode: PathDto['pathCode']
  selectionKind: 'FIXED' | 'CHOICE' | 'ROLL_TABLE'
}): PathDto {
  if (selectionKind === 'CHOICE') {
    return {
      id,
      order,
      pathCode,
      groupType: 'CHOICE',
      selectionKind: 'CHOICE',
      options: []
    } as PathDto
  }

  if (selectionKind === 'ROLL_TABLE') {
    return {
      id,
      order,
      pathCode,
      groupType: 'SINGLE',
      selectionKind: 'ROLL_TABLE',
      rollTableKind: 'RANGE',
      dieConfig: '1d6',
      rows: []
    } as PathDto
  }

  return {
    ...createDefaultPath(order, pathCode),
    id
  }
}

export function createRange(rangeKind = 'SELF', amount = 30): RangeDto {
  return rangeKind === 'DISTANCE'
    ? { id: crypto.randomUUID(), rangeKind: 'DISTANCE', amount, unit: 'FEET' }
    : { id: crypto.randomUUID(), rangeKind: rangeKind as Exclude<RangeDto['rangeKind'], 'DISTANCE'> }
}

export function createTargeting(selectionKind = 'SELF'): TargetingDto {
  if (selectionKind === 'SELF') return { selectionKind: 'SELF' }
  if (selectionKind === 'CHOSEN_CREATURES') return { selectionKind: 'CHOSEN_CREATURES', dispositionKind: 'ANY', maxTargets: 1 }
  if (selectionKind === 'AREA_CONTENTS') return { selectionKind: 'AREA_CONTENTS', dispositionKind: 'ANY' }
  return { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
}

export function createOutcome(kind: string, references: EffectEditorReferenceData): Record<string, unknown> {
  const id = crypto.randomUUID()

  switch (kind) {
    case 'DAMAGE':
      return {
        id,
        effectKind: 'DAMAGE',
        valueKind: 'DICE',
        scalingKind: 'NONE',
        diceConfig: '1d6',
        damageTypeId: references.damageTypes[0]?.value ?? ''
      }
    case 'CONDITION':
      return { id, effectKind: 'CONDITION', conditionId: references.conditionTypes[0]?.value ?? '' }
    case 'HEAL':
      return { id, effectKind: 'HEAL', valueKind: 'DICE', scalingKind: 'NONE', diceConfig: '1d6' }
    case 'APPLY_GRANT':
      return { id, effectKind: 'APPLY_GRANT', grants: {} }
    case 'FORCED_MOVEMENT':
      return {
        id,
        effectKind: 'FORCED_MOVEMENT',
        direction: 'AWAY_FROM_SOURCE',
        actionEconomy: 'NONE',
        distanceMode: 'FIXED_DISTANCE',
        amount: 10,
        unit: 'FEET'
      }
    case 'TELEPORT':
      return {
        id,
        effectKind: 'TELEPORT',
        targetKind: 'TARGET',
        destinationKind: 'VISIBLE',
        distance: createRange('DISTANCE', 30)
      }
    case 'MANIFEST':
      return { id, effectKind: 'MANIFEST', manifestKind: 'ZONE', label: 'Manifested effect' }
    case 'MOVE_MANIFEST':
      return { id, effectKind: 'MOVE_MANIFEST', manifestId: '', amount: 30, unit: 'FEET' }
    case 'COMMAND_MANIFEST':
      return { id, effectKind: 'COMMAND_MANIFEST', manifestId: '' }
    default:
      return { id, effectKind: 'RULE' }
  }
}

export function formatEffectSummary(effect: EffectDto): string {
  return toTitleCase(effect.invocation.triggerCode.replaceAll('_', ' '))
}

export function formatEffectDescription(effect: EffectDto): string | undefined {
  if (effect.paths.length === 0) return 'No outcome paths configured'

  return effect.paths
    .map((path) => `${formatPathResultLabel(path.pathCode)}: ${formatPathOutcomeSummary(path)}`)
    .join('; ')
}

export function formatResultBlockSummary(resultBlock: unknown): string | undefined {
  const outcomes = getOutcomesFromResultBlock(resultBlock)
  if (outcomes.length === 0) return undefined

  return outcomes
    .map(formatOutcomeSummary)
    .filter((summary, index, summaries) => summaries.indexOf(summary) === index)
    .join(', ')
}

function formatPathResultLabel(pathCode: PathDto['pathCode']): string {
  switch (pathCode) {
    case 'ON_SAVE_FAIL':
      return 'Failed'
    case 'ON_SAVE_SUCCESS':
      return 'Success'
    case 'ON_HIT':
      return 'Hit'
    case 'ON_MISS':
      return 'Miss'
    case 'ON_CRIT':
      return 'Critical'
    default:
      return toTitleCase(String(pathCode).replaceAll('_', ' '))
  }
}

function formatPathOutcomeSummary(path: PathDto): string {
  const outcomes = getPathOutcomes(path)
  if (outcomes.length === 0) return 'No effect'

  return formatResultBlockSummary({ outcomes }) ?? 'No effect'
}

function formatOutcomeSummary(outcome: OutcomeDraft): string {
  const effectKind = typeof outcome.effectKind === 'string' ? outcome.effectKind : 'RULE'

  if (effectKind === 'DAMAGE') {
    return outcome.amountKind === 'HALF' ? 'Half damage' : 'Damage'
  }

  if (effectKind === 'HEAL') return 'Healing'
  if (effectKind === 'CONDITION') return 'Condition'
  if (effectKind === 'APPLY_GRANT') return 'Grant'

  return toTitleCase(effectKind.replaceAll('_', ' '))
}

export function getPathOutcomes(path: PathDto): OutcomeDraft[] {
  if ('resultBlock' in path) {
    return getOutcomesFromResultBlock(path.resultBlock)
  }

  if ('options' in path) {
    return path.options.flatMap((option) => getOutcomesFromResultBlock(option.resultBlock))
  }

  if ('rows' in path) {
    return path.rows.flatMap((row) => getOutcomesFromResultBlock(row.resultBlock))
  }

  return []
}

function getChildMapId(node: NodeRuntimeNodeDto): string {
  if (node.childMapId) return node.childMapId
  throw new Error(`Cannot create default value for group node "${node.id}" without childMapId.`)
}

function createAbilityScores() {
  return {
    STRENGTH: 10,
    DEXTERITY: 10,
    CONSTITUTION: 10,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 10,
    SPELLCASTING: 0
  }
}

function createChargeBonus(order: number) {
  return {
    id: crypto.randomUUID(),
    order,
    bonusKind: 'PROFICIENCY_BONUS'
  }
}

function createChargeRules() {
  return {
    id: crypto.randomUUID(),
    resetKind: 'LONG_REST',
    limitKind: 'FIXED_AMOUNT',
    scalingKind: 'NONE',
    amount: 1,
    bonuses: []
  }
}

function createDetail(order: number) {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: '',
    order
  }
}

function createFeatureLike(order: number) {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: '',
    order,
    details: [],
    effects: [],
    optionChoices: [],
    options: []
  }
}

function createOption(order: number) {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: '',
    order,
    details: [],
    effects: []
  }
}

function createFeatureGrants() {
  return {
    feats: [],
    modifiers: [],
    proficiencies: [],
    senses: [],
    spells: []
  }
}

function createGrantLevel(order: number) {
  return {
    id: crypto.randomUUID(),
    level: order,
    order,
    authoringModeKind: 'ALL'
  }
}

function createGrantProgression() {
  return {
    scalingSource: 'CHARACTER_LEVEL',
    levels: []
  }
}

function createMeasurement(unit: string) {
  return {
    amount: 0,
    unit
  }
}

function createModifierGrant(order: number) {
  return {
    id: crypto.randomUUID(),
    order,
    grantKind: 'MODIFIER_GRANT',
    selectionKind: 'GRANTED',
    valueDomainCode: 'HIT_POINTS_MAX',
    modifierKind: 'BONUS',
    scope: 'SOURCE',
    domain: {},
    payload: {
      valueKind: 'FIXED',
      amount: 1
    }
  }
}

function createProficiencyGrant(order: number) {
  return {
    grantKind: 'PROFICIENCY_GRANT',
    id: crypto.randomUUID(),
    order,
    selectionKind: 'GRANTED',
    proficiencyKind: 'SKILL',
    authoringModeKind: 'ALL',
    level: 'FULL'
  }
}

function createScalingGrant(grantKind: string, order: number) {
  return {
    grantKind,
    id: crypto.randomUUID(),
    order,
    selectionKind: 'GRANTED',
    scalingKind: 'NONE',
    authoringModeKind: 'ALL'
  }
}

function appendStartingEquipmentItem(
  startingEquipment: StartingEquipmentDto,
  item: StartingEquipmentItemDto
): StartingEquipmentDto {
  const next = startingEquipment
  const [firstSet, ...remainingSets] = next.sets
  const set = firstSet ?? createEmptyStartingEquipment().sets[0]
  const [firstGroup, ...remainingGroups] = set.groups
  const group = firstGroup ?? createEmptyStartingEquipment().sets[0].groups[0]
  const [firstOption, ...remainingOptions] = group.options
  const option = firstOption ?? createEmptyStartingEquipment().sets[0].groups[0].options[0]

  return {
    ...next,
    sets: [
      {
        ...set,
        groups: [
          {
            ...group,
            options: [
              {
                ...option,
                items: [...option.items, item]
              },
              ...remainingOptions
            ]
          },
          ...remainingGroups
        ]
      },
      ...remainingSets
    ]
  }
}

function updateStartingEquipmentItems(
  startingEquipment: StartingEquipmentDto,
  updater: (items: StartingEquipmentItemDto[]) => StartingEquipmentItemDto[]
): StartingEquipmentDto {
  return {
    ...startingEquipment,
    sets: startingEquipment.sets.map((set) => ({
      ...set,
      groups: set.groups.map((group) => ({
        ...group,
        options: group.options.map((option) => ({
          ...option,
          items: updater(option.items)
        }))
      }))
    }))
  }
}

function getOutcomesFromResultBlock(resultBlock: unknown): OutcomeDraft[] {
  if (!isResultBlockLike(resultBlock) || !Array.isArray(resultBlock.outcomes)) return []
  return resultBlock.outcomes.filter(isOutcomeDraft)
}

function isResultBlockLike(value: unknown): value is ResultBlockLike {
  return typeof value === 'object' && value !== null && 'outcomes' in value
}

function isOutcomeDraft(value: unknown): value is OutcomeDraft {
  return typeof value === 'object' && value !== null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
