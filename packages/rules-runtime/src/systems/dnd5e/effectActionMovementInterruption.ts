import {
  serverPublishedRuleDefinitionDtoSchema,
  type ServerPublishedRuleDefinitionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import {
  Dnd5eEffectActionCompilerError,
  type Dnd5eCompiledEffectActionSource,
  type TestKind
} from './effectActionContracts.js'
import { withMovementInterruption } from './effectActionTestPhase.js'

/**
 * A movement interruption is an explicit authored reaction binding.  The
 * compiler projects it into the graph so execution never infers it from an
 * action label, outcome, or system-specific branch.
 */
function movementInterruptionOf(action: Dnd5eCompiledEffectActionSource) {
  const { invocation } = action.compiledEffect
  const trigger = 'reactionTrigger' in invocation ? invocation.reactionTrigger : undefined
  return trigger?.kind === 'MOVEMENT' ? trigger.movementInterruption : null
}

export function bindMovementInterruptionTestOutput(input: {
  action: Dnd5eCompiledEffectActionSource
  published: ServerPublishedRuleDefinitionDto
  kind: TestKind
}): ServerPublishedRuleDefinitionDto {
  const binding = movementInterruptionOf(input.action)
  if (binding?.kind !== 'STOP') return input.published
  const allowedPaths =
    input.kind === 'ATTACK' ? ['ON_HIT', 'ON_MISS', 'ON_CRIT'] : ['ON_SAVE_FAIL', 'ON_SAVE_SUCCESS']
  if (
    !allowedPaths.includes(binding.whenResultPath) ||
    !input.action.compiledEffect.entries.some((entry) => entry.pathCode === binding.whenResultPath)
  )
    throw new Dnd5eEffectActionCompilerError(
      'Movement interruption must bind one exact authored D&D test path.'
    )
  return withMovementInterruption(input.published, binding.whenResultPath)
}

export function bindMovementInterruptionOutput(input: {
  action: Dnd5eCompiledEffectActionSource
  published: ServerPublishedRuleDefinitionDto
}): ServerPublishedRuleDefinitionDto {
  const binding = movementInterruptionOf(input.action)
  if (binding?.kind !== 'STOP') return input.published

  const proposalNodeId = `proposal-${binding.whenResultPath.toLowerCase()}`
  const proposal = input.published.definition.nodes.find((node) => node.id === proposalNodeId)
  if (
    !proposal ||
    proposal.inputs.authoredPath?.kind !== 'LITERAL' ||
    proposal.inputs.authoredPath.value !== binding.whenResultPath
  ) {
    throw new Dnd5eEffectActionCompilerError(
      'Movement interruption must bind one exact D&D test proposal path.'
    )
  }

  const definition: RuleGraphDefinition = {
    ...input.published.definition,
    outputs: {
      ...input.published.definition.outputs,
      movementInterruption: {
        kind: 'NODE_OUTPUT',
        nodeId: proposalNodeId,
        port: 'authorized'
      }
    }
  }
  return serverPublishedRuleDefinitionDtoSchema.parse({
    ...input.published,
    checksum: checksumRuleDocument(definition),
    definition
  })
}
