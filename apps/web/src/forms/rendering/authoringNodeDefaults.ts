import type { EffectDto, TargetingDto } from '@artificer-toolkit/schema/effects'
import type { FeatureDto, FeatureGrantsDto } from '@artificer-toolkit/schema/features'
import type {
  AttackSlotConditionDto,
  AttackSlotDto,
  AttackSlotFillerDto,
  AttackSlotSetDto
} from '@artificer-toolkit/schema/features/attackSlots'
import type { FeatureRollDefinitionDto } from '@artificer-toolkit/schema/features/reference'
import type { SpellSlotTableDto } from '@artificer-toolkit/schema/grants/spellSlots'
import type {
  StartingEquipmentCurrencyDto,
  StartingEquipmentGroupDto,
  StartingEquipmentOptionDto,
  StartingEquipmentSetDto
} from '@artificer-toolkit/schema/shared/startingEquipment'
import type { ChargeBonusDto, ChargeDto } from '@artificer-toolkit/schema/shared/charge'
import type { DetailDto } from '@artificer-toolkit/schema/shared/detail'
import type { DiceExpressionDto } from '@artificer-toolkit/schema/shared/dice'
import type { RangeDto } from '@artificer-toolkit/schema/shared/range'
import type {
  CapacityDto,
  ClassHitpointDto,
  ClassMulticlassDto,
  ClassPrepareLimitDto,
  ClassResourceDto,
  ClassSpecializationDto,
  ClassSpellLimitDto,
  ClassSpellSlotDto,
  ClassStartingGoldDto,
  ContainsDto,
  CostDto,
  WeightDto
} from '@artificer-toolkit/schema/subjects/shared'
import type { ClassSpellcastingDto } from '@artificer-toolkit/schema/subjects/class'
import type {
  CreatureCompanionProfileDto,
  CreatureEquipmentLoadoutEntryDto,
  CreatureMountProfileDto,
  CreatureNpcProfileDto,
  CreatureQualifiedDamageDefenseDto,
  CreatureSenseDto
} from '@artificer-toolkit/schema/subjects/creature'
import type {
  AbilityCode,
  MeasurementUnitCode,
  BreakpointScalingAuthored,
  ModifierAttackDecoysAuthored,
  ModifierDamageDieAuthored,
  ModifierDamageInterceptionAuthored,
  ModifierIncomingAttackGateAuthored,
  ModifierScalarValueAuthored,
  NumericExpr
} from '@artificer-toolkit/shared/core'
import type {
  ActorRelationshipAuthored,
  ApplyGrantAuthored,
  ActorRelationshipModuleAuthored,
  CastingTimeAuthored,
  CheckAuthored,
  CheckChoiceAuthored,
  ChargeLimitPayload,
  CheckDcAuthored,
  DamageBreakpointProgressionLevel,
  DamageProgressionLevel,
  DamageBonusAuthored,
  DegradeEquipmentDestroyWhenAuthored,
  DurationAuthored,
  EffectAuthored,
  EndEffectsSelectorAuthored,
  EquipmentEffectAuthored,
  ExistsConditionAuthored,
  FacetAuthored,
  FacetBodyAuthored,
  FacetBodyGroupAuthored,
  FacetContextAuthored,
  FacetGroupAuthored,
  FailureMarginRiderAuthored,
  FeatGrantAuthored,
  FeatureGrantedSpellCastAuthored,
  FeatureOptionActionReferenceAuthored,
  FeatureSpellCastAuthored,
  FeatureWeaponAttackAuthored,
  FollowUpSaveAuthored,
  FollowUpSaveBranchAuthored,
  FollowUpSaveRepeatAttemptGateAuthored,
  FollowUpSaveRepeatPerceptionAuthored,
  FollowUpSaveRepeatRollInfluenceAuthored,
  FollowUpSaveRepeatTriggerAuthored,
  ForcedMovementCollisionAuthored,
  GrantProgression,
  GrantProgressionLevel,
  HealAuthored,
  HeldEscapeDcAuthored,
  HitPointMaximumReductionAuthored,
  ManifestBehaviorAuthored,
  ManifestComponentAuthored,
  ManifestCreatureFormAuthored,
  ManifestCreatureFormFilterAuthored,
  ManifestDestructionCriterionAuthored,
  ManifestLightAuthored,
  ManifestOccupantSaveBonusAuthored,
  ManifestProximityRuleAuthored,
  ManualAdjudicationAuthored,
  RangeMeasurementAuthored,
  ModifierGrantAuthoredFor,
  OptionalOnHitAuthored,
  PathChoiceOptionAuthored,
  PathChosenItemAuthored,
  PathHitPointTierRowAuthored,
  PathLifecycleAuthored,
  PathRollTableRowAuthored,
  PredicateConditionAuthored,
  ProficiencyGrantAuthored,
  RaceAncestryAuthored,
  RaceAncestryOptionAuthored,
  RangeAuthored,
  ReactionHigherLevelCheckAuthored,
  ReactionTriggerBindingAuthored,
  ResourceUseAuthored,
  ResultBlockAuthored,
  ResultBlockGateAuthored,
  SavingThrowAuthored,
  SavingThrowDcBonusAuthored,
  ScalarReductionAuthored,
  SenseGrantAuthored,
  ShapeAuthored,
  SpeedAuthored,
  SpellGrantAuthored,
  SummonStatBlockAuthored,
  TargetingAuthored,
  TargetRequirementAuthored
} from '@artificer-toolkit/shared/authored'
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

type BreakpointOf<TScaling extends { breakpoints: unknown[] } | undefined> =
  NonNullable<TScaling>['breakpoints'][number]
type ScalingGrantAuthored = FeatGrantAuthored | SenseGrantAuthored | SpellGrantAuthored
type AreaContentsTargeting = Extract<TargetingAuthored, { selectionKind: 'AREA_CONTENTS' }>
type DurationScalingBreakpoint = BreakpointOf<
  Extract<DurationAuthored, { amount: number }>['scaling']
>
type DistanceRangeDto = Extract<RangeDto, { rangeKind: 'DISTANCE' }>
type OutcomeBreakpoint =
  | DamageBreakpointProgressionLevel<{ amount: number }>
  | DamageBreakpointProgressionLevel<{ diceConfig: string }>
type RollTableRepeat = Extract<
  PathRollTableRowAuthored,
  { resolutionKind: 'REPEAT_TABLE' }
>['repeat']
type PathEffectOffer = NonNullable<PathLifecycleAuthored['effectOffers']>[number]

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
      return createMeasurement('POUNDS') satisfies CapacityDto
    case 'activation':
      return {
        amount: 1,
        unit: 'ROUND'
      } satisfies CastingTimeAuthored
    case 'applyGrants':
      return {
        modifiers: [],
        proficiencies: [],
        senses: []
      } satisfies ApplyGrantAuthored['grants']
    case 'actorRelationshipModule':
      return {
        id: crypto.randomUUID(),
        order,
        kind: 'SOURCE_FOLLOWS_TARGET'
      } satisfies Extract<ActorRelationshipModuleAuthored, { kind: 'SOURCE_FOLLOWS_TARGET' }>
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
      } satisfies NonNullable<ActorRelationshipAuthored['recurrence']>
    case 'check':
      return {
        checks: createCheckChoice(),
        dc: createCheckDc()
      } satisfies CheckAuthored
    case 'checkChoice':
      return createCheckChoice()
    case 'checkDc':
      return createCheckDc()
    case 'heldEscapeDc':
      return { kind: 'SOURCE_SAVE_DC' } satisfies HeldEscapeDcAuthored
    case 'spellCast':
      return { castLevel: 1 } satisfies FeatureSpellCastAuthored
    case 'featureGrantedSpellCast':
      return { spellKind: 'CANTRIP' } satisfies FeatureGrantedSpellCastAuthored
    case 'featureWeaponAttack':
      return {} satisfies FeatureWeaponAttackAuthored
    case 'chargeBonus':
      return createChargeBonus(order)
    case 'chargeLevelScaling':
      return {
        level: order,
        amount: 1
      } satisfies Partial<Extract<ChargeDto, { levels: unknown }>['levels'][number]>
    case 'charges':
      return createChargeRules()
    case 'classDetail':
      return createDetail(order)
    case 'classHitpoint':
      return {
        ability: 'CONSTITUTION',
        dieConfig: '1d8'
      } satisfies ClassHitpointDto
    case 'classMulticlass':
      return {
        id: crypto.randomUUID(),
        requirementGroups: { groups: [] },
        proficiencies: []
      } satisfies ClassMulticlassDto
    case 'classMulticlassRequirement':
      return {
        id: crypto.randomUUID(),
        ability: 'STRENGTH',
        min: 13
      } satisfies ClassMulticlassDto['requirementGroups']['groups'][number]['requirements'][number]
    case 'classMulticlassRequirementGroup':
      return {
        id: crypto.randomUUID(),
        requirements: []
      } satisfies ClassMulticlassDto['requirementGroups']['groups'][number]
    case 'classMulticlassRequirementGroups':
      return { groups: [] } satisfies ClassMulticlassDto['requirementGroups']
    case 'classPrepareLimit':
      return {
        methodKinds: [],
        perLevel: []
      } satisfies Partial<ClassPrepareLimitDto>
    case 'classPrepareLimitPerLevel':
      return {
        classLevel: order,
        amount: 0
      } satisfies NonNullable<ClassPrepareLimitDto['perLevel']>[number]
    case 'classResource':
      return {
        id: crypto.randomUUID(),
        label: '',
        description: '',
        availableAtLevel: 1,
        charges: createChargeRules()
      } satisfies Partial<ClassResourceDto>
    case 'classSpecialization':
      return {
        id: crypto.randomUUID(),
        label: '',
        order
      } satisfies ClassSpecializationDto
    case 'classSpellcasting':
      return {
        spellLimits: [],
        details: [],
        maxSpellLevel: 9,
        attributes: [],
        charges: createChargeRules()
      } satisfies Partial<ClassSpellcastingDto>
    case 'classSpellLimits':
      return {
        classLevel: order,
        slots: []
      } satisfies Partial<ClassSpellLimitDto>
    case 'classSpellSlot':
      return {
        spellLevel: order,
        slotCount: 0
      } satisfies ClassSpellSlotDto
    case 'classStartingGold':
      return {
        multiplier: 1,
        currencyId: '',
        dieConfig: '1d4'
      } satisfies ClassStartingGoldDto
    case 'contains':
      return {
        equipmentId: '',
        quantity: 1
      } satisfies ContainsDto
    case 'cost':
      return {
        amount: 0,
        currencyId: ''
      } satisfies CostDto
    case 'creatureCompanionProfile':
      return {
        bondType: 'ANIMAL_COMPANION',
        initiativeMode: 'USES_PC_INITIATIVE',
        notes: ''
      } satisfies CreatureCompanionProfileDto
    case 'creatureEquipmentLoadout':
      return {
        id: crypto.randomUUID(),
        equipmentId: '',
        quantity: 1,
        useState: 'CARRIED',
        attuned: false,
        actionFeatureIds: []
      } satisfies CreatureEquipmentLoadoutEntryDto
    case 'creatureHitDice':
      return {
        count: 1,
        die: 8,
        modifier: 0
      } satisfies DiceExpressionDto
    case 'creatureQualifiedDamageDefense':
      return {
        kind: 'RESISTANCE',
        damageTypeIds: [],
        bypassedBy: []
      } satisfies CreatureQualifiedDamageDefenseDto
    case 'creatureSense':
      return {
        senseDefinitionId: '',
        range: createRange('DISTANCE')
      } satisfies Partial<CreatureSenseDto>
    case 'creatureMountProfile':
      return {
        mountType: 'CONTROLLED',
        riderCount: 1,
        notes: ''
      } satisfies CreatureMountProfileDto
    case 'creatureNpcProfile':
      return {
        bonds: [],
        flaws: [],
        ideals: [],
        personalityTraits: []
      } satisfies CreatureNpcProfileDto
    case 'effect':
      return createDefaultEffect(order)
    case 'equipmentEffect':
      // The default effect is ACTIVATED, not a weapon attack, so it has no grip.
      return {
        ...createDefaultEffect(order),
        grip: null
      } satisfies Partial<EquipmentEffectAuthored>
    case 'effectPath':
      return createDefaultPath(order)
    case 'duration':
      return {
        id: crypto.randomUUID(),
        durationKind: 'INSTANTANEOUS'
      } satisfies Extract<DurationAuthored, { durationKind: 'INSTANTANEOUS' }>
    case 'durationScalingBreakpoint':
      return {
        id: crypto.randomUUID(),
        level: order,
        order,
        value: { amount: 1 }
      } satisfies DurationScalingBreakpoint
    case 'durationValue':
      return { amount: 1 } satisfies DurationScalingBreakpoint['value']
    case 'hitPointPool':
      return { diceConfig: '1d8' } satisfies NonNullable<AreaContentsTargeting['hitPointPool']>
    case 'sizeLimit':
      return { stepsAboveActor: 1 } satisfies NonNullable<
        Extract<TargetingAuthored, { selectionKind: 'SINGLE_TARGET' }>['sizeLimit']
      >
    case 'hitPointPoolScalingBreakpoint':
      return {
        id: crypto.randomUUID(),
        level: order,
        order,
        value: { diceConfig: '1d8' }
      } satisfies BreakpointOf<AreaContentsTargeting['hitPointPoolScaling']>
    case 'diceExpression':
      return {
        count: 1,
        die: 6,
        modifier: 0
      } satisfies DiceExpressionDto
    case 'facet':
      return {
        id: crypto.randomUUID(),
        groups: []
      } satisfies FacetAuthored
    case 'facetBody':
      return {
        authoringModeKind: 'ALL',
        groups: []
      } satisfies Partial<FacetBodyAuthored>
    case 'facetBodyGroup':
      return {
        id: crypto.randomUUID(),
        order,
        conditions: []
      } satisfies FacetBodyGroupAuthored
    case 'facetCondition':
      return createFacetCondition(order)
    case 'facetContext':
      return {
        id: crypto.randomUUID(),
        order,
        subject: 'CHARACTER',
        conditions: [createFacetCondition(1)]
      } satisfies Partial<Omit<FacetContextAuthored<'CHARACTER'>, 'conditions'>> & {
        conditions: object[]
      }
    case 'facetExists':
      return {
        id: crypto.randomUUID(),
        order,
        kind: 'EXISTS',
        constraint: 'INCLUDE',
        relationCode: 'FEATURE',
        authoringModeKind: 'ALL'
      } satisfies Partial<Extract<ExistsConditionAuthored, { relationCode: 'FEATURE' }>>
    case 'facetGroup':
      return {
        id: crypto.randomUUID(),
        order,
        contexts: []
      } satisfies FacetGroupAuthored
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
      } satisfies FeatureRollDefinitionDto
    case 'option':
      return createOption(order)
    case 'featureGrants':
      return createFeatureGrants()
    case 'featureOptionChoice':
      return {
        level: order,
        count: 1
      } satisfies NonNullable<FeatureDto['optionChoices']>[number]
    case 'featGrant': {
      const grant = createScalingGrant('FEAT_GRANT', order)
      return grant satisfies Partial<FeatGrantAuthored>
    }
    case 'featGrantLevel':
      return createGrantLevel(order)
    case 'featGrantProgression':
      return createGrantProgression()
    case 'modifierAttackDecoyArmorClass':
      return { amount: 10, abilities: [] } satisfies ModifierAttackDecoysAuthored['armorClass']
    case 'modifierAttackDecoyThreshold':
      return {
        id: crypto.randomUUID(),
        remaining: 1,
        minimumRoll: 11
      } satisfies ModifierAttackDecoysAuthored['thresholds'][number]
    case 'modifierChargeLimitLevel':
      return {
        id: crypto.randomUUID(),
        level: order,
        amount: 1
      } satisfies Extract<ChargeLimitPayload, { scalingKind: 'PER_LEVEL' }>['levels'][number]
    case 'damageInterceptionExcludes':
      return {
        damageTypeIds: [],
        critical: false
      } satisfies NonNullable<ModifierDamageInterceptionAuthored['excludes']>
    case 'damageInterceptionSave':
      return {
        ability: 'CONSTITUTION',
        dc: { base: 10, plusDamageTaken: false }
      } satisfies NonNullable<ModifierDamageInterceptionAuthored['save']>
    case 'damageInterceptionSaveDc':
      return {
        base: 10,
        plusDamageTaken: false
      } satisfies NonNullable<ModifierDamageInterceptionAuthored['save']>['dc']
    case 'incomingGateSuccessImmunity':
      return {
        duration: { id: crypto.randomUUID(), durationKind: 'INSTANTANEOUS' }
      } satisfies NonNullable<ModifierIncomingAttackGateAuthored['successImmunity']>
    case 'modifierGrant':
      return createModifierGrant(order)
    case 'modifierGrantDomain':
      return {} satisfies Partial<ModifierGrantAuthoredFor<'HIT_POINTS_MAX'>['domain']>
    case 'modifierGrantPayload':
      return {
        valueKind: 'FIXED',
        amount: 1
      } satisfies ModifierScalarValueAuthored
    case 'invocation':
      return createDefaultInvocation()
    case 'manifestBehavior':
      return {
        id: crypto.randomUUID(),
        order,
        invocation: createDefaultInvocation(),
        paths: []
      } satisfies Partial<ManifestBehaviorAuthored>
    case 'manifestComponent':
      return {
        id: crypto.randomUUID(),
        order,
        label: '',
        behaviors: [],
        blockingRules: [],
        destructionCriteria: []
      } satisfies ManifestComponentAuthored
    case 'manifestComponentRegion':
      return {
        kind: 'SIDE_BAND',
        distance: createMeasurement('FEET')
      } satisfies NonNullable<ManifestComponentAuthored['region']>
    case 'manifestCreatureForm':
      return {
        id: crypto.randomUUID(),
        order,
        label: '',
        creatureId: '',
        maxTargets: 1
      } satisfies ManifestCreatureFormAuthored
    case 'manifestCreatureFormFilter':
      return {
        id: crypto.randomUUID(),
        challengeRatingCapKind: 'TARGET',
        excludedSpeedIds: []
      } satisfies ManifestCreatureFormFilterAuthored
    case 'creatureFormFilterScaledCap':
      return {
        maxChallengeRatingId: ''
      } satisfies BreakpointOf<ManifestCreatureFormFilterAuthored['scaling']>['value']
    case 'creatureFormFilterScalingBreakpoint':
      return {
        id: crypto.randomUUID(),
        level: order,
        order,
        value: { maxChallengeRatingId: '' }
      } satisfies BreakpointOf<ManifestCreatureFormFilterAuthored['scaling']>
    case 'manifestDestructionCriterion':
      return {
        id: crypto.randomUUID(),
        order,
        kind: 'DAMAGE_THRESHOLD',
        damageTypeId: '',
        amount: 0
      } satisfies Extract<ManifestDestructionCriterionAuthored, { kind: 'DAMAGE_THRESHOLD' }>
    case 'manifestLight':
      return {
        bright: createMeasurement('FEET'),
        dimAdditional: createMeasurement('FEET')
      } satisfies ManifestLightAuthored
    case 'manifestOccupantSaveBonus':
      return {
        id: crypto.randomUUID(),
        domain: 'EVERY_SAVING_THROW',
        amountKind: 'FIXED',
        amount: 1,
        dispositionFilter: 'ALLIES_AND_SOURCE'
      } satisfies Extract<ManifestOccupantSaveBonusAuthored, { amountKind: 'FIXED' }>
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
            kind: 'PASSIVE',
            triggerCode: 'SAVING_THROW',
            savingThrow: {
              id: crypto.randomUUID(),
              abilityDefinitionId: '',
              dcMethod: 'SOURCE_SAVE_DC'
            },
            range: createRange('SELF')
          },
          paths: []
        }
      } satisfies ManifestProximityRuleAuthored
    case 'measurement':
      return createMeasurement('FEET') satisfies RangeMeasurementAuthored
    case 'measurementScalingBreakpoint':
      return {
        id: crypto.randomUUID(),
        level: order,
        order,
        value: createMeasurement('FEET')
      } satisfies BreakpointOf<
        NonNullable<Extract<RangeAuthored, { rangeKind: 'DISTANCE' }>['scaling']>
      >
    case 'outcome':
      return {
        id: crypto.randomUUID(),
        effectKind: 'MANUAL_ADJUDICATION',
        label: '',
        reasonCode: 'NARRATIVE_JUDGMENT',
        instructions: ''
      } satisfies ManualAdjudicationAuthored
    case 'outcomeBreakpoint':
      return {
        id: crypto.randomUUID(),
        level: order,
        order,
        value: { amount: 1, diceConfig: '1d6' }
      } satisfies OutcomeBreakpoint
    case 'outcomeBreakpointValue':
      return { amount: 1, diceConfig: '1d6' } satisfies OutcomeBreakpoint['value']
    case 'outcomeBonus':
      return {
        id: crypto.randomUUID(),
        order,
        bonusKind: 'PROFICIENCY_BONUS'
      } satisfies Extract<DamageBonusAuthored, { bonusKind: 'PROFICIENCY_BONUS' }>
    case 'forcedMovementCollision':
      return {
        id: crypto.randomUUID(),
        diceConfig: '1d6',
        damageTypeId: '',
        savingThrow: createSavingThrow(),
        conditionId: ''
      } satisfies Partial<ForcedMovementCollisionAuthored>
    case 'followUpSaveBranch':
      return { kind: 'END' } satisfies FollowUpSaveBranchAuthored
    case 'followUpSaveAttempts':
      return { kind: 'ONCE' } satisfies FollowUpSaveAuthored['attempts']
    case 'followUpSaveFailureMarginRider':
      return {
        id: crypto.randomUUID(),
        failedBy: 5,
        outcomes: [],
        lifecycle: { endOnTriggers: [] }
      } satisfies FailureMarginRiderAuthored
    case 'followUpSaveFailureMarginRiderLifecycle':
      return { endOnTriggers: [] } satisfies FailureMarginRiderAuthored['lifecycle']
    case 'followUpSaveRepeatRollInfluence':
      return {
        influence: 'ADVANTAGE',
        when: createFollowUpSaveRepeatPerception()
      } satisfies FollowUpSaveRepeatRollInfluenceAuthored
    case 'followUpSaveRepeatAttemptGate':
      return {
        allow: 'WHEN_UNMET',
        when: createFollowUpSaveRepeatPerception()
      } satisfies FollowUpSaveRepeatAttemptGateAuthored
    case 'followUpSaveRepeatTrigger':
      return { kind: 'DAMAGE_TAKEN', by: 'ANYONE' } satisfies FollowUpSaveRepeatTriggerAuthored
    case 'followUpSaveRepeatPerception':
      return createFollowUpSaveRepeatPerception()
    case 'degradeEquipmentDestroyWhen':
      return {
        kind: 'PENALTY_REACHES',
        value: 1
      } satisfies DegradeEquipmentDestroyWhenAuthored
    case 'healFraction':
      return { numerator: 1, denominator: 2 } satisfies Extract<
        HealAuthored,
        { valueKind: 'DAMAGE_DEALT' }
      >['fraction']
    case 'hitPointMaximumReductionAmountSource':
      return {
        kind: 'DAMAGE_TAKEN',
        damageOutcomeId: ''
      } satisfies HitPointMaximumReductionAuthored['amountSource']
    case 'pathChoiceOption':
      return {
        id: crypto.randomUUID(),
        order,
        label: '',
        description: '',
        resultBlock: createEmptyResultBlock()
      } satisfies Partial<PathChoiceOptionAuthored>
    case 'resultBlock':
      return createEmptyResultBlock()
    case 'numericExpr':
      return {
        kind: 'FIXED',
        value: 1
      } satisfies NumericExpr
    case 'pathChosenItem':
      return {} satisfies PathChosenItemAuthored
    case 'pathLifecycle':
      return {} satisfies PathLifecycleAuthored
    case 'pathLifecycleEffectOffer':
      return {
        kind: 'MOVE_HELD_EFFECT',
        offeredTo: 'SOURCE',
        when: 'HOLDER_AT_ZERO_HP',
        activation: 'BONUS_ACTION',
        range: { amount: 30, unit: 'FEET' }
      } satisfies PathEffectOffer
    case 'pathLifecycleEffectOfferRange':
      return { amount: 30, unit: 'FEET' } satisfies NonNullable<PathEffectOffer['range']>
    case 'pathLifecycleEndTrigger':
      return {
        event: 'DAMAGE_TAKEN',
        by: 'ANYONE'
      } satisfies NonNullable<PathLifecycleAuthored['endOnTriggers']>[number]
    case 'pathLifecycleEscape':
      return {
        activation: { code: 'ACTION', amount: 1 },
        checks: createCheckChoice(),
        dc: { kind: 'SOURCE_SAVE_DC' }
      } satisfies NonNullable<PathLifecycleAuthored['escape']>
    case 'pathLifecycleHolderEnd':
      return {
        activation: 'BONUS_ACTION'
      } satisfies NonNullable<PathLifecycleAuthored['holderEnd']>
    case 'pathLifecycleGrantedAction':
      return {
        activation: 'BONUS_ACTION',
        actionDefinitionIds: []
      } satisfies NonNullable<PathLifecycleAuthored['grantedActions']>[number]
    case 'pathLifecycleOnEnd':
      return { turns: 1, modifiers: [] } satisfies NonNullable<PathLifecycleAuthored['onEnd']>
    case 'pathLifecycleTurnAnchor':
      return {
        actor: 'TARGET',
        boundary: 'END_OF_TURN'
      } satisfies NonNullable<PathLifecycleAuthored['turnAnchor']>
    case 'pathLifecycleTurnEndGate':
      return { minimumRoll: 11 } satisfies NonNullable<PathLifecycleAuthored['turnEndGate']>
    case 'pathHitPointTierRow':
      return {
        id: crypto.randomUUID(),
        order,
        atMost: 1,
        resultBlock: createEmptyResultBlock()
      } satisfies PathHitPointTierRowAuthored
    case 'pathRollTableRow':
      return {
        id: crypto.randomUUID(),
        order,
        rollRange: [order, order],
        rollValue: order,
        resolutionKind: 'RESULT',
        resultBlock: createEmptyResultBlock()
      } satisfies Extract<PathRollTableRowAuthored, { resolutionKind: 'RESULT' }>
    case 'rollTableRerollValue':
      return {
        id: crypto.randomUUID(),
        order,
        value: order
      } satisfies RollTableRepeat['rerollValues'][number]
    case 'rollTableRepeat':
      return { count: 2, rerollValues: [] } satisfies RollTableRepeat
    case 'resultBlockGate':
      return {
        kind: 'TARGET_HIT_POINTS_AT_MOST',
        amount: 1
      } satisfies ResultBlockGateAuthored
    case 'perTargetLockout':
      return { until: 'SOURCE_LONG_REST' } satisfies NonNullable<
        SpellGrantAuthored['perTargetLockout']
      >
    case 'slotCost':
      return { poolCode: '' } satisfies NonNullable<SpellGrantAuthored['slotCost']>
    case 'proficiencyGrant':
      return createProficiencyGrant(order)
    case 'raceAncestry':
      return {
        id: crypto.randomUUID(),
        label: '',
        description: '',
        options: []
      } satisfies RaceAncestryAuthored
    case 'raceAncestryOption':
      return {
        id: crypto.randomUUID(),
        label: '',
        description: '',
        order,
        features: []
      } satisfies RaceAncestryOptionAuthored
    case 'range':
      return createRange('DISTANCE')
    case 'reactionTrigger':
      return { kind: 'ATTACKED_SELF' } satisfies Partial<ReactionTriggerBindingAuthored>
    case 'higherLevelCheck':
      return { ability: 'SPELLCASTING', baseDc: 10 } satisfies ReactionHigherLevelCheckAuthored
    case 'optionalOnHit':
      return { kind: 'SPELL_SLOT' } satisfies OptionalOnHitAuthored
    case 'resourceUse':
      return { chargeId: '', cost: 1 } satisfies ResourceUseAuthored
    case 'featureOptionActionReference':
      return { featureId: '', chargeCost: 1 } satisfies FeatureOptionActionReferenceAuthored
    case 'attackSlotFiller':
      return { kind: 'ANY_ATTACK' } satisfies AttackSlotFillerDto
    case 'attackSlotCondition':
      return { kind: 'EARLIER_SLOTS_HIT_SAME_TARGET' } satisfies AttackSlotConditionDto
    case 'attackSlot':
      return { count: 1, fillers: [{ kind: 'ANY_ATTACK' }] } satisfies AttackSlotDto
    case 'attackSlotAlternative':
      return {
        slots: [{ count: 1, fillers: [{ kind: 'ANY_ATTACK' }] }]
      } satisfies AttackSlotSetDto['alternatives'][number]
    case 'attackSlotSet':
      return {
        alternatives: [{ slots: [{ count: 1, fillers: [{ kind: 'ANY_ATTACK' }] }] }]
      } satisfies AttackSlotSetDto
    case 'scaling':
      return {
        scalingKind: 'BREAKPOINTS',
        scalingSource: 'CHARACTER_LEVEL',
        breakpoints: []
      } satisfies BreakpointScalingAuthored
    case 'savingThrow':
      return createSavingThrow()
    case 'savingThrowDcBonus':
      return {
        id: crypto.randomUUID(),
        bonusKind: 'PROFICIENCY_BONUS'
      } satisfies Extract<SavingThrowDcBonusAuthored, { bonusKind: 'PROFICIENCY_BONUS' }>
    case 'scalarReductionAmount':
      return {
        kind: 'DICE',
        diceConfig: '1d6'
      } satisfies ScalarReductionAuthored['amount']
    case 'senseGrant': {
      const grant = createScalingGrant('SENSE_GRANT', order)
      return { ...grant, range: createRange('DISTANCE') } satisfies Partial<SenseGrantAuthored>
    }
    case 'senseGrantLevel':
      return createGrantLevel(order)
    case 'senseGrantProgression':
      return createGrantProgression()
    case 'speed':
      return {
        speedId: '',
        amount: 30,
        unit: 'FEET'
      } satisfies SpeedAuthored
    case 'shape':
      return {
        id: crypto.randomUUID(),
        shapeKind: 'SPHERE',
        radius: createMeasurement('FEET')
      } satisfies Extract<ShapeAuthored, { shapeKind: 'SPHERE' }>
    case 'spellGrant': {
      const grant = createScalingGrant('SPELL_GRANT', order)
      return grant satisfies Partial<SpellGrantAuthored>
    }
    case 'spellGrantLevel':
      return createGrantLevel(order)
    case 'spellGrantProgression':
      return createGrantProgression()
    case 'spellSlotTable':
      return {
        id: crypto.randomUUID(),
        resetKind: 'LONG_REST',
        levels: []
      } satisfies SpellSlotTableDto
    case 'startingEquipment':
      return createEmptyStartingEquipment()
    case 'startingEquipmentCurrency':
      return {
        currencyId: '',
        amount: 1
      } satisfies StartingEquipmentCurrencyDto
    case 'startingEquipmentGroup':
      return {
        id: crypto.randomUUID(),
        order,
        options: []
      } satisfies StartingEquipmentGroupDto
    case 'startingEquipmentItem':
      return createEmptyStartingEquipmentItem(order)
    case 'startingEquipmentOption':
      return {
        id: crypto.randomUUID(),
        order,
        items: []
      } satisfies StartingEquipmentOptionDto
    case 'startingEquipmentSet':
      return {
        id: crypto.randomUUID(),
        order,
        groups: []
      } satisfies StartingEquipmentSetDto
    case 'string':
      return { value: '' }
    case 'summonStatBlock':
      return {} satisfies SummonStatBlockAuthored
    case 'targetCount':
      return { amount: 1 }
    case 'targetRequirement':
      return { kind: 'SIGHT', direction: 'ACTOR_SEES_TARGET' } satisfies TargetRequirementAuthored
    case 'targeting':
      return createTargeting('SELF')
    case 'damageDieCastLevelScaling':
      return { level: 1, count: 1 } satisfies NonNullable<
        ModifierDamageDieAuthored['countPerCastLevelAbove']
      >
    case 'damageLevelScalingEntry':
      return {
        id: crypto.randomUUID(),
        level: order,
        order,
        amount: 1,
        diceConfig: '1d6'
      } satisfies
        | DamageProgressionLevel<{ amount: number }>
        | DamageProgressionLevel<{ diceConfig: string }>
    case 'endEffectsSelector':
      return {
        id: crypto.randomUUID(),
        order,
        kind: 'CONDITION',
        conditionIds: []
      } satisfies EndEffectsSelectorAuthored & { id: string; order: number }
    case 'weight':
      return createMeasurement('POUNDS') satisfies WeightDto
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
  } satisfies FollowUpSaveRepeatPerceptionAuthored
}

function createEmptyResultBlock() {
  return {
    id: crypto.randomUUID(),
    resultKind: 'SINGLE',
    outcomes: []
  } satisfies ResultBlockAuthored
}

function createDefaultInvocation(): EffectDto['invocation'] {
  return {
    kind: 'ACTION',
    triggerCode: 'ACTIVATED',
    activation: { code: 'ACTION', amount: 1 },
    range: createRange('SELF')
  }
}

export function createDefaultEffect(order: number): EffectDto {
  return {
    id: crypto.randomUUID(),
    order,
    invocation: createDefaultInvocation(),
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
    resultBlock: createEmptyResultBlock()
  }
}

function createRange(rangeKind: 'DISTANCE', amount?: number): DistanceRangeDto
function createRange(rangeKind?: 'SELF'): RangeDto
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
  } satisfies Record<AbilityCode, number>
}

function createChargeBonus(order: number) {
  return {
    id: crypto.randomUUID(),
    order,
    bonusKind: 'PROFICIENCY_BONUS'
  } satisfies Extract<ChargeBonusDto, { bonusKind: 'PROFICIENCY_BONUS' }>
}

function createChargeRules() {
  return {
    id: crypto.randomUUID(),
    resetKind: 'LONG_REST',
    limitKind: 'FIXED_AMOUNT',
    scalingKind: 'NONE',
    amount: 1,
    bonuses: []
  } satisfies Extract<ChargeDto, { limitKind: 'FIXED_AMOUNT'; scalingKind: 'NONE' }>
}

function createDetail(order: number) {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: '',
    order
  } satisfies DetailDto
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
  } satisfies Partial<FeatureDto>
}

function createOption(order: number) {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: '',
    order,
    details: [],
    effects: []
  } satisfies Partial<NonNullable<FeatureDto['options']>[number]>
}

function createFeatureGrants() {
  return {
    feats: [],
    modifiers: [],
    proficiencies: [],
    senses: [],
    spells: []
  } satisfies FeatureGrantsDto
}

function createGrantLevel(order: number) {
  return {
    id: crypto.randomUUID(),
    level: order,
    order,
    authoringModeKind: 'ALL'
  } satisfies GrantProgressionLevel<{ authoringModeKind: 'ALL' }>
}

function createGrantProgression() {
  return {
    scalingSource: 'CHARACTER_LEVEL',
    levels: []
  } satisfies GrantProgression
}

function createMeasurement<TUnit extends MeasurementUnitCode>(unit: TUnit) {
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
  } satisfies Partial<ModifierGrantAuthoredFor<'HIT_POINTS_MAX'>>
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
  } satisfies Partial<ProficiencyGrantAuthored>
}

function createScalingGrant<TGrantKind extends ScalingGrantAuthored['grantKind']>(
  grantKind: TGrantKind,
  order: number
): {
  grantKind: TGrantKind
  id: string
  order: number
  selectionKind: 'GRANTED'
  scalingKind: 'NONE'
  authoringModeKind: 'ALL'
} {
  return {
    grantKind,
    ...({
      id: crypto.randomUUID(),
      order,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL'
    } satisfies Pick<ScalingGrantAuthored, 'id' | 'order' | 'selectionKind' | 'scalingKind'> & {
      authoringModeKind: 'ALL'
    })
  }
}

function createCheckChoice() {
  return { skillIds: [], abilityDefinitionIds: [] } satisfies CheckChoiceAuthored
}

function createCheckDc() {
  return { kind: 'FIXED', value: 10 } satisfies Extract<CheckDcAuthored, { kind: 'FIXED' }>
}

function createSavingThrow() {
  return {
    id: crypto.randomUUID(),
    abilityDefinitionId: '',
    dcMethod: 'FIXED_DC',
    baseDc: 10,
    bonuses: []
  } satisfies Extract<SavingThrowAuthored, { dcMethod: 'FIXED_DC' }>
}

function createFacetCondition(order: number) {
  return {
    id: crypto.randomUUID(),
    order,
    kind: 'PREDICATE',
    constraint: 'INCLUDE'
  } satisfies Partial<PredicateConditionAuthored>
}
