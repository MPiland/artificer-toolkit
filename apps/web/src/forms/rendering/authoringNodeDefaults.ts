import type { EffectDto, PathDto, TargetingDto } from '@artificer-toolkit/schema/effects'
import type { RangeDto } from '@artificer-toolkit/schema/shared/range'
import type { StartingEquipmentDto } from '@artificer-toolkit/schema/shared/startingEquipment'
import type {
  NodeRuntimeArrayGroupNodeDto,
  NodeRuntimeGroupNodeDto,
  NodeRuntimeObjectGroupNodeDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { getAuthoringDefaultKind } from './authoringNodeDefaultRegistry'

export type AuthoringGroupValues = Record<string, unknown>
export type StartingEquipmentItemDto =
  StartingEquipmentDto['sets'][number]['groups'][number]['options'][number]['items'][number]

export function createDefaultAuthoringArrayItem(
  node: NodeRuntimeArrayGroupNodeDto,
  currentLength: number
): AuthoringGroupValues {
  return createDefaultAuthoringNodeValue(getChildMapId(node), currentLength + 1)
}

export function createDefaultAuthoringObjectItem(
  node: NodeRuntimeObjectGroupNodeDto
): AuthoringGroupValues {
  return createDefaultAuthoringNodeValue(getChildMapId(node), 1)
}

export function createDefaultAuthoringNodeValue(
  childMapId: string,
  order = 1
): AuthoringGroupValues {
  const defaultKind = getAuthoringDefaultKind(childMapId)

  switch (defaultKind) {
    case 'abilityScores':
      return createAbilityScores()
    case 'capacity':
      return createMeasurement('POUNDS')
    case 'activation':
      return {
        amount: 1,
        unit: 'ROUND'
      }
    case 'applyGrants':
      return {
        modifiers: [],
        proficiencies: [],
        senses: []
      }
    case 'chargeBonus':
      return createChargeBonus(order)
    case 'chargeLevelScaling':
      return {
        level: order,
        amount: 1
      }
    case 'charges':
      return createChargeRules()
    case 'classDetail':
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
    case 'creatureHitDice':
      return {
        count: 1,
        die: 8,
        modifier: 0
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
    case 'durationScalingBreakpoint':
      return {
        id: crypto.randomUUID(),
        level: order,
        order,
        value: { amount: 1 }
      }
    case 'durationValue':
      return { amount: 1 }
    case 'diceExpression':
      return {
        count: 1,
        die: 6,
        modifier: 0
      }
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
      return {
        id: crypto.randomUUID(),
        order,
        conditions: []
      }
    case 'facetCondition':
      return {
        id: crypto.randomUUID(),
        order,
        kind: 'PREDICATE',
        constraint: 'INCLUDE'
      }
    case 'facetContext':
      return {
        id: crypto.randomUUID(),
        order,
        subject: 'CHARACTER',
        conditions: [
          {
            id: crypto.randomUUID(),
            order: 1,
            kind: 'PREDICATE',
            constraint: 'INCLUDE'
          }
        ]
      }
    case 'facetExists':
      return {
        id: crypto.randomUUID(),
        order,
        kind: 'EXISTS',
        constraint: 'INCLUDE',
        relationCode: 'FEATURE',
        authoringModeKind: 'ALL'
      }
    case 'facetGroup':
      return {
        id: crypto.randomUUID(),
        order,
        contexts: []
      }
    case 'feature':
      return createFeatureLike(order)
    case 'featureRollDefinition':
      return {
        id: crypto.randomUUID(),
        label: '',
        kind: 'DAMAGE',
        expression: {
          count: 1,
          die: 6,
          modifier: 0
        },
        rollMode: 'NORMAL',
        chargeCost: null,
        order
      }
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
    case 'manifestBehavior':
      return {
        id: crypto.randomUUID(),
        order,
        invocation: {
          kind: 'ACTION',
          triggerCode: 'ACTIVATED',
          activation: { code: 'ACTION', amount: 1 },
          range: createRange('SELF')
        },
        paths: []
      }
    case 'manifestComponent':
      return {
        id: crypto.randomUUID(),
        order,
        label: '',
        behaviors: [],
        blockingRules: [],
        destructionCriteria: []
      }
    case 'manifestDestructionCriterion':
      return {
        id: crypto.randomUUID(),
        order,
        kind: 'DAMAGE_THRESHOLD',
        damageTypeId: '',
        amount: 0
      }
    case 'manifestLight':
      return {
        bright: createMeasurement('FEET'),
        dimAdditional: createMeasurement('FEET')
      }
    case 'manifestProximityRule':
      return {
        id: crypto.randomUUID(),
        events: ['MOVE_WITHIN', 'START_TURN'],
        distance: createMeasurement('FEET'),
        requiresSight: true,
        behavior: {
          id: crypto.randomUUID(),
          order: 1,
          invocation: {
            triggerCode: 'SAVING_THROW',
            savingThrow: {
              id: crypto.randomUUID(),
              dcMethod: 'SOURCE_SAVE_DC',
              ability: 'CONSTITUTION'
            }
          },
          paths: []
        }
      }
    case 'measurement':
      return createMeasurement('FEET')
    case 'measurementScalingBreakpoint':
      return {
        id: crypto.randomUUID(),
        level: order,
        order,
        value: createMeasurement('FEET')
      }
    case 'outcome':
      return {
        id: crypto.randomUUID(),
        effectKind: 'MANUAL_ADJUDICATION',
        label: '',
        reasonCode: 'NARRATIVE_JUDGMENT',
        instructions: ''
      }
    case 'outcomeBreakpoint':
      return {
        id: crypto.randomUUID(),
        level: order,
        order,
        value: { amount: 1, diceConfig: '1d6' }
      }
    case 'outcomeBreakpointValue':
      return { amount: 1, diceConfig: '1d6' }
    case 'outcomeBonus':
      return {
        id: crypto.randomUUID(),
        order,
        bonusKind: 'PROFICIENCY_BONUS'
      }
    case 'followUpSaveBranch':
      return { kind: 'END' }
    case 'followUpSaveAttempts':
      return { kind: 'ONCE' }
    case 'pathChoiceOption':
      return {
        id: crypto.randomUUID(),
        order,
        label: '',
        description: '',
        resultBlock: {
          id: crypto.randomUUID(),
          resultKind: 'SINGLE',
          outcomes: []
        }
      }
    case 'resultBlock':
      return {
        id: crypto.randomUUID(),
        resultKind: 'SINGLE',
        outcomes: []
      }
    case 'numericExpr':
      return {
        valueKind: 'FIXED',
        amount: 1
      }
    case 'pathLifecycle':
      return {}
    case 'pathRollTableRow':
      return {
        id: crypto.randomUUID(),
        order,
        rollRange: [order, order],
        rollValue: order,
        resolutionKind: 'RESULT',
        resultBlock: {
          id: crypto.randomUUID(),
          resultKind: 'SINGLE',
          outcomes: []
        }
      }
    case 'rollTableRerollValue':
      return {
        id: crypto.randomUUID(),
        order,
        value: order
      }
    case 'rollTableRepeat':
      return { count: 2, rerollValues: [] }
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
    case 'scaling':
      return {
        scalingKind: 'BREAKPOINTS',
        scalingSource: 'CHARACTER_LEVEL',
        breakpoints: []
      }
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
        id: crypto.randomUUID(),
        shapeKind: 'SPHERE',
        radius: createMeasurement('FEET')
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
    case 'string':
      return { value: '' }
    case 'summonStatBlock':
      return {}
    case 'targetCount':
      return { amount: 1 }
    case 'targeting':
      return createTargeting('SELF') as AuthoringGroupValues
    case 'damageLevelScalingEntry':
      return {
        id: crypto.randomUUID(),
        level: order,
        order,
        amount: 1,
        diceConfig: '1d6'
      }
    case 'weight':
      return createMeasurement('POUNDS')
    default:
      return assertUnreachableDefaultKind(defaultKind)
  }
}

function assertUnreachableDefaultKind(kind: never): never {
  throw new Error(`Unsupported authoring default kind: ${String(kind)}`)
}

export function createEmptyStartingEquipment(): StartingEquipmentDto {
  return {
    id: crypto.randomUUID(),
    sets: []
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

export function addStartingEquipmentItem(
  startingEquipment: StartingEquipmentDto | undefined
): StartingEquipmentDto {
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
  return updateStartingEquipmentItems(startingEquipment, (items) =>
    items.map((item) => (item.id === itemId ? replacement : item))
  )
}

export function removeStartingEquipmentItem(
  startingEquipment: StartingEquipmentDto,
  itemId: string
): StartingEquipmentDto {
  return updateStartingEquipmentItems(startingEquipment, (items) =>
    items.filter((item) => item.id !== itemId)
  )
}

export function getStartingEquipmentItems(
  startingEquipment: StartingEquipmentDto | undefined
): StartingEquipmentItemDto[] {
  if (!startingEquipment) return []

  return startingEquipment.sets.flatMap((set) =>
    set.groups.flatMap((group) => group.options.flatMap((option) => option.items))
  )
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

export function createDefaultPath(
  order: number,
  pathCode: PathDto['pathCode'] = 'ON_USE'
): PathDto {
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

export function createRange(rangeKind = 'SELF', amount = 30): RangeDto {
  return rangeKind === 'DISTANCE'
    ? { id: crypto.randomUUID(), rangeKind: 'DISTANCE', amount, unit: 'FEET' }
    : {
        id: crypto.randomUUID(),
        rangeKind: rangeKind as Exclude<RangeDto['rangeKind'], 'DISTANCE'>
      }
}

export function createTargeting(selectionKind = 'SELF'): TargetingDto {
  if (selectionKind === 'SELF') return { selectionKind: 'SELF' }
  if (selectionKind === 'CHOSEN_CREATURES')
    return { selectionKind: 'CHOSEN_CREATURES', dispositionKind: 'ANY', maxTargets: 1 }
  if (selectionKind === 'AREA_CONTENTS')
    return { selectionKind: 'AREA_CONTENTS', dispositionKind: 'ANY' }
  return { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
}

function getChildMapId(node: NodeRuntimeGroupNodeDto): string {
  return node.childMapId
}

function createAbilityScores() {
  return {
    STRENGTH: 10,
    DEXTERITY: 10,
    CONSTITUTION: 10,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 10
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
    scalingKind: 'NONE',
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
  const set = firstSet ?? createStartingEquipmentSet(1)
  const [firstGroup, ...remainingGroups] = set.groups
  const group = firstGroup ?? createStartingEquipmentGroup(1)
  const [firstOption, ...remainingOptions] = group.options
  const option = firstOption ?? createStartingEquipmentOption(1)

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

function createStartingEquipmentSet(order: number): StartingEquipmentDto['sets'][number] {
  return {
    id: crypto.randomUUID(),
    order,
    groups: []
  }
}

function createStartingEquipmentGroup(
  order: number
): StartingEquipmentDto['sets'][number]['groups'][number] {
  return {
    id: crypto.randomUUID(),
    order,
    options: []
  }
}

function createStartingEquipmentOption(
  order: number
): StartingEquipmentDto['sets'][number]['groups'][number]['options'][number] {
  return {
    id: crypto.randomUUID(),
    order,
    items: []
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
