import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  type EncounterExecuteInput
} from '@artificer-toolkit/schema/api/encounters'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRunActorSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { encounterInitiativeRoundStateDtoSchema } from '@artificer-toolkit/schema/shared/initiativeState'
import { AUTHORED_LIMITS } from '@artificer-toolkit/shared/utils/authoringLimits'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import {
  bindEncounterActorRuleOutputToFacts,
  reconcileEncounterActorRuleOutput
} from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { projectGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { MutationCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { snapshotBlueprintEnemies } from './blueprintSnapshots'
import { readEncounterCharacterStates } from './characterStates'
import { readEncounterActorCore, readRunActors, readRunProjection, readRunState } from './documents'
import { insertReinforcementInitiative } from './actorReinforcementInitiative'
import { validateInitiativeCursor } from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import { requireSnapshotIdentity } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { insertRunCommand, requireUnusedEvidenceCommandId } from './timelineEntries'
import { rejectDomain } from '../lib/domainRejections'

type ReinforceCommand = Extract<EncounterExecuteInput['command'], { type: 'REINFORCE' }>

function sameActorCore(left: unknown, right: unknown) {
  return (
    checksumCanonicalJson(readEncounterActorCore(left)) ===
    checksumCanonicalJson(readEncounterActorCore(right))
  )
}

function normalize(command: ReinforceCommand) {
  return {
    ...command,
    encounterId: command.encounterId.toLowerCase(),
    commandId: command.commandId.toLowerCase(),
    ...(command.sideId === undefined ? {} : { sideId: command.sideId.toLowerCase() }),
    enemy:
      command.enemy.kind === 'CREATURE'
        ? { ...command.enemy, sourceId: command.enemy.sourceId.toLowerCase() }
        : command.enemy
  }
}

function requireHistoricalActor(input: {
  command: ReturnType<typeof normalize>
  actor: ReturnType<typeof encounterRunActorStateSchema.parse>
  projection: ReturnType<typeof encounterGmProjectionDtoSchema.parse>
  reinforcedActorId: string
}) {
  const { command, actor, projection, reinforcedActorId } = input
  requireSnapshotIdentity(actor)
  const projected = projection.actors.find((candidate) => candidate.id === reinforcedActorId)
  if (
    actor.id !== reinforcedActorId ||
    actor.encounterId !== command.encounterId ||
    !projected ||
    !sameActorCore(actor, projected) ||
    actor.systemId !== projection.gameSystemId ||
    actor.public !== command.public ||
    (command.sideId !== undefined && actor.sideId !== command.sideId) ||
    (command.enemy.kind === 'CREATURE'
      ? actor.kind !== 'CREATURE' ||
        actor.sourceId !== command.enemy.sourceId ||
        actor.sourceRevision === null
      : actor.kind !== 'CUSTOM' ||
        actor.sourceId !== null ||
        actor.sourceRevision !== null ||
        actor.label !== command.enemy.label ||
        actor.maxHitPoints !== command.enemy.maxHitPoints)
  )
    throw new Error('Stored actor reinforcement receipt mismatch.')
}

export async function reinforceEncounterActors(
  ctx: MutationCtx,
  command: ReinforceCommand,
  userId: string
) {
  const input = normalize(command)
  const row = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', input.encounterId))
    .unique()
  if (!row) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await requireCampaignAuthority(ctx, row.campaignId, userId)
  if (membership.role !== 'OWNER') rejectDomain('GM_ONLY')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (row.gameSystemId !== campaign.gameSystemId)
    throw new Error('Encounter does not match the Campaign Game System.')
  await requireUnusedEvidenceCommandId(ctx, campaign.id, input.commandId)
  const fingerprint = checksumCanonicalJson(input)
  const prior = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (query) =>
      query.eq('campaignId', campaign.id).eq('commandId', input.commandId)
    )
    .unique()
  if (prior) {
    if (
      prior.commandType !== 'REINFORCE' ||
      prior.encounterId !== row.id ||
      prior.actorUserId !== userId ||
      prior.commandFingerprint !== fingerprint
    )
      rejectDomain('COMMAND_ID_REUSED')
    const result = encounterCommandResultDtoSchema.parse(JSON.parse(prior.resultJson))
    const projection = encounterGmProjectionDtoSchema.parse(result.projection)
    const actor = encounterRunActorStateSchema.parse(JSON.parse(prior.reinforcedActorStateJson))
    if (
      checksumCanonicalJson(JSON.parse(prior.commandJson)) !== fingerprint ||
      checksumCanonicalJson(result) !== prior.resultChecksum ||
      checksumCanonicalJson(actor) !== prior.reinforcedActorStateChecksum ||
      projection.id !== row.id ||
      projection.campaignId !== campaign.id ||
      projection.gameSystemId !== campaign.gameSystemId ||
      projection.version !== prior.version ||
      prior.version !== input.expectedVersion + 1 ||
      result.roll !== null ||
      result.occurrence !== null
    )
      throw new Error('Stored actor reinforcement receipt mismatch.')
    requireHistoricalActor({
      command: input,
      actor,
      projection,
      reinforcedActorId: prior.reinforcedActorId
    })
    if ((prior.initiativeStateJson === null) !== (prior.initiativeStateChecksum === null))
      throw new Error('Stored actor reinforcement initiative receipt mismatch.')
    if (prior.initiativeStateJson !== null) {
      const initiative = encounterInitiativeRoundStateDtoSchema.parse(
        JSON.parse(prior.initiativeStateJson)
      )
      if (
        checksumCanonicalJson(initiative) !== prior.initiativeStateChecksum ||
        initiative.round.encounterId !== row.id ||
        initiative.round.round !== projection.round
      )
        throw new Error('Stored actor reinforcement initiative receipt mismatch.')
      validateInitiativeCursor({
        state: initiative,
        currentActorId: projection.currentActorId,
        actorIds: projection.actors.map((candidate) => candidate.id),
        allowedSideIds: initiative.participants.map((participant) => participant.sideId)
      })
    } else if (projection.status === 'ACTIVE') {
      throw new Error('Stored actor reinforcement initiative receipt mismatch.')
    }
    return result
  }
  if (row.version !== input.expectedVersion) rejectDomain('VERSION_STALE')
  if (row.status !== 'PREPARED' && row.status !== 'ACTIVE') rejectDomain('ENCOUNTER_NOT_ACTIVE')
  const state = readRunState(row)
  const projection = readRunProjection(row)
  const actors = await readRunActors(ctx, state)
  for (const currentActor of actors) requireSnapshotIdentity(currentActor)
  if (
    projection.actors.length !== actors.length ||
    new Set(projection.actors.map((actor) => actor.id)).size !== actors.length ||
    projection.actors.some((actor) => {
      const stored = actors.find((candidate) => candidate.id === actor.id)
      return !stored || !sameActorCore(stored, actor)
    }) ||
    projection.currentActorId !== state.currentActorId ||
    projection.round !== state.round ||
    checksumCanonicalJson(projection.reminders) !== checksumCanonicalJson(state.reminders)
  )
    throw new Error('Stored Encounter projection does not match the Run.')
  if (actors.length >= MAX_ENCOUNTER_ACTORS)
    throw new Error(`Encounters support at most ${MAX_ENCOUNTER_ACTORS} actors.`)
  const pending = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (query) =>
      query.eq('encounterId', row.id).eq('state', 'PENDING')
    )
    .take(1)
  if (pending.length > 0)
    throw new Error('Resolve the pending Encounter occurrence before reinforcing.')
  const sideId = input.sideId ?? state.sides.find((side) => side.sortOrder === 1)?.id
  if (!sideId || !state.sides.some((side) => side.id === sideId))
    throw new Error('Encounter side was not found.')
  const [enemy] = await snapshotBlueprintEnemies(ctx, userId, {
    gameSystemId: state.gameSystemId,
    enemies: [input.enemy]
  })
  if (!enemy || enemy.systemId !== state.gameSystemId)
    throw new Error('Encounter actor does not match the Campaign Game System.')
  const now = new Date().toISOString()
  const newActorId = crypto.randomUUID()
  let actor = encounterRunActorStateSchema.parse({
    id: newActorId,
    encounterId: row.id,
    sideId,
    kind: enemy.kind,
    sourceId: enemy.sourceId,
    sourceRevision: enemy.sourceRevision,
    label: enemy.label,
    systemId: enemy.systemId,
    stableTieKey: crypto.randomUUID(),
    public: input.public,
    controllerUserIds: [],
    disposition: 'HOSTILE',
    healthDisplay: null,
    currentHitPoints: enemy.maxHitPoints,
    maxHitPoints: enemy.maxHitPoints,
    tempHitPoints: 0,
    conditions: [],
    defeated: false,
    resources: {},
    gmNotes: null,
    initiative: input.initiative ?? null,
    manualOrder: null,
    snapshot: enemy.snapshot,
    createdAt: now,
    updatedAt: now
  })
  requireSnapshotIdentity(actor)
  if (
    new TextEncoder().encode(JSON.stringify(actor)).byteLength >
    AUTHORED_LIMITS.mutationPayloadBytes
  )
    throw new Error('Encounter actor snapshot is too large.')
  const initiative = await insertReinforcementInitiative({
    ctx,
    state,
    actors,
    actor,
    initiative: input.initiative,
    occurredAt: now
  })
  actor = encounterRunActorStateSchema.parse(initiative.actor)
  const nextActors = initiative.actors
  const nextState = encounterRunStateSchema.parse({
    ...state,
    actorIds: [...state.actorIds, actor.id],
    version: state.version + 1,
    updatedAt: now
  })
  const facts = buildEncounterActorRuleFacts({ actors: nextActors })
  const output = bindEncounterActorRuleOutputToFacts(
    reconcileEncounterActorRuleOutput(
      evaluateInstalledEncounterActors({
        gameSystemId: state.gameSystemId,
        facts
      }),
      facts
    ),
    facts
  )
  const nextProjection = encounterGmProjectionDtoSchema.parse(
    projectGm(
      {
        ...nextState,
        actors: nextActors,
        initiativeRoundState: initiative.state
      },
      output,
      await readEncounterCharacterStates(ctx, nextState, nextActors)
    )
  )
  const projectedActor = nextProjection.actors.find((candidate) => candidate.id === actor.id)
  if (!projectedActor || !sameActorCore(actor, projectedActor))
    throw new Error('Encounter actor projection does not match the Run.')
  const result = encounterCommandResultDtoSchema.parse({
    projection: nextProjection,
    roll: null,
    occurrence: null
  })
  for (const currentActor of actors) {
    const updatedActor = nextActors.find((candidate) => candidate.id === currentActor.id)
    if (!updatedActor) throw new Error('Encounter actor was not found.')
    if (checksumCanonicalJson(updatedActor) === checksumCanonicalJson(currentActor)) continue
    const actorRow = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (query) =>
        query.eq('encounterId', row.id).eq('id', currentActor.id)
      )
      .unique()
    if (!actorRow || actorRow.stateChecksum !== checksumCanonicalJson(currentActor))
      throw new Error('Encounter actor changed before reinforcement.')
    await ctx.db.patch(actorRow._id, {
      stateJson: JSON.stringify(updatedActor),
      stateChecksum: checksumCanonicalJson(updatedActor)
    })
  }
  await ctx.db.insert(
    'encounterRunActors',
    encounterStoredRunActorSchema.parse({
      id: actor.id,
      encounterId: row.id,
      stateJson: JSON.stringify(actor),
      stateChecksum: checksumCanonicalJson(actor)
    })
  )
  await ctx.db.patch(row._id, {
    version: nextState.version,
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
      commandType: 'REINFORCE',
      commandFingerprint: fingerprint,
      actorUserId: userId,
      version: nextState.version,
      commandJson: JSON.stringify(input),
      resultJson: JSON.stringify(result),
      resultChecksum: checksumCanonicalJson(result),
      createdAt: now,
      reinforcedActorId: actor.id,
      reinforcedActorStateJson: JSON.stringify(actor),
      reinforcedActorStateChecksum: checksumCanonicalJson(actor),
      initiativeStateJson: initiative.state === null ? null : JSON.stringify(initiative.state),
      initiativeStateChecksum:
        initiative.state === null ? null : checksumCanonicalJson(initiative.state)
    })
  )
  return result
}
