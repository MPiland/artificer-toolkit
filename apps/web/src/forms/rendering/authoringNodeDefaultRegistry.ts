type AuthoringDefaultKind =
  | 'abilityScores'
  | 'activation'
  | 'applyGrants'
  | 'actorRelationshipModule'
  | 'actorRelationshipRecurrence'
  | 'capacity'
  | 'chargeBonus'
  | 'check'
  | 'checkChoice'
  | 'checkDc'
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
  | 'cost'
  | 'creatureAction'
  | 'creatureCompanionProfile'
  | 'creatureEquipmentLoadout'
  | 'creatureHitDice'
  | 'creatureLairProfile'
  | 'creatureLegendaryProfile'
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
  | 'followUpSaveRepeatAttemptGate'
  | 'followUpSaveRepeatPerception'
  | 'followUpSaveRepeatRollInfluence'
  | 'higherLevelCheck'
  | 'hitPointMaximumReductionAmountSource'
  | 'invocation'
  | 'manifestBehavior'
  | 'manifestComponent'
  | 'manifestCreatureForm'
  | 'manifestCreatureFormFilter'
  | 'manifestDestructionCriterion'
  | 'manifestLight'
  | 'manifestProximityRule'
  | 'measurement'
  | 'measurementScalingBreakpoint'
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
  | 'pathLifecycle'
  | 'pathLifecycleEndTrigger'
  | 'pathLifecycleHolderEnd'
  | 'pathLifecycleTurnAnchor'
  | 'pathRollTableRow'
  | 'proficiencyGrant'
  | 'raceAncestry'
  | 'raceAncestryOption'
  | 'range'
  | 'reactionTrigger'
  | 'resourceUse'
  | 'scaling'
  | 'resultBlock'
  | 'rollTableRepeat'
  | 'rollTableRerollValue'
  | 'savingThrow'
  | 'savingThrowDcBonus'
  | 'scalarReductionAmount'
  | 'senseGrant'
  | 'senseGrantLevel'
  | 'senseGrantProgression'
  | 'shape'
  | 'speed'
  | 'spellGrant'
  | 'spellGrantLevel'
  | 'spellGrantProgression'
  | 'startingEquipment'
  | 'startingEquipmentCurrency'
  | 'startingEquipmentGroup'
  | 'spellCast'
  | 'startingEquipmentItem'
  | 'startingEquipmentOption'
  | 'startingEquipmentSet'
  | 'string'
  | 'summonStatBlock'
  | 'targetCount'
  | 'targeting'
  | 'damageLevelScalingEntry'
  | 'weight'

const AUTHORING_DEFAULT_MAP_IDS: Readonly<Record<AuthoringDefaultKind, readonly string[]>> = {
  abilityScores: ['abilityScores', 'summonAbilityScores'],
  activation: ['activation', 'castingTime'],
  applyGrants: ['applyGrants'],
  actorRelationshipModule: ['actorRelationshipModule'],
  actorRelationshipRecurrence: ['actorRelationshipRecurrence'],
  capacity: ['capacity', 'creatureCapacity'],
  chargeBonus: ['chargeBonus'],
  check: ['check'],
  checkChoice: ['checkChoice'],
  checkDc: ['checkDc', 'escapeDc'],
  chargeLevelScaling: ['levels'],
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
  creatureAction: ['creatureAction'],
  creatureCompanionProfile: ['creatureCompanionProfile'],
  creatureEquipmentLoadout: ['creatureEquipmentLoadout'],
  creatureHitDice: ['creatureHitDice'],
  creatureLairProfile: ['creatureLairProfile'],
  creatureLegendaryProfile: ['creatureLegendaryProfile'],
  creatureMountProfile: ['creatureMountProfile'],
  creatureNpcProfile: ['creatureNpcProfile'],
  creatureQualifiedDamageDefense: ['creatureQualifiedDamageDefense'],
  creatureSense: ['creatureSense'],
  duration: ['duration'],
  durationScalingBreakpoint: ['durationScalingBreakpoint', 'targetCountScalingBreakpoint'],
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
  followUpSaveRepeatAttemptGate: ['followUpSaveRepeatAttemptGate'],
  followUpSaveRepeatPerception: ['followUpSaveRepeatPerception'],
  followUpSaveRepeatRollInfluence: ['followUpSaveRepeatRollInfluence'],
  higherLevelCheck: ['higherLevelCheck'],
  hitPointMaximumReductionAmountSource: ['hitPointMaximumReductionAmountSource'],
  invocation: ['invocation'],
  manifestBehavior: ['manifestBehavior'],
  manifestComponent: ['manifestComponent'],
  manifestCreatureForm: ['manifestCreatureForm'],
  manifestCreatureFormFilter: ['manifestCreatureFormFilter'],
  manifestDestructionCriterion: ['manifestDestructionCriterion'],
  manifestLight: ['manifestLight'],
  manifestProximityRule: ['manifestProximityRule'],
  measurement: ['measurement', 'shapeMeasurement'],
  measurementScalingBreakpoint: ['rangeScalingBreakpoint', 'shapeMeasurementScalingBreakpoint'],
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
  pathLifecycle: ['pathLifecycle'],
  pathLifecycleEndTrigger: ['pathLifecycleEndTrigger'],
  pathLifecycleHolderEnd: ['pathLifecycleHolderEnd'],
  pathLifecycleTurnAnchor: ['pathLifecycleTurnAnchor'],
  pathRollTableRow: ['rollTableRow', 'nonManifestRollTableRow'],
  proficiencyGrant: ['proficiencyGrant'],
  raceAncestry: ['raceAncestry'],
  raceAncestryOption: ['raceAncestryOption'],
  range: ['range', 'senseRange'],
  reactionTrigger: ['reactionTrigger'],
  resourceUse: ['resourceUse'],
  scaling: ['durationScaling', 'rangeScaling', 'shapeMeasurementScaling', 'targetCountScaling'],
  resultBlock: ['nonManifestResultBlock', 'resultBlock'],
  rollTableRepeat: ['rollTableRepeat'],
  rollTableRerollValue: ['rollTableRerollValue'],
  savingThrow: ['savingThrow'],
  savingThrowDcBonus: ['savingThrowDcBonus'],
  scalarReductionAmount: ['scalarReductionAmount'],
  senseGrant: ['senseGrant'],
  senseGrantLevel: ['senseGrantLevel'],
  senseGrantProgression: ['senseGrantProgression'],
  shape: ['shape'],
  speed: ['speed'],
  spellGrant: ['spellGrant'],
  spellGrantLevel: ['spellGrantLevel'],
  spellGrantProgression: ['spellGrantProgression'],
  startingEquipment: ['startingEquipment'],
  startingEquipmentCurrency: ['startingEquipmentCurrency'],
  startingEquipmentGroup: ['startingEquipmentGroup'],
  spellCast: ['spellCast'],
  startingEquipmentItem: ['startingEquipmentItem'],
  startingEquipmentOption: ['startingEquipmentOption'],
  startingEquipmentSet: ['startingEquipmentSet'],
  string: ['actionEffectId', 'vehicleString', 'string', 'logisticsNote', 'regionalEffect', 'tag'],
  summonStatBlock: ['summonStatBlock'],
  targetCount: ['targetCount'],
  targeting: ['targeting'],
  damageLevelScalingEntry: ['damageLevelScalingEntry'],
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

export function hasAuthoringDefaultKind(mapId: string): boolean {
  return mapId in defaultKindByMapId
}

export function getAuthoringDefaultKind(mapId: string): AuthoringDefaultKind {
  const kind = defaultKindByMapId[mapId]
  if (kind === undefined) {
    throw new Error(`No authoring default factory is registered for child map: ${mapId}`)
  }
  return kind
}
