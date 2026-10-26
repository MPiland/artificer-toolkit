import {
  encounterCommandResultDtoSchema,
  type EncounterExecuteInput
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRunCommandSchema,
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { encounterInitiativeRoundStateDtoSchema } from '@artificer-toolkit/schema/shared/initiativeState'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { maintenanceCompleteRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionTurnResults'
import type { encounterConcentrationDamageCheckPendingContextDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  changedFields,
  deleteRunActor,
  readRunActors,
  readRunState,
  writeRunActor
} from './documents.js'
import {
  encounterReplayReceipt,
  readEncounterReplayReceipt,
  replayEncounterCommandResult
} from './replayReceipts.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import { cleanupRemovedActorEffects } from './actorRemovalEffects.js'
import { removeActorInitiative } from './actorRemovalInitiative.js'
import { insertRunCommand, requireUnusedEvidenceCommandId } from './timelineEntries.js'
import { rejectDomain } from './domainRejections.js'
import { readPendingSnapshot, writePendingSnapshot } from './pendingSnapshots.js'
import type { EncounterDocument } from './store.js'
import type {
  EncounterCharacterWriteTransaction,
  EncounterPersistenceTransaction
} from './ports.js'

type RemoveActorCommand = Extract<EncounterExecuteInput['command'], { type: 'REMOVE_ACTOR' }>
type Campaign = EncounterDocument<'campaigns'>
type RemovalMode = 'PUBLIC' | 'ACCOUNT_CLEANUP' | 'MISSING_CHARACTER'

const storedOccurrence = encounterStoredRuleOccurrenceSchema.clone({
  ...encounterStoredRuleOccurrenceSchema._zod.def,
  catchall: undefined
})
const storedReceipt = encounterStoredRuleReceiptSchema.clone({
  ...encounterStoredRuleReceiptSchema._zod.def,
  catchall: undefined
})

export async function removeEncounterActor(
  ctx: EncounterCharacterWriteTransaction,
  command: RemoveActorCommand,
  userId: string
) {
  const input = normalizeRemoveActorCommand(command)
  const row = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!row) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(row.campaignId, userId)
  if (membership.role !== 'OWNER') rejectDomain('GM_ONLY')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (row.gameSystemId !== campaign.gameSystemId)
    throw new Error('Encounter does not match the Campaign Game System.')
  return removeEncounterActorCore(ctx, input, userId, campaign, 'PUBLIC')
}

/** Trusted lifecycle cleanup while the deleting account profile still exists. */
export async function removeAccountCharacterActors(
  ctx: EncounterCharacterWriteTransaction,
  campaignId: string,
  userId: string
) {
  if (!(await ctx.ports.hasAccountProfile(userId)))
    throw new Error('Account profile is unavailable.')

  const storedCampaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', campaignId))
    .unique()
  if (!storedCampaign) rejectDomain('CAMPAIGN_NOT_FOUND')
  const { campaign } = await ctx.ports.requireCampaignAuthority(
    storedCampaign.id,
    storedCampaign.ownerUserId
  )
  if (campaign.status !== 'ACTIVE' && campaign.status !== 'ARCHIVED')
    throw new Error('Campaign is unavailable.')
  const membership = await ctx.db
    .query('campaignMemberships')
    .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', campaign.id).eq('userId', userId))
    .unique()
  if (
    !membership ||
    membership.role !== 'PLAYER' ||
    (membership.status !== 'ACTIVE' && membership.status !== 'LEFT')
  )
    throw new Error('A current or departed player membership is required.')

  const [characters, assignment] = await Promise.all([
    ctx.db
      .query('characters')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect(),
    ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', campaign.id).eq('userId', userId)
      )
      .unique()
  ])
  const characterIds = new Set(characters.map((character) => character.id))
  if (assignment) characterIds.add(assignment.characterId)

  const targets: Array<{ encounterId: string; actorId: string }> = []
  const rows = await ctx.db
    .query('encounterRuns')
    .withIndex('by_campaignId_status', (q) => q.eq('campaignId', campaign.id))
    .collect()
  for (const row of rows
    .filter((candidate) => candidate.status !== 'COMPLETED')
    .sort((left, right) => left.id.localeCompare(right.id))) {
    const state = readRunState(row)
    const actors = await readRunActors(ctx, state)
    for (const actor of actors
      .filter(
        (candidate) =>
          candidate.kind === 'CHARACTER' &&
          candidate.sourceId !== null &&
          characterIds.has(candidate.sourceId)
      )
      .sort((left, right) => left.id.localeCompare(right.id))) {
      const characterId = actor.sourceId
      if (!characterId) throw new Error('Stored Encounter Character source is unavailable.')
      const character = await ctx.ports.readCharacterRow(characterId)
      if (!character || character.userId !== userId)
        throw new Error('Stored Encounter Character source is unavailable.')
      ctx.ports.readCharacterRecord(character)
      targets.push({ encounterId: row.id, actorId: actor.id })
    }
  }

  await removeTargetedActors(ctx, campaign, userId, targets, 'ACCOUNT_CLEANUP')
}

/**
 * Trusted cleanup of a Campaign's open Runs: removes the actors of Characters that no longer exist,
 * as account cleanup does for a deleting account. Convex runs it at room release and the room on its
 * departure reconcile (D74); each owner says which Characters are gone.
 */
export async function removeMissingCharacterActors(
  ctx: EncounterCharacterWriteTransaction,
  campaign: Campaign,
  userId: string,
  isMissing: (characterId: string) => Promise<boolean>
) {
  const targets: Array<{ encounterId: string; actorId: string }> = []
  const rows = await ctx.db
    .query('encounterRuns')
    .withIndex('by_campaignId_status', (q) => q.eq('campaignId', campaign.id))
    .collect()
  for (const row of rows
    .filter((candidate) => candidate.status !== 'COMPLETED')
    .sort((left, right) => left.id.localeCompare(right.id)))
    for (const actor of (await readRunActors(ctx, readRunState(row))).sort((left, right) =>
      left.id.localeCompare(right.id)
    ))
      if (actor.kind === 'CHARACTER' && (await isMissing(actor.sourceId)))
        targets.push({ encounterId: row.id, actorId: actor.id })
  await removeTargetedActors(ctx, campaign, userId, targets, 'MISSING_CHARACTER')
}

async function removeTargetedActors(
  ctx: EncounterCharacterWriteTransaction,
  campaign: Campaign,
  userId: string,
  targets: Array<{ encounterId: string; actorId: string }>,
  mode: RemovalMode
) {
  for (const target of targets) {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', target.encounterId))
      .unique()
    if (!row || row.status === 'COMPLETED') continue
    await removeEncounterActorCore(
      ctx,
      {
        type: 'REMOVE_ACTOR',
        encounterId: row.id,
        commandId: crypto.randomUUID(),
        expectedVersion: row.version,
        actorId: target.actorId
      },
      userId,
      campaign,
      mode
    )
  }
}

function normalizeRemoveActorCommand(command: RemoveActorCommand) {
  return {
    ...command,
    encounterId: command.encounterId.toLowerCase(),
    commandId: command.commandId.toLowerCase(),
    actorId: command.actorId.toLowerCase()
  }
}

async function removeEncounterActorCore(
  ctx: EncounterCharacterWriteTransaction,
  input: RemoveActorCommand,
  userId: string,
  campaign: Campaign,
  mode: RemovalMode
) {
  const row = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!row) throw new Error('Encounter is unavailable.')
  if (row.campaignId !== campaign.id || row.gameSystemId !== campaign.gameSystemId)
    throw new Error('Encounter does not match the Campaign Game System.')
  await requireUnusedEvidenceCommandId(ctx, campaign.id, input.commandId)
  const fingerprint = checksumCanonicalJson(input)
  const priorRow = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', input.commandId)
    )
    .unique()
  if (priorRow) {
    const prior = priorRow
    if (
      prior.commandType !== 'REMOVE_ACTOR' ||
      prior.encounterId !== row.id ||
      prior.actorUserId !== userId ||
      prior.commandFingerprint !== fingerprint
    )
      rejectDomain('COMMAND_ID_REUSED')
    const replayReceipt = readEncounterReplayReceipt(prior)
    const state = readRunState(row)
    // A Character the GM took out of initiative (D82) stays in the Run; any other removal deletes it.
    const keptActor = state.actorIds.includes(input.actorId)
    if (
      checksumCanonicalJson(JSON.parse(prior.commandJson)) !== fingerprint ||
      prior.version !== input.expectedVersion + 1 ||
      prior.version > row.version ||
      replayReceipt.roll !== null ||
      replayReceipt.occurrence !== null
    )
      throw new Error('Stored actor removal receipt mismatch.')
    if ((prior.initiativeStateJson === null) !== (prior.initiativeStateChecksum === null))
      throw new Error('Stored actor removal initiative receipt mismatch.')
    if (prior.initiativeStateJson !== null) {
      const initiative = encounterInitiativeRoundStateDtoSchema.parse(
        JSON.parse(prior.initiativeStateJson)
      )
      if (
        checksumCanonicalJson(initiative) !== prior.initiativeStateChecksum ||
        initiative.round.encounterId !== row.id ||
        initiative.participants.some((participant) => participant.actorId === input.actorId) !==
          keptActor
      )
        throw new Error('Stored actor removal initiative receipt mismatch.')
    }
    if ((prior.ruleOccurrenceId === null) !== (prior.ruleResultChecksum === null))
      throw new Error('Stored actor removal maintenance receipt mismatch.')
    const receipt = await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) =>
        q.eq('encounterId', row.id).eq('commandId', input.commandId)
      )
      .unique()
    if (prior.ruleOccurrenceId === null) {
      if (receipt) throw new Error('Stored actor removal maintenance receipt mismatch.')
    } else {
      const occurrence = await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_publicId', (q) => q.eq('id', prior.ruleOccurrenceId!))
        .unique()
      if (!receipt || !occurrence)
        throw new Error('Stored actor removal maintenance receipt is unavailable.')
      storedOccurrence.parse(occurrence)
      storedReceipt.parse(receipt)
      const cleanup = maintenanceCompleteRuleExecutionResultDtoSchema.parse(
        JSON.parse(receipt.resultJson)
      )
      const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
        JSON.parse(receipt.commandMetadataJson)
      )
      if (
        occurrence.state !== 'COMPLETED' ||
        occurrence.campaignId !== campaign.id ||
        occurrence.encounterId !== row.id ||
        occurrence.expectedEncounterVersion !== prior.version ||
        receipt.occurrenceId !== occurrence.id ||
        receipt.campaignId !== campaign.id ||
        receipt.commandType !== 'REMOVE_ACTOR' ||
        receipt.commandFingerprint !== fingerprint ||
        receipt.actorUserId !== userId ||
        receipt.encounterVersion !== prior.version ||
        receipt.correlationId !== null ||
        checksumCanonicalJson(cleanup) !== prior.ruleResultChecksum ||
        receipt.resultChecksum !== prior.ruleResultChecksum ||
        cleanup.occurrenceId !== occurrence.id ||
        cleanup.occurrenceVersion !== occurrence.version ||
        cleanup.encounterId !== row.id ||
        cleanup.removedActorId !== input.actorId ||
        metadata.transition !== 'MAINTENANCE_CLEANUP' ||
        metadata.commandType !== 'REMOVE_ACTOR' ||
        metadata.expectedAggregateVersion !== input.expectedVersion ||
        metadata.removedActorId !== input.actorId ||
        occurrence.version !==
          (metadata.expectedOccurrenceVersion === null
            ? 0
            : metadata.expectedOccurrenceVersion + 1) ||
        (metadata.expectedOccurrenceVersion === null &&
          occurrence.rootCommandId !== input.commandId)
      )
        throw new Error('Stored actor removal maintenance receipt mismatch.')
    }
    return replayEncounterCommandResult(ctx, state, prior)
  }

  if (row.version !== input.expectedVersion) rejectDomain('VERSION_STALE')
  if (row.status === 'COMPLETED') rejectDomain('ENCOUNTER_NOT_ACTIVE')
  const state = readRunState(row)
  const actors = await readRunActors(ctx, state)
  const removed = actors.find((actor) => actor.id === input.actorId)
  if (!removed) throw new Error('Encounter actor was not found.')
  if (mode === 'ACCOUNT_CLEANUP') await requireOwnedCharacterActor(ctx, removed, userId)
  // D82: a GM removal mid-Run never changes a Character the room holds; it only leaves initiative.
  const absentCharacter =
    mode === 'PUBLIC' &&
    row.status === 'ACTIVE' &&
    removed.kind === 'CHARACTER' &&
    !removed.frozenState
      ? removed
      : null
  if (absentCharacter && absentCharacter.absence !== null)
    throw new Error('Encounter Character is already out of initiative.')
  const pendingRows = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', row.id).eq('state', 'PENDING'))
    .take(2)
  if (pendingRows.length > 1) throw new Error('Encounter has multiple pending occurrences.')
  const pending = pendingRows[0] ?? null
  if (absentCharacter && pending)
    rejectDomain(
      'PENDING_DECISION',
      'Resolve the pending Encounter occurrence before removing this actor.'
    )
  let concentrationState:
    | ReturnType<
        typeof encounterConcentrationDamageCheckPendingContextDtoSchema.parse
      >['maintainedState']
    | null = null
  if (pending) {
    storedOccurrence.parse(pending)
    const snapshot = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse(
      await readPendingSnapshot(ctx, pending)
    )
    const context = snapshot.applicationContext
    if (
      snapshot.occurrenceId !== pending.id ||
      pending.campaignId !== campaign.id ||
      pending.expectedEncounterVersion !== row.version
    )
      throw new Error('Pending Encounter occurrence changed before actor removal.')
    if (
      context.kind === 'ENCOUNTER_DAMAGE_SAVE_CHECK' &&
      context.application.targetActorId === input.actorId
    )
      // A removed holder's pending repeat or massive-damage save is void with it; only Concentration
      // owes a cleanup.
      concentrationState = context.source === 'CONCENTRATION' ? context.maintainedState : null
    else if (
      mode === 'PUBLIC' &&
      (context.kind !== 'ENCOUNTER_INITIATIVE' ||
        context.root.expectedEncounterVersion !== row.version ||
        context.root.rootCommandId !== pending.rootCommandId ||
        !context.root.stagedInitiativeRoundState.participants.some(
          (actor) => actor.actorId === input.actorId
        ))
    )
      rejectDomain(
        'PENDING_DECISION',
        'Resolve the pending Encounter occurrence before removing this actor.'
      )
  }
  const now = new Date().toISOString()
  const version = row.version + 1
  const cleanup = absentCharacter
    ? null
    : await cleanupRemovedActorEffects(ctx, {
        state,
        actorId: input.actorId,
        occurredAt: now
      })
  if (
    concentrationState !== null &&
    !cleanup?.terminatedStates.some(
      (entry) =>
        entry.id === concentrationState.id &&
        entry.ownerActorId === input.actorId &&
        entry.expectedVersion === concentrationState.version &&
        entry.maintenanceDefinitionId === concentrationState.maintenanceDefinitionId &&
        entry.descriptorChecksum === concentrationState.descriptorChecksum
    )
  )
    throw new Error('Pending concentration cleanup did not terminate its maintained state.')

  const initiative = await removeActorInitiative(
    ctx,
    state,
    actors,
    input.actorId,
    now,
    absentCharacter !== null
  )
  const actorRow = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) => q.eq('encounterId', row.id).eq('id', input.actorId))
    .unique()
  if (!actorRow) throw new Error('Encounter actor was not found.')
  if (absentCharacter)
    await writeRunActor(
      ctx,
      actorRow._id,
      encounterRunActorStateSchema.parse({
        ...absentCharacter,
        absence: 'GM_REMOVED',
        updatedAt: now
      })
    )
  else {
    await deleteRunActor(ctx, actorRow)
    const binding = await ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (q) =>
        q.eq('encounterId', row.id).eq('actorId', input.actorId)
      )
      .unique()
    if (binding) await ctx.db.delete(binding._id)
  }

  const maintenance =
    cleanup ??
    (pending ? { terminatedStates: [], removedEffects: [], characterOwnerTransitions: [] } : null)
  let ruleOccurrenceId: string | null = null
  let ruleResultChecksum: string | null = null
  if (maintenance) {
    ruleOccurrenceId = pending?.id ?? crypto.randomUUID()
    const occurrenceVersion = pending ? pending.version + 1 : 0
    const result = maintenanceCompleteRuleExecutionResultDtoSchema.parse({
      status: 'MAINTENANCE_COMPLETE',
      schemaVersion: 1,
      occurrenceId: ruleOccurrenceId,
      occurrenceVersion,
      encounterId: row.id,
      removedActorId: input.actorId,
      reason: 'ACTOR_REMOVED',
      ...maintenance
    })
    const occurrence = encounterStoredRuleOccurrenceSchema.parse({
      id: ruleOccurrenceId,
      campaignId: campaign.id,
      encounterId: row.id,
      rootCommandId: pending?.rootCommandId ?? input.commandId,
      state: 'COMPLETED',
      version: occurrenceVersion,
      expectedEncounterVersion: version,
      pendingSnapshotChecksum: await writePendingSnapshot(
        ctx,
        { id: ruleOccurrenceId, encounterId: row.id },
        null
      ),
      completedAt: now,
      createdAt: pending?.createdAt ?? now,
      updatedAt: now
    })
    if (pending) await ctx.db.patch(pending._id, changedFields(pending, occurrence))
    else await ctx.db.insert('encounterRuleOccurrences', occurrence)
    const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
      schemaVersion: 1,
      transition: 'MAINTENANCE_CLEANUP',
      commandType: 'REMOVE_ACTOR',
      expectedAggregateVersion: row.version,
      expectedOccurrenceVersion: pending?.version ?? null,
      removedActorId: input.actorId
    })
    ruleResultChecksum = checksumCanonicalJson(result)
    await ctx.db.insert(
      'encounterRuleReceipts',
      encounterStoredRuleReceiptSchema.parse({
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        encounterId: row.id,
        occurrenceId: ruleOccurrenceId,
        commandId: input.commandId,
        commandType: 'REMOVE_ACTOR',
        commandFingerprint: fingerprint,
        encounterVersion: version,
        commandMetadataJson: JSON.stringify(metadata),
        resultJson: JSON.stringify(result),
        resultChecksum: ruleResultChecksum,
        actorUserId: userId,
        correlationId: null,
        createdAt: now
      })
    )
  }
  const currentActorId = state.currentActorId === input.actorId ? null : state.currentActorId
  const nextState = encounterRunStateSchema.parse({
    ...state,
    actorIds: absentCharacter
      ? state.actorIds
      : state.actorIds.filter((id) => id !== input.actorId),
    currentActorId,
    turnSequence:
      currentActorId === state.currentActorId ? state.turnSequence : state.turnSequence + 1,
    reminders: absentCharacter
      ? state.reminders
      : state.reminders.filter((reminder) => reminder.actorId !== input.actorId),
    version,
    updatedAt: now
  })
  await ctx.db.patch(row._id, {
    version,
    updatedAt: now,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState)
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection: await readEncounterGmProjection(ctx, nextState),
    roll: null,
    occurrence: null
  })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: row.id,
      commandId: input.commandId,
      commandType: 'REMOVE_ACTOR',
      commandFingerprint: fingerprint,
      actorUserId: userId,
      version,
      commandJson: JSON.stringify(input),
      ...encounterReplayReceipt(result),
      createdAt: now,
      ruleOccurrenceId,
      ruleResultChecksum,
      initiativeStateJson: initiative === null ? null : JSON.stringify(initiative),
      initiativeStateChecksum: initiative === null ? null : checksumCanonicalJson(initiative)
    })
  )
  return result
}

async function requireOwnedCharacterActor(
  ctx: EncounterPersistenceTransaction,
  actor: Awaited<ReturnType<typeof readRunActors>>[number],
  userId: string
) {
  const characterId = actor.sourceId
  if (actor.kind !== 'CHARACTER' || !characterId)
    throw new Error('Encounter actor is not a Character.')
  const character = await ctx.ports.readCharacterRow(characterId)
  if (!character || character.userId !== userId)
    throw new Error('Encounter Character is unavailable for account cleanup.')
  ctx.ports.readCharacterRecord(character)
}
