export type AuthoringDefaultKind =
  | 'abilityScores'
  | 'activation'
  | 'applyGrants'
  | 'capacity'
  | 'chargeBonus'
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
  | 'creatureLairProfile'
  | 'creatureLegendaryProfile'
  | 'creatureMountProfile'
  | 'creatureNpcProfile'
  | 'duration'
  | 'durationScalingBreakpoint'
  | 'durationValue'
  | 'effect'
  | 'effectPath'
  | 'facet'
  | 'facetBody'
  | 'facetBodyGroup'
  | 'facetCondition'
  | 'facetContext'
  | 'facetExists'
  | 'facetGroup'
  | 'feature'
  | 'option'
  | 'featureGrants'
  | 'featureOptionChoice'
  | 'featGrant'
  | 'featGrantLevel'
  | 'featGrantProgression'
  | 'invocation'
  | 'manifestBehavior'
  | 'measurement'
  | 'measurementScalingBreakpoint'
  | 'modifierChargeLimitLevel'
  | 'modifierGrant'
  | 'modifierGrantDomain'
  | 'modifierGrantPayload'
  | 'numericExpr'
  | 'outcome'
  | 'outcomeBonus'
  | 'pathChoiceOption'
  | 'pathLifecycle'
  | 'pathRollTableRow'
  | 'proficiencyGrant'
  | 'raceAncestry'
  | 'raceAncestryOption'
  | 'range'
  | 'scaling'
  | 'resultBlock'
  | 'savingThrow'
  | 'savingThrowDcBonus'
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
  capacity: ['capacity', 'creatureCapacity'],
  chargeBonus: ['chargeBonus'],
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
  creatureLairProfile: ['creatureLairProfile'],
  creatureLegendaryProfile: ['creatureLegendaryProfile'],
  creatureMountProfile: ['creatureMountProfile'],
  creatureNpcProfile: ['creatureNpcProfile'],
  duration: ['duration'],
  durationScalingBreakpoint: ['durationScalingBreakpoint', 'targetCountScalingBreakpoint'],
  durationValue: ['durationValue'],
  effect: ['effect'],
  effectPath: ['effectPath', 'manifestBehaviorPath'],
  facet: ['facet', 'characterFacet'],
  facetBody: ['facetBody'],
  facetBodyGroup: ['facetBodyGroup'],
  facetCondition: ['facetCondition', 'facetBodyCondition'],
  facetContext: ['facetContext', 'characterFacetContext'],
  facetExists: ['facetExists'],
  facetGroup: ['facetGroup', 'characterFacetGroup'],
  feature: ['feature', 'featureBasics'],
  option: ['option'],
  featureGrants: ['featureGrants'],
  featureOptionChoice: ['featureOptionChoice'],
  featGrant: ['featGrant'],
  featGrantLevel: ['featGrantLevel'],
  featGrantProgression: ['featGrantProgression'],
  invocation: ['invocation'],
  manifestBehavior: ['manifestBehavior'],
  measurement: ['measurement', 'shapeMeasurement'],
  measurementScalingBreakpoint: [
    'rangeScalingBreakpoint',
    'shapeMeasurementScalingBreakpoint'
  ],
  modifierChargeLimitLevel: ['modifierChargeLimitLevel'],
  modifierGrant: ['modifierGrant'],
  modifierGrantDomain: ['modifierGrantDomain'],
  modifierGrantPayload: ['modifierGrantPayload'],
  numericExpr: ['numericAtom', 'numericExpr'],
  outcome: ['nonManifestOutcome', 'outcome'],
  outcomeBonus: ['outcomeBonus'],
  pathChoiceOption: ['choiceOption', 'nonManifestChoiceOption'],
  pathLifecycle: ['pathLifecycle'],
  pathRollTableRow: ['rollTableRow', 'nonManifestRollTableRow'],
  proficiencyGrant: ['proficiencyGrant'],
  raceAncestry: ['raceAncestry'],
  raceAncestryOption: ['raceAncestryOption'],
  range: ['range'],
  scaling: ['durationScaling', 'rangeScaling', 'shapeMeasurementScaling', 'targetCountScaling'],
  resultBlock: ['nonManifestResultBlock', 'resultBlock'],
  savingThrow: ['savingThrow'],
  savingThrowDcBonus: ['savingThrowDcBonus'],
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
  startingEquipmentItem: ['startingEquipmentItem'],
  startingEquipmentOption: ['startingEquipmentOption'],
  startingEquipmentSet: ['startingEquipmentSet'],
  string: ['vehicleString', 'string', 'logisticsNote', 'regionalEffect', 'sense', 'tag'],
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
