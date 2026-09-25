import type { z } from 'zod'
import {
  encounterCommandInputDtoSchema,
  encounterCommandResultDtoSchema,
  type EncounterTimelineDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterActorTokenBindingCommandInputDtoSchema,
  sceneTokenMovementCommandInputDtoSchema
} from '@artificer-toolkit/schema/api/vttScenes'
import type { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { rejectDomain } from '../lib/domainRejections'

type StoredCommand = z.infer<typeof encounterStoredRunCommandSchema>

function commandTimelineMetadata(command: StoredCommand) {
  const input =
    command.commandType === 'CREATE'
      ? null
      : command.commandType === 'MOVE_SCENE_TOKEN'
        ? sceneTokenMovementCommandInputDtoSchema.parse(JSON.parse(command.commandJson))
        : command.commandType === 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING' ||
            command.commandType === 'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
          ? encounterActorTokenBindingCommandInputDtoSchema.parse(JSON.parse(command.commandJson))
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
  const id = command.commandType === 'CREATE' ? command.commandId : command.id
  const version = command.commandType === 'CREATE' ? 0 : command.version
  const visibility =
    input?.type === 'ROLL_ENEMY_ACTION' && input.visibility === 'TABLE'
      ? ('TABLE' as const)
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
  ctx: QueryCtx,
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

export async function insertRunCommand(ctx: MutationCtx, command: StoredCommand) {
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
  const result =
    command.commandType === 'CREATE'
      ? null
      : encounterCommandResultDtoSchema.parse(JSON.parse(command.resultJson))
  if (
    command.commandType !== 'CREATE' &&
    (checksumCanonicalJson(result) !== command.resultChecksum ||
      result?.projection.id !== command.encounterId ||
      result.projection.version !== command.version)
  )
    throw new Error('Stored Encounter command receipt mismatch.')
  return {
    ...metadata,
    commandType: command.commandType,
    actorUserId: command.actorUserId,
    createdAt: command.createdAt,
    roll: result?.roll ?? null,
    resolution: result?.resolution
      ? {
          rolls: result.resolution.rolls,
          outcomes: result.resolution.appliedOutcomes.map(({ proposed, status }) => ({
            kind: proposed.kind,
            status
          })),
          overridden: result.resolution.override !== null
        }
      : null,
    ruleOverrides: command.commandType === 'RESOLVE_ACTION' ? command.ruleOverrides : []
  }
}
