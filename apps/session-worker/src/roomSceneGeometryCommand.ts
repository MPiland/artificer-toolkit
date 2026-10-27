import { publishSceneGeometry } from '@artificer-toolkit/encounter-persistence/sceneGeometryPublication'
import { publishSpatialPending } from '@artificer-toolkit/encounter-persistence/spatialPendingPublication'
import { publishSpatialTerminal } from '@artificer-toolkit/encounter-persistence/spatialTerminalPublication'
import { publishMovementResponse } from '@artificer-toolkit/encounter-persistence/movementResolutionPublication'
import { readResponse } from '@artificer-toolkit/encounter-persistence/movementResolutionDocuments'
import { readMovementResponseResult } from '@artificer-toolkit/encounter-persistence/movementResolutionReads'
import {
  readSpatialPreparation,
  readMovementResolution,
  assertGeometryReceiving
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { persistMovementSettlements } from '@artificer-toolkit/encounter-persistence/movementSettlementPersistence'
import { applyConcealmentPrune } from '@artificer-toolkit/encounter-persistence/concealmentPrune'
import { recordZoneSightings } from '@artificer-toolkit/encounter-persistence/zoneSightings'
import {
  postMovementDecisionSkipped,
  recordRuleOccurrenceVoid
} from '@artificer-toolkit/encounter-persistence/occurrenceVoid'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { isDepartedCharacterActor } from '@artificer-toolkit/encounter-persistence/characterStates'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { liveSessionMovementPrepareInputSchema } from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { projectGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import {
  prepareStagedSceneCommit,
  type StagedSceneCommand,
  type StagedSceneContext
} from './roomSceneGeometryPlan.js'
import type { RoomSceneTokens } from './roomEncounterReadPorts.js'
import { roomEncounterWriteTransaction } from './roomEncounterWritePorts.js'
import { stageRoomSceneGeometry } from './roomSceneGeometryStaging.js'
import {
  roomSceneGeometryCallbacks,
  stageRoomSceneGeometryFog
} from './roomSceneGeometryPublication.js'
import { readRoomEncounterTurnCapture } from './roomEncounterTurnCapture.js'
import { readRoomSceneEntities, readRoomSceneHeader } from './roomSceneRead.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { readRoomMaintenanceCapture } from './roomMaintenanceCapture.js'
import { assertRoomEncounterRulesRevisions } from './roomEncounterTurns.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import { writeRoomSceneRow } from './roomSceneRecords.js'
import { roomMovementSettlementCallbacks } from './roomMovementSettlementCallbacks.js'
import { readRoomLiveMovementAdmission } from './roomSceneGeometryRead.js'

/** The caller commits this complete Scene/Encounter write set with its room journal receipt. */
export async function executeRoomSceneGeometry(input: {
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  authorization: LiveSessionRoomAuthorization
  campaignId: string
  epoch: string
  userId: string
  command: StagedSceneCommand
  context: StagedSceneContext
  sceneTokens: RoomSceneTokens
  runtime: RulesRuntimeService
  random(maximum: number): number
}) {
  const { store, transaction, inputs, authorization, campaignId, epoch, userId, command, context } =
    input
  const observed = inputs.revisions(campaignId, authorization.revisions)
  const held = authorization.play.encounter
  if (held?.sceneId === context.scene.id) await inputs.encounter(held.encounterId, transaction)
  const ctx = await roomEncounterWriteTransaction({
    store,
    transaction,
    inputs,
    authorization,
    campaignId,
    epoch,
    userId,
    observed,
    sceneTokens: input.sceneTokens
  })
  const { membership } = await ctx.ports.requireCampaignAuthority(campaignId, userId)
  const begun = await stageRoomSceneGeometry({
    ctx,
    transaction,
    command,
    context,
    observed
  })
  if (begun.kind !== 'READY') {
    const encounter =
      command.type === 'RESOLVE_RULE_OCCURRENCE'
        ? await readMovementResponseResult(ctx, command)
        : command.type === 'VOID_RULE_OCCURRENCE'
          ? await recordRuleOccurrenceVoid(ctx, command)
          : null
    return {
      scene: begun.result,
      encounter,
      nextScene: context.scene,
      fogChanged: false
    }
  }
  const presentation = {
    sceneId: context.scene.id,
    version: context.presentation.expectedPresentationVersion
  }
  const sceneInputs = { ctx, transaction, observed, presentation }
  const sceneCallbacks = roomSceneGeometryCallbacks(sceneInputs)
  const actor = {
    campaignId,
    authorityEpoch: epoch,
    expectedUserId: userId,
    expectedRole: membership.role
  }
  const stagedInput = begun.input
  const movement =
    stagedInput.type === 'MOVE_SCENE_TOKEN' && stagedInput.expectedEncounterVersion !== null
      ? {
          encounterId: begun.encounterId!,
          saveId: begun.saveId,
          baseTokenOrdinal:
            context.baseOrdinals.tokens.find((entry) => entry.tokenId === stagedInput.tokenId)
              ?.baseOrdinal ?? null
        }
      : null
  const captures: LiveCaptureReads = {
    encounterRules: (scope) =>
      readRoomEncounterTurnCapture(
        ctx,
        inputs,
        transaction,
        scope,
        observed.filter((entry) => entry.scope !== 'CHARACTER'),
        {
          readSceneHeader: async (id) => readRoomSceneHeader(transaction, id),
          readSceneEntities: (page) => readRoomSceneEntities(transaction, page)
        },
        presentation
      ),
    prepareCharacter: async (scope) => {
      if (
        !movement ||
        !scope.movement ||
        scope.movement.saveId !== movement.saveId ||
        scope.movement.encounterId !== movement.encounterId
      )
        throw new Error('Room movement Character scope mismatch.')
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', movement.encounterId))
        .unique()
      if (!run) throw new Error('Spatial Encounter is unavailable.')
      const state = readRunState(run)
      const actor = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', state.id).eq('id', scope.movement!.actorId)
        )
        .unique()
      if (!actor || !state.actorIds.includes(actor.id))
        throw new Error('Movement Character actor is unavailable.')
      const current = (await readRunActors(ctx, state)).find((entry) => entry.id === actor.id)
      if (current?.kind !== 'CHARACTER' || current.sourceId !== scope.characterId)
        throw new Error('Movement Character source is inconsistent.')
      if (await isDepartedCharacterActor(ctx, campaignId, current))
        rejectDomain('TARGET_UNAVAILABLE', 'That Character has left the Campaign.')
      await ctx.ports.requireCampaignCharacterAuthority(
        campaignId,
        scope.characterId,
        authorization.campaign.ownerUserId
      )
      return prepareRoomLiveCharacterSheet(store, inputs, scope, observed, transaction)
    }
  }
  const prepared = await prepareStagedSceneCommit({
    actor,
    assignments: authorization.campaign.assignments,
    command,
    context,
    runtime: input.runtime,
    random: input.random,
    captures,
    staged: { begun, saveId: begun.saveId },
    movement
  })
  if (prepared.kind === 'GEOMETRY') {
    for (const layer of prepared.fogLayers)
      await stageRoomSceneGeometryFog(sceneInputs, begun.saveId, layer)
    const scene = await publishSceneGeometry(ctx, prepared.finish, null, sceneCallbacks)
    assertPrediction(scene)
    return {
      scene,
      encounter: null,
      nextScene: prepared.nextScene,
      fogChanged: prepared.fogChanged
    }
  }
  const plan = prepared.commit
  const admittedInput = liveSessionMovementPrepareInputSchema.parse({
    ...actor,
    movement: plan.movement,
    preparation: plan.preparation,
    revisions: plan.revisions,
    maintenanceOwners: plan.maintenanceOwners
  })
  const admission = await readRoomLiveMovementAdmission(
    ctx,
    transaction,
    admittedInput,
    observed,
    presentation
  )
  if (
    admission.state.id !== plan.preparation.encounterId ||
    admission.state.version !== plan.preparation.expectedEncounterVersion
  )
    throw new Error('Live movement preparation Run mismatch.')
  const actors = await readRunActors(ctx, admission.state)
  const characterIds = new Set(
    admission.state.automationMode === 'MANUAL'
      ? []
      : actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : []))
  )
  const owners = new Set<string>()
  for (const request of plan.maintenanceOwners) {
    const key = checksumCanonicalJson(request)
    if (owners.has(key) || !admission.state.actorIds.includes(request.actorId))
      throw new Error('Live movement maintenance owner scope mismatch.')
    owners.add(key)
    await readRoomMaintenanceCapture(ctx, admission.state, request)
    if (request.owner.kind === 'CHARACTER') characterIds.add(request.owner.characterId)
  }
  // Complete the fence for Character owners whose maintenance the plan read without their sheet.
  const revisions = mergeNativeRulesRevisions(
    observed.filter((entry) => entry.scope !== 'CHARACTER' || characterIds.has(entry.id)),
    plan.revisions
  )
  assertRoomEncounterRulesRevisions(observed, admission.state, [...characterIds], revisions)
  assertGeometryReceiving(admission.save, admission.header.version, userId)
  if (admission.save.fogSaves.length)
    throw new Error('Spatial preparation must precede fog staging.')
  const save = {
    ...admission.save,
    spatialPreparationJson: JSON.stringify(plan.preparation),
    spatialPreparationChecksum: checksumCanonicalJson(plan.preparation)
  }
  readSpatialPreparation(save)
  const sceneBinding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', admission.state.id))
    .unique()
  if (
    !sceneBinding ||
    sceneBinding.sceneId !== save.sceneId ||
    sceneBinding.campaignId !== campaignId
  )
    throw new Error('Spatial preparation Scene binding is stale.')
  writeRoomSceneRow(transaction, 'sceneGeometrySaves', save)
  for (const layer of plan.fogLayers) await stageRoomSceneGeometryFog(sceneInputs, save.id, layer)
  const current = await sceneCallbacks.readGeometrySave(save.id)
  const resolution = readMovementResolution(current.save)
  const settlementCallbacks = roomMovementSettlementCallbacks({
    ctx,
    store,
    transaction,
    inputs,
    campaignId,
    epoch,
    observed,
    characterIds,
    mirrorSettlement: { userId, random: input.random }
  })
  let settled = false
  const settle = async () => {
    if (settled || plan.preparation.outcome.kind === 'UNINTERRUPTED')
      throw new Error('Live movement settlement is unavailable.')
    settled = true
    return persistMovementSettlements(
      ctx,
      {
        state: admission.state,
        actors,
        authorizedCharacterIds: characterIds,
        save: current.save,
        preparation: plan.preparation,
        settlements: plan.settlements,
        userId
      },
      settlementCallbacks
    )
  }
  const project: Parameters<typeof publishSpatialTerminal>[4]['project'] = (
    state,
    actors,
    characterStates
  ) => {
    const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
    const rules = plan.rules
    if (
      !rules ||
      rules.actors.length !== ruleActors.length ||
      new Set(rules.actors.map((actor) => actor.actorId)).size !== ruleActors.length ||
      rules.actors.some((actor) => !ruleActors.some((current) => current.id === actor.actorId))
    )
      throw new Error('Movement actor rule output scope mismatch.')
    return projectGm({ ...state, actors }, rules, characterStates)
  }
  const scene = await publishSceneGeometry(
    ctx,
    plan.finish,
    {
      publishPreparedMovementResponse: (request, geometry) =>
        publishMovementResponse(ctx, request, geometry, {
          readGeometrySave: sceneCallbacks.readGeometrySave,
          readSceneReceipt: sceneCallbacks.readSceneCommand,
          readResponse: (id, geometry) =>
            readResponse(ctx, id, geometry, sceneCallbacks.readGeometrySave),
          commit: async () => {
            if (!resolution || plan.preparation.outcome.kind === 'UNINTERRUPTED')
              throw new Error('Live movement response is unavailable.')
            const resolutionCommands =
              plan.preparation.outcome.kind === 'PENDING'
                ? readEncounterMovementPendingContext(plan.preparation.outcome.pendingSnapshot).root
                    .resolutionCommands
                : plan.preparation.outcome.resolutionCommands
            if (!resolutionCommands) throw new Error('Movement response history is unavailable.')
            const committed = await settle()
            return {
              outcome: plan.preparation.outcome,
              resolutionCommands,
              ...committed,
              commandCharacterTransitions: committed.characterTransitions
            }
          },
          project
        }),
      publishPreparedSpatialPending: (request, geometry) =>
        publishSpatialPending(ctx, request, geometry, {
          readGeometrySave: sceneCallbacks.readGeometrySave,
          evaluateInitial: async () => {
            if (plan.preparation.outcome.kind !== 'PENDING')
              throw new Error('Live pending movement is unavailable.')
            return {
              outcome: plan.preparation.outcome,
              settlements: plan.settlements
            }
          },
          settle,
          project
        }),
      publishPreparedSpatialTerminal: (id, geometry, request) =>
        publishSpatialTerminal(ctx, id, geometry, request, {
          readGeometrySave: sceneCallbacks.readGeometrySave,
          settle: async () => {
            if (plan.preparation.outcome.kind !== 'TERMINAL')
              throw new Error('Live terminal movement is unavailable.')
            return {
              result: plan.preparation.outcome.result,
              ...(await settle())
            }
          },
          project
        }),
      verifyPreparedUninterruptedMovement: async () => {
        if (
          plan.preparation.outcome.kind !== 'UNINTERRUPTED' ||
          plan.settlements.length ||
          plan.rules
        )
          throw new Error('Uninterrupted movement cannot settle mechanics.')
      }
    },
    sceneCallbacks,
    current
  )
  assertPrediction(scene)
  // Observers the move left seeing a hidden creature stop being hidden from; undo gives them back.
  const concealmentPrunes = await applyConcealmentPrune(ctx, {
    state: admission.state,
    actors,
    prunes: prepared.concealmentPrunes
  })
  if (concealmentPrunes.length)
    writeRoomSceneRow(transaction, 'sceneConcealmentPrunes', {
      sceneId: scene.sceneId,
      commandId: scene.commandId,
      entries: concealmentPrunes
    })
  // Characters the move put in sight of a concealed zone they notice prompt the GM (MOVE-3.5).
  await recordZoneSightings(ctx, {
    encounterId: admission.state.id,
    sceneId: scene.sceneId,
    sightings: prepared.zoneSightings
  })
  let encounter = resolution ? await readMovementResponseResult(ctx, resolution.command) : null
  if (plan.voidCommand) {
    await postMovementDecisionSkipped(ctx, {
      campaignId,
      gmUserId: userId,
      voidCommand: plan.voidCommand
    })
    encounter = await recordRuleOccurrenceVoid(ctx, plan.voidCommand)
  }
  return {
    scene,
    encounter,
    nextScene: prepared.nextScene,
    fogChanged: prepared.fogChanged
  }

  function assertPrediction(scene: { sceneId: string; version: number; delta: unknown }) {
    if (
      scene.sceneId !== prepared.expectedScene.sceneId ||
      scene.version !== prepared.expectedScene.version ||
      checksumCanonicalJson(scene.delta) !== checksumCanonicalJson(prepared.expectedScene.delta)
    )
      throw new Error('Room Scene publication differs from its frozen plan.')
  }
}
