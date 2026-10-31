import type { z } from 'zod'
import {
  encounterCommandInputDtoSchema,
  type EncounterTimelineDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterActorTokenBindingCommandInputDtoSchema,
  sceneTokenMovementCommandInputDtoSchema
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  encounterConcentrationDroppedOutsideInputSchema,
  encounterRelationshipsEndedInputSchema,
  encounterSummonsEndedInputSchema,
  encounterReturnedToPlayInputSchema,
  type encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readStoredInitiativeReceipt } from './initiativeReceipt.js'
import { readEncounterReplayReceipt } from './replayReceipts.js'
import { rejectDomain } from './domainRejections.js'
import type { EncounterReadContext, EncounterWriteContext } from './store.js'

export type StoredCommand = z.infer<typeof encounterStoredRunCommandSchema>

function commandTimelineMetadata(command: StoredCommand) {
  const input =
    command.commandType === 'CREATE'
      ? null
      : command.commandType === 'MOVE_SCENE_TOKEN'
        ? sceneTokenMovementCommandInputDtoSchema.parse(JSON.parse(command.commandJson))
        : command.commandType === 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING' ||
            command.commandType === 'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
          ? encounterActorTokenBindingCommandInputDtoSchema.parse(JSON.parse(command.commandJson))
          : command.commandType === 'CONCENTRATION_DROPPED_OUTSIDE'
            ? encounterConcentrationDroppedOutsideInputSchema.parse(JSON.parse(command.commandJson))
            : command.commandType === 'RELATIONSHIPS_ENDED'
              ? encounterRelationshipsEndedInputSchema.parse(JSON.parse(command.commandJson))
              : command.commandType === 'SUMMONS_ENDED'
                ? encounterSummonsEndedInputSchema.parse(JSON.parse(command.commandJson))
                : command.commandType === 'RETURNED_TO_PLAY'
                  ? encounterReturnedToPlayInputSchema.parse(JSON.parse(command.commandJson))
                  : encounterCommandInputDtoSchema.parse(JSON.parse(command.commandJson))
  if (
    input !== null &&
    (input.type !== command.commandType ||
      input.commandId !== command.commandId ||
      checksumCanonicalJson(input) !== command.commandFingerprint)
  )
    throw new Error('Stored Encounter command receipt mismatch.')
  if (
    command.commandType === 'MOVE_SCENE_TOKEN' &&
    (input?.type !== 'MOVE_SCENE_TOKEN' ||
      input.expectedEncounterVersion === null ||
      input.expectedEncounterVersion !== command.version - 1)
  )
    throw new Error('Stored Encounter command receipt mismatch.')
  if (
    input !== null &&
    input.type !== 'MOVE_SCENE_TOKEN' &&
    input.encounterId !== command.encounterId
  )
    throw new Error('Stored Encounter command receipt mismatch.')
  // A removal of conjured creatures keeps the round's initiative it left; none of them may remain in it.
  if (
    command.commandType === 'SUMMONS_ENDED' ||
    command.commandType === 'REVERT_LAST_ACTION' ||
    command.commandType === 'RESOLVE_ACTION'
  ) {
    const initiative = readStoredInitiativeReceipt(command, command.encounterId)
    if (
      command.commandType === 'SUMMONS_ENDED' &&
      initiative?.participants.some(({ actorId }) =>
        command.receipt.removedActorIds.includes(actorId)
      )
    )
      throw new Error('Stored Encounter initiative receipt mismatch.')
  }
  const id = command.commandType === 'CREATE' ? command.commandId : command.id
  const version = command.commandType === 'CREATE' ? 0 : command.version
  // A stored PRIVATE narrows a PUBLIC enemy roll that came from a hidden actor (D62). An action
  // that keeps results for its issuer is shown to the issuing user as well as the GM.
  const visibility =
    input?.type === 'ROLL_ENEMY_ACTION' &&
    input.visibility === 'PUBLIC' &&
    command.visibility !== 'PRIVATE'
      ? ('TABLE' as const)
      : command.commandType === 'RESOLVE_ACTION' && command.issuerLines.length > 0
        ? ('ISSUER' as const)
        : ('PRIVATE' as const)
  if (
    (command.id !== undefined && command.id !== id) ||
    (command.version !== undefined && command.version !== version) ||
    (command.visibility !== undefined && command.visibility !== visibility)
  )
    throw new Error('Stored Encounter timeline metadata mismatch.')
  return { id, version, visibility }
}

export async function requireUnusedEvidenceCommandId(
  ctx: EncounterReadContext,
  campaignId: string,
  commandId: string
) {
  const evidence = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_campaignId_commandId', (query) =>
      query.eq('campaignId', campaignId).eq('commandId', commandId)
    )
    .unique()
  if (evidence?.commandType === 'RESOLVE_RULE_OCCURRENCE') rejectDomain('COMMAND_ID_REUSED')
}

export async function insertRunCommand(ctx: EncounterWriteContext, command: StoredCommand) {
  await requireUnusedEvidenceCommandId(ctx, command.campaignId, command.commandId)
  const metadata = commandTimelineMetadata(command)
  return command.commandType === 'CREATE'
    ? ctx.db.insert('encounterRunCommands', { ...command, ...metadata, version: 0 })
    : ctx.db.insert('encounterRunCommands', { ...command, ...metadata })
}

export function presentTimelineEntry(
  command: StoredCommand
): EncounterTimelineDto['entries'][number] {
  const metadata = commandTimelineMetadata(command)
  const receipt = command.commandType === 'CREATE' ? null : readEncounterReplayReceipt(command)
  return {
    ...metadata,
    commandType: command.commandType,
    actorUserId: command.actorUserId,
    createdAt: command.createdAt,
    roll: receipt?.roll ?? null,
    label:
      command.commandType === 'RESOLVE_ACTION' ||
      command.commandType === 'ESCAPE' ||
      command.commandType === 'END_HELD_GRANT' ||
      command.commandType === 'MOVE_HELD_EFFECT' ||
      command.commandType === 'CHANGE_FACING' ||
      command.commandType === 'RELEASE_RELATIONSHIP' ||
      command.commandType === 'RELATIONSHIPS_ENDED' ||
      command.commandType === 'SUMMONS_ENDED' ||
      command.commandType === 'CONCENTRATION_DROPPED_OUTSIDE' ||
      command.commandType === 'RETURNED_TO_PLAY'
        ? command.label
        : null,
    ruleOverrides:
      command.commandType === 'RESOLVE_ACTION' ||
      command.commandType === 'ESCAPE' ||
      command.commandType === 'END_HELD_GRANT' ||
      command.commandType === 'MOVE_HELD_EFFECT' ||
      command.commandType === 'CHANGE_FACING' ||
      command.commandType === 'RETURNED_TO_PLAY'
        ? command.ruleOverrides
        : [],
    issuerLines: command.commandType === 'RESOLVE_ACTION' ? command.issuerLines : [],
    gmLines: command.commandType === 'RESOLVE_ACTION' ? command.gmLines : []
  }
}
