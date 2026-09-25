import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  type EncounterExecuteInput
} from '@artificer-toolkit/schema/api/encounters'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
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
import type { MutationCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { readCharacterRecord } from '../characters/stateDocuments'
import { readEncounterActorCore, readRunActors, readRunProjection, readRunState } from './documents'
import { validateInitiativeCursor } from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import { cleanupRemovedActorEffects } from './actorRemovalEffects'
import { removeActorInitiative } from './actorRemovalInitiative'
import { insertRunCommand, requireUnusedEvidenceCommandId } from './timelineEntries'
import { rejectDomain } from '../lib/domainRejections'

type RemoveActorCommand = Extract<EncounterExecuteInput['command'], { type: 'REMOVE_ACTOR' }>
type Campaign = Awaited<ReturnType<typeof requireCampaignAuthority>>['campaign']
type RemovalMode = 'PUBLIC' | 'ACCOUNT_CLEANUP'

const storedOccurrence = encounterStoredRuleOccurrenceSchema.clone({
  ...encounterStoredRuleOccurrenceSchema._zod.def,
  catchall: undefined
})
const storedReceipt = encounterStoredRuleReceiptSchema.clone({
  ...encounterStoredRuleReceiptSchema._zod.def,
  catchall: undefined
})

export async function removeEncounterActor(
  ctx: MutationCtx,
  command: RemoveActorCommand,
  userId: string
) {
  const input = normalizeRemoveActorCommand(command)
  const row = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!row) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await requireCampaignAuthority(ctx, row.campaignId, userId)
  if (membership.role !== 'OWNER') throw new Error('Campaign not found.')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (row.gameSystemId !== campaign.gameSystemId)
    throw new Error('Encounter does not match the Campaign Game System.')
  return removeEncounterActorCore(ctx, input, userId, campaign, 'PUBLIC')
}

/** Trusted lifecycle cleanup while the deleting account profile still exists. */
export async function removeAccountCharacterActors(
  ctx: MutationCtx,
  campaignId: string,
  userId: string
) {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
  if (!profile) throw new Error('Account profile is unavailable.')

  const storedCampaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', campaignId))
    .unique()
  if (!storedCampaign) throw new Error('Campaign not found.')
  const { campaign } = await requireCampaignAuthority(
    ctx,
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
      const character = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', characterId))
        .unique()
      if (!character || character.userId !== userId)
        throw new Error('Stored Encounter Character source is unavailable.')
      readCharacterRecord(character)
      targets.push({ encounterId: row.id, actorId: actor.id })
    }
  }

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
      'ACCOUNT_CLEANUP'
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
  ctx: MutationCtx,
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
    const result = encounterCommandResultDtoSchema.parse(JSON.parse(prior.resultJson))
    const projection = encounterGmProjectionDtoSchema.parse(result.projection)
    if (
      checksumCanonicalJson(JSON.parse(prior.commandJson)) !== fingerprint ||
      checksumCanonicalJson(result) !== prior.resultChecksum ||
      projection.id !== row.id ||
      projection.campaignId !== campaign.id ||
      projection.gameSystemId !== campaign.gameSystemId ||
      projection.version !== prior.version ||
      prior.version !== input.expectedVersion + 1 ||
      projection.actors.some((actor) => actor.id === input.actorId) ||
      projection.reminders.some((reminder) => reminder.actorId === input.actorId) ||
      projection.currentActorId === input.actorId ||
      result.roll !== null ||
      result.resolution !== null ||
      result.occurrence !== null
    )
      throw new Error('Stored actor removal receipt mismatch.')
    if (
      (prior.initiativeStateJson === null) !== (prior.initiativeStateChecksum === null) ||
      (projection.status === 'ACTIVE') !== (prior.initiativeStateJson !== null)
    )
      throw new Error('Stored actor removal initiative receipt mismatch.')
    if (prior.initiativeStateJson !== null) {
      const initiative = encounterInitiativeRoundStateDtoSchema.parse(
        JSON.parse(prior.initiativeStateJson)
      )
      if (
        checksumCanonicalJson(initiative) !== prior.initiativeStateChecksum ||
        initiative.round.encounterId !== row.id ||
        initiative.round.round !== projection.round
      )
        throw new Error('Stored actor removal initiative receipt mismatch.')
      validateInitiativeCursor({
        state: initiative,
        currentActorId: projection.currentActorId,
        actorIds: projection.actors.map((actor) => actor.id),
        // Historical side assignments are retained in this checksummed snapshot.
        allowedSideIds: initiative.participants.map((participant) => participant.sideId)
      })
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
    return result
  }

  if (row.version !== input.expectedVersion) rejectDomain('VERSION_STALE')
  if (row.status === 'COMPLETED') rejectDomain('ENCOUNTER_NOT_ACTIVE')
  const state = readRunState(row)
  const projection = readRunProjection(row)
  const actors = await readRunActors(ctx, state)
  const removed = actors.find((actor) => actor.id === input.actorId)
  if (!removed) throw new Error('Encounter actor was not found.')
  if (mode === 'ACCOUNT_CLEANUP') await requireOwnedCharacterActor(ctx, removed, userId)
  if (
    projection.actors.length !== actors.length ||
    new Set(projection.actors.map((actor) => actor.id)).size !== actors.length ||
    projection.actors.some((actor) => {
      const stored = actors.find((candidate) => candidate.id === actor.id)
      return (
        !stored ||
        checksumCanonicalJson(readEncounterActorCore(stored)) !==
          checksumCanonicalJson(readEncounterActorCore(actor))
      )
    }) ||
    projection.currentActorId !== state.currentActorId ||
    projection.round !== state.round ||
    checksumCanonicalJson(projection.reminders) !== checksumCanonicalJson(state.reminders)
  )
    throw new Error('Stored Encounter projection does not match the Run.')
  const pendingRows = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', row.id).eq('state', 'PENDING'))
    .take(2)
  if (pendingRows.length > 1) throw new Error('Encounter has multiple pending occurrences.')
  const pending = pendingRows[0] ?? null
  let concentrationState:
    | ReturnType<
        typeof encounterConcentrationDamageCheckPendingContextDtoSchema.parse
      >['maintainedState']
    | null = null
  if (pending) {
    storedOccurrence.parse(pending)
    const snapshot = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse(
      JSON.parse(pending.pendingSnapshotJson!)
    )
    const context = snapshot.applicationContext
    if (
      snapshot.occurrenceId !== pending.id ||
      pending.campaignId !== campaign.id ||
      pending.expectedEncounterVersion !== row.version ||
      checksumCanonicalJson(snapshot) !== pending.pendingSnapshotChecksum
    )
      throw new Error('Pending Encounter occurrence changed before actor removal.')
    if (
      context.kind === 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK' &&
      context.application.targetActorId === input.actorId
    )
      concentrationState = context.maintainedState
    else if (
      mode === 'PUBLIC' &&
      (context.kind !== 'ENCOUNTER_INITIATIVE' ||
        context.root.expectedEncounterVersion !== row.version ||
        context.root.rootCommandId !== pending.rootCommandId ||
        !context.root.stagedInitiativeRoundState.participants.some(
          (actor) => actor.actorId === input.actorId
        ))
    )
      throw new Error('Resolve the pending Encounter occurrence before removing this actor.')
  }
  const now = new Date().toISOString()
  const version = row.version + 1
  const cleanup = await cleanupRemovedActorEffects(ctx, {
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

  const projectedActors = projection.actors.filter((actor) => actor.id !== input.actorId)
  const initiative = await removeActorInitiative(ctx, state, input.actorId, now)
  const actorRow = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) => q.eq('encounterId', row.id).eq('id', input.actorId))
    .unique()
  if (!actorRow) throw new Error('Encounter actor was not found.')
  await ctx.db.delete(actorRow._id)
  const binding = await ctx.db
    .query('encounterActorTokenBindings')
    .withIndex('by_encounterId_actorId', (q) =>
      q.eq('encounterId', row.id).eq('actorId', input.actorId)
    )
    .unique()
  if (binding) await ctx.db.delete(binding._id)

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
      pendingSnapshotJson: null,
      pendingSnapshotChecksum: null,
      completedAt: now,
      createdAt: pending?.createdAt ?? now,
      updatedAt: now
    })
    if (pending) await ctx.db.replace(pending._id, occurrence)
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
  const reminders = state.reminders.filter((reminder) => reminder.actorId !== input.actorId)
  const nextState = encounterRunStateSchema.parse({
    ...state,
    actorIds: state.actorIds.filter((id) => id !== input.actorId),
    currentActorId,
    reminders,
    version,
    updatedAt: now
  })
  const nextProjection = encounterGmProjectionDtoSchema.parse({
    ...projection,
    actors: projectedActors,
    currentActorId,
    reminders,
    version,
    updatedAt: now
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection: nextProjection,
    roll: null,
    resolution: null,
    occurrence: null
  })
  await ctx.db.patch(row._id, {
    version,
    updatedAt: now,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState),
    projectionJson: JSON.stringify(nextProjection),
    projectionChecksum: checksumCanonicalJson(nextProjection)
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
      resultJson: JSON.stringify(result),
      resultChecksum: checksumCanonicalJson(result),
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
  ctx: MutationCtx,
  actor: Awaited<ReturnType<typeof readRunActors>>[number],
  userId: string
) {
  const characterId = actor.sourceId
  if (actor.kind !== 'CHARACTER' || !characterId)
    throw new Error('Encounter actor is not a Character.')
  const character = await ctx.db
    .query('characters')
    .withIndex('by_publicId', (q) => q.eq('id', characterId))
    .unique()
  if (!character || character.userId !== userId)
    throw new Error('Encounter Character is unavailable for account cleanup.')
  readCharacterRecord(character)
}
