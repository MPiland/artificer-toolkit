import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput,
  type LiveSessionEncounterRulesRequest,
  type LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import { MAX_SPATIAL_RULE_EFFECTS_PER_SCENE } from '@artificer-toolkit/schema/shared/spatial'
import { resolveRuleOccurrenceInputDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  serverPublishedRuleDefinitionDtoSchema,
  serverRuleExecutionInputDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { serverRuleExecutionPendingOccurrenceId } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { movementRuleResolutionCommandDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionSpatial'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import { withEncounterAppRoll } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { buildEncounterMovementReactionFacts } from '@artificer-toolkit/rules-runtime/encounterMovementReactionFacts'
import { createEncounterMovementReactionPerception } from '@artificer-toolkit/rules-runtime/encounterMovementReactionPerception'
import { discoverEncounterMovementReactionChoices } from '@artificer-toolkit/rules-runtime/encounterMovementReactionDiscovery'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { sceneTokenMovementFailure, type CampaignSceneState } from '@artificer-toolkit/shared/vtt'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import type { NativeLiveSessionEnvironment } from './liveSessionRoutes.js'
import { captureEncounterRules, type LiveCaptureReads } from './nativeCaptureCache.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'

/**
 * The room supplies its complete, flushed Scene; raw captures stay within the trusted DO. The
 * movement admission read fetches the command's capture bundle, and System-level reads go through
 * the room cache.
 */
export async function readNativeLiveMovementInputs(input: {
  environment: NativeLiveSessionEnvironment
  accessToken: string
  scope: Omit<LiveSessionEncounterRulesInput, 'request' | 'concentrationResponse'> & {
    movement: NonNullable<LiveSessionEncounterRulesInput['movement']>
  }
  scene: CampaignSceneState
  occurrenceId: string
  runtime: RulesRuntimeService
  captures?: LiveCaptureReads
}) {
  const { environment, accessToken, scene, runtime, occurrenceId, captures } = input
  const scope = liveSessionEncounterRulesInputSchema.parse({
    ...input.scope,
    request: { kind: 'MOVEMENT_INPUTS' }
  })
  let revisions: LiveSessionRulesRevisions = []
  const dependencies: Array<{ request: LiveSessionEncounterRulesRequest; readChecksum: string }> =
    []
  const reads = new Map<string, Promise<LiveSessionEncounterRulesResponse>>()
  function capture(request: LiveSessionEncounterRulesRequest) {
    const key = checksumCanonicalJson(request)
    let read = reads.get(key)
    if (!read) {
      read = captureEncounterRules(
        environment,
        accessToken,
        liveSessionEncounterRulesInputSchema.parse({ ...scope, request }),
        revisions,
        captures
      ).then((captured) => {
        const { response } = captured
        if (response.kind !== request.kind) throw new Error('Movement capture kind mismatch.')
        revisions = mergeNativeRulesRevisions(revisions, captured.revisions)
        dependencies.push({ request, readChecksum: response.readChecksum })
        return response
      })
      reads.set(key, read)
    }
    return read
  }
  // The admission read fetches the bundle that later reads take their parts from.
  const movement = await capture({ kind: 'MOVEMENT_INPUTS' })
  const inputs = await capture({ kind: 'INPUTS' })
  if (movement.kind !== 'MOVEMENT_INPUTS' || inputs.kind !== 'INPUTS')
    throw new Error('Movement inputs are unavailable.')
  const { header, save } = movement
  const { state, system } = inputs
  if (
    save.id !== scope.movement?.saveId ||
    save.sceneId !== scene.id ||
    header.id !== scene.id ||
    header.version !== scene.version ||
    header.definitionId !== scene.definitionId ||
    header.definitionVersion !== scene.definitionVersion ||
    scene.campaignId !== scope.campaignId ||
    state.id !== scope.encounterId ||
    state.id !== input.scope.movement.encounterId ||
    state.version !== scope.expectedVersion ||
    state.campaignId !== scope.campaignId ||
    state.gameSystemId !== system.id ||
    state.status !== 'ACTIVE' ||
    save.input.type !== 'MOVE_SCENE_TOKEN' ||
    save.input.expectedEncounterVersion !== state.version ||
    save.input.expectedSceneVersion !== scene.version ||
    save.actorUserId !== scope.expectedUserId
  )
    throw new Error('Movement capture binding mismatch.')
  for (const collection of ['tokens', 'barriers', 'lights', 'darknessZones'] as const)
    if (
      scene[collection].length !== header.currentCounts[collection] ||
      new Set(scene[collection].map((entity) => entity.id)).size !== scene[collection].length
    )
      throw new Error('Movement Scene geometry is incomplete.')
  for (const key of ['grid', 'map', 'ambientIllumination', 'fogMode', 'visionRevealMode'] as const)
    if (checksumCanonicalJson(scene[key]) !== checksumCanonicalJson(header[key]))
      throw new Error('Movement Scene settings changed.')
  const command = save.input
  const token = scene.tokens.find((candidate) => candidate.id === command.tokenId)
  // The movement capture already admitted the mover as a controller of the bound actor.
  if (!token || token.locked) throw new Error('Movement token authority is unavailable.')
  const actorIdByTokenId = new Map(
    movement.bindings.map((binding) => [binding.tokenId, binding.actorId])
  )
  if (
    actorIdByTokenId.size !== movement.bindings.length ||
    new Set(movement.bindings.map((binding) => binding.actorId)).size !==
      movement.bindings.length ||
    !actorIdByTokenId.has(token.id) ||
    movement.bindings.some(
      (binding) =>
        !state.actorIds.includes(binding.actorId) ||
        !scene.tokens.some((entry) => entry.id === binding.tokenId)
    )
  )
    throw new Error('Movement actor bindings are inconsistent.')
  if (!save.movementResolution) {
    if (checksumCanonicalJson(command.path[0]) !== checksumCanonicalJson(token.position))
      throw new Error('Movement path does not begin at the current token position.')
    const failure = sceneTokenMovementFailure(scene, token.id, command.path.at(-1)!, command.path)
    if (failure) throw new Error(failure)
  }
  const response = save.movementResolution
    ? (() => {
        const retained = save.movementResolution
        const command = resolveRuleOccurrenceInputDtoSchema.parse(JSON.parse(retained.commandJson))
        const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(
          JSON.parse(retained.pendingSnapshotJson)
        )
        const { context, root } = readEncounterMovementPendingContext(snapshot)
        if (
          retained.commandChecksum !== checksumCanonicalJson(command) ||
          retained.pendingSnapshotChecksum !== checksumCanonicalJson(snapshot) ||
          command.commandId !== save.commandId ||
          command.encounterId !== root.encounterId ||
          command.occurrenceId !== serverRuleExecutionPendingOccurrenceId(snapshot) ||
          command.occurrenceId !== occurrenceId ||
          command.expectedOccurrenceVersion !== root.resolutionCommands.length ||
          command.expectedVersion !== state.version ||
          command.correlationId !== save.input.correlationId ||
          root.commandId === command.commandId ||
          root.encounterId !== state.id ||
          root.sceneId !== scene.id ||
          root.tokenId !== token.id ||
          root.movementKind !== save.input.movementKind ||
          root.currentSceneVersion !== scene.version ||
          checksumCanonicalJson(root.currentPosition) !== checksumCanonicalJson(token.position) ||
          checksumCanonicalJson(root.originalPath) !== checksumCanonicalJson(save.input.path) ||
          (snapshot.optionalCombatSnapshotChecksum ?? null) !== state.optionalCombatSnapshotChecksum
        )
          throw new Error('Stored movement response identity is inconsistent.')
        const responseCommand = movementRuleResolutionCommandDtoSchema.parse({
          commandId: command.commandId,
          commandFingerprint: checksumCanonicalJson(command),
          actorUserId: scope.expectedUserId,
          correlationId: command.correlationId,
          expectedOccurrenceVersion: command.expectedOccurrenceVersion,
          kind: command.resolution.kind,
          ...('requestId' in command.resolution ? { requestId: command.resolution.requestId } : {}),
          ...('optionId' in command.resolution ? { optionId: command.resolution.optionId } : {})
        })
        if (root.resolutionCommands.some((entry) => entry.commandId === responseCommand.commandId))
          throw new Error('Movement response command was already used.')
        // An app roll settles with the faces Convex recorded for it, never client-supplied values.
        const answer = withEncounterAppRoll(command.resolution, movement.appRoll)
        return { command, answer, snapshot, context, root, responseCommand }
      })()
    : null
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  const prepared =
    state.automationMode === 'MANUAL'
      ? []
      : await Promise.all(
          actors.map((actor) =>
            prepareNativeLiveMovementTarget({
              environment,
              accessToken,
              scope,
              state,
              actor,
              activeEffectsByActorId,
              captures
            })
          )
        )
  for (const target of prepared) revisions = mergeNativeRulesRevisions(revisions, target.revisions)
  const targets = new Map(prepared.map(({ target }) => [target.actor.id, target]))
  const definitions = {
    requireCurrent: async (definitionId: string) => {
      const response = await capture({ kind: 'DEFINITION', definitionId })
      if (
        response.kind !== 'DEFINITION' ||
        !response.definition ||
        response.definition.id !== definitionId ||
        response.definition.gameSystemId !== state.gameSystemId
      )
        throw new Error('Movement definition is unavailable.')
      return response.definition
    }
  }
  // A policy that names its definition (reaction eligibility) reads it through this command's
  // authorized capture; the room runtime has no definition source of its own.
  const capturedRuntime: RulesRuntimeService = {
    ...runtime,
    execute: async (candidate) => {
      const command = serverRuleExecutionInputDtoSchema.parse(candidate)
      const current = await definitions.requireCurrent(command.definitionId)
      return runtime.executeResolved({
        command,
        published: serverPublishedRuleDefinitionDtoSchema.parse({
          id: current.id,
          gameSystemId: current.gameSystemId,
          definitionFamilyKey: current.definitionFamilyKey,
          checksum: current.checksum,
          definition: current.document
        })
      })
    }
  }
  const spatialEffects: EncounterSpatialRuleEffectRecord[] = []
  let afterEffectId: string | null = null
  for (;;) {
    const page = await capture({
      kind: 'SCENE_SPATIAL_EFFECTS',
      sceneId: scene.id,
      expectedSceneVersion: scene.version,
      afterEffectId
    })
    if (
      page.kind !== 'SCENE_SPATIAL_EFFECTS' ||
      page.sceneId !== scene.id ||
      page.sceneVersion !== scene.version
    )
      throw new Error('Movement spatial effect scope mismatch.')
    let lastId: string | null = afterEffectId
    for (const effect of page.effects) {
      if (
        (lastId !== null && effect.id <= lastId) ||
        effect.sceneId !== scene.id ||
        effect.encounterId !== state.id
      )
        throw new Error('Movement spatial effect identity mismatch.')
      spatialEffects.push(effect)
      lastId = effect.id
    }
    if (spatialEffects.length > MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)
      throw new Error('Movement spatial effects exceed the supported bound.')
    if (page.continueAfter === null) break
    if (page.effects.length !== 4 || page.continueAfter !== lastId || lastId === afterEffectId)
      throw new Error('Movement spatial effect cursor mismatch.')
    afterEffectId = page.continueAfter
  }
  const facts =
    state.automationMode === 'MANUAL'
      ? null
      : {
          ...buildEncounterMovementReactionFacts({
            state,
            userId: scope.expectedUserId,
            campaignOwnerUserId: movement.campaignOwnerUserId,
            targets,
            system,
            definitions
          }),
          runtime: capturedRuntime
        }
  const resolvePerception =
    facts === null
      ? null
      : await createEncounterMovementReactionPerception({
          state,
          actors,
          targets,
          movingTokenId: token.id,
          actorIdByTokenId,
          sceneId: scene.id,
          sceneVersion: scene.version,
          sceneGrid: scene.grid,
          scene,
          loadSystem: async () => system,
          loadDefinition: async (id) => {
            const current = await definitions.requireCurrent(id)
            return {
              definitionFamilyKey: current.definitionFamilyKey,
              gameSystemId: current.gameSystemId,
              current
            }
          },
          loadSpatialEffects: async () => spatialEffects
        })
  const reactions =
    !facts ||
    !resolvePerception ||
    (response && response.context.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
      ? { reactionTimeline: [], firstBoundaryDistance: null }
      : await discoverEncounterMovementReactionChoices({
          ...facts,
          grid: scene.grid,
          movementKind: command.movementKind,
          movingTokenId: token.id,
          occurrenceId,
          path: command.path,
          actorIdByTokenId,
          tokens: scene.tokens,
          resolvePerception
        })
  return {
    save,
    response,
    header,
    autoRollByActorId: movement.autoRollByActorId,
    state,
    system,
    actors,
    targets,
    actorIdByTokenId,
    token,
    spatialEffects,
    facts,
    resolvePerception,
    reactions,
    definitions,
    runtime: capturedRuntime,
    capture,
    dependencies,
    revisions: () => revisions
  }
}
