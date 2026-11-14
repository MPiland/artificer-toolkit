import { reactionTriggerRow } from '../../events/reactionTriggers.js'
import { unsupported, type Dnd5eCompiledEffectActionSource } from './effectActionContracts.js'

type Invocation = Dnd5eCompiledEffectActionSource['compiledEffect']['invocation']

/**
 * How an Effect action is taken, apart from what it targets, tests or leaves behind (ADR 0039
 * decision 1). A free option is `charged` when its Feature charge is its cost (a Legendary Action
 * option); an uncharged free action is bounded by its holder alone, which the composition checks.
 */
export type Dnd5eActivation = Readonly<{
  code: 'ACTION' | 'BONUS_ACTION' | 'REACTION' | 'FREE'
  charged: boolean
}>

/**
 * The activation aspect: one action, bonus action or reaction, or a free action. A reaction is
 * offered only by a registered trigger's pending decision, never taken directly.
 */
export function compileDnd5eActivation(invocation: Invocation): Dnd5eActivation {
  if (invocation.kind !== 'ACTION') unsupported('D&D Effect is not an activated action.')
  const { activation } = invocation
  if (activation.code === 'FREE')
    return { code: 'FREE', charged: invocation.resourceUse !== undefined }
  if (activation.amount !== 1)
    unsupported('D&D action activation must take exactly one action, bonus action or reaction.')
  if (activation.code === 'REACTION' && reactionTriggerRow(invocation) === null)
    unsupported('D&D reaction must name a registered trigger.')
  return { code: activation.code, charged: false }
}
