function activeSpellLimits(source: string, classState: string): string {
  return `filter(${source}.spellLimits as limit, limit.classLevel <= ${classState}.classLevel)`
}

function selectedSpellLimit(source: string, classState: string): string {
  const activeLimits = activeSpellLimits(source, classState)
  return `filter(${activeLimits} as limit, limit.classLevel == max(map(${activeLimits}, #.classLevel)))[0]`
}

function classLevelMethodAmount(source: string, classState: string): string {
  return `${source}.prepareLimit.scaling == "HALF" ? (${source}.prepareLimit.rounding == "UP" ? ceil(${classState}.classLevel / 2) : ${source}.prepareLimit.rounding == "NEAREST" ? round(${classState}.classLevel / 2) : floor(${classState}.classLevel / 2)) : ${source}.prepareLimit.scaling == "DOUBLE" ? ${classState}.classLevel * 2 : ${classState}.classLevel`
}

function perLevelMethodAmount(source: string, classState: string): string {
  const activeRows = `filter(${source}.prepareLimit.perLevel as row, row.classLevel <= ${classState}.classLevel)`
  return `len(${activeRows}) == 0 ? 0 : filter(${activeRows} as row, row.classLevel == max(map(${activeRows}, #.classLevel)))[0].amount`
}

function formulaPreparedSpellLimit(source: string, classState: string): string {
  const abilityModifier = `${source}.abilityIndex == null or ${source}.abilityIndex >= len(resolvedDerivedAbilities) ? 0 : resolvedDerivedAbilities[${source}.abilityIndex].modifier.effective`
  return `${source}.prepareLimit == null ? null : max([1, sum(map(${source}.prepareLimit.methodKinds as method, method == "SPELLCASTING_ABILITY" ? (${abilityModifier}) : method == "CLASS_LEVEL" ? (${classLevelMethodAmount(source, classState)}) : method == "PER_LEVEL" ? (${perLevelMethodAmount(source, classState)}) : 0))])`
}

function preparedSpellLimit(source: string, classState: string): string {
  const activeLimits = activeSpellLimits(source, classState)
  const selectedLimit = selectedSpellLimit(source, classState)
  return `len(${activeLimits}) > 0 and (${selectedLimit}).preparedSpellsLimit != null ? (${selectedLimit}).preparedSpellsLimit : (${formulaPreparedSpellLimit(source, classState)})`
}

function maximumPreparableSpellLevel(source: string, classState: string): string {
  const activeLimits = activeSpellLimits(source, classState)
  const selectedLimit = selectedSpellLimit(source, classState)
  return `len(${activeLimits}) == 0 or len((${selectedLimit}).spellLevels) == 0 ? 0 : max((${selectedLimit}).spellLevels)`
}

const preparationCapable =
  'some(source.attributes, # == "PREPARES_SPELLS") or source.prepareLimit != null or some(source.spellLimits as limit, limit.preparedSpellsLimit != null and limit.preparedSpellsLimit > 0)'

const calculatedSource = `{
  sourceId: source.sourceId,
  sourceKind: source.sourceKind,
  preparationCapable: ${preparationCapable},
  preparedSpellLimit: ${preparedSpellLimit('source', 'classState')},
  maxPreparableSpellLevel: ${maximumPreparableSpellLevel('source', 'classState')}
}`.replace(/\s+/g, ' ')

const capableSources = 'filter(classState.sources as source, source.preparationCapable)'
const preparedLimits = 'filter(classState.sources as source, source.preparedSpellLimit != null)'
const maximumClassSpellLevel = `len(${capableSources}) == 0 ? 0 : max(map(${capableSources}, #.maxPreparableSpellLevel))`
const classSourceIds = 'map(classState.sources, #.sourceId)'
const capableSourceIds = `map(${capableSources}, #.sourceId)`
const effectiveLearnedSpellIds =
  'classState.learnedStatePresent ? classState.learnedStateSpellIds : classState.intentSpellIds'
const seedSpellMatches = `some((${effectiveLearnedSpellIds}), # == spell.spellId) or some(classState.intentSpellIds, # == spell.spellId) or some(classState.preparedStateSpellIds, # == spell.spellId)`
const sourceMatches = `some(spell.classIds as spellClassId, some((${classSourceIds}), # == spellClassId))`
const fullListMatches = `spell.spellLevel > 0 and spell.spellLevel <= (${maximumClassSpellLevel}) and some(spell.classIds as spellClassId, some((${capableSourceIds}), # == spellClassId))`
const availableSpellIds = `map(filter(spellPreparationCatalog as spell, (${sourceMatches}) and ((${seedSpellMatches}) or (${fullListMatches}))), #.spellId)`
const learnedSpellIds = `map(filter(spellPreparationCatalog as spell, (${sourceMatches}) and some((${effectiveLearnedSpellIds}), # == spell.spellId)), #.spellId)`

export const dnd5e2014CharacterSpellPreparationPolicyNodes = [
  {
    id: 'spell-preparation-source-calculations',
    type: 'expressionNode',
    name: 'Spell preparation sources',
    position: { x: 1980, y: 300 },
    content: {
      passThrough: true,
      inputField: null,
      outputPath: null,
      executionMode: 'single',
      expressions: [
        {
          id: 'source-calculations',
          key: 'resolvedSpellPreparationClasses',
          value: `map(spellPreparationClasses as classState, { classId: classState.classId, classLevel: classState.classLevel, learnedStatePresent: classState.learnedStatePresent, learnedStateSpellIds: classState.learnedStateSpellIds, intentSpellIds: classState.intentSpellIds, preparedStateSpellIds: classState.preparedStateSpellIds, sources: map(classState.sources as source, ${calculatedSource}) })`
        }
      ]
    }
  },
  {
    id: 'spell-preparation-state',
    type: 'expressionNode',
    name: 'Spell preparation state',
    position: { x: 2160, y: 300 },
    content: {
      passThrough: true,
      inputField: null,
      outputPath: null,
      executionMode: 'single',
      expressions: [
        {
          id: 'candidates',
          key: 'spellPreparationCandidates',
          value: `map(resolvedSpellPreparationClasses as classState, { classId: classState.classId, sourceIds: ${capableSourceIds}, preparedSpellLimit: len(${preparedLimits}) == 0 ? null : max(map(${preparedLimits}, #.preparedSpellLimit)), maxPreparableSpellLevel: ${maximumClassSpellLevel}, availableSpellIds: ${availableSpellIds}, learnedSpellIds: ${learnedSpellIds}, preparedStateSpellIds: classState.preparedStateSpellIds })`
        },
        {
          id: 'sources',
          key: 'spellPreparationSources',
          value:
            'map(filter($.spellPreparationCandidates as candidate, len(candidate.sourceIds) > 0) as candidate, { classId: candidate.classId, sourceIds: candidate.sourceIds, preparedSpellLimit: candidate.preparedSpellLimit, maxPreparableSpellLevel: candidate.maxPreparableSpellLevel, availableSpellIds: candidate.availableSpellIds, learnedSpellIds: candidate.learnedSpellIds, preparedSpellIds: filter(candidate.preparedStateSpellIds as spellId, some(candidate.availableSpellIds, # == spellId)) })'
        }
      ]
    }
  },
  {
    id: 'spell-preparation-request',
    type: 'expressionNode',
    name: 'Spell preparation request',
    position: { x: 2340, y: 300 },
    content: {
      passThrough: true,
      inputField: null,
      outputPath: null,
      executionMode: 'single',
      expressions: [
        {
          id: 'active-class',
          key: 'preparationRequestClassActive',
          value:
            'spellPreparationRequest == null ? false : some(spellPreparationClasses, #.classId == spellPreparationRequest.classId)'
        },
        {
          id: 'source',
          key: 'preparationRequestSource',
          value:
            'spellPreparationRequest == null or len(filter(spellPreparationSources, #.classId == spellPreparationRequest.classId)) == 0 ? null : filter(spellPreparationSources, #.classId == spellPreparationRequest.classId)[0]'
        },
        {
          id: 'unavailable-spell',
          key: 'preparationRequestUnavailableSpellId',
          value:
            'spellPreparationRequest == null or $.preparationRequestSource == null or len(filter(spellPreparationRequest.spellIds as spellId, !some($.preparationRequestSource.availableSpellIds, # == spellId))) == 0 ? null : filter(spellPreparationRequest.spellIds as spellId, !some($.preparationRequestSource.availableSpellIds, # == spellId))[0]'
        },
        {
          id: 'decision',
          key: 'spellPreparationRequestDecision',
          value:
            'spellPreparationRequest == null ? null : { classId: spellPreparationRequest.classId, requestedSpellIds: spellPreparationRequest.spellIds, status: !$.preparationRequestClassActive or ($.preparationRequestSource == null and len(spellPreparationRequest.spellIds) > 0) or ($.preparationRequestSource != null and $.preparationRequestSource.preparedSpellLimit != null and len(spellPreparationRequest.spellIds) > $.preparationRequestSource.preparedSpellLimit) or $.preparationRequestUnavailableSpellId != null ? "REJECTED" : "ALLOWED", reasonCode: !$.preparationRequestClassActive ? "CLASS_NOT_ACTIVE" : $.preparationRequestSource == null and len(spellPreparationRequest.spellIds) > 0 ? "CLASS_DOES_NOT_PREPARE_SPELLS" : $.preparationRequestSource != null and $.preparationRequestSource.preparedSpellLimit != null and len(spellPreparationRequest.spellIds) > $.preparationRequestSource.preparedSpellLimit ? "PREPARATION_LIMIT_EXCEEDED" : $.preparationRequestUnavailableSpellId != null ? "SPELL_NOT_AVAILABLE" : "REQUEST_ALLOWED", unavailableSpellId: $.preparationRequestUnavailableSpellId }'
        }
      ]
    }
  }
]

export const dnd5e2014CharacterSpellPreparationPolicyOutputExpressions = [
  {
    id: 'spell-preparation',
    key: 'spellPreparation',
    value: '{ sources: spellPreparationSources, requestDecision: spellPreparationRequestDecision }'
  }
]
