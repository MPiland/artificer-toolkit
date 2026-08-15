const specializationMismatch =
  '($.candidate.sourceKind == "CLASS" or $.candidate.sourceKind == "SUBCLASS") and $.candidate.specializationRestrictionIds != null and ($.candidate.specializationId == null or !some($.candidate.specializationRestrictionIds, # == $.candidate.specializationId))'
const unsupportedRaceScaling =
  '$.candidate.scalingKind == "PER_LEVEL" and ($.candidate.sourceKind == "RACE" or $.candidate.sourceKind == "SUBRACE") and $.candidate.scalingSource != "CHARACTER_LEVEL"'
const effectiveProgressionLevel =
  '$.candidate.scalingSource == "CHARACTER_LEVEL" ? $.candidate.totalLevel : $.candidate.classLevel'
const progressionLocked = `$.candidate.scalingKind == "PER_LEVEL" and $.candidate.progressionLevel > (${effectiveProgressionLevel})`
const targetNotSelected =
  '($.candidate.selectionKind == "CHOSEN" and !$.candidate.selectedByCharacter) or ($.candidate.selectionKind == "GRANTED" and $.candidate.authoringMode != "SELECTED")'

const preDedupeReason = `$.candidate.inheritedFeatureDuplicate ? "INHERITED_FEATURE_DUPLICATE" : $.candidate.activeSourceLevel < $.candidate.featureAvailableAtLevel ? "SOURCE_LEVEL_LOCKED" : ${specializationMismatch} ? "SPECIALIZATION_MISMATCH" : ${unsupportedRaceScaling} ? "UNSUPPORTED_SCALING_SOURCE" : ${progressionLocked} ? "PROGRESSION_LEVEL_LOCKED" : ${targetNotSelected} ? "TARGET_NOT_SELECTED" : "ACCESS_GRANTED"`

const copyCandidate =
  '{ sequence: sequence, accessId: accessId, sourceInstanceId: sourceInstanceId, spellId: spellId, sourceFeatureId: sourceFeatureId, grantId: grantId, sourceKind: sourceKind, sourceId: sourceId, owningClassId: owningClassId, activeSourceLevel: activeSourceLevel, featureAvailableAtLevel: featureAvailableAtLevel, inheritedFeatureDuplicate: inheritedFeatureDuplicate, specializationId: specializationId, specializationRestrictionIds: specializationRestrictionIds, selectionKind: selectionKind, authoringMode: authoringMode, selectedByCharacter: selectedByCharacter, scalingKind: scalingKind, scalingSource: scalingSource, progressionLevel: progressionLevel, totalLevel: totalLevel, classLevel: classLevel, attributes: attributes, castAtLevel: castAtLevel, castingAbility: castingAbility, charge: charge }'

const duplicateAccess =
  'some(preDedupeSpellAccessCandidates as earlier, earlier.preDedupeReason == "ACCESS_GRANTED" and earlier.candidate.accessId == decision.candidate.accessId and earlier.candidate.sequence < decision.candidate.sequence)'

const includedAccess = `{
  sequence: decision.candidate.sequence,
  accessId: decision.candidate.accessId,
  sourceInstanceId: decision.candidate.sourceInstanceId,
  spellId: decision.candidate.spellId,
  sourceFeatureId: decision.candidate.sourceFeatureId,
  grantId: decision.candidate.grantId,
  sourceKind: decision.candidate.sourceKind,
  sourceId: decision.candidate.sourceId,
  owningClassId: decision.candidate.owningClassId,
  timingKind: decision.candidate.owningClassId == null ? "CHARACTER_LEVEL" : "CLASS_LEVEL",
  timingLevel: decision.candidate.activeSourceLevel,
  attributes: decision.candidate.attributes,
  acquisition: some(decision.candidate.attributes, # == "PREPARED") ? "ALWAYS_PREPARED" : some(decision.candidate.attributes, # == "KNOWN") ? "KNOWN" : "GRANTED",
  castMode: some(decision.candidate.attributes, # == "LIMITED_USE") ? "LIMITED_USE" : some(decision.candidate.attributes, # == "CAST_AT_WILL") ? "AT_WILL" : some(decision.candidate.attributes, # == "CAST_AT_LEVEL") ? "FIXED_LEVEL" : some(decision.candidate.attributes, # == "RITUAL") ? "RITUAL" : "SPELL_SLOT",
  castAtLevel: decision.candidate.castAtLevel,
  castingAbility: decision.candidate.castingAbility,
  charge: decision.candidate.charge,
  learned: some(decision.candidate.attributes, # == "KNOWN") or !some(decision.candidate.attributes, # == "PREPARED"),
  prepared: some(decision.candidate.attributes, # == "PREPARED")
}`.replace(/\s+/g, ' ')

export const dnd5e2014CharacterSpellPolicyNodes = [
  {
    id: 'spell-access-candidates',
    type: 'expressionNode',
    name: 'Spell access candidates',
    position: { x: 1260, y: 300 },
    content: {
      passThrough: true,
      inputField: 'spellAccessCandidates',
      outputPath: 'preDedupeSpellAccessCandidates',
      executionMode: 'loop',
      expressions: [
        { id: 'candidate', key: 'candidate', value: copyCandidate },
        { id: 'pre-dedupe-reason', key: 'preDedupeReason', value: preDedupeReason }
      ]
    }
  },
  {
    id: 'spell-access-decisions',
    type: 'expressionNode',
    name: 'Spell access decisions',
    position: { x: 1440, y: 300 },
    content: {
      passThrough: true,
      inputField: null,
      outputPath: null,
      executionMode: 'single',
      expressions: [
        {
          id: 'decisions',
          key: 'resolvedSpellAccessDecisions',
          value: `map(preDedupeSpellAccessCandidates as decision, { candidate: decision.candidate, preDedupeReason: decision.preDedupeReason, status: decision.preDedupeReason == "ACCESS_GRANTED" and !(${duplicateAccess}) ? "INCLUDED" : "EXCLUDED", reasonCode: decision.preDedupeReason == "ACCESS_GRANTED" and (${duplicateAccess}) ? "DUPLICATE_ACCESS_ID" : decision.preDedupeReason })`
        }
      ]
    }
  },
  {
    id: 'spell-access-summary',
    type: 'expressionNode',
    name: 'Resolved spell access',
    position: { x: 1620, y: 300 },
    content: {
      passThrough: true,
      inputField: null,
      outputPath: null,
      executionMode: 'single',
      expressions: [
        {
          id: 'decisions',
          key: 'spellAccessDecisions',
          value:
            'map(resolvedSpellAccessDecisions as decision, { sequence: decision.candidate.sequence, accessId: decision.candidate.accessId, status: decision.status, reasonCode: decision.reasonCode })'
        },
        {
          id: 'included-access',
          key: 'spellAccess',
          value: `map(filter(resolvedSpellAccessDecisions as decision, decision.status == "INCLUDED") as decision, ${includedAccess})`
        }
      ]
    }
  },
  {
    id: 'spell-class-states',
    type: 'expressionNode',
    name: 'Class spell state',
    position: { x: 1800, y: 300 },
    content: {
      passThrough: true,
      inputField: null,
      outputPath: null,
      executionMode: 'single',
      expressions: [
        {
          id: 'class-states',
          key: 'resolvedClassSpellStates',
          value:
            'map(spellClasses as classState, { classId: classState.classId, learnedSpellIds: map(filter(spellAccess as access, access.owningClassId == classState.classId and access.learned and !some(spellAccess as earlier, earlier.owningClassId == classState.classId and earlier.learned and earlier.spellId == access.spellId and earlier.sequence < access.sequence)), #.spellId), preparedSpellIds: map(filter(spellAccess as access, access.owningClassId == classState.classId and access.prepared and !some(spellAccess as earlier, earlier.owningClassId == classState.classId and earlier.prepared and earlier.spellId == access.spellId and earlier.sequence < access.sequence)), #.spellId) })'
        }
      ]
    }
  }
]

export const dnd5e2014CharacterSpellPolicyOutputExpressions = [
  {
    id: 'spell-access-decisions',
    key: 'spellAccessDecisions',
    value: 'spellAccessDecisions'
  },
  { id: 'spell-access', key: 'spellAccess', value: 'spellAccess' },
  {
    id: 'class-spell-states',
    key: 'classSpellStates',
    value:
      'filter(resolvedClassSpellStates as state, len(state.learnedSpellIds) > 0 or len(state.preparedSpellIds) > 0)'
  }
]
