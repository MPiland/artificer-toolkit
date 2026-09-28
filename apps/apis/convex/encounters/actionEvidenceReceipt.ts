import type {
  EncounterCommandResultDto,
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterStoredRuleReceiptSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { encounterReplayReceipt } from '@artificer-toolkit/encounter-persistence/replayReceipts'

export async function insertActionEvidenceReceipt(
  ctx: MutationCtx,
  input: {
    occurrence: Doc<'encounterRuleOccurrences'>
    response: ResolveRuleOccurrenceInputDto
    rootCommand: ResolveEncounterActionInputDto
    rootFingerprint: string
    userId: string
    rootInitiatorUserId?: string
    commandResult?: EncounterCommandResultDto
    result: ReturnType<typeof storedRuleExecutionResultDtoSchema.parse>
  }
) {
  const { occurrence, response } = input
  if (!('requestId' in response.resolution)) throw new Error('The action requires evidence.')
  await ctx.db.insert(
    'encounterRuleReceipts',
    encounterStoredRuleReceiptSchema.parse({
      id: crypto.randomUUID(),
      campaignId: occurrence.campaignId,
      encounterId: occurrence.encounterId,
      occurrenceId: occurrence.id,
      commandId: response.commandId,
      commandType: response.type,
      commandFingerprint: checksumCanonicalJson(response),
      encounterVersion: occurrence.expectedEncounterVersion,
      commandMetadataJson: JSON.stringify(
        serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
          schemaVersion: 1,
          transition: 'ACTION_EVIDENCE',
          rootCommandId: input.rootCommand.commandId,
          rootCommandFingerprint: input.rootFingerprint,
          rootInitiatorUserId: input.rootInitiatorUserId ?? input.userId,
          expectedAggregateVersion: response.expectedVersion,
          expectedOccurrenceVersion: response.expectedOccurrenceVersion,
          requestId: response.resolution.requestId,
          resolutionKind: response.resolution.kind,
          ...(input.commandResult
            ? { replayReceipt: encounterReplayReceipt(input.commandResult) }
            : {})
        })
      ),
      resultJson: JSON.stringify(input.result),
      resultChecksum: checksumRuleDocument(input.result),
      actorUserId: input.userId,
      correlationId: response.correlationId ?? null,
      createdAt: new Date().toISOString()
    })
  )
}
