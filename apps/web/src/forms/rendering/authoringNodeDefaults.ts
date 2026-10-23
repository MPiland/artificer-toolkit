import type { EffectDto, TargetingDto } from '@artificer-toolkit/schema/effects'
import type { RangeDto } from '@artificer-toolkit/schema/shared/range'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import type {
  NodeRuntimeArrayGroupNodeDto,
  NodeRuntimeObjectGroupNodeDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { getAuthoringDefaultKind } from './authoringNodeDefaultRegistry'
import {
  createEmptyStartingEquipment,
  createEmptyStartingEquipmentItem
} from './startingEquipmentDefaults'

export type AuthoringGroupValues = Record<string, unknown>

export function createDefaultAuthoringArrayItem(
  node: NodeRuntimeArrayGroupNodeDto,
  currentLength: number
): AuthoringGroupValues {
  return createDefaultAuthoringNodeValue(node.childMapId, currentLength + 1)
}

export function createDefaultAuthoringObjectItem(
  node: NodeRuntimeObjectGroupNodeDto
): AuthoringGroupValues {
  return createDefaultAuthoringNodeValue(node.childMapId, 1)
}

function createDefaultAuthoringNodeValue(childMapId: string, order = 1): AuthoringGroupValues {
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
    case 'actorRelationshipModule':
      return {
        id: crypto.randomUUID(),
        order,
        kind: 'SOURCE_FOLLOWS_TARGET'
      }
    case 'actorRelationshipRecurrence':
      return {
        stage: 'START_OF_TURN',
        damage: {
          id: crypto.randomUUID(),
          effectKind: 'DAMAGE',
          damageTypeId: '',
          valueKind: 'DICE',
          diceConfig: '1d6',
          scalingKind: 'NONE'
        }
      }
    case 'check':
      return {
        checks: createDefaultAuthoringNodeValue('checkChoice'),
        dc: createDefaultAuthoringNodeValue('checkDc')
      }
    case 'checkChoice':
      return { skillIds: [], abilityDefinitionIds: [] }
    case 'checkDc':
      return { kind: 'FIXED', value: 10 }
    case 'heldEscapeDc':
      return { kind: 'SOURCE_SAVE_DC' }
    case 'spellCast':
      return { castLevel: 1 }
    case 'featureGrantedSpellCast':
      return { spellKind: 'CANTRIP' }
    case 'featureWeaponAttack':
      return {}
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
    case 'creatureEquipmentLoadout':
      return {
        id: crypto.randomUUID(),
        equipmentId: '',
        quantity: 1,
        useState: 'CARRIED',
        attuned: false,
        actionFeatureIds: []
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
    case 'creatureQualifiedDamageDefense':
      return {
        kind: 'RESISTANCE',
        damageTypeIds: [],
        bypassedBy: []
      }
    case 'creatureSense':
      return {
        senseDefinitionId: '',
        range: createRange('DISTANCE')
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
    case 'equipmentEffect':
      // The default effect is ACTIVATED, not a weapon attack, so it has no grip.
      return { ...createDefaultEffect(order), grip: null }
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
    case 'hitPointPool':
      return { diceConfig: '1d8' }
    case 'sizeLimit':
      return { stepsAboveActor: 1 }
    case 'hitPointPoolScalingBreakpoint':
      return {
        id: crypto.randomUUID(),
        level: order,
        order,
        value: { diceConfig: '1d8' }
      }
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
    case 'modifierAttackDecoyArmorClass':
      return { amount: 10, abilities: [] }
    case 'modifierAttackDecoyThreshold':
      return { id: crypto.randomUUID(), remaining: 1, minimumRoll: 11 }
    case 'modifierChargeLimitLevel':
      return {
        id: crypto.randomUUID(),
        level: order,
        amount: 1
      }
    case 'damageInterceptionExcludes':
      return { damageTypeIds: [], critical: false }
    case 'damageInterceptionSave':
      return { ability: 'CONSTITUTION', dc: { base: 10, plusDamageTaken: false } }
    case 'damageInterceptionSaveDc':
      return { base: 10, plusDamageTaken: false }
    case 'incomingGateSuccessImmunity':
      return { duration: { durationKind: 'INSTANTANEOUS' } }
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
    case 'manifestComponentRegion':
      return { kind: 'SIDE_BAND', distance: createMeasurement('FEET') }
    case 'manifestCreatureForm':
      return {
        id: crypto.randomUUID(),
        order,
        label: '',
        creatureId: '',
        maxTargets: 1
      }
    case 'manifestCreatureFormFilter':
      return {
        id: crypto.randomUUID(),
        challengeRatingCapKind: 'TARGET',
        excludedSpeedIds: []
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
    case 'manifestOccupantSaveBonus':
      return {
        id: crypto.randomUUID(),
        domain: 'EVERY_SAVING_THROW',
        amountKind: 'FIXED',
        amount: 1,
        dispositionFilter: 'ALLIES_AND_SOURCE'
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
    case 'forcedMovementCollision':
      return {
        id: crypto.randomUUID(),
        diceConfig: '1d6',
        damageTypeId: '',
        savingThrow: createDefaultAuthoringNodeValue('savingThrow'),
        conditionId: ''
      }
    case 'followUpSaveBranch':
      return { kind: 'END' }
    case 'followUpSaveAttempts':
      return { kind: 'ONCE' }
    case 'followUpSaveFailureMarginRider':
      return {
        id: crypto.randomUUID(),
        failedBy: 5,
        outcomes: [],
        lifecycle: { endOnTriggers: [] }
      }
    case 'followUpSaveFailureMarginRiderLifecycle':
      return { endOnTriggers: [] }
    case 'followUpSaveRepeatRollInfluence':
      return {
        influence: 'ADVANTAGE',
        when: createFollowUpSaveRepeatPerception()
      }
    case 'followUpSaveRepeatAttemptGate':
      return {
        allow: 'WHEN_UNMET',
        when: createFollowUpSaveRepeatPerception()
      }
    case 'followUpSaveRepeatTrigger':
      return { kind: 'DAMAGE_TAKEN', by: 'ANYONE' }
    case 'followUpSaveRepeatPerception':
      return createFollowUpSaveRepeatPerception()
    case 'degradeEquipmentDestroyWhen':
      return { kind: 'PENALTY_REACHES', value: 1 }
    case 'healFraction':
      return { numerator: 1, denominator: 2 }
    case 'hitPointMaximumReductionAmountSource':
      return {
        kind: 'DAMAGE_TAKEN',
        damageOutcomeId: ''
      }
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
    case 'pathChosenItem':
    case 'pathLifecycle':
      return {}
    case 'pathLifecycleEffectOffer':
      return {
        kind: 'MOVE_HELD_EFFECT',
        offeredTo: 'SOURCE',
        when: 'HOLDER_AT_ZERO_HP',
        activation: 'BONUS_ACTION',
        range: { amount: 30, unit: 'FEET' }
      }
    case 'pathLifecycleEffectOfferRange':
      return { amount: 30, unit: 'FEET' }
    case 'pathLifecycleEndTrigger':
      return { event: 'DAMAGE_TAKEN', by: 'ANYONE' }
    case 'pathLifecycleEscape':
      return {
        activation: { code: 'ACTION', amount: 1 },
        checks: { skillIds: [], abilityDefinitionIds: [] },
        dc: { kind: 'SOURCE_SAVE_DC' }
      }
    case 'pathLifecycleHolderEnd':
      return { activation: 'BONUS_ACTION' }
    case 'pathLifecycleGrantedAction':
      return { activation: 'BONUS_ACTION', actionDefinitionIds: [] }
    case 'pathLifecycleOnEnd':
      return { turns: 1, modifiers: [] }
    case 'pathLifecycleTurnAnchor':
      return { actor: 'TARGET', boundary: 'END_OF_TURN' }
    case 'pathLifecycleTurnEndGate':
      return { minimumRoll: 11 }
    case 'pathHitPointTierRow':
      return {
        id: crypto.randomUUID(),
        order,
        atMost: 1,
        resultBlock: {
          id: crypto.randomUUID(),
          resultKind: 'SINGLE',
          outcomes: []
        }
      }
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
    case 'resultBlockGate':
      return { kind: 'TARGET_HIT_POINTS_AT_MOST', amount: 1 }
    case 'perTargetLockout':
      return { until: 'SOURCE_LONG_REST' }
    case 'slotCost':
      return { poolCode: '' }
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
    case 'reactionTrigger':
      return { kind: 'ATTACKED_SELF' }
    case 'higherLevelCheck':
      return { ability: 'SPELLCASTING', baseDc: 10 }
    case 'optionalOnHit':
      return { kind: 'SPELL_SLOT' }
    case 'resourceUse':
      return { chargeId: '', cost: 1 }
    case 'featureOptionActionReference':
      return { featureId: '', chargeCost: 1 }
    case 'attackSlotFiller':
      return { kind: 'ANY_ATTACK' }
    case 'attackSlotCondition':
      return { kind: 'EARLIER_SLOTS_HIT_SAME_TARGET' }
    case 'attackSlot':
      return { count: 1, fillers: [{ kind: 'ANY_ATTACK' }] }
    case 'attackSlotAlternative':
      return { slots: [{ count: 1, fillers: [{ kind: 'ANY_ATTACK' }] }] }
    case 'attackSlotSet':
      return { alternatives: [{ slots: [{ count: 1, fillers: [{ kind: 'ANY_ATTACK' }] }] }] }
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
    case 'scalarReductionAmount':
      return {
        kind: 'DICE',
        diceConfig: '1d6'
      }
    case 'senseGrant':
      return { ...createScalingGrant('SENSE_GRANT', order), range: createRange('DISTANCE') }
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
    case 'spellSlotTable':
      return { id: crypto.randomUUID(), resetKind: 'LONG_REST', levels: [] }
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
    case 'targetRequirement':
      return { kind: 'SIGHT', direction: 'ACTOR_SEES_TARGET' }
    case 'targeting':
      return createTargeting('SELF') as AuthoringGroupValues
    case 'damageDieCastLevelScaling':
      return { level: 1, count: 1 }
    case 'damageLevelScalingEntry':
      return {
        id: crypto.randomUUID(),
        level: order,
        order,
        amount: 1,
        diceConfig: '1d6'
      }
    case 'endEffectsSelector':
      return { id: crypto.randomUUID(), order, kind: 'CONDITION', conditionIds: [] }
    case 'weight':
      return createMeasurement('POUNDS')
    default:
      return assertUnreachableDefaultKind(defaultKind)
  }
}

function assertUnreachableDefaultKind(kind: never): never {
  throw new Error(`Unsupported authoring default kind: ${String(kind)}`)
}

function createFollowUpSaveRepeatPerception() {
  return {
    kind: 'PERCEPTION',
    observer: 'TARGET',
    subject: 'SOURCE',
    requirement: 'SEE'
  }
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

function createDefaultPath(
  order: number,
  pathCode: EffectAuthored['paths'][number]['pathCode'] = 'ON_USE'
): EffectAuthored['paths'][number] {
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
  }
}

function createRange(rangeKind: 'SELF' | 'DISTANCE' = 'SELF', amount = 30): RangeDto {
  return rangeKind === 'DISTANCE'
    ? { id: crypto.randomUUID(), rangeKind: 'DISTANCE', amount, unit: 'FEET' }
    : { id: crypto.randomUUID(), rangeKind }
}

export function createTargeting(selectionKind = 'SELF'): TargetingDto {
  if (selectionKind === 'SELF') return { selectionKind: 'SELF' }
  if (selectionKind === 'CHOSEN_CREATURES')
    return { selectionKind: 'CHOSEN_CREATURES', dispositionKind: 'ANY', maxTargets: 1 }
  if (selectionKind === 'AREA_CONTENTS')
    return { selectionKind: 'AREA_CONTENTS', dispositionKind: 'ANY' }
  return { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
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
