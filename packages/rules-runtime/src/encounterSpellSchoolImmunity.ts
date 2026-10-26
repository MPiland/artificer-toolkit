import type { MovementTarget } from './encounterMovementTargets.js'
import type { NativeEncounterActionSource } from './encounterActionSources.js'

/**
 * Whether the target is immune to this action: a Character's spell of a school the target holds
 * `SPELL_SCHOOL_IMMUNITY` against has no effect on it (Mind Blank's divination clause). A
 * Creature's spell actions carry no school, so they are never gated.
 */
export function encounterSpellSchoolImmunity(input: {
  source:
    | Pick<
        Extract<
          NativeEncounterActionSource,
          { kind: 'CREATURE' | 'BASIC_ACTION' | 'REPEAT_PATH' | 'RULE' }
        >,
        'kind'
      >
    | {
        kind: 'CHARACTER_ACTION'
        candidate: Pick<
          Extract<NativeEncounterActionSource, { kind: 'CHARACTER_ACTION' }>['candidate'],
          'mechanicsOwner'
        >
      }
  sourceFacts: Pick<MovementTarget, 'characterSpellCast'>
  target: Pick<MovementTarget, 'spellSchoolImmunityIds'>
}): boolean {
  const { source } = input
  if (source.kind !== 'CHARACTER_ACTION' || source.candidate.mechanicsOwner.kind !== 'SPELL')
    return false
  const schoolId = input.sourceFacts.characterSpellCast?.magicSchoolIdBySpellId.get(
    source.candidate.mechanicsOwner.id
  )
  return schoolId !== undefined && input.target.spellSchoolImmunityIds.includes(schoolId)
}
