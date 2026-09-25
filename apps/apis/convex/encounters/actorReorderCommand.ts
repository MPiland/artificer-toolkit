import {
  encounterCommandInputDtoSchema,
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
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
import type { MutationCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { readEncounterActorCore, readRunActors, readRunProjection, readRunState } from './documents'
import { createEncounterInitiativeStore } from './initiativeStore'
import { validateInitiativeCursor } from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import { requireSnapshotIdentity } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { insertRunCommand, requireUnusedEvidenceCommandId } from './timelineEntries'
import { rejectDomain } from '../lib/domainRejections'

export async function reorderEncounterActors(
  ctx: MutationCtx,
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
  const { campaign, membership } = await requireCampaignAuthority(ctx, row.campaignId, userId)
  if (membership.role !== 'OWNER') throw new Error('Campaign not found.')
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
    const result = encounterCommandResultDtoSchema.parse(JSON.parse(prior.resultJson))
    const projection = encounterGmProjectionDtoSchema.parse(result.projection)
    if (
      checksumCanonicalJson(encounterCommandInputDtoSchema.parse(JSON.parse(prior.commandJson))) !==
        fingerprint ||
      checksumCanonicalJson(result) !== prior.resultChecksum ||
      projection.id !== row.id ||
      projection.campaignId !== campaign.id ||
      projection.gameSystemId !== campaign.gameSystemId ||
      projection.version !== prior.version ||
      prior.version !== input.expectedVersion + 1 ||
      projection.actors.length !== input.actorIds.length ||
      projection.actors.some(
        (actor, index) => actor.id !== input.actorIds[index] || actor.manualOrder !== index
      ) ||
      new Set(input.actorIds).size !== input.actorIds.length ||
      result.roll !== null ||
      result.occurrence !== null
    )
      throw new Error('Stored Encounter reorder receipt mismatch.')
    if (
      (prior.initiativeStateJson === null) !== (prior.initiativeStateChecksum === null) ||
      (projection.status === 'ACTIVE') !== (prior.initiativeStateJson !== null)
    )
      throw new Error('Stored Encounter reorder initiative receipt mismatch.')
    if (prior.initiativeStateJson !== null) {
      const initiative = encounterInitiativeRoundStateDtoSchema.parse(
        JSON.parse(prior.initiativeStateJson)
      )
      if (
        checksumCanonicalJson(initiative) !== prior.initiativeStateChecksum ||
        initiative.round.encounterId !== row.id ||
        initiative.round.round !== projection.round ||
        [...initiative.participants]
          .sort((a, b) => a.turnOrderOrdinal! - b.turnOrderOrdinal!)
          .some((participant, index) => participant.actorId !== input.actorIds[index])
      )
        throw new Error('Stored Encounter reorder initiative receipt mismatch.')
      validateInitiativeCursor({
        state: initiative,
        currentActorId: projection.currentActorId,
        actorIds: input.actorIds,
        allowedSideIds: initiative.participants.map((participant) => participant.sideId)
      })
    }
    return result
  }
  if (row.version !== input.expectedVersion) rejectDomain('VERSION_STALE')
  if (row.status === 'COMPLETED') rejectDomain('ENCOUNTER_NOT_ACTIVE')
  const state = readRunState(row)
  const projection = readRunProjection(row)
  const actors = await readRunActors(ctx, state)
  const requested = [...input.actorIds].sort()
  const expected = [...state.actorIds].sort()
  if (
    requested.length !== expected.length ||
    new Set(requested).size !== expected.length ||
    requested.some((id, index) => id !== expected[index])
  )
    throw new Error('Reorder must contain every Encounter actor exactly once.')
  for (const actor of actors) requireSnapshotIdentity(actor)
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
      actorIds: state.actorIds,
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
      actorIds: input.actorIds,
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
    await ctx.db.replace(round._id, initiative.round)
    for (const participant of initiative.participants) {
      const stored = await ctx.db
        .query('encounterInitiativeParticipants')
        .withIndex('by_encounterId_round_actorId', (q) =>
          q.eq('encounterId', row.id).eq('round', state.round).eq('actorId', participant.actorId)
        )
        .unique()
      if (!stored || stored.version !== participant.version - 1)
        throw new Error('Initiative participant changed before reorder.')
      await ctx.db.replace(stored._id, participant)
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
      await ctx.db.replace(stored._id, side)
    }
  }
  for (const actor of actors) {
    const stored = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', row.id).eq('id', actor.id))
      .unique()
    if (!stored || stored.stateChecksum !== checksumCanonicalJson(actor))
      throw new Error('Encounter actor changed before reorder.')
    const next = encounterRunActorStateSchema.parse({
      ...actor,
      manualOrder: input.actorIds.indexOf(actor.id),
      updatedAt: now
    })
    await ctx.db.patch(stored._id, {
      stateJson: JSON.stringify(next),
      stateChecksum: checksumCanonicalJson(next)
    })
  }
  const version = row.version + 1
  const nextState = encounterRunStateSchema.parse({
    ...state,
    actorIds: input.actorIds,
    version,
    updatedAt: now
  })
  const nextProjection = encounterGmProjectionDtoSchema.parse({
    ...projection,
    actors: input.actorIds.map((id, index) => ({
      ...projection.actors.find((actor) => actor.id === id)!,
      manualOrder: index
    })),
    version,
    updatedAt: now
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection: nextProjection,
    roll: null,
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
      commandType: 'REORDER',
      commandFingerprint: fingerprint,
      actorUserId: userId,
      version,
      commandJson: JSON.stringify(input),
      resultJson: JSON.stringify(result),
      resultChecksum: checksumCanonicalJson(result),
      createdAt: now,
      initiativeStateJson: initiative === null ? null : JSON.stringify(initiative),
      initiativeStateChecksum: initiative === null ? null : checksumCanonicalJson(initiative)
    })
  )
  return result
}
