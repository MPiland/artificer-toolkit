import type { EncounterDocument, EncounterWriteContext } from './store.js'
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
import { encounterReplayReceipt } from './replayReceipts.js'

export async function insertActionEvidenceReceipt(
  ctx: EncounterWriteContext,
  input: {
    occurrence: EncounterDocument<'encounterRuleOccurrences'>
    response: ResolveRuleOccurrenceInputDto
    rootCommand: ResolveEncounterActionInputDto
    rootFingerprint: string
    userId: string
    rootInitiatorUserId?: string
    /** The save an area Legendary Resistance decision belongs to; every other answer names its own. */
    areaSaveRequestId?: string
    commandResult?: EncounterCommandResultDto
    result: ReturnType<typeof storedRuleExecutionResultDtoSchema.parse>
  }
) {
  const { occurrence, response } = input
  const requestId =
    'requestId' in response.resolution ? response.resolution.requestId : input.areaSaveRequestId
  if (requestId === undefined) throw new Error('The action requires evidence.')
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
          requestId,
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
