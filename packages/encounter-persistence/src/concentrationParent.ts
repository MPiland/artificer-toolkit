import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  MAX_CONCENTRATION_DAMAGE_APPLICATIONS,
  compareDamageSaveApplications,
  unboundDamageSaveApplication
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import {
  damageSaveCheckBoundApplication,
  damageSaveCheckMutatesRun
} from '@artificer-toolkit/schema/shared/ruleExecutionDamageSaveOutputs'
import {
  storedRuleExecutionResultDtoSchema,
  type StoredRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumRuleDocument, RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules'
import {
  concentrationOccurrenceId,
  damageSaveContextBoundApplication
} from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import type { NativeDamageSaveContext } from '@artificer-toolkit/rules-runtime/encounterConcentration'
import { nativeConcentrationParentDamage } from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { presentTimelineEntry } from './timelineEntries.js'
import type { EncounterReadContext } from './store.js'

/**
 * A response commit with a failed check advances the Run once; every intervening command must belong
 * to this damage parent.
 */
export async function readNativeConcentrationParentDamage(
  ctx: EncounterReadContext,
  input: { state: EncounterRunState; context: NativeDamageSaveContext }
) {
  const { state, context } = input
  const parent = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', context.parentOccurrenceId))
    .unique()
  const parentReceipts = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_occurrenceId', (q) => q.eq('occurrenceId', context.parentOccurrenceId))
    .take(RULE_GRAPH_LIMITS.NODES * 20 + 1)
  if (
    !parent ||
    parent.encounterId !== state.id ||
    parent.campaignId !== state.campaignId ||
    parent.state !== 'COMPLETED' ||
    parent.expectedEncounterVersion > state.version ||
    parentReceipts.length > RULE_GRAPH_LIMITS.NODES * 20
  )
    throw new Error('The concentration parent is unavailable.')
  const matching = parentReceipts.filter(
    (receipt) =>
      receipt.commandFingerprint === context.parentCommandFingerprint &&
      receipt.encounterVersion === parent.expectedEncounterVersion
  )
  if (matching.length !== 1) throw new Error('The concentration parent receipt is unavailable.')
  const receipt = matching[0]!
  const result = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  if (
    receipt.encounterId !== state.id ||
    receipt.campaignId !== state.campaignId ||
    result.occurrenceId !== parent.id ||
    result.occurrenceVersion !== parent.version ||
    checksumRuleDocument(result) !== receipt.resultChecksum
  )
    throw new Error('The concentration parent receipt is invalid.')
  const applications = nativeConcentrationParentDamage(result)

  if (parent.expectedEncounterVersion < state.version) {
    const commands = await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId_version', (q) =>
        q
          .eq('encounterId', state.id)
          .gt('version', parent.expectedEncounterVersion)
          .lte('version', state.version)
      )
      .take(MAX_CONCENTRATION_DAMAGE_APPLICATIONS + 1)
    if (commands.length > MAX_CONCENTRATION_DAMAGE_APPLICATIONS)
      throw new Error('The concentration continuation exceeds its command bound.')
    const advances = new Set<number>()
    const applicationChecksums = new Set(
      applications.map((application) => checksumRuleDocument(application))
    )
    for (const command of commands) {
      presentTimelineEntry(command)
      const child = await ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_campaignId_commandId', (q) =>
          q.eq('campaignId', state.campaignId).eq('commandId', command.commandId)
        )
        .unique()
      if (!child || command.commandType !== 'RESOLVE_RULE_OCCURRENCE')
        throw new Error('The concentration parent version is stale.')
      const childResult = storedRuleExecutionResultDtoSchema.parse(JSON.parse(child.resultJson))
      const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
        JSON.parse(child.commandMetadataJson)
      )
      if (
        childResult.status !== 'COMPLETE' ||
        childResult.applicationOutputs.kind !== 'DAMAGE_SAVE_CHECK'
      )
        throw new Error('The concentration parent version is stale.')
      const commitMutated = await readDamageSaveCommitMutated(ctx, {
        encounterId: state.id,
        output: childResult.applicationOutputs,
        encounterVersion: command.version
      })
      if (
        childResult.applicationOutputs.parentOccurrenceId !== parent.id ||
        childResult.occurrenceId !==
          concentrationOccurrenceId(
            parent.id,
            damageSaveCheckBoundApplication(childResult.applicationOutputs)
          ) ||
        child.encounterId !== state.id ||
        child.commandType !== command.commandType ||
        child.occurrenceId !== childResult.occurrenceId ||
        child.occurrenceId !== command.ruleOccurrenceId ||
        child.encounterVersion !== command.version ||
        child.actorUserId !== command.actorUserId ||
        child.commandFingerprint !== command.commandFingerprint ||
        checksumRuleDocument(childResult) !== child.resultChecksum ||
        child.resultChecksum !== command.ruleResultChecksum ||
        metadata.transition !== 'RESUME' ||
        metadata.expectedAggregateVersion + (commitMutated ? 1 : 0) !== command.version
      )
        throw new Error('The concentration parent version is stale.')
      // The parent recorded the bare damage; a sibling's output may bind it to what it checked.
      const damage = unboundDamageSaveApplication(
        damageSaveCheckBoundApplication(childResult.applicationOutputs)
      )
      if (
        !applicationChecksums.has(checksumRuleDocument(damage)) ||
        compareDamageSaveApplications(
          damageSaveCheckBoundApplication(childResult.applicationOutputs),
          damageSaveContextBoundApplication(context)
        ) >= 0
      )
        throw new Error('The concentration sibling does not match its parent damage.')
      if (commitMutated) {
        if (advances.has(command.version))
          throw new Error('The concentration version advance is duplicated.')
        advances.add(command.version)
      }
    }
    if (advances.size !== state.version - parent.expectedEncounterVersion)
      throw new Error('The concentration parent version is stale.')
  }
  return applications
}

/**
 * Whether any check one damage-save response commit settled changed Run state: its answered check,
 * or a remaining check it auto-rolled (D23). Auto-rolled checks follow the answered check's successor
 * chain as START receipts correlated in order and pinned to the commit's Encounter version.
 */
export async function readDamageSaveCommitMutated(
  ctx: EncounterReadContext,
  input: {
    encounterId: string
    output: Extract<
      Extract<StoredRuleExecutionResultDto, { status: 'COMPLETE' }>['applicationOutputs'],
      { kind: 'DAMAGE_SAVE_CHECK' }
    >
    encounterVersion: number
  }
) {
  let mutated = damageSaveCheckMutatesRun(input.output)
  let previousId = input.output.occurrenceId
  let nextId = input.output.nextOccurrenceId
  for (let settled = 0; nextId !== null; settled += 1) {
    if (settled >= MAX_CONCENTRATION_DAMAGE_APPLICATIONS)
      throw new Error('The concentration commit exceeds its bound.')
    const occurrenceId = nextId
    const started = (
      await ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_occurrenceId', (q) => q.eq('occurrenceId', occurrenceId))
        .take(3)
    ).filter((receipt) => receipt.commandType === 'DAMAGE_SAVE_CHECK')
    const receipt = started[0]
    if (!receipt) break
    const result = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    if (
      started.length !== 1 ||
      receipt.encounterId !== input.encounterId ||
      receipt.correlationId !== previousId ||
      receipt.encounterVersion !== input.encounterVersion ||
      checksumRuleDocument(result) !== receipt.resultChecksum ||
      result.occurrenceId !== occurrenceId ||
      result.status !== 'COMPLETE' ||
      result.applicationOutputs.kind !== 'DAMAGE_SAVE_CHECK'
    )
      throw new Error('The concentration commit receipt is invalid.')
    mutated ||= damageSaveCheckMutatesRun(result.applicationOutputs)
    previousId = occurrenceId
    nextId = result.applicationOutputs.nextOccurrenceId
  }
  return mutated
}
