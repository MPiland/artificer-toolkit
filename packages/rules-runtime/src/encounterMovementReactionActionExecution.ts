import type {
  ServerCompletedRuleExecutionDto,
  ServerPublishedRuleDefinitionDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { CharacterRuleActionSystemAdapter } from './characterRuleActionSystemAdapter.js'
import { EncounterValidationError } from './encounterErrors.js'

export interface PreparedEncounterMovementReactionAction {
  adapter: CharacterRuleActionSystemAdapter
  published: ServerPublishedRuleDefinitionDto
  actionMechanic: Readonly<Record<string, unknown>>
  movementInterruption?: null | { kind: 'STOP'; whenResultPath: string }
  sourceDerivedFacts: Readonly<Record<string, unknown>>
  sourceHitPoints?: { current: number; maximum: number } | null
  target: {
    actorId: string
    currentHitPoints: number
    temporaryHitPoints: number
    maximumHitPoints: number
    scalarValues: Readonly<Record<string, number>>
    conditionIds: readonly string[]
    derivedFacts: Readonly<Record<string, unknown>>
    defenses: readonly {
      kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'
      damageTypeId: string
    }[]
    conditionImmunityIds: readonly string[]
  }
}

export function bindMovementInterruption(input: {
  execution: ServerCompletedRuleExecutionDto
  binding: PreparedEncounterMovementReactionAction['movementInterruption']
}): ServerCompletedRuleExecutionDto {
  if (input.binding === null || input.binding === undefined)
    return { ...input.execution, movementInterruption: null }
  if (typeof input.execution.outputs.movementInterruption !== 'boolean') {
    throw new EncounterValidationError('The movement interruption output is invalid.')
  }
  return {
    ...input.execution,
    movementInterruption: input.execution.outputs.movementInterruption ? { kind: 'STOP' } : null
  }
}
