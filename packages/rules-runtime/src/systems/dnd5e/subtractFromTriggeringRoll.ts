import { rolledDiePayloadDtoSchema } from '@artificer-toolkit/schema/grants/modifier'

import { scaledRolledDieFaces } from '../../scalingRowSelection.js'
import { dnd5eResolvedProposalTrace } from './dnd5eTestOperationKeys.js'

/** The D&D operation a `SUBTRACT_FROM_TRIGGERING_ROLL` outcome (Cutting Words) compiles to. */
export const DND5E_SUBTRACT_FROM_TRIGGERING_ROLL_PROPOSAL_OPERATION_KEY =
  'dnd5e.subtract-from-triggering-roll-proposal'

/** The size of the die the outcome rolls, which the use binds from its holder's class levels. */
export const DND5E_TRIGGERING_ROLL_DIE_FACES_FACT_KEY = 'dnd5e.triggering-roll-die-faces'

/** The prefix of the graph nodes that roll the outcome's die, one evidence request per die. */
export const DND5E_TRIGGERING_ROLL_DICE_NODE_PREFIX = 'triggering-roll-'

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

const TRIGGERING_ROLL_DIE_NODE = new RegExp(`^${DND5E_TRIGGERING_ROLL_DICE_NODE_PREFIX}die-\\d+$`)

/**
 * The die a committed reaction execution rolled against the roll it answered: its size and the faces
 * it rolled. Null when the execution did not resolve the subtract outcome or rolled no die for it.
 */
export function executionTriggeringRollSubtraction(execution: {
  evidence: {
    trace: readonly {
      nodeId: string
      operation: { key: string }
      inputs: Readonly<Record<string, unknown>>
      outputs: Readonly<Record<string, unknown>>
    }[]
  }
}): { faces: number; rolledFaces: number[] } | null {
  const { trace } = execution.evidence
  if (
    dnd5eResolvedProposalTrace(
      trace,
      DND5E_SUBTRACT_FROM_TRIGGERING_ROLL_PROPOSAL_OPERATION_KEY
    ) === undefined
  )
    return null
  const dice = trace.filter(({ nodeId }) => TRIGGERING_ROLL_DIE_NODE.test(nodeId))
  const faces = dice[0]?.inputs.max
  const rolledFaces = dice.map(({ outputs }) => outputs.value)
  if (
    typeof faces !== 'number' ||
    dice.some(({ inputs }) => inputs.max !== faces) ||
    !rolledFaces.every((face): face is number => typeof face === 'number')
  )
    return null
  return { faces, rolledFaces }
}
