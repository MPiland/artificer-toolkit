import type { DBLike, EncounterRecord, LockedSpatialRuleEffectScope } from '@artificer-toolkit/db'
import type { MovementReactionChoiceOptionDto } from '@artificer-toolkit/schema/shared/reaction'
import type { CampaignSceneState } from '@artificer-toolkit/shared/vtt'

import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import { executeEncounterMovementReactionAction } from './encounterMovementReactionActionExecution.js'
import { prepareCurrentEncounterMovementReactionAction } from './encounterMovementReactionActionCoordinator.js'
import { settleEncounterMovementReactionAction } from './encounterMovementReactionActionSettlement.js'
import type { LockedEncounterActiveEffectTargets } from './encounterActiveEffectTargetState.js'

/**
 * Executes one server-selected reaction through the exact same coordinator and
 * settlement path as a controller selection. A pending d20 has no side
 * effects; allowance use follows only a completed action settlement.
 */
export async function executeAutomaticEncounterMovementReaction(input: {
  db: DBLike
  actorUserId: string
  encounter: EncounterRecord
  scene: CampaignSceneState
  actorIdByTokenId: ReadonlyMap<string, string>
  movingTokenId: string
  movementKind: 'VOLUNTARY' | 'FORCED' | 'TELEPORT'
  occurrenceId: string
  commandId: string
  ordinal: number
  option: MovementReactionChoiceOptionDto
  runtime: RulesRuntimeService
  attunementSlotOverride: number | null
  spatialScope: LockedSpatialRuleEffectScope
  lockedTargets?: LockedEncounterActiveEffectTargets
  rollD20?: () => number
}): Promise<
  | {
      kind: 'PENDING'
      prepared: Awaited<ReturnType<typeof prepareCurrentEncounterMovementReactionAction>>
      continuation: Extract<
        Awaited<ReturnType<typeof executeEncounterMovementReactionAction>>,
        { kind: 'PENDING' }
      >
    }
  | {
      kind: 'SETTLED'
      settled: Awaited<ReturnType<typeof settleEncounterMovementReactionAction>>
    }
> {
  const prepared = await prepareCurrentEncounterMovementReactionAction({
    trx: input.db,
    actorUserId: input.actorUserId,
    encounter: input.encounter,
    scene: input.scene,
    actorIdByTokenId: input.actorIdByTokenId,
    movingTokenId: input.movingTokenId,
    movementKind: input.movementKind,
    occurrenceId: input.occurrenceId,
    option: input.option,
    runtime: input.runtime,
    attunementSlotOverride: input.attunementSlotOverride,
    spatialScope: input.spatialScope,
    ...(input.lockedTargets ? { lockedTargets: input.lockedTargets } : {})
  })
  const execution = await executeEncounterMovementReactionAction({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    automationMode: input.encounter.automationMode === 'AUTOMATIC' ? 'AUTOMATIC' : 'ASSISTED',
    prepared: prepared.action,
    ...(input.rollD20 ? { rollD20: input.rollD20 } : {})
  })
  if (execution.kind === 'PENDING') return { kind: 'PENDING', prepared, continuation: execution }
  return {
    kind: 'SETTLED',
    settled: await settleEncounterMovementReactionAction({
      db: input.db,
      actorUserId: input.actorUserId,
      encounterId: input.encounter.id,
      occurrenceId: input.occurrenceId,
      commandId: input.commandId,
      ordinal: input.ordinal,
      prepared,
      execution
    })
  }
}
