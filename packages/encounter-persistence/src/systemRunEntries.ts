import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readRunState } from './documents.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import type { EncounterWriteContext } from './store.js'
import { insertRunCommand } from './timelineEntries.js'

/**
 * Writes one GM-only timeline entry the room authors itself (never a client command) and advances
 * the Run's version to it, so an in-flight Encounter command from another client reads the Run as
 * changed. `command` is the entry's stored input, already parsed by its schema.
 */
export async function appendSystemRunEntry(
  ctx: EncounterWriteContext,
  input: {
    encounterId: string
    userId: string
    occurredAt: string
    command: { type: 'CONCENTRATION_DROPPED_OUTSIDE' | 'RETURNED_TO_PLAY'; commandId: string }
    label: string
    ruleOverrides?: EncounterRuleWarningDto[]
  }
): Promise<void> {
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const version = run.version + 1
  const nextState = { ...readRunState(run), version, updatedAt: input.occurredAt }
  await ctx.db.patch(run._id, {
    version,
    updatedAt: input.occurredAt,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState)
  })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: run.campaignId,
      encounterId: run.id,
      commandId: input.command.commandId,
      commandType: input.command.type,
      commandFingerprint: checksumCanonicalJson(input.command),
      actorUserId: input.userId,
      version,
      commandJson: JSON.stringify(input.command),
      label: input.label.slice(0, 160),
      ...(input.ruleOverrides && { ruleOverrides: input.ruleOverrides }),
      ...encounterReplayReceipt({ roll: null, occurrence: null }),
      createdAt: input.occurredAt
    })
  )
}
