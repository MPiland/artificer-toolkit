import { createEncounterRepository, type DBLike, type EncounterRecord } from '@artificer-toolkit/db'
import type { MovementReactionChoiceOptionDto } from '@artificer-toolkit/schema/shared/reaction'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionD20EvidenceDto,
  ServerRuleExecutionApplicationOutputsDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import { encounterRuleUsageUsed, withEncounterRuleUsageUsed } from './encounterActorState.js'
import type { LockedEncounterActiveEffectTargets } from './encounterActiveEffectTargetState.js'
import {
  prepareEncounterActionSettlementCore,
  settleEncounterActionSettlementCore,
  type PreparedEncounterActionSettlementCore
} from './encounterActionSettlementCore.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import type { EncounterMovementReactionActionSource } from './encounterMovementReactionSources.js'
import type { EncounterMovementReactionActionExecution } from './encounterMovementReactionActionExecution.js'

type CompleteActionExecution = Extract<
  EncounterMovementReactionActionExecution,
  { kind: 'COMPLETE' }
>
type LegendaryResistanceSettlementEvidence = {
  selectedIndex: 0 | 1
  use: boolean
  lifecycle: {
    definitionId: string
    definitionVersion: number
    definitionChecksum: string
    choiceGraphDefinitionId: string
    choiceGraphDefinitionVersion: number
    choiceGraphDefinitionChecksum: string
    useOutput: string
    interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME'
    replacement: 'SAVE_SUCCESS'
  }
  execution: ServerCompletedRuleExecutionDto
  originalD20: ServerRuleExecutionD20EvidenceDto
}

export interface PreparedEncounterMovementReactionSettlement extends PreparedEncounterActionSettlementCore {
  option: MovementReactionChoiceOptionDto
  movementInterruption: MovementReactionChoiceOptionDto['binding']['movementInterruption']
  allowance: {
    definitionId: string
    maximum: number
    beforeUsed: number
    afterUsed: number
  }
}

/** Movement-only target constraint; source/currentness and target state are core-owned. */
function requireReactionTargetPolicy(
  sourceActorId: string,
  targetActorId: string,
  action: EncounterMovementReactionActionSource
): void {
  const policy =
    action.kind === 'CHARACTER_ACTION'
      ? action.entry.targetPolicy
      : (() => {
          const invocation = action.capability.compiledEffect.invocation
          if (invocation.kind !== 'ACTION') return null
          return {
            shape: invocation.shape ?? null,
            pathOverrides: [],
            targeting: invocation.targeting ?? null
          }
        })()
  const targeting = policy?.targeting
  if (
    !policy ||
    policy.shape !== null ||
    policy.pathOverrides.length !== 0 ||
    !targeting ||
    targeting.selectionKind !== 'SINGLE_TARGET' ||
    targeting.dispositionKind === 'WILLING' ||
    (targeting.excludedCreatureTypeIds?.length ?? 0) !== 0 ||
    sourceActorId === targetActorId
  ) {
    throw new EncounterValidationError(
      'The selected reaction action cannot target the moving actor.'
    )
  }
}

export async function prepareEncounterMovementReactionSettlement(input: {
  db: DBLike
  actorUserId: string
  automationMode: 'AUTOMATIC' | 'ASSISTED'
  encounter: EncounterRecord
  option: MovementReactionChoiceOptionDto
  actionSource: EncounterMovementReactionActionSource
  targets: LockedEncounterActiveEffectTargets
}): Promise<PreparedEncounterMovementReactionSettlement> {
  const sourceActor = input.encounter.actors.find(
    (actor) => actor.id === input.actionSource.actorId
  )
  const targetActor = input.encounter.actors.find(
    (actor) => actor.id === input.option.candidate.movingActorId
  )
  if (!sourceActor || !targetActor) {
    throw new EncounterConflictError('The selected reaction action source or target is stale.')
  }
  requireReactionTargetPolicy(sourceActor.id, targetActor.id, input.actionSource)
  const prepared = await prepareEncounterActionSettlementCore({
    db: input.db,
    actorUserId: input.actorUserId,
    automationMode: input.automationMode,
    encounter: input.encounter,
    actionSource: input.actionSource,
    targetActorId: targetActor.id,
    targets: input.targets
  })
  const beforeUsed = encounterRuleUsageUsed(
    prepared.sourceActor,
    input.option.policy.allowanceDefinitionId
  )
  if (beforeUsed >= input.option.policy.allowanceMaximum) {
    throw new EncounterConflictError(
      'The selected movement reaction allowance is no longer available.'
    )
  }
  return {
    ...prepared,
    movementInterruption: input.option.binding.movementInterruption,
    option: input.option,
    allowance: {
      definitionId: input.option.policy.allowanceDefinitionId,
      maximum: input.option.policy.allowanceMaximum,
      beforeUsed,
      afterUsed: beforeUsed + 1
    }
  }
}

/** Applies generic action outcomes, then consumes one successful reaction allowance. */
export async function settleEncounterMovementReactionAction(input: {
  db: DBLike
  actorUserId: string
  encounterId: string
  occurrenceId: string
  commandId: string
  ordinal: number
  prepared: PreparedEncounterMovementReactionSettlement
  execution: CompleteActionExecution
  legendaryResistance?: LegendaryResistanceSettlementEvidence | null
}): Promise<{
  application: ServerRuleExecutionApplicationOutputsDto
  reactionExecution: {
    ordinal: number
    sourceCommandId: string
    option: MovementReactionChoiceOptionDto
    allowance: PreparedEncounterMovementReactionSettlement['allowance']
    execution: ServerCompletedRuleExecutionDto
    application: ServerRuleExecutionApplicationOutputsDto
    legendaryResistance: LegendaryResistanceSettlementEvidence | null
    characterTransitions: Array<{
      characterId: string
      beforeStreamVersion: number
      afterStreamVersion: number
    }>
  }
}> {
  const settled = await settleEncounterActionSettlementCore({
    db: input.db,
    actorUserId: input.actorUserId,
    encounterId: input.encounterId,
    occurrenceId: input.occurrenceId,
    commandId: input.commandId,
    ordinal: input.ordinal,
    eventPhases: {
      resource: 'MOVEMENT_REACTION_RESOURCE',
      outcome: 'MOVEMENT_REACTION_OUTCOME'
    },
    prepared: input.prepared,
    execution: input.execution,
    allowMovementInterruption: true
  })
  const currentAllowance = encounterRuleUsageUsed(
    settled.sourceActor,
    input.prepared.allowance.definitionId
  )
  if (currentAllowance !== input.prepared.allowance.beforeUsed) {
    throw new EncounterConflictError('The movement reaction allowance changed before settlement.')
  }
  const sourceActor = {
    ...settled.sourceActor,
    resources: withEncounterRuleUsageUsed(
      settled.sourceActor,
      input.prepared.allowance.definitionId,
      input.prepared.allowance.afterUsed
    )
  }
  await createEncounterRepository(input.db).updateActor(sourceActor)
  return {
    application: settled.application,
    reactionExecution: {
      ordinal: input.ordinal,
      sourceCommandId: input.commandId,
      option: input.prepared.option,
      allowance: input.prepared.allowance,
      execution: input.execution.execution,
      application: settled.application,
      legendaryResistance: input.legendaryResistance ?? null,
      characterTransitions: settled.characterTransitions.sort((left, right) =>
        left.characterId.localeCompare(right.characterId)
      )
    }
  }
}
