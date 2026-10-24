import { checksumRunActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import {
  encounterCommandInputDtoSchema,
  encounterCommandResultDtoSchema,
  type EncounterExecuteInput
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import {
  encounterInitiativeRoundStateDtoSchema,
  type EncounterInitiativeRoundStateDto
} from '@artificer-toolkit/schema/shared/initiativeState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readRunActors, readRunState, changedFields, writeRunActor } from './documents.js'
import {
  encounterReplayReceipt,
  readEncounterReplayReceipt,
  replayEncounterCommandResult
} from './replayReceipts.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import { createEncounterInitiativeStore } from './initiativeStore.js'
import {
  takesInitiativeTurns,
  validateInitiativeCursor
} from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import { requireSnapshotIdentity } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { insertRunCommand, requireUnusedEvidenceCommandId } from './timelineEntries.js'
import { rejectDomain } from './domainRejections.js'
import type { EncounterPersistenceTransaction } from './ports.js'

export async function reorderEncounterActors(
  ctx: EncounterPersistenceTransaction,
  command: Extract<EncounterExecuteInput['command'], { type: 'REORDER' }>,
  userId: string
) {
  const input = {
    ...command,
    encounterId: command.encounterId.toLowerCase(),
    commandId: command.commandId.toLowerCase(),
    actorIds: command.actorIds.map((id) => id.toLowerCase())
  }
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
  await requireUnusedEvidenceCommandId(ctx, campaign.id, input.commandId)
  const fingerprint = checksumCanonicalJson(input)
  const prior = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', input.commandId)
    )
    .unique()
  if (prior) {
    if (
      prior.commandType !== 'REORDER' ||
      prior.encounterId !== row.id ||
      prior.actorUserId !== userId ||
      prior.commandFingerprint !== fingerprint
    )
      rejectDomain('COMMAND_ID_REUSED')
    const replayReceipt = readEncounterReplayReceipt(prior)
    if (
      checksumCanonicalJson(encounterCommandInputDtoSchema.parse(JSON.parse(prior.commandJson))) !==
        fingerprint ||
      prior.version !== input.expectedVersion + 1 ||
      prior.version > row.version ||
      new Set(input.actorIds).size !== input.actorIds.length ||
      replayReceipt.roll !== null ||
      replayReceipt.occurrence !== null
    )
      throw new Error('Stored Encounter reorder receipt mismatch.')
    if ((prior.initiativeStateJson === null) !== (prior.initiativeStateChecksum === null))
      throw new Error('Stored Encounter reorder initiative receipt mismatch.')
    if (prior.initiativeStateJson !== null) {
      const initiative = encounterInitiativeRoundStateDtoSchema.parse(
        JSON.parse(prior.initiativeStateJson)
      )
      if (
        checksumCanonicalJson(initiative) !== prior.initiativeStateChecksum ||
        initiative.round.encounterId !== row.id ||
        [...initiative.participants]
          .sort((a, b) => a.turnOrderOrdinal! - b.turnOrderOrdinal!)
          .some((participant, index) => participant.actorId !== input.actorIds[index])
      )
        throw new Error('Stored Encounter reorder initiative receipt mismatch.')
    }
    return replayEncounterCommandResult(ctx, readRunState(row), prior)
  }
  if (row.version !== input.expectedVersion) rejectDomain('VERSION_STALE')
  if (row.status === 'COMPLETED') rejectDomain('ENCOUNTER_NOT_ACTIVE')
  const state = readRunState(row)
  const actors = await readRunActors(ctx, state)
  const requested = [...input.actorIds].sort()
  const expected = actors
    .filter(takesInitiativeTurns)
    .map((actor) => actor.id)
    .sort()
  if (
    requested.length !== expected.length ||
    new Set(requested).size !== expected.length ||
    requested.some((id, index) => id !== expected[index])
  )
    throw new Error('Reorder must contain every Encounter actor exactly once.')
  for (const actor of actors) requireSnapshotIdentity(actor)
  const pending = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', row.id).eq('state', 'PENDING'))
    .take(2)
  if (pending.length) throw new Error('Resolve the pending Encounter occurrence before reordering.')
  const now = new Date().toISOString()
  let initiative: EncounterInitiativeRoundStateDto | null = null
  if (state.status === 'ACTIVE') {
    const current = await createEncounterInitiativeStore(ctx).lockInitiativeRound({
      encounterId: row.id,
      round: state.round
    })
    if (
      !current ||
      current.round.policySnapshotChecksum !==
        (state.automationMode === 'MANUAL' ? null : state.initiativePolicySnapshotChecksum)
    )
      throw new Error('Initiative policy snapshot does not match the Encounter Run.')
    validateInitiativeCursor({
      state: current,
      currentActorId: state.currentActorId,
      actors,
      allowedSideIds: state.sides.map((side) => side.id)
    })
    const ordered = [...current.participants].sort(
      (a, b) => a.turnOrderOrdinal! - b.turnOrderOrdinal!
    )
    const activeIndex = ordered.findIndex(
      (participant) => participant.actorId === state.currentActorId
    )
    if (
      ordered
        .slice(0, activeIndex + 1)
        .some((participant, index) => participant.actorId !== input.actorIds[index])
    )
      throw new Error('Reorder must preserve the current turn and completed turns.')
    const participants = current.participants.map((participant) => ({
      ...participant,
      turnOrderOrdinal: input.actorIds.indexOf(participant.actorId),
      version: participant.version + 1,
      updatedAt: now
    }))
    const sideByActorId = new Map(actors.map((actor) => [actor.id, actor.sideId]))
    const requestedSides = input.actorIds
      .map((id) => sideByActorId.get(id)!)
      .filter((sideId, index, array) => index === 0 || sideId !== array[index - 1])
    const sides = current.sides.map((side) => ({
      ...side,
      sideOrderOrdinal: requestedSides.indexOf(side.sideId),
      version: side.version + 1,
      updatedAt: now
    }))
    initiative = encounterInitiativeRoundStateDtoSchema.parse({
      round: { ...current.round, version: current.round.version + 1, updatedAt: now },
      participants,
      sides
    })
    validateInitiativeCursor({
      state: initiative,
      currentActorId: state.currentActorId,
      actors,
      allowedSideIds: state.sides.map((side) => side.id)
    })
    const round = await ctx.db
      .query('encounterInitiativeRounds')
      .withIndex('by_encounterId_round', (q) =>
        q.eq('encounterId', row.id).eq('round', state.round)
      )
      .unique()
    if (!round || round.version !== current.round.version)
      throw new Error('Initiative round changed before reorder.')
    await ctx.db.patch(round._id, changedFields(round, initiative.round))
    for (const participant of initiative.participants) {
      const stored = await ctx.db
        .query('encounterInitiativeParticipants')
        .withIndex('by_encounterId_round_actorId', (q) =>
          q.eq('encounterId', row.id).eq('round', state.round).eq('actorId', participant.actorId)
        )
        .unique()
      if (!stored || stored.version !== participant.version - 1)
        throw new Error('Initiative participant changed before reorder.')
      await ctx.db.patch(stored._id, changedFields(stored, participant))
    }
    for (const side of initiative.sides) {
      const stored = await ctx.db
        .query('encounterInitiativeSides')
        .withIndex('by_encounterId_round_sideId', (q) =>
          q.eq('encounterId', row.id).eq('round', state.round).eq('sideId', side.sideId)
        )
        .unique()
      if (!stored || stored.version !== side.version - 1)
        throw new Error('Initiative side changed before reorder.')
      await ctx.db.patch(stored._id, changedFields(stored, side))
    }
  }
  for (const actor of actors) {
    const stored = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', row.id).eq('id', actor.id))
      .unique()
    if (!stored || stored.stateChecksum !== checksumRunActorPlayState(actor))
      throw new Error('Encounter actor changed before reorder.')
    const next = encounterRunActorStateSchema.parse({
      ...actor,
      manualOrder: input.actorIds.indexOf(actor.id),
      updatedAt: now
    })
    await writeRunActor(ctx, stored._id, next)
  }
  const version = row.version + 1
  const nextState = encounterRunStateSchema.parse({
    ...state,
    actorIds: input.actorIds,
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
      commandType: 'REORDER',
      commandFingerprint: fingerprint,
      actorUserId: userId,
      version,
      commandJson: JSON.stringify(input),
      ...encounterReplayReceipt(result),
      createdAt: now,
      initiativeStateJson: initiative === null ? null : JSON.stringify(initiative),
      initiativeStateChecksum: initiative === null ? null : checksumCanonicalJson(initiative)
    })
  )
  return result
}
