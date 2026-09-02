import type { DBLike, EncounterActorRecord } from '@artificer-toolkit/db'
import {
  serverRuleExecutionApplicationOutputsDtoSchema,
  type ServerOptionalCombatContestPendingApplicationContextDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { executeLockedEncounterCharacterUnequip } from '../character/sheetService.js'
import {
  applyEncounterActorOptionalContestSuccess,
  type EncounterActorOptionalContestContext
} from './encounterActorOptionalContestContext.js'
import type { LockedEncounterCharacterOptionalContestContext } from './encounterCharacterOptionalContestContext.js'
import { consumePreparedActionEconomy } from './encounterActionSettlementCore.js'
import type { EncounterOptionalContestActionExecution } from './encounterOptionalContestActionExecution.js'

/** Applies the terminal Disarm state only after the sealed contest graph completes. */
export async function settleEncounterOptionalContestAction(input: {
  db: DBLike
  occurrenceId: string
  pending: ServerOptionalCombatContestPendingApplicationContextDto
  execution: Extract<EncounterOptionalContestActionExecution, { kind: 'COMPLETE' }>
  sourceActor: EncounterActorRecord
  actionEconomy: Parameters<typeof consumePreparedActionEconomy>[0]['consumption'] | null
  target:
    | { kind: 'CHARACTER'; context: LockedEncounterCharacterOptionalContestContext }
    | {
        kind: 'ENCOUNTER_ACTOR'
        context: EncounterActorOptionalContestContext
        actor: EncounterActorRecord
      }
  updateActor: (actor: EncounterActorRecord) => Promise<void>
}) {
  const sourceWon = input.execution.initiator.total > input.execution.defender.total
  let stateTransition: Record<string, unknown> = { kind: 'NONE' }
  if (sourceWon && input.target.kind === 'CHARACTER') {
    const before = input.target.context.targetStreamVersion
    const applied = await executeLockedEncounterCharacterUnequip({
      db: input.db,
      capability: input.target.context.unequipCapability
    })
    stateTransition = {
      kind: 'CHARACTER_ITEM_USE_STATE',
      characterId: input.target.context.targetCharacterId,
      itemInstanceId: input.target.context.selectedItem.itemId,
      fromState: 'EQUIPPED',
      toState: 'CARRIED',
      beforeStreamVersion: before,
      afterStreamVersion: applied.streamVersion,
      beforeStateChecksum: applied.beforeStateChecksum,
      afterStateChecksum: applied.afterStateChecksum
    }
  } else if (sourceWon && input.target.kind === 'ENCOUNTER_ACTOR') {
    const applied = applyEncounterActorOptionalContestSuccess({
      context: input.target.context,
      actor: input.target.actor
    })
    await input.updateActor(applied.actor)
    stateTransition = {
      kind: 'ENCOUNTER_ACTOR_ITEM_USE_STATE',
      actorId: input.target.context.actorId,
      loadoutEntryId: input.target.context.equipment.loadoutEntryId,
      equipmentId: input.target.context.equipment.equipmentId,
      fromState: 'HELD',
      toState: 'CARRIED',
      beforeStateChecksum: applied.beforeStateChecksum,
      afterStateChecksum: applied.afterStateChecksum
    }
  }
  if (input.actionEconomy)
    await consumePreparedActionEconomy({
      db: input.db,
      sourceActor: input.sourceActor,
      consumption: input.actionEconomy
    })
  return serverRuleExecutionApplicationOutputsDtoSchema.parse({
    kind: 'CONTESTED_ACTION',
    schemaVersion: 1,
    occurrenceId: input.occurrenceId,
    sourceActorId: input.pending.sourceActorId,
    targetActorId: input.pending.targetActorId,
    sealedContextChecksum: checksumRuleDocument(input.pending),
    policy: input.pending.optionalCombat,
    contestGraph: input.pending.contestGraph,
    sourceRoll: input.execution.initiator,
    targetRoll: input.execution.defender,
    outcome: sourceWon ? 'SOURCE_WIN' : 'TARGET_WIN_OR_TIE',
    stateTransition,
    actionEconomyTransition: input.actionEconomy ? { ...input.actionEconomy } : null
  })
}
