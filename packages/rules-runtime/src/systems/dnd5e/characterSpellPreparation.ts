import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

type DerivedStats = Omit<CharacterRulePolicyOutput['derivedStats'], 'armorClass' | 'maxHitPoints'>
type PreparationOutput = CharacterRulePolicyOutput['spellPreparation']
type PreparationClass = CharacterRulePolicyInput['spellPreparationClasses'][number]
type PreparationSource = PreparationClass['sources'][number]

function abilityModifier(derivedStats: DerivedStats, index: number | null): number {
  if (index === null || index < 0 || index >= derivedStats.abilities.length) return 0
  return derivedStats.abilities[index]?.modifier.effective ?? 0
}

function classLevelAmount(source: PreparationSource, classState: PreparationClass): number {
  const prepareLimit = source.prepareLimit
  if (prepareLimit === null || prepareLimit.scaling === 'HALF') {
    const halfLevel = classState.classLevel / 2
    if (prepareLimit?.rounding === 'UP') return Math.ceil(halfLevel)
    if (prepareLimit?.rounding === 'NEAREST') return Math.round(halfLevel)
    return Math.floor(halfLevel)
  }
  return prepareLimit.scaling === 'DOUBLE' ? classState.classLevel * 2 : classState.classLevel
}

function perLevelAmount(source: PreparationSource, classState: PreparationClass): number {
  const activeRows = source.prepareLimit?.perLevel.filter(
    (row) => row.classLevel <= classState.classLevel
  )
  if (activeRows === undefined || activeRows.length === 0) return 0
  const level = Math.max(...activeRows.map((row) => row.classLevel))
  return activeRows.find((row) => row.classLevel === level)?.amount ?? 0
}

function preparedLimit(
  source: PreparationSource,
  classState: PreparationClass,
  derivedStats: DerivedStats
): number | null {
  const activeLimits = source.spellLimits.filter(
    (limit) => limit.classLevel <= classState.classLevel
  )
  if (activeLimits.length > 0) {
    const level = Math.max(...activeLimits.map((limit) => limit.classLevel))
    const selected = activeLimits.find((limit) => limit.classLevel === level)
    if (selected?.preparedSpellsLimit !== null && selected?.preparedSpellsLimit !== undefined)
      return selected.preparedSpellsLimit
  }
  if (source.prepareLimit === null) return null
  const total = source.prepareLimit.methodKinds.reduce((sum, method) => {
    if (method === 'SPELLCASTING_ABILITY')
      return sum + abilityModifier(derivedStats, source.abilityIndex)
    if (method === 'CLASS_LEVEL') return sum + classLevelAmount(source, classState)
    return sum + perLevelAmount(source, classState)
  }, 0)
  return Math.max(1, total)
}

function maximumPreparableSpellLevel(
  source: PreparationSource,
  classState: PreparationClass
): number {
  const activeLimits = source.spellLimits.filter(
    (limit) => limit.classLevel <= classState.classLevel
  )
  if (activeLimits.length === 0) return 0
  const level = Math.max(...activeLimits.map((limit) => limit.classLevel))
  const selected = activeLimits.find((limit) => limit.classLevel === level)
  return selected === undefined || selected.spellLevels.length === 0
    ? 0
    : Math.max(...selected.spellLevels)
}

export function evaluateDnd5eCharacterSpellPreparation(
  input: CharacterRulePolicyInput,
  derivedStats: DerivedStats
): PreparationOutput {
  const sources = input.spellPreparationClasses
    .map((classState) => {
      const calculatedSources = classState.sources.map((source) => ({
        sourceId: source.sourceId,
        preparationCapable:
          source.attributes.includes('PREPARES_SPELLS') ||
          source.prepareLimit !== null ||
          source.spellLimits.some(
            (limit) => limit.preparedSpellsLimit !== null && limit.preparedSpellsLimit > 0
          ),
        preparedSpellLimit: preparedLimit(source, classState, derivedStats),
        maxPreparableSpellLevel: maximumPreparableSpellLevel(source, classState)
      }))
      const capableSources = calculatedSources.filter((source) => source.preparationCapable)
      const preparedLimits = capableSources.filter((source) => source.preparedSpellLimit !== null)
      const maxPreparableSpellLevel =
        capableSources.length === 0
          ? 0
          : Math.max(...capableSources.map((source) => source.maxPreparableSpellLevel))
      const sourceIds = classState.sources.map((source) => source.sourceId)
      const capableSourceIds = capableSources.map((source) => source.sourceId)
      const effectiveLearnedSpellIds = classState.learnedStatePresent
        ? classState.learnedStateSpellIds
        : classState.intentSpellIds
      const availableSpellIds = input.spellPreparationCatalog
        .filter(
          (spell) =>
            spell.classIds.some((classId) => sourceIds.includes(classId)) &&
            (effectiveLearnedSpellIds.includes(spell.spellId) ||
              classState.intentSpellIds.includes(spell.spellId) ||
              classState.preparedStateSpellIds.includes(spell.spellId) ||
              (spell.spellLevel > 0 &&
                spell.spellLevel <= maxPreparableSpellLevel &&
                spell.classIds.some((classId) => capableSourceIds.includes(classId))))
        )
        .map((spell) => spell.spellId)
      const learnedSpellIds = input.spellPreparationCatalog
        .filter(
          (spell) =>
            spell.classIds.some((classId) => sourceIds.includes(classId)) &&
            effectiveLearnedSpellIds.includes(spell.spellId)
        )
        .map((spell) => spell.spellId)
      const preparedSpellLimit =
        preparedLimits.length === 0
          ? null
          : Math.max(...preparedLimits.map((source) => source.preparedSpellLimit!))
      return {
        classId: classState.classId,
        sourceIds,
        preparedSpellLimit,
        maxPreparableSpellLevel,
        availableSpellIds,
        learnedSpellIds,
        preparedSpellIds: classState.preparedStateSpellIds.filter((spellId) =>
          availableSpellIds.includes(spellId)
        )
      }
    })
    .filter(
      (source) =>
        source.sourceIds.length > 0 &&
        (source.preparedSpellLimit !== null ||
          source.learnedSpellIds.length > 0 ||
          source.preparedSpellIds.length > 0)
    )
  const request = input.spellPreparationRequest
  if (request === null) return { sources, requestDecision: null }
  const classActive = input.spellPreparationClasses.some(
    (entry) => entry.classId === request.classId
  )
  const requestSource = sources.find((source) => source.classId === request.classId)
  const unavailableSpellId =
    requestSource === undefined
      ? null
      : (request.spellIds.find((spellId) => !requestSource.availableSpellIds.includes(spellId)) ??
        null)
  const rejectedWithoutPreparation =
    (requestSource === undefined || requestSource.preparedSpellLimit === null) &&
    request.spellIds.length > 0
  const limitExceeded =
    requestSource !== undefined &&
    requestSource.preparedSpellLimit !== null &&
    request.spellIds.length > requestSource.preparedSpellLimit
  const reasonCode = !classActive
    ? 'CLASS_NOT_ACTIVE'
    : rejectedWithoutPreparation
      ? 'CLASS_DOES_NOT_PREPARE_SPELLS'
      : limitExceeded
        ? 'PREPARATION_LIMIT_EXCEEDED'
        : unavailableSpellId !== null
          ? 'SPELL_NOT_AVAILABLE'
          : 'REQUEST_ALLOWED'
  return {
    sources,
    requestDecision: {
      classId: request.classId,
      requestedSpellIds: request.spellIds,
      status: reasonCode === 'REQUEST_ALLOWED' ? 'ALLOWED' : 'REJECTED',
      reasonCode,
      unavailableSpellId:
        requestSource === undefined || requestSource.preparedSpellLimit === null
          ? null
          : unavailableSpellId
    }
  }
}
