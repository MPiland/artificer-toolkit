type AuthoringDefaultKind =
  | 'abilityScores'
  | 'activation'
  | 'applyGrants'
  | 'actorRelationshipModule'
  | 'actorRelationshipRecurrence'
  | 'actorRelationshipRecurrenceOutcome'
  | 'capacity'
  | 'chargeBonus'
  | 'check'
  | 'checkChoice'
  | 'checkDc'
  | 'heldEscapeDc'
  | 'chargeLevelScaling'
  | 'charges'
  | 'classDetail'
  | 'classHitpoint'
  | 'classMulticlass'
  | 'classMulticlassRequirement'
  | 'classMulticlassRequirementGroup'
  | 'classMulticlassRequirementGroups'
  | 'classPrepareLimit'
  | 'classPrepareLimitPerLevel'
  | 'classResource'
  | 'classSpecialization'
  | 'classSpellcasting'
  | 'classSpellLimits'
  | 'classSpellSlot'
  | 'classStartingGold'
  | 'contains'
  | 'attackSlot'
  | 'attackSlotAlternative'
  | 'attackSlotCondition'
  | 'attackSlotFiller'
  | 'attackSlotSet'
  | 'cost'
  | 'creatureCompanionProfile'
  | 'creatureEquipmentLoadout'
  | 'creatureHitDice'
  | 'creatureMountProfile'
  | 'creatureNpcProfile'
  | 'creatureQualifiedDamageDefense'
  | 'creatureSense'
  | 'duration'
  | 'durationScalingBreakpoint'
  | 'durationValue'
  | 'diceExpression'
  | 'effect'
  | 'effectPath'
  | 'equipmentEffect'
  | 'facet'
  | 'facetBody'
  | 'facetBodyGroup'
  | 'facetCondition'
  | 'facetContext'
  | 'facetExists'
  | 'facetGroup'
  | 'feature'
  | 'featureRollDefinition'
  | 'option'
  | 'featureGrants'
  | 'featureOptionChoice'
  | 'featureOptionActionReference'
  | 'featGrant'
  | 'featGrantLevel'
  | 'featGrantProgression'
  | 'followUpSaveAttempts'
  | 'followUpSaveBranch'
  | 'followUpSaveFailureMarginRider'
  | 'followUpSaveFailureMarginRiderLifecycle'
  | 'forcedMovement'
  | 'forcedMovementCollision'
  | 'followUpSaveRepeatAttemptGate'
  | 'followUpSaveRepeatPerception'
  | 'followUpSaveRepeatRollInfluence'
  | 'followUpSaveRepeatTrigger'
  | 'healFraction'
  | 'higherLevelCheck'
  | 'degradeEquipmentDestroyWhen'
  | 'hitPointMaximumReductionAmountSource'
  | 'invocation'
  | 'manifestBehavior'
  | 'manifestComponent'
  | 'manifestComponentRegion'
  | 'manifestCreatureForm'
  | 'manifestCreatureFormFilter'
  | 'creatureFormFilterScaledCap'
  | 'creatureFormFilterScalingBreakpoint'
  | 'manifestCamouflage'
  | 'manifestDestructionCriterion'
  | 'manifestLight'
  | 'manifestOccupantConditionImmunity'
  | 'manifestOccupantSaveBonus'
  | 'manifestProximityRule'
  | 'measurement'
  | 'measurementScalingBreakpoint'
  | 'damageInterceptionExcludes'
  | 'damageInterceptionSave'
  | 'damageInterceptionSaveDc'
  | 'incomingGateSuccessImmunity'
  | 'telepathicLinkAbilityFloor'
  | 'modifierAttackDecoyArmorClass'
  | 'modifierAttackDecoyThreshold'
  | 'modifierChargeLimitLevel'
  | 'modifierGrant'
  | 'modifierGrantDomain'
  | 'modifierGrantPayload'
  | 'numericExpr'
  | 'optionalOnHit'
  | 'outcome'
  | 'outcomeBreakpoint'
  | 'outcomeBreakpointValue'
  | 'outcomeBonus'
  | 'pathChoiceOption'
  | 'pathChoiceOptionRequiredRule'
  | 'pathChosenItem'
  | 'pathLifecycle'
  | 'pathLifecycleEffectOffer'
  | 'pathLifecycleEffectOfferRange'
  | 'pathLifecycleEndTrigger'
  | 'pathLifecycleEscape'
  | 'pathLifecycleGrantedAction'
  | 'pathLifecycleHolderEnd'
  | 'pathLifecycleOnEnd'
  | 'pathLifecycleTurnAnchor'
  | 'pathLifecycleTurnEndGate'
  | 'pathHitPointTierRow'
  | 'pathRollTableRow'
  | 'perTargetLockout'
  | 'proficiencyGrant'
  | 'raceAncestry'
  | 'raceAncestryOption'
  | 'range'
  | 'slotCost'
  | 'reactionTrigger'
  | 'resourceUse'
  | 'resultBlockGate'
  | 'scaling'
  | 'resultBlock'
  | 'rollTableRepeat'
  | 'rollTableRerollValue'
  | 'savingThrow'
  | 'sparesCreatures'
  | 'savingThrowDcBonus'
  | 'scalarReductionAmount'
  | 'senseGrant'
  | 'senseGrantLevel'
  | 'senseGrantProgression'
  | 'shape'
  | 'sizeLimit'
  | 'speed'
  | 'spellSlotCost'
  | 'spellSlotLevelBudget'
  | 'spellGrant'
  | 'spellGrantLevel'
  | 'spellGrantProgression'
  | 'spellSlotTable'
  | 'startingEquipment'
  | 'startingEquipmentCurrency'
  | 'startingEquipmentGroup'
  | 'spellCast'
  | 'featureGrantedSpellCast'
  | 'featureWeaponAttack'
  | 'startingEquipmentItem'
  | 'startingEquipmentOption'
  | 'startingEquipmentSet'
  | 'string'
  | 'summonStatBlock'
  | 'targetCount'
  | 'targetRequirement'
  | 'hitPointPool'
  | 'hitPointPoolScalingBreakpoint'
  | 'targeting'
  | 'damageDieCastLevelScaling'
  | 'damageLevelScalingEntry'
  | 'endEffectsSelector'
  | 'weight'

const AUTHORING_DEFAULT_MAP_IDS: Readonly<Record<AuthoringDefaultKind, readonly string[]>> = {
  abilityScores: ['abilityScores', 'summonAbilityScores'],
  activation: ['activation', 'castingTime'],
  applyGrants: ['applyGrants'],
  actorRelationshipModule: ['actorRelationshipModule'],
  actorRelationshipRecurrence: ['actorRelationshipRecurrence'],
  actorRelationshipRecurrenceOutcome: ['actorRelationshipRecurrenceOutcome'],
  capacity: ['capacity', 'creatureCapacity'],
  chargeBonus: ['chargeBonus'],
  check: ['check'],
  checkChoice: ['checkChoice'],
  checkDc: ['checkDc', 'escapeDc'],
  heldEscapeDc: ['heldEscapeDc'],
  chargeLevelScaling: ['levels', 'spellSlotLevels'],
  charges: ['charges'],
  classDetail: [
    'authoredDetail',
    'backgroundDetail',
    'classDetail',
    'creatureDetail',
    'raceDetail',
    'vehicleDetail'
  ],
  classHitpoint: ['classHitpoint'],
  classMulticlass: ['classMulticlass'],
  classMulticlassRequirement: ['classMulticlassRequirement'],
  classMulticlassRequirementGroup: ['classMulticlassRequirementGroup'],
  classMulticlassRequirementGroups: ['classMulticlassRequirementGroups'],
  classPrepareLimit: ['classPrepareLimit'],
  classPrepareLimitPerLevel: ['classPrepareLimitPerLevel'],
  classResource: ['classResource'],
  classSpecialization: ['classSpecialization'],
  classSpellcasting: ['classSpellcasting'],
  classSpellLimits: ['classSpellLimits'],
  classSpellSlot: ['classSpellSlot'],
  classStartingGold: ['classStartingGold'],
  contains: ['contains'],
  cost: ['cost', 'creatureCost'],
  creatureCompanionProfile: ['creatureCompanionProfile'],
  creatureEquipmentLoadout: ['creatureEquipmentLoadout'],
  creatureHitDice: ['creatureHitDice'],
  creatureMountProfile: ['creatureMountProfile'],
  creatureNpcProfile: ['creatureNpcProfile'],
  creatureQualifiedDamageDefense: ['creatureQualifiedDamageDefense'],
  attackSlot: ['attackSlot'],
  attackSlotAlternative: ['attackSlotAlternative'],
  attackSlotCondition: ['attackSlotCondition'],
  attackSlotFiller: ['attackSlotFiller'],
  attackSlotSet: ['attackSlotSet'],
  creatureSense: ['creatureSense'],
  duration: ['duration'],
  durationScalingBreakpoint: ['durationScalingBreakpoint', 'targetCountScalingBreakpoint'],
  hitPointPool: ['hitPointPool'],
  hitPointPoolScalingBreakpoint: ['hitPointPoolScalingBreakpoint'],
  durationValue: ['durationValue'],
  diceExpression: ['featureRollExpression'],
  effect: ['effect', 'featureEffect'],
  effectPath: ['effectPath', 'manifestBehaviorPath'],
  equipmentEffect: ['equipmentEffect'],
  facet: ['facet', 'characterFacet'],
  facetBody: ['facetBody'],
  facetBodyGroup: ['facetBodyGroup'],
  facetCondition: ['facetCondition', 'facetBodyCondition'],
  facetContext: ['facetContext', 'characterFacetContext'],
  facetExists: ['facetExists'],
  facetGroup: ['facetGroup', 'characterFacetGroup'],
  feature: ['feature', 'featureBasics', 'creatureFeature'],
  featureRollDefinition: ['featureRollDefinition'],
  option: ['option', 'creatureOption'],
  featureGrants: ['featureGrants'],
  featureOptionChoice: ['featureOptionChoice'],
  featureOptionActionReference: ['featureOptionActionReference'],
  featGrant: ['featGrant'],
  featGrantLevel: ['featGrantLevel'],
  featGrantProgression: ['featGrantProgression'],
  followUpSaveAttempts: ['followUpSaveAttempts'],
  followUpSaveBranch: ['followUpSaveBranch'],
  followUpSaveFailureMarginRider: ['followUpSaveFailureMarginRider'],
  followUpSaveFailureMarginRiderLifecycle: ['followUpSaveFailureMarginRiderLifecycle'],
  forcedMovement: ['forcedMovement'],
  forcedMovementCollision: ['forcedMovementCollision'],
  followUpSaveRepeatAttemptGate: ['followUpSaveRepeatAttemptGate'],
  followUpSaveRepeatPerception: ['followUpSaveRepeatPerception'],
  followUpSaveRepeatRollInfluence: ['followUpSaveRepeatRollInfluence'],
  followUpSaveRepeatTrigger: ['followUpSaveRepeatTrigger'],
  healFraction: ['healFraction'],
  higherLevelCheck: ['higherLevelCheck'],
  degradeEquipmentDestroyWhen: ['degradeEquipmentDestroyWhen'],
  hitPointMaximumReductionAmountSource: ['hitPointMaximumReductionAmountSource'],
  invocation: ['invocation'],
  manifestBehavior: ['manifestBehavior'],
  manifestComponent: ['manifestComponent'],
  manifestComponentRegion: ['manifestComponentRegion'],
  manifestCreatureForm: ['manifestCreatureForm'],
  manifestCreatureFormFilter: ['manifestCreatureFormFilter'],
  creatureFormFilterScaledCap: ['creatureFormFilterScaledCap'],
  creatureFormFilterScalingBreakpoint: ['creatureFormFilterScalingBreakpoint'],
  manifestCamouflage: ['manifestCamouflage'],
  manifestDestructionCriterion: ['manifestDestructionCriterion'],
  manifestLight: ['manifestLight'],
  manifestOccupantConditionImmunity: ['manifestOccupantConditionImmunity'],
  manifestOccupantSaveBonus: ['manifestOccupantSaveBonus'],
  manifestProximityRule: ['manifestProximityRule'],
  measurement: ['measurement', 'shapeMeasurement'],
  measurementScalingBreakpoint: ['rangeScalingBreakpoint', 'shapeMeasurementScalingBreakpoint'],
  damageInterceptionExcludes: ['damageInterceptionExcludes'],
  damageInterceptionSave: ['damageInterceptionSave'],
  damageInterceptionSaveDc: ['damageInterceptionSaveDc'],
  incomingGateSuccessImmunity: ['incomingGateSuccessImmunity'],
  telepathicLinkAbilityFloor: ['telepathicLinkAbilityFloor'],
  modifierAttackDecoyArmorClass: ['modifierAttackDecoyArmorClass'],
  modifierAttackDecoyThreshold: ['modifierAttackDecoyThreshold'],
  modifierChargeLimitLevel: ['modifierChargeLimitLevel'],
  modifierGrant: ['modifierGrant'],
  modifierGrantDomain: ['modifierGrantDomain'],
  modifierGrantPayload: ['modifierGrantPayload'],
  numericExpr: ['numericAtom', 'numericExpr'],
  optionalOnHit: ['optionalOnHit'],
  outcome: ['nonManifestOutcome', 'outcome'],
  outcomeBreakpoint: ['outcomeBreakpoint'],
  outcomeBreakpointValue: ['outcomeBreakpointValue'],
  outcomeBonus: ['outcomeBonus'],
  pathChoiceOption: ['choiceOption', 'nonManifestChoiceOption'],
  pathChoiceOptionRequiredRule: ['choiceOptionRequiredRule'],
  pathChosenItem: ['pathChosenItem'],
  pathLifecycle: ['pathLifecycle'],
  pathLifecycleEffectOffer: ['pathLifecycleEffectOffer'],
  pathLifecycleEffectOfferRange: ['pathLifecycleEffectOfferRange'],
  pathLifecycleEndTrigger: ['pathLifecycleEndTrigger'],
  pathLifecycleEscape: ['pathLifecycleEscape'],
  pathLifecycleGrantedAction: ['pathLifecycleGrantedAction'],
  pathLifecycleHolderEnd: ['pathLifecycleHolderEnd'],
  pathLifecycleOnEnd: ['pathLifecycleOnEnd'],
  pathLifecycleTurnAnchor: ['pathLifecycleTurnAnchor'],
  pathLifecycleTurnEndGate: ['pathLifecycleTurnEndGate'],
  pathHitPointTierRow: ['hitPointTierRow', 'nonManifestHitPointTierRow'],
  pathRollTableRow: ['rollTableRow', 'nonManifestRollTableRow'],
  perTargetLockout: ['perTargetLockout'],
  proficiencyGrant: ['proficiencyGrant'],
  raceAncestry: ['raceAncestry'],
  raceAncestryOption: ['raceAncestryOption'],
  range: ['range', 'senseRange'],
  slotCost: ['slotCost'],
  reactionTrigger: ['reactionTrigger'],
  resourceUse: ['resourceUse'],
  resultBlockGate: ['resultBlockGate'],
  scaling: [
    'durationScaling',
    'rangeScaling',
    'shapeMeasurementScaling',
    'targetCountScaling',
    'hitPointPoolScaling',
    'creatureFormFilterScaling'
  ],
  resultBlock: ['nonManifestResultBlock', 'resultBlock'],
  rollTableRepeat: ['rollTableRepeat'],
  rollTableRerollValue: ['rollTableRerollValue'],
  savingThrow: ['savingThrow'],
  sparesCreatures: ['sparesCreatures'],
  savingThrowDcBonus: ['savingThrowDcBonus'],
  scalarReductionAmount: ['scalarReductionAmount'],
  senseGrant: ['senseGrant'],
  senseGrantLevel: ['senseGrantLevel'],
  senseGrantProgression: ['senseGrantProgression'],
  shape: ['shape'],
  sizeLimit: ['sizeLimit'],
  speed: ['speed'],
  spellSlotCost: ['spellSlotCost'],
  spellSlotLevelBudget: ['spellSlotLevelBudget'],
  spellGrant: ['spellGrant'],
  spellGrantLevel: ['spellGrantLevel'],
  spellGrantProgression: ['spellGrantProgression'],
  spellSlotTable: ['spellSlotTable'],
  startingEquipment: ['startingEquipment'],
  startingEquipmentCurrency: ['startingEquipmentCurrency'],
  startingEquipmentGroup: ['startingEquipmentGroup'],
  spellCast: ['spellCast'],
  featureGrantedSpellCast: ['featureGrantedSpellCast'],
  featureWeaponAttack: ['featureWeaponAttack'],
  startingEquipmentItem: ['startingEquipmentItem'],
  startingEquipmentOption: ['startingEquipmentOption'],
  startingEquipmentSet: ['startingEquipmentSet'],
  string: ['effectId', 'vehicleString', 'string', 'logisticsNote', 'regionalEffect', 'tag'],
  summonStatBlock: ['summonStatBlock'],
  targetCount: ['targetCount'],
  targetRequirement: ['targetRequirement'],
  targeting: ['targeting'],
  damageDieCastLevelScaling: ['damageDieCastLevelScaling'],
  damageLevelScalingEntry: ['damageLevelScalingEntry'],
  endEffectsSelector: ['endEffectsSelector'],
  weight: ['weight']
}

const defaultKindByMapId = Object.entries(AUTHORING_DEFAULT_MAP_IDS).reduce<
  Record<string, AuthoringDefaultKind>
>((result, [kind, mapIds]) => {
  for (const mapId of mapIds) {
    result[mapId] = kind as AuthoringDefaultKind
  }

  return result
}, {})

export function getAuthoringDefaultKind(mapId: string): AuthoringDefaultKind {
  const kind = defaultKindByMapId[mapId]
  if (kind === undefined) {
    throw new Error(`No authoring default factory is registered for child map: ${mapId}`)
  }
  return kind
}
