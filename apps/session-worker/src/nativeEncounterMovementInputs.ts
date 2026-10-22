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
import { encounterGrantsEnabledDomain } from '@artificer-toolkit/rules-runtime/encounterActiveGrants'
import { withEncounterAppRoll } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { buildEncounterMovementReactionFacts } from '@artificer-toolkit/rules-runtime/encounterMovementReactionFacts'
import { createEncounterMovementReactionPerception } from '@artificer-toolkit/rules-runtime/encounterMovementReactionPerception'
import { discoverEncounterMovementReactionChoices } from '@artificer-toolkit/rules-runtime/encounterMovementReactionDiscovery'
import { encounterMovementDrag } from '@artificer-toolkit/rules-runtime/encounterMovementDrag'
import { encounterActorEffectiveSize } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import {
  encounterActorMovementProvokesNoOpportunityAttacks,
  encounterMovementPassageFacts
} from '@artificer-toolkit/rules-runtime/encounterMovementPassagePolicy'
import { toSpatialInstances } from '@artificer-toolkit/rules-runtime/encounterSpatialCandidateExecution'
import { creatureTokenLights } from '@artificer-toolkit/rules-runtime/creatureLight'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  sceneTokenMovementFailure,
  selectTeleportAllowance,
  withSceneTokenLights,
  type CampaignSceneState,
  type ScenePoint
} from '@artificer-toolkit/shared/vtt'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects,
  readNativeLiveSpellPins
} from './nativeEncounterTargets.js'

const TELEPORT_REFUSALS = {
  OCCUPIED: 'That space is occupied.',
  OUT_OF_RANGE: 'That is beyond the range of your teleport.',
  UNSEEN: 'You can teleport only to a place you can see.'
} as const

/**
 * The cast whose allowance a teleport spends. A player's teleport needs one that admits the
 * destination, or is refused with the reason; the GM's is ungated (ADR 0034) and spends any unspent
 * allowance the actor holds, so a GM-driven cast is one-shot too.
 */
async function teleportAllowanceToSpend(input: {
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
  scene: CampaignSceneState
  token: CampaignSceneState['tokens'][number]
  actorId: string
  viewerUserId: string
  destination: ScenePoint
  gated: boolean
}) {
  const captured = await input.capture({ kind: 'TELEPORT_ALLOWANCES', actorId: input.actorId })
  if (captured.kind !== 'TELEPORT_ALLOWANCES')
    throw new Error('Teleport allowances are unavailable.')
  if (!input.gated)
    return (
      captured.allowances.find(({ consumedByCommandId }) => consumedByCommandId === null)
        ?.castCommandId ?? null
    )
  const selection = selectTeleportAllowance({
    scene: input.scene,
    moverTokenId: input.token.id,
    viewerUserId: input.viewerUserId,
    destination: input.destination,
    allowances: captured.allowances
  })
  if (selection.allowed) return selection.castCommandId
  if (selection.reason === 'NO_ALLOWANCE') rejectDomain('TELEPORT_UNAVAILABLE')
  return rejectDomain('MOVEMENT_BLOCKED', TELEPORT_REFUSALS[selection.reason])
}

/**
 * The room supplies its complete, flushed Scene; raw captures stay within the trusted DO.
 */
export async function readNativeLiveMovementInputs(input: {
  scope: Omit<LiveSessionEncounterRulesInput, 'request' | 'concentrationResponse'> & {
    movement: NonNullable<LiveSessionEncounterRulesInput['movement']>
  }
  scene: CampaignSceneState
  occurrenceId: string
  runtime: RulesRuntimeService
  captures: LiveCaptureReads
  random(maximum: number): number
}) {
  const { scene, runtime, occurrenceId, captures } = input
  const scope = liveSessionEncounterRulesInputSchema.parse({
    ...input.scope,
    request: { kind: 'MOVEMENT_INPUTS' }
  })
  let revisions: LiveSessionRulesRevisions = []
  const dependencies: Array<{ request: LiveSessionEncounterRulesRequest }> = []
  const reads = new Map<string, Promise<LiveSessionEncounterRulesResponse>>()
  function capture(request: LiveSessionEncounterRulesRequest) {
    const key = checksumCanonicalJson(request)
    let read = reads.get(key)
    if (!read) {
      read = captures
        .encounterRules(liveSessionEncounterRulesInputSchema.parse({ ...scope, request }))
        .then((response) => {
          if (response.kind !== request.kind) throw new Error('Movement capture kind mismatch.')
          revisions = mergeNativeRulesRevisions(revisions, response.revisions)
          dependencies.push({ request })
          return response
        })
      reads.set(key, read)
    }
    return read
  }
  const movement = await capture({ kind: 'MOVEMENT_INPUTS' })
  const inputs = await capture({ kind: 'INPUTS' })
  if (movement.kind !== 'MOVEMENT_INPUTS' || inputs.kind !== 'INPUTS')
    throw new Error('Movement inputs are unavailable.')
  const { header, save } = movement
  const { state, system } = inputs
  const spells = await readNativeLiveSpellPins(capture)
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
  if (
    !save.movementResolution &&
    checksumCanonicalJson(command.path[0]) !== checksumCanonicalJson(token.position)
  )
    throw new Error('Movement path does not begin at the current token position.')
  const teleportCastCommandId =
    !save.movementResolution && command.movementKind === 'TELEPORT'
      ? await teleportAllowanceToSpend({
          capture,
          scene,
          token,
          actorId: actorIdByTokenId.get(token.id)!,
          viewerUserId: scope.expectedUserId,
          destination: command.path.at(-1)!,
          gated: scope.expectedUserId !== movement.campaignOwnerUserId
        })
      : null
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
  // Manual automation runs no rules but the mover's own passage, which walls still answer to.
  const moverActorId = actorIdByTokenId.get(token.id)!
  const prepared = await Promise.all(
    actors
      .filter((actor) => state.automationMode !== 'MANUAL' || actor.id === moverActorId)
      .map((actor) =>
        prepareNativeLiveMovementTarget({
          scope,
          state,
          actor,
          activeEffectsByActorId,
          captures,
          random: input.random
        })
      )
  )
  for (const target of prepared) revisions = mergeNativeRulesRevisions(revisions, target.revisions)
  const preparedTargets = new Map(prepared.map(({ target }) => [target.actor.id, target]))
  if (!save.movementResolution) {
    // The mover passes blocking barriers by its own resolved passage, as the composed token shows.
    const passesBlockingBarriers = encounterMovementPassageFacts(preparedTargets, moverActorId)
      .mover.throughBarriers
    const failure = sceneTokenMovementFailure(
      {
        ...scene,
        tokens: scene.tokens.map((entry) => {
          if (entry.id !== token.id) return entry
          const { passesBlockingBarriers: _composed, ...mover } = entry
          return passesBlockingBarriers ? { ...mover, passesBlockingBarriers } : mover
        })
      },
      token.id,
      command.path.at(-1)!,
      command.path,
      command.movementKind
    )
    if (failure) throw new Error(failure)
  }
  const targets = new Map(state.automationMode === 'MANUAL' ? [] : preparedTargets)
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
  // A grappler's voluntary move drags the creatures its own holds bind (D105). A new move checks
  // each dragged creature's whole translated path; every segment re-reads who is held.
  const planned =
    state.automationMode === 'MANUAL' || command.movementKind !== 'VOLUNTARY'
      ? null
      : encounterMovementDrag({
          scene,
          mover: { tokenId: token.id, actorId: actorIdByTokenId.get(token.id)! },
          actorIdByTokenId,
          activeEffectsByActorId,
          sizeOf: (actorId) => {
            const target = targets.get(actorId)
            return target ? encounterActorEffectiveSize(target) : null
          },
          effects: toSpatialInstances(spatialEffects, actors),
          path: save.movementResolution ? null : command.path
        })
  if (planned?.kind === 'REFUSED') rejectDomain('MOVEMENT_BLOCKED', 'Release the grapple first.')
  const drag = planned?.tokens.length ? planned : null
  const draggedTokenIds = new Set(drag?.tokens.map(({ tokenId }) => tokenId))
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
            spells,
            definitions
          }),
          runtime: capturedRuntime
        }
  // Perception sees the light each bound Creature sheds, as the room's Scene vision draws it.
  const perceptionScene = withSceneTokenLights(
    scene,
    creatureTokenLights(
      [...actorIdByTokenId].map(([tokenId, actorId]) => ({ tokenId, actorId })),
      actors
    )
  )
  const resolvePerception =
    facts === null
      ? null
      : await createEncounterMovementReactionPerception({
          state,
          targets,
          movingTokenId: token.id,
          actorIdByTokenId,
          sceneId: scene.id,
          sceneVersion: scene.version,
          sceneGrid: scene.grid,
          scene: perceptionScene,
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
  // A mover holding the Disengage grant provokes no opportunity attacks this turn, nor does one
  // whose own features grant that immunity (Flyby).
  const mover = actors.find((actor) => actor.id === actorIdByTokenId.get(token.id))
  const moverTarget = preparedTargets.get(moverActorId)
  const reactions =
    !facts ||
    !resolvePerception ||
    (mover &&
      encounterGrantsEnabledDomain(
        activeEffectsByActorId.get(mover.id) ?? [],
        'OPPORTUNITY_ATTACK_IMMUNITY'
      )) ||
    (moverTarget &&
      encounterActorMovementProvokesNoOpportunityAttacks(
        state.gameSystemId,
        moverTarget.actor,
        moverTarget.effectiveRulePolicyOutput
      )) ||
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
          // A creature being dragged moves with its grappler, so it never reacts to that move.
          tokens: scene.tokens.filter(({ id }) => !draggedTokenIds.has(id)),
          resolvePerception
        })
  return {
    save,
    response,
    teleportCastCommandId,
    header,
    autoRollByActorId: movement.autoRollByActorId,
    state,
    system,
    spells,
    actors,
    targets,
    actorIdByTokenId,
    token,
    perceptionScene,
    spatialEffects,
    drag,
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
