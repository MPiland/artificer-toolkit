import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

type SpellAccessOutput = Pick<
  CharacterRulePolicyOutput,
  'spellAccess' | 'spellAccessDecisions' | 'classSpellStates'
>

function denialReason(
  candidate: CharacterRulePolicyInput['spellAccessCandidates'][number]
): CharacterRulePolicyOutput['spellAccessDecisions'][number]['reasonCode'] {
  if (candidate.inheritedFeatureDuplicate) return 'INHERITED_FEATURE_DUPLICATE'
  if (candidate.activeSourceLevel < candidate.featureAvailableAtLevel) return 'SOURCE_LEVEL_LOCKED'
  if (
    (candidate.sourceKind === 'CLASS' || candidate.sourceKind === 'SUBCLASS') &&
    candidate.specializationRestrictionIds !== null &&
    (candidate.specializationId === null ||
      !candidate.specializationRestrictionIds.includes(candidate.specializationId))
  ) {
    return 'SPECIALIZATION_MISMATCH'
  }
  if (
    candidate.scalingKind === 'PER_LEVEL' &&
    (candidate.sourceKind === 'RACE' || candidate.sourceKind === 'SUBRACE') &&
    candidate.scalingSource !== 'CHARACTER_LEVEL'
  ) {
    return 'UNSUPPORTED_SCALING_SOURCE'
  }
  const progressionLevel =
    candidate.scalingSource === 'CHARACTER_LEVEL' ? candidate.totalLevel : candidate.classLevel
  if (
    candidate.scalingKind === 'PER_LEVEL' &&
    candidate.progressionLevel !== null &&
    progressionLevel !== null &&
    candidate.progressionLevel > progressionLevel
  ) {
    return 'PROGRESSION_LEVEL_LOCKED'
  }
  if (
    (candidate.selectionKind === 'CHOSEN' && !candidate.selectedByCharacter) ||
    (candidate.selectionKind === 'GRANTED' && candidate.authoringMode !== 'SELECTED')
  ) {
    return 'TARGET_NOT_SELECTED'
  }
  return 'ACCESS_GRANTED'
}

export function evaluateDnd5eCharacterSpellAccess(
  input: CharacterRulePolicyInput
): SpellAccessOutput {
  const decisions = input.spellAccessCandidates.map((candidate) => {
    const reasonCode = denialReason(candidate)
    const duplicate = input.spellAccessCandidates.some(
      (earlier) =>
        earlier.sequence < candidate.sequence &&
        earlier.accessId === candidate.accessId &&
        denialReason(earlier) === 'ACCESS_GRANTED'
    )
    return {
      candidate,
      status:
        reasonCode === 'ACCESS_GRANTED' && !duplicate
          ? ('INCLUDED' as const)
          : ('EXCLUDED' as const),
      reasonCode:
        reasonCode === 'ACCESS_GRANTED' && duplicate ? ('DUPLICATE_ACCESS_ID' as const) : reasonCode
    }
  })
  const spellAccessDecisions = decisions.map((decision) => ({
    sequence: decision.candidate.sequence,
    accessId: decision.candidate.accessId,
    status: decision.status,
    reasonCode: decision.reasonCode
  }))
  const spellAccess = decisions
    .filter((decision) => decision.status === 'INCLUDED')
    .map(({ candidate }) => ({
      sequence: candidate.sequence,
      accessId: candidate.accessId,
      sourceInstanceId: candidate.sourceInstanceId,
      spellId: candidate.spellId,
      sourceFeatureId: candidate.sourceFeatureId,
      grantId: candidate.grantId,
      sourceKind: candidate.sourceKind,
      sourceId: candidate.sourceId,
      owningClassId: candidate.owningClassId,
      timingKind:
        candidate.owningClassId === null ? ('CHARACTER_LEVEL' as const) : ('CLASS_LEVEL' as const),
      timingLevel: candidate.activeSourceLevel,
      attributes: candidate.attributes,
      acquisition: candidate.attributes.includes('PREPARED')
        ? ('ALWAYS_PREPARED' as const)
        : candidate.attributes.includes('KNOWN')
          ? ('KNOWN' as const)
          : ('GRANTED' as const),
      castMode: candidate.attributes.includes('LIMITED_USE')
        ? ('LIMITED_USE' as const)
        : candidate.attributes.includes('CAST_AT_WILL')
          ? ('AT_WILL' as const)
          : candidate.attributes.includes('CAST_AT_LEVEL')
            ? ('FIXED_LEVEL' as const)
            : candidate.attributes.includes('RITUAL')
              ? ('RITUAL' as const)
              : ('SPELL_SLOT' as const),
      castAtLevel: candidate.castAtLevel,
      castingAbility: candidate.castingAbility,
      charge: candidate.charge,
      learned: candidate.attributes.includes('KNOWN') || !candidate.attributes.includes('PREPARED'),
      prepared: candidate.attributes.includes('PREPARED')
    }))
  const classSpellStates = input.spellClasses
    .map((classState) => {
      const learnedSpellIds = spellAccess
        .filter(
          (access) =>
            access.owningClassId === classState.classId &&
            access.learned &&
            !spellAccess.some(
              (earlier) =>
                earlier.owningClassId === classState.classId &&
                earlier.learned &&
                earlier.spellId === access.spellId &&
                earlier.sequence < access.sequence
            )
        )
        .map((access) => access.spellId)
      const preparedSpellIds = spellAccess
        .filter(
          (access) =>
            access.owningClassId === classState.classId &&
            access.prepared &&
            !spellAccess.some(
              (earlier) =>
                earlier.owningClassId === classState.classId &&
                earlier.prepared &&
                earlier.spellId === access.spellId &&
                earlier.sequence < access.sequence
            )
        )
        .map((access) => access.spellId)
      return { classId: classState.classId, learnedSpellIds, preparedSpellIds }
    })
    .filter((state) => state.learnedSpellIds.length > 0 || state.preparedSpellIds.length > 0)
  return { spellAccess, spellAccessDecisions, classSpellStates }
}
