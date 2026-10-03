import { recordEncounterCommand } from '@artificer-toolkit/encounter-persistence/commands'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { listActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import { presentEncounterResultForMember } from '@artificer-toolkit/encounter-persistence/resultPresentation'
import { isCharacterSheetLivePlayCommand } from '@artificer-toolkit/schema/api/characterSheetLiveCommands'
import { CharacterSheetCommandError } from '@artificer-toolkit/rules-runtime/character/sheetCommandError'
import {
  encounterGmProjectionDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
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
  refuseUnroutedEncounterDecision,
  requireEncounterDecisionResponder,
  roomOwnsEncounterVoid
} from './roomEncounterResponseRouting.js'
import { executeRoomCharacterSheetCommand } from './roomCharacterSheetCommands.js'
import { projectRoomCharacterSheet } from './roomCharacterSheetProjection.js'
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
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { executeEncounterActorTokenBinding } from '@artificer-toolkit/encounter-persistence/actorTokenBindingPersistence'
import { parseSceneLiveEntity } from '@artificer-toolkit/encounter-persistence/sceneLiveState'
import type { EncounterActorTokenBindingCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import { roomSceneTokenReaders } from './roomActionSceneInputs.js'
import { readRoomScene } from './roomSceneRead.js'

/** The room journal's fingerprint of an Encounter command: a reused command ID must match it. */
export function roomEncounterCommandFingerprint(command: RoomNativeEncounterCommand) {
  return checksumCanonicalJson({ command, scope: 'ENCOUNTER' })
}

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
  /** The room's presented Scene; actor-token bindings change only its tokens. */
  presentedSceneId?: string | null
  random(maximum: number): number
  turnExecution?: { runtime: RulesRuntimeService }
}) {
  const { store, transaction, inputs, authorization, campaignId, epoch, userId, command } = input
  await inputs.encounter(command.encounterId.toLowerCase(), transaction)
  const observed = inputs.revisions(campaignId, authorization.revisions)
  const written = await roomEncounterWriteTransaction({
    store,
    transaction,
    inputs,
    authorization,
    campaignId,
    epoch,
    userId,
    observed
  })
  const context: EncounterWriteTransaction = {
    ...written,
    ports: {
      ...written.ports,
      // A GM's Sheet command on an Encounter Character commits on the Run's held play (R06.3); a
      // Run that is not ACTIVE holds no play, so that edit belongs to the Sheet itself.
      executeCharacterCommand: async (caller, { characterId, command: sheetCommand }, encounterId) => {
        const run = await written.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', encounterId.toLowerCase()))
          .unique()
        if (
          !isCharacterSheetLivePlayCommand(sheetCommand) ||
          sheetCommand.type === 'SET_PARTY_VISIBILITY' ||
          (run !== null && readRunState(run).status !== 'ACTIVE')
        )
          throw new CharacterSheetCommandError('Make this change from the Character Sheet.')
        const executed = await executeRoomCharacterSheetCommand({
          store,
          transaction,
          inputs,
          authorization,
          campaignId,
          epoch,
          userId: caller,
          command: { scope: 'CHARACTER_SHEET', characterId, encounterId, command: sheetCommand }
        })
        const { historyEntry, streamVersion } = executed.acknowledgement
        if (!historyEntry) throw new Error('Character Sheet command receipt is unavailable.')
        const { overview } = projectRoomCharacterSheet(
          executed.facts,
          await listActiveRuleEffects(
            written,
            { kind: 'CHARACTER', characterId: characterId.toLowerCase() },
            { ownerVerified: true }
          )
        )
        return {
          historyEventId: historyEntry.eventId,
          streamVersion,
          currentHitPoints: overview.currentHitPoints,
          maxHitPoints: overview.maxHitPoints,
          tempHitPoints: overview.tempHitPoints,
          conditions: overview.conditions
        }
      }
    }
  }
  const beforeRun = await context.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', command.encounterId.toLowerCase()))
    .unique()
  if (!beforeRun) throw new Error('Encounter is unavailable.')
  if (command.type === 'RESOLVE_RULE_OCCURRENCE' || command.type === 'VOID_RULE_OCCURRENCE') {
    const route = await readRoomEncounterResponseRoute(store, command)
    const routed =
      command.type === 'RESOLVE_RULE_OCCURRENCE'
        ? route !== null
        : await roomOwnsEncounterVoid(store, command)
    // The presented Scene's movement path settles its own Run's movement first, so a movement
    // decision here belongs to an Encounter the presented Scene is not bound to (D42).
    if (route === 'MOVEMENT' && (command.type === 'RESOLVE_RULE_OCCURRENCE' || !routed))
      rejectDomain('SCENE_NOT_PRESENTED')
    if (!routed) await refuseUnroutedEncounterDecision(context, beforeRun, userId, command)
    // A recorded command is a retry: its planner's admission replays or refuses it on its receipt,
    // a Run command or a rule receipt (an action's evidence answer records only the latter).
    if (command.type === 'RESOLVE_RULE_OCCURRENCE') {
      const key = { campaignId: beforeRun.campaignId, commandId: command.commandId.toLowerCase() }
      const recorded = await Promise.all([
        context.db
          .query('encounterRunCommands')
          .withIndex('by_campaignId_commandId', (q) =>
            q.eq('campaignId', key.campaignId).eq('commandId', key.commandId)
          )
          .unique(),
        context.db
          .query('encounterRuleReceipts')
          .withIndex('by_campaignId_commandId', (q) =>
            q.eq('campaignId', key.campaignId).eq('commandId', key.commandId)
          )
          .unique()
      ])
      if (!recorded.some((receipt) => receipt?.encounterId === beforeRun.id))
        await requireEncounterDecisionResponder(context, beforeRun, userId, command)
    }
  }
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
              : command.type === 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING' ||
                  command.type === 'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
                ? await executeTokenBinding(command)
                : await recordEncounterCommand(context, command, userId, input.random)
  const parsedGm = encounterGmProjectionDtoSchema.safeParse(rawResult.projection)
  const currentRun = await context.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', state.id))
    .unique()
  if (!currentRun) throw new Error('Committed room Encounter is unavailable.')
  if (beforeRun.status !== 'ACTIVE' && currentRun.status === 'ACTIVE') {
    // The store fences the Runs it holds; a Run already ACTIVE in Convex when this one loaded is
    // not held here, and still holds the Campaign's one active Encounter.
    const activeEncounterId = inputs.activeEncounterIdAtLoad(state.id, transaction)
    if (
      activeEncounterId !== null &&
      activeEncounterId !== state.id &&
      !(await context.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', activeEncounterId))
        .unique())
    )
      rejectDomain('ACTIVE_ENCOUNTER_EXISTS')
  }
  const projection = parsedGm.success
    ? parsedGm.data
    : await readEncounterGmProjection(context, readRunState(currentRun))
  const result = { ...rawResult, projection }
  // The table's token-binding view reads Convex, so a binding is durable before it is acknowledged.
  const checkpointBeforeAcknowledgement =
    command.type === 'START' ||
    command.type === 'COMPLETE' ||
    command.type === 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING' ||
    command.type === 'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING' ||
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

  async function executeTokenBinding(command: EncounterActorTokenBindingCommandInputDto) {
    const readers = roomSceneTokenReaders(transaction)
    return executeEncounterActorTokenBinding(context, command, {
      readScene: async (sceneId) => {
        if (sceneId !== input.presentedSceneId?.toLowerCase()) rejectDomain('SCENE_NOT_PRESENTED')
        return readRoomScene(transaction, sceneId).header
      },
      hasToken: async (sceneId, tokenId) => {
        const { header } = readRoomScene(transaction, sceneId)
        const live = await readers.readLiveToken(sceneId, tokenId)
        if (live) return parseSceneLiveEntity(live, header.version).value?.collection === 'tokens'
        const base = await readers.readDefinitionToken(header.definitionSaveId, tokenId)
        if (!base) return false
        if (
          base.value.collection !== 'tokens' ||
          base.value.entity.id !== base.entityId ||
          base.checksum !== checksumCanonicalJson(base.value)
        )
          throw new Error('Stored Scene token is inconsistent.')
        return true
      }
    })
  }

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
      encounterId: bound.encounterId,
      sceneId: bound.sceneId,
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
