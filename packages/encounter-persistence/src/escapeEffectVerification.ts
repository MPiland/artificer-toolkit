import type { LiveSessionEncounterEscapeResponseCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { actionEconomyCapabilityRegistry } from '@artificer-toolkit/rules-runtime/actionEconomyCapabilityRegistry.default'
import { findEncounterHolderEscape } from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterWriteContext } from './store.js'

export const ESCAPE_EFFECT_MISMATCH = "Live Session escape differs from the holder's effect."

type EscapeContext = LiveSessionEncounterEscapeResponseCommitInput['settlement']['context']
export type StoredEscape = NonNullable<ReturnType<typeof findEncounterHolderEscape>>

/**
 * The held creature's stored fixed-DC escape that a frozen check context was derived from, or null
 * once the effect has ended. `holder` is the creature carrying the effect: the context's actor, or
 * its `heldActorId` when a rescuer rolls. Rejects a context whose DC, escape source or chosen check
 * the stored effect does not carry for that roller: the room's plan is never trusted for the
 * effect's own terms.
 */
export async function findStoredEscape(
  ctx: EncounterWriteContext,
  input: {
    encounterId: string
    holder: Pick<EncounterRunActorState, 'id' | 'kind' | 'sourceId'>
    context: EscapeContext
  }
): Promise<StoredEscape | null> {
  const { context } = input
  const effect = await createActiveRuleEffectStore(ctx).findById(
    turnEffectOwner(input.holder, input.encounterId),
    context.activeEffectId
  )
  if (!effect) return null
  const escape = findEncounterHolderEscape(
    effect,
    context.heldActorId ? 'CREATURE_WITHIN_REACH' : 'TARGET'
  )
  if (
    !escape ||
    escape.escapeSourceId !== context.escapeSourceId ||
    escape.dc !== context.check.dc ||
    !(
      escape.checks.skillIds.includes(context.check.checkDefinitionId) ||
      escape.checks.abilityDefinitionIds.includes(context.check.checkDefinitionId)
    )
  )
    throw new Error(ESCAPE_EFFECT_MISMATCH)
  return escape
}

/**
 * Whether a spent allowance is the one the activation spends: the System binds the activation to
 * its capability, and a free activation spends none. Both callers admit Assisted Runs only.
 */
export function activationAllowanceMatches(
  state: Pick<EncounterRunState, 'gameSystemId'>,
  activation: { code: 'FREE' } | { code: string; amount: number },
  spent: { definitionId: string } | null
): boolean {
  const binding = !('amount' in activation)
    ? null
    : actionEconomyCapabilityRegistry.resolveActionEconomyCapability({
        gameSystemId: state.gameSystemId,
        activationKind: activation.code,
        activationAmount: activation.amount
      })
  const expected = binding?.kind === 'REQUIRED' ? binding.capabilityDefinitionId : null
  return (spent?.definitionId ?? null) === expected
}

/** Rejects a spent allowance that is not the one the escape's authored activation spends. */
export function requireEscapeAllowance(
  state: Pick<EncounterRunState, 'gameSystemId'>,
  escape: StoredEscape,
  spent: { definitionId: string } | null
): void {
  if (!activationAllowanceMatches(state, escape.activation, spent))
    throw new Error(ESCAPE_EFFECT_MISMATCH)
}
