import type { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import { isInstalledSpellAttackTrigger } from './platformRulesRuntime.js'

/**
 * The level a prepared spell cast is cast at (0 for a cantrip); null when the action is not a spell
 * cast, so nothing can counter it. A Character's is the level of its cast. A Creature capability's is
 * its authored cast level; a spell attack casts no spell (D136).
 */
export function preparedSpellCastLevel(
  prepared: Pick<
    Awaited<ReturnType<typeof prepareEncounterActionMechanics>>,
    'source' | 'characterActionState'
  >
): number | null {
  if (prepared.source.kind === 'CREATURE') {
    return prepared.source.capability.spellCast?.castLevel ?? null
  }
  if (
    prepared.source.kind !== 'CHARACTER_ACTION' ||
    prepared.source.candidate.mechanicsOwner.kind !== 'SPELL'
  )
    return null
  return prepared.characterActionState?.actionMechanic.spellCastLevel ?? null
}

/** The spell attack bonus a Character's cast freezes into the attack repeats it offers (D166). */
export function preparedSpellAttackBonus(
  prepared: Pick<Awaited<ReturnType<typeof prepareEncounterActionMechanics>>, 'source'>
): number | undefined {
  return prepared.source.kind === 'CHARACTER_ACTION'
    ? prepared.source.effectivePolicyOutput.derivedStats.spellcasting?.attackBonus.effective
    : undefined
}

/**
 * Whether the prepared action is a spell cast, the fact `ON_CAST_SPELL` ends effects on. A Character
 * casts a spell; a Creature casts one when its action is triggered by a spell attack.
 */
export function preparedCastsSpell(
  prepared: Pick<
    Awaited<ReturnType<typeof prepareEncounterActionMechanics>>,
    'source' | 'characterActionState' | 'state'
  >
): boolean {
  if (preparedSpellCastLevel(prepared) !== null) return true
  if (prepared.source.kind !== 'CREATURE') return false
  const { capability } = prepared.source
  return (
    capability.spellCast != null ||
    isInstalledSpellAttackTrigger(
      prepared.state.gameSystemId,
      capability.mechanicFacts.invocation.triggerCode
    )
  )
}
