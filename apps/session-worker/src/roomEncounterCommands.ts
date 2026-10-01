import { reorderEncounterActors } from '@artificer-toolkit/encounter-persistence/actorReorderCommand'
import { removeEncounterActor } from '@artificer-toolkit/encounter-persistence/actorRemovalCommand'
import { reinforceEncounterActors } from '@artificer-toolkit/encounter-persistence/actorReinforcementCommand'
import { recordEncounterToolCommand } from '@artificer-toolkit/encounter-persistence/commands'
import { revertLastEncounterAction } from '@artificer-toolkit/encounter-persistence/actionRevert'
import { presentEncounterResultForMember } from '@artificer-toolkit/encounter-persistence/resultPresentation'
import {
  encounterGmProjectionDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import type { RoomNativeEncounterCommand } from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import {
  liveSessionRoomPlayAuthorizationSchema,
  type LiveSessionRoomAuthorization
} from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'
import { roomEncounterReadTransaction } from './roomEncounterReadPorts.js'
import { roomEncounterWriteTransaction } from './roomEncounterWritePorts.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { EncounterReadContext } from '@artificer-toolkit/encounter-persistence/store'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { executeRoomEncounterTurn } from './roomEncounterTurns.js'
import {
  readRoomEncounterResponseRoute,
  roomOwnsEncounterVoid
} from './roomEncounterResponseRouting.js'
import { executeRoomEncounterConcentrationResponse } from './roomEncounterConcentrationResponse.js'
import { executeRoomEncounterCleavingResponse } from './roomEncounterCleavingResponse.js'
import { executeRoomEncounterAction } from './roomEncounterActions.js'
import { executeRoomEncounterDisarm } from './roomEncounterDisarm.js'
import { executeRoomEncounterBasicAction } from './roomEncounterBasicActions.js'
import {
  prepareRuleOccurrenceVoid,
  recordRuleOccurrenceVoid
} from '@artificer-toolkit/encounter-persistence/occurrenceVoid'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { NativeLiveSessionEnvironment } from './liveSessionRoutes.js'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import type { LiveCaptureReads } from './nativeCaptureCache.js'

/** The enclosing command transaction also commits the room receipt before any recipient sees it. */
export async function executeRoomEncounterCommand(input: {
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  authorization: LiveSessionRoomAuthorization
  campaignId: string
  epoch: string
  userId: string
  recipientUserIds: string[]
  command: RoomNativeEncounterCommand
  random(maximum: number): number
  turnExecution?: {
    environment: NativeLiveSessionEnvironment
    runtime: RulesRuntimeService
    captures: LiveCaptureReads
  }
}) {
  const { store, transaction, inputs, authorization, campaignId, epoch, userId, command } = input
  await inputs.encounter(command.encounterId.toLowerCase(), transaction)
  const responseRoute =
    command.type === 'RESOLVE_RULE_OCCURRENCE'
      ? await readRoomEncounterResponseRoute(store, command)
      : null
  if (command.type === 'RESOLVE_RULE_OCCURRENCE' && responseRoute === null)
    throw new Error('This occurrence is not owned by an implemented room response path.')
  if (command.type === 'VOID_RULE_OCCURRENCE' && !(await roomOwnsEncounterVoid(store, command)))
    throw new Error('This void is not owned by an implemented room response path.')
  const observed = inputs.revisions(campaignId, authorization.revisions)
  const context = await roomEncounterWriteTransaction({
    store,
    transaction,
    inputs,
    authorization,
    campaignId,
    epoch,
    userId,
    observed
  })
  const beforeRun = await context.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', command.encounterId.toLowerCase()))
    .unique()
  if (!beforeRun) throw new Error('Encounter is unavailable.')
  const state = readRunState(beforeRun)
  const characters = new Set(
    (await readRunActors(context, state)).flatMap((actor) =>
      actor.kind === 'CHARACTER' && !actor.frozenState ? [actor.sourceId] : []
    )
  )
  for (const characterId of characters) {
    if (inputs.characterIsCurrent(characterId, observed, transaction)) continue
    const { membership } = await context.ports.requireCampaignAuthority(campaignId, userId)
    await prepareRoomLiveCharacterSheet(
      store,
      inputs,
      {
        campaignId,
        authorityEpoch: epoch,
        characterId,
        expectedUserId: userId,
        expectedRole: membership.role
      },
      observed,
      transaction
    )
  }
  const removed =
    command.type === 'REMOVE_ACTOR'
      ? await context.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q
              .eq('encounterId', command.encounterId.toLowerCase())
              .eq('id', command.actorId.toLowerCase())
          )
          .unique()
      : null
  const rawResult =
    command.type === 'START' || command.type === 'ADVANCE_TURN'
      ? await executeTurn(command)
      : command.type === 'RESOLVE_ACTION'
        ? await executeAction(command)
        : command.type === 'RESOLVE_RULE_OCCURRENCE'
          ? await executeResponse(command)
          : command.type === 'VOID_RULE_OCCURRENCE'
            ? await executeVoid()
            : command.type === 'USE_BASIC_ACTION'
              ? await executeBasicAction()
              : command.type === 'REORDER'
                ? await reorderEncounterActors(context, command, userId)
                : command.type === 'REMOVE_ACTOR'
                  ? await removeEncounterActor(context, command, userId)
                  : command.type === 'REINFORCE'
                    ? await reinforceEncounterActors(context, command, userId)
                    : command.type === 'REVERT_LAST_ACTION'
                      ? await revertLastEncounterAction(context, command, userId)
                      : await recordEncounterToolCommand(context, command, userId, input.random)
  const parsedGm = encounterGmProjectionDtoSchema.safeParse(rawResult.projection)
  const currentRun = await context.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', state.id))
    .unique()
  if (!currentRun) throw new Error('Committed room Encounter is unavailable.')
  const projection = parsedGm.success
    ? parsedGm.data
    : await readEncounterGmProjection(context, readRunState(currentRun))
  const result = { ...rawResult, projection }
  const checkpointBeforeAcknowledgement =
    command.type === 'START' ||
    command.type === 'COMPLETE' ||
    projection.round !== readRunState(beforeRun).round ||
    (removed !== null &&
      encounterRunActorStateSchema.parse(JSON.parse(removed.stateJson)).kind === 'CHARACTER')
  const recipients = new Map<string, EncounterCommandResultDto>()
  for (const recipient of new Set([userId, ...input.recipientUserIds])) {
    const { campaign, membership } = await context.ports.requireCampaignAuthority(
      campaignId,
      recipient
    )
    recipients.set(
      recipient,
      await presentEncounterResultForMember(context, {
        campaign,
        membership,
        result: { ...result, roll: recipient === userId ? result.roll : null }
      })
    )
  }
  const play = await readRoomEncounterPlayAuthorization(context, campaignId, authorization.play)
  return { recipients, play, checkpointBeforeAcknowledgement }

  async function executeTurn(command: Parameters<typeof executeRoomEncounterTurn>[0]['command']) {
    if (!input.turnExecution) throw new Error('Room turn execution is unavailable.')
    const { membership } = await context.ports.requireCampaignAuthority(campaignId, userId)
    return executeRoomEncounterTurn({
      ...input.turnExecution,
      ctx: context,
      store,
      transaction,
      inputs,
      observed,
      command,
      random: input.random,
      scope: {
        campaignId,
        authorityEpoch: epoch,
        expectedUserId: userId,
        expectedRole: membership.role,
        encounterId: command.encounterId.toLowerCase(),
        expectedVersion: command.expectedVersion
      }
    })
  }

  async function executeBasicAction() {
    if (command.type !== 'USE_BASIC_ACTION' || !input.turnExecution)
      throw new Error('Room basic action execution is unavailable.')
    const { membership } = await context.ports.requireCampaignAuthority(campaignId, userId)
    return executeRoomEncounterBasicAction({
      ...input.turnExecution,
      ctx: context,
      store,
      transaction,
      inputs,
      observed,
      command,
      scope: {
        campaignId,
        authorityEpoch: epoch,
        expectedUserId: userId,
        expectedRole: membership.role,
        encounterId: command.encounterId.toLowerCase(),
        expectedVersion: command.expectedVersion
      }
    })
  }

  async function executeResponse(command: ResolveRuleOccurrenceInputDto) {
    const route = await readRoomEncounterResponseRoute(store, command)
    if (!input.turnExecution || route === null)
      throw new Error('Room response execution is unavailable.')
    if (route === 'TURN') return executeTurn(command)
    if (route === 'ACTION') return executeAction(command)
    if (route === 'DISARM') return executeDisarm(command)
    const { membership } = await context.ports.requireCampaignAuthority(campaignId, userId)
    const execute =
      route === 'CLEAVING'
        ? executeRoomEncounterCleavingResponse
        : executeRoomEncounterConcentrationResponse
    return execute({
      ...input.turnExecution,
      ctx: context,
      store,
      transaction,
      inputs,
      observed,
      command,
      random: input.random,
      scope: {
        campaignId,
        authorityEpoch: epoch,
        expectedUserId: userId,
        expectedRole: membership.role,
        encounterId: command.encounterId.toLowerCase(),
        expectedVersion: command.expectedVersion
      }
    })
  }

  async function executeAction(
    command: Parameters<typeof executeRoomEncounterAction>[0]['command']
  ) {
    if (command.type === 'RESOLVE_ACTION' && command.optionalCombatIntent != null)
      return executeDisarm(command)
    if (!input.turnExecution) throw new Error('Room action execution is unavailable.')
    const { membership } = await context.ports.requireCampaignAuthority(campaignId, userId)
    return executeRoomEncounterAction({
      ...input.turnExecution,
      ctx: context,
      store,
      transaction,
      inputs,
      observed,
      command,
      random: input.random,
      scope: {
        campaignId,
        authorityEpoch: epoch,
        expectedUserId: userId,
        expectedRole: membership.role,
        encounterId: command.encounterId.toLowerCase(),
        expectedVersion: command.expectedVersion
      }
    })
  }

  async function executeVoid() {
    if (command.type !== 'VOID_RULE_OCCURRENCE')
      throw new Error('Room void execution is unavailable.')
    const prepared = await prepareRuleOccurrenceVoid(context, command)
    if (prepared.kind === 'COMPLETE') return prepared.result
    if (prepared.kind === 'DECLINE') await executeResponse(prepared.command)
    return recordRuleOccurrenceVoid(context, command)
  }

  async function executeDisarm(
    command: Parameters<typeof executeRoomEncounterDisarm>[0]['command']
  ) {
    if (!input.turnExecution) throw new Error('Room Disarm execution is unavailable.')
    const { membership } = await context.ports.requireCampaignAuthority(campaignId, userId)
    return executeRoomEncounterDisarm({
      ...input.turnExecution,
      ctx: context,
      store,
      transaction,
      inputs,
      observed,
      command,
      random: input.random,
      scope: {
        campaignId,
        authorityEpoch: epoch,
        expectedUserId: userId,
        expectedRole: membership.role,
        encounterId: command.encounterId.toLowerCase(),
        expectedVersion: command.expectedVersion
      }
    })
  }
}

/** Rebuilds room-owned controls from committed native facts, including after memory eviction. */
export async function readRoomEncounterPlayAuthorization(
  ctx: EncounterReadContext,
  campaignId: string,
  held: LiveSessionRoomAuthorization['play'],
  binding?: Pick<
    NonNullable<LiveSessionRoomAuthorization['play']['encounter']>,
    'encounterId' | 'sceneId'
  >
): Promise<LiveSessionRoomAuthorization['play'] | null> {
  const bound = binding ?? held.encounter
  if (!bound) return null
  const row = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', bound.encounterId))
    .unique()
  if (!row) return null
  if (row.campaignId !== campaignId) throw new Error('Room Encounter Campaign mismatch.')
  const state = readRunState(row)
  const actors = await readRunActors(ctx, state)
  const bindings = await ctx.db
    .query('encounterActorTokenBindings')
    .withIndex('by_encounterId_tokenId', (q) => q.eq('encounterId', row.id))
    .collect()
  if (bindings.some((binding) => binding.sceneId !== bound.sceneId))
    throw new Error('Room Encounter token Scene mismatch.')
  return liveSessionRoomPlayAuthorizationSchema.parse({
    encounter: {
      ...bound,
      healthDisplayDefault: state.healthDisplayDefault,
      actors: actors.map(({ id, kind, sourceId, controllerUserIds, healthDisplay }) => ({
        id,
        kind,
        sourceId,
        controllerUserIds,
        healthDisplay
      })),
      tokens: bindings.map(({ tokenId, actorId }) => ({ tokenId, actorId }))
    }
  })
}
/** A retry keeps its original result at that version, and shows the current Run after later work. */
export async function replayRoomEncounterCommand(input: {
  store: RoomEncounterStore
  inputs: RoomInputs
  authorization: LiveSessionRoomAuthorization
  userId: string
  result: EncounterCommandResultDto
}) {
  const { store, inputs, authorization, userId, result } = input
  const recorded = result.projection
  const epoch = store.epoch
  if (!epoch) throw new Error('Room Encounter epoch is unavailable.')
  const row = await store.store
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', recorded.id))
    .unique()
  if (!row || row.campaignId !== recorded.campaignId || row.version < recorded.version)
    throw new Error('Stored local Encounter receipt does not match its Run.')
  const system = inputs.systemSnapshot()
  const savedGm = encounterGmProjectionDtoSchema.safeParse(recorded)
  const projection =
    row.version === recorded.version && savedGm.success
      ? savedGm.data
      : await readEncounterGmProjection(
          {
            db: store.store,
            ports: {
              readCharacterPlay,
              requireSystem: async (id) => {
                if (id !== system.id) throw new Error('Room Encounter System mismatch.')
                return system
              }
            }
          },
          readRunState(row)
        )
  const ctx = await roomEncounterReadTransaction({
    store,
    inputs,
    authorization,
    campaignId: recorded.campaignId,
    epoch,
    userId,
    observed: inputs.revisions(recorded.campaignId, authorization.revisions)
  })
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(
    recorded.campaignId,
    userId
  )
  return presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result: { ...result, projection }
  })
}
