import { endCarriedGrantsOfConcentratingCasters } from '@artificer-toolkit/encounter-persistence/characterRunEffects'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { CharacterSheetCommandError } from '@artificer-toolkit/rules-runtime/character/sheetCommandError'
import { planConcentrationCarriedGrantEnds } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import type { MutationCtx } from '../_generated/server'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { readFightingCharacterIds } from '../encounters/runGrantCarryOver'

/**
 * SPELLS-5.11: the caster ends the Concentration whose grants a finished Run carried onto the
 * Campaign clock. Every grant stamped with the caster ends; the caster's own is deleted here for the
 * Sheet write to settle, and each other holder's stream moves once. Throws when nothing is carried
 * and the Sheet held no Concentration summon (D190) for the same command to end.
 * The caster's `concentrationCasterCharacterId` stamp lets a later checkpoint finish any holder this
 * call skipped.
 *
 * A holder in an ACTIVE Run belongs to that Run's room (Q1): Convex skips it, and the same user
 * action ends it through the room (`concentrationRoomRoute`) with the same command id. A caller that
 * skips the room leaves those grants to the next checkpoint (the safety net).
 */
export async function endCarriedConcentration(
  ctx: MutationCtx,
  input: {
    characterId: string
    campaignId: string | null
    occurredAt: string
    /** The command also ends a Concentration summon the Sheet holds. */
    endsSpellSummon: boolean
  }
): Promise<void> {
  const transaction = encounterWriteTransaction(ctx)
  const store = createActiveRuleEffectStore(transaction)
  const carried = planConcentrationCarriedGrantEnds({
    casterCharacterId: input.characterId,
    effects: await store.listCarriedByCaster(input.characterId)
  })
  if (carried.length === 0) {
    if (input.endsSpellSummon) return
    throw new CharacterSheetCommandError('This Character is not concentrating.')
  }
  const fighting = input.campaignId
    ? await readFightingCharacterIds(ctx, input.campaignId)
    : new Set<string>()
  for (const effect of carried)
    if (effect.owner.kind === 'CHARACTER' && effect.owner.characterId === input.characterId)
      await store.deleteCas({
        id: effect.id,
        owner: effect.owner,
        expectedVersion: effect.version,
        // Outside a Run no turn counts down, so nothing an effect would leave behind is left.
        removal: 'REMOVED'
      })
  await endCarriedGrantsOfConcentratingCasters(transaction, {
    encounterId: null,
    casterCharacterIds: [input.characterId],
    includesHolder: (characterId) =>
      characterId !== input.characterId && !fighting.has(characterId),
    occurredAt: input.occurredAt
  })
}
