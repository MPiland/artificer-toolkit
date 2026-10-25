import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'
import { spellCastActionId } from './spellCastCandidates.js'

/**
 * Whether a declared-action initiative round refuses the action its current actor takes: the actor
 * declared its action and bonus action for the round, and an action that spends an allowance must be
 * one of them. A GM-adjudicated declaration names no executable option, so it permits none. Rounds of
 * every other procedure, and actors without a declaration, are not enforced.
 */
export function encounterActionUndeclared(input: {
  round: {
    round: Pick<EncounterInitiativeRoundStateDto['round'], 'procedure'>
    participants: readonly Pick<
      EncounterInitiativeRoundStateDto['participants'][number],
      'actorId' | 'declaration'
    >[]
  } | null
  actorId: string
  actionId: string
}): boolean {
  if (input.round?.round.procedure !== 'DECLARED_ACTION_ROLL') return false
  const declaration = input.round.participants.find(
    (participant) => participant.actorId === input.actorId
  )?.declaration
  if (!declaration) return false
  return ![declaration.primary, declaration.bonus].some(
    (source) =>
      source !== null &&
      source.kind !== 'GM_ADJUDICATED' &&
      (source.kind === 'CHARACTER_SPELL_CAST'
        ? spellCastActionId(source.optionId)
        : source.optionId) === input.actionId
  )
}
