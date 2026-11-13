import { rolledDiePayloadDtoSchema } from '@artificer-toolkit/schema/grants/modifier'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

import { scaledRolledDieFaces } from '../../scalingRowSelection.js'
import { rolledDiceNodes } from './effectActionOutcomeNodes.js'
import {
  DND5E_TRIGGERING_ROLL_DICE_NODE_PREFIX,
  DND5E_TRIGGERING_ROLL_DIE_FACES_FACT_KEY
} from './subtractFromTriggeringRoll.js'

/**
 * The nodes that roll the die a reaction takes from the roll it answers (D219): the reactor is asked
 * for each die like any roll, and the room reads the faces back from the committed execution. None
 * for an Effect whose outcome is another.
 */
export function triggeringRollDiceNodes(compiledEffect: Pick<CompiledEffectGroup, 'entries'>) {
  const [entry] = compiledEffect.entries
  if (
    !entry ||
    !('outcome' in entry) ||
    entry.outcome.effectKind !== 'SUBTRACT_FROM_TRIGGERING_ROLL'
  )
    return []
  const { count, faces } = entry.outcome.die
  return rolledDiceNodes(
    { count, die: faces, modifier: 0 },
    DND5E_TRIGGERING_ROLL_DICE_NODE_PREFIX,
    {
      facesFactKey: DND5E_TRIGGERING_ROLL_DIE_FACES_FACT_KEY
    }
  ).nodes
}

/**
 * The die-size fact of a graph that rolls the outcome's die: the die the action's resolved outcome
 * authors, at the size its holder's class levels reach. Empty for a graph that rolls none.
 */
export function triggeringRollDieFacts(
  published: {
    definition: {
      nodes: readonly { inputs: Readonly<Record<string, { kind: string; factKey?: string }>> }[]
    }
  },
  actionOutcomes: unknown,
  classLevels: Readonly<Record<string, number>> | undefined
): Record<string, number> {
  const rollsDie = published.definition.nodes.some((node) =>
    Object.values(node.inputs).some(
      (binding) =>
        binding.kind === 'FACT' && binding.factKey === DND5E_TRIGGERING_ROLL_DIE_FACES_FACT_KEY
    )
  )
  if (!rollsDie) return {}
  const dice = (Array.isArray(actionOutcomes) ? actionOutcomes : []).flatMap((outcome: unknown) => {
    const die =
      outcome && typeof outcome === 'object' && 'rolledDie' in outcome
        ? rolledDiePayloadDtoSchema.safeParse(outcome.rolledDie)
        : null
    return die?.success ? [die.data] : []
  })
  const [die] = dice
  if (!die || dice.length !== 1)
    throw new Error('D&D subtract-from-triggering-roll action requires one exact resolved die.')
  return {
    [DND5E_TRIGGERING_ROLL_DIE_FACES_FACT_KEY]: scaledRolledDieFaces(die, classLevels ?? {})
  }
}
