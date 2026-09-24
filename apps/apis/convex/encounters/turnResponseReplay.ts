import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto,
  type EncounterGmProjectionDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { nativeConcentrationParentDamage } from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { matchesNativeTurnResponse } from '@artificer-toolkit/rules-runtime/encounterTurnResponse'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { requireInitiativeTransition } from './commandReplay'

/** Reconstructs a completed response from its retained receipt, including its original projection. */
export async function readNativeTurnResponseReplay(
  ctx: QueryCtx,
  {
    occurrence,
    row,
    campaign,
    command,
    userId,
    projection,
    receipt: suppliedReceipt
  }: {
    occurrence: Doc<'encounterRuleOccurrences'>
    row: Doc<'encounterRuns'>
    campaign: Doc<'campaigns'>
    command: ResolveRuleOccurrenceInputDto
    userId: string
    projection: EncounterGmProjectionDto
    receipt?: Doc<'encounterRuleReceipts'> | null
  }
): Promise<EncounterCommandResultDto | null> {
  if (occurrence.state !== 'COMPLETED') return null
  const receipt =
    suppliedReceipt === undefined
      ? await ctx.db
          .query('encounterRuleReceipts')
          .withIndex('by_encounterId_commandId', (q) =>
            q.eq('encounterId', row.id).eq('commandId', occurrence.rootCommandId)
          )
          .unique()
      : suppliedReceipt
  if (!receipt) throw new Error('Rule occurrence is unavailable.')
  const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
    JSON.parse(receipt.commandMetadataJson)
  )
  const storedResult = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  if (
    storedResult.status !== 'INITIATIVE_COMPLETE' &&
    storedResult.status !== 'TURN_LIFECYCLE_COMPLETE' &&
    storedResult.status !== 'MANUAL' &&
    !(
      storedResult.status === 'BATCH_COMPLETE' &&
      storedResult.batchKind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
    )
  )
    throw new Error('Rule occurrence is unavailable.')
  const recordedResponse =
    metadata.transition === 'TURN_EFFECTS'
      ? metadata.resolutionCommands.find((entry) => entry.commandId === command.commandId)
      : null
  const history = recordedResponse
  const commandFingerprint = checksumCanonicalJson(command)
  if (
    receipt.campaignId !== campaign.id ||
    receipt.encounterId !== row.id ||
    receipt.occurrenceId !== occurrence.id ||
    (receipt.commandType !== 'START' && receipt.commandType !== 'ADVANCE_TURN') ||
    receipt.encounterVersion !== occurrence.expectedEncounterVersion ||
    checksumCanonicalJson(storedResult) !== receipt.resultChecksum ||
    (storedResult.status !== 'MANUAL' && storedResult.commandType !== receipt.commandType) ||
    storedResult.occurrenceId !== occurrence.id ||
    storedResult.occurrenceVersion !== occurrence.version ||
    metadata.transition !== 'TURN_EFFECTS' ||
    metadata.commandType !== receipt.commandType ||
    metadata.terminalOccurrenceVersion !== occurrence.version ||
    !history ||
    !matchesNativeTurnResponse(history, command.resolution) ||
    history.commandFingerprint !== commandFingerprint ||
    history.actorUserId !== userId ||
    history.correlationId !== command.correlationId ||
    history.expectedOccurrenceVersion !== command.expectedOccurrenceVersion
  )
    throw new Error('Rule occurrence is unavailable.')
  requireInitiativeTransition(
    receipt.commandType,
    storedResult.initiative,
    storedResult.initiativeAdvance
  )
  let replayProjection: EncounterCommandResultDto['projection'] = projection
  // Child Concentration cleanup may change the Run after this damage turn completed.
  if (nativeConcentrationParentDamage(storedResult).length > 0) {
    const rootCommandId = occurrence.rootCommandId
    const terminalCommand = await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', campaign.id).eq('commandId', rootCommandId)
      )
      .unique()
    if (!terminalCommand || terminalCommand.commandType !== receipt.commandType)
      throw new Error('The terminal turn command is unavailable.')
    const terminalResult = encounterCommandResultDtoSchema.parse(
      JSON.parse(terminalCommand.resultJson)
    )
    if (
      terminalCommand.encounterId !== row.id ||
      terminalCommand.ruleOccurrenceId !== occurrence.id ||
      terminalCommand.ruleResultChecksum !== receipt.resultChecksum ||
      terminalCommand.commandFingerprint !== receipt.commandFingerprint ||
      terminalCommand.actorUserId !== receipt.actorUserId ||
      terminalCommand.version !== receipt.encounterVersion ||
      checksumCanonicalJson(terminalResult) !== terminalCommand.resultChecksum ||
      terminalResult.projection.version !== terminalCommand.version ||
      terminalResult.occurrence?.occurrenceId !== occurrence.id ||
      terminalResult.occurrence.occurrenceVersion !== occurrence.version
    )
      throw new Error('The terminal turn command is invalid.')
    replayProjection = terminalResult.projection
  }
  return encounterCommandResultDtoSchema.parse({
    projection: replayProjection,
    roll: null,
    resolution: null,
    occurrence: {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: 'COMPLETE',
      outcome: null,
      pending: null
    }
  })
}
