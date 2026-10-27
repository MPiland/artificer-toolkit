import { readEncounterActorDefeated } from '@artificer-toolkit/encounter-persistence/characterStates'
import { readRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import {
  ruleFailedSaveAction,
  ruleTriggerWindowStart
} from '@artificer-toolkit/encounter-persistence/systemTriggerAdmission'
import { encounterRuleActionId } from '@artificer-toolkit/rules-runtime/encounterRuleAction'
import {
  systemTriggerCommandId,
  systemTriggerSelfCommand
} from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'

// The rule receipts one command and its answers can record before the Run moves on.
const RULE_RECEIPT_SCAN_LIMIT = 256

/**
 * Raises the action an optional combat rule names for a failed save, once per committed command:
 * every failed save recorded since the command that opened the window, whether rolled inside an
 * action or answered later, whose holder still stands and whose action has not run. Each runs as its
 * own rule-raised root on the holder, after the hit-point and turn-start effects. An Encounter that
 * already waits on a decision raises nothing yet; the answer that settles it raises the rest.
 * Returns whether any root committed.
 */
export async function raiseRoomRuleEffects(input: {
  ctx: EncounterWriteTransaction
  encounterId: string
  execute(command: ResolveEncounterActionInputDto): Promise<unknown>
}) {
  const { ctx, encounterId } = input
  const readRun = () =>
    ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', encounterId))
      .unique()
  const first = await readRun()
  if (!first || first.status !== 'ACTIVE') return false
  const windowStart = await ruleTriggerWindowStart(ctx, encounterId)
  if (windowStart === null) return false
  const firstState = readRunState(first)
  const receipts = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_encounterId_encounterVersion', (query) =>
      query.eq('encounterId', encounterId).gte('encounterVersion', windowStart)
    )
    .take(RULE_RECEIPT_SCAN_LIMIT)
  let committed = false
  for (const receipt of receipts) {
    const failedSave = ruleFailedSaveAction(firstState, receipt)
    if (!failedSave) continue
    const actionId = encounterRuleActionId(
      failedSave.holderActorId,
      failedSave.definitionId,
      failedSave.effectId
    )
    const raisedCommandId = systemTriggerCommandId(
      receipt.commandId,
      failedSave.holderActorId,
      actionId
    )
    const run = await readRun()
    const waiting = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (query) =>
        query.eq('encounterId', encounterId).eq('state', 'PENDING')
      )
      .first()
    if (!run || run.status !== 'ACTIVE' || waiting) return committed
    const raised = await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (query) =>
        query.eq('campaignId', run.campaignId).eq('commandId', raisedCommandId)
      )
      .unique()
    const holder = await readRunActor(ctx, readRunState(run), failedSave.holderActorId)
    if (raised || (await readEncounterActorDefeated(ctx, holder))) continue
    await input.execute(
      systemTriggerSelfCommand({
        encounterId,
        expectedVersion: run.version,
        parentCommandId: receipt.commandId,
        holderActorId: failedSave.holderActorId,
        actionId,
        trigger: 'RULE'
      })
    )
    committed = true
  }
  return committed
}
