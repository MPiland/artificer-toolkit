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
 * The holder's stored fixed-DC escape that a frozen check context was derived from, or null once the
 * effect has ended. Rejects a context whose DC, module, relationship outcome or chosen check the
 * stored effect does not carry: the room's plan is never trusted for the effect's own terms.
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
  const escape = findEncounterHolderEscape(effect)
  if (
    !escape ||
    escape.module.id !== context.escapeModuleId ||
    escape.relationshipOutcomeId !== context.relationshipOutcomeId ||
    escape.dc !== context.check.dc ||
    !(
      escape.module.checks.skillIds.includes(context.check.checkDefinitionId) ||
      escape.module.checks.abilityDefinitionIds.includes(context.check.checkDefinitionId)
    )
  )
    throw new Error(ESCAPE_EFFECT_MISMATCH)
  return escape
}

/**
 * Rejects a spent allowance that is not the one the escape's authored activation spends: the System
 * binds the activation to its capability, and a free activation or a Manual Run spends none.
 */
export function requireEscapeAllowance(
  state: Pick<EncounterRunState, 'gameSystemId' | 'automationMode'>,
  escape: StoredEscape,
  spent: { definitionId: string } | null
): void {
  const { activation } = escape.module
  const binding =
    activation.code === 'FREE'
      ? null
      : actionEconomyCapabilityRegistry.resolveActionEconomyCapability({
          gameSystemId: state.gameSystemId,
          activationKind: activation.code,
          activationAmount: activation.amount
        })
  const expected =
    binding?.kind === 'REQUIRED' && state.automationMode !== 'MANUAL'
      ? binding.capabilityDefinitionId
      : null
  if ((spent?.definitionId ?? null) !== expected) throw new Error(ESCAPE_EFFECT_MISMATCH)
}
