import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { prepareEncounterMovementContinuation } from '@artificer-toolkit/rules-runtime/encounterMovementContinuation'
import { preparedMovementSegment } from '@artificer-toolkit/rules-runtime/encounterMovementPublication'
import type { PreparedSpatialMovementPlan } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementPreparation'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { CampaignSceneState, ScenePoint } from '@artificer-toolkit/shared/vtt'
import { liveEncounterCaptures, type LiveCaptureReads } from './nativeEncounterReads.js'
import {
  capturedNativeRuntime,
  nativeLiveDefinitions,
  readNativeLiveSpatialEffects
} from './nativeEncounterMovementInputs.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'
import type { NativeLiveMovementMaintenanceProjection } from './nativeEncounterMaintenance.js'
import {
  nativeMovementSettlementInputs,
  nativeSpatialStepCallbacks,
  type CharacterFacts,
  type NativeLiveMovementSettlement
} from './nativeSpatialContinuation.js'

/**
 * Settles the zone contacts of one forced step of a creature's token, from `path[0]` to the last
 * point, through the spatial candidate execution a voluntary move uses (D170). The zone's damage and
 * the Concentration saves it causes are rolled by the system with the room's dice, whoever acts.
 * `actors` is the Run's actors as the committing action leaves them; the contacts build on them.
 */
export async function prepareRoomForcedMovementContacts(input: {
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>
  captures: LiveCaptureReads
  runtime: RulesRuntimeService
  random(maximum: number): number
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  scene: CampaignSceneState
  tokenId: string
  path: readonly ScenePoint[]
  actorIdByTokenId: ReadonlyMap<string, string>
  commandId: string
  occurrenceId: string
  occurredAt: string
  userId: string
}) {
  const { scope, state, scene, tokenId, path, commandId, random, userId } = input
  const reads = liveEncounterCaptures(
    liveSessionEncounterRulesInputSchema.parse({ ...scope, request: { kind: 'INPUTS' } }),
    input.captures
  )
  const { capture } = reads
  const read = await readNativeLiveActorsAndEffects({ state, capture })
  const settled = new Map(input.actors.map((actor) => [actor.id, actor]))
  const actors = read.actors.map((actor) => settled.get(actor.id) ?? actor)
  const prepared = await Promise.all(
    actors.map((actor) =>
      prepareNativeLiveMovementTarget({
        scope,
        state,
        actor,
        activeEffectsByActorId: read.activeEffectsByActorId,
        captures: input.captures,
        random
      })
    )
  )
  for (const { revisions } of prepared) reads.observe(revisions)
  const targets = new Map(prepared.map(({ target }) => [target.actor.id, target]))
  const runtime = capturedNativeRuntime(input.runtime, nativeLiveDefinitions(capture, state))
  const spatialEffects = await readNativeLiveSpatialEffects(capture, scene, state.id)
  const finalActors = new Map(actors.map((actor) => [actor.id, actor]))
  // The action's own dice are already settled, so the contacts' are rolled for every creature.
  const autoRoll = Object.fromEntries(actors.map(({ id }) => [id, true]))
  const step = {
    occurrenceId: input.occurrenceId,
    executionCommandId: commandId,
    occurredAt: input.occurredAt
  }
  const { outcome, settlements } = await prepareEncounterMovementContinuation<
    CharacterFacts,
    NativeLiveMovementMaintenanceProjection,
    PreparedSpatialMovementPlan<CharacterFacts>,
    NativeLiveMovementSettlement
  >(
    {
      state,
      userId,
      autoRoll,
      root: {
        commandId,
        commandFingerprint: checksumCanonicalJson({ commandId, tokenId, path }),
        initiatorUserId: userId,
        correlationId: null,
        encounterId: state.id,
        sceneId: scene.id,
        tokenId,
        expectedEncounterVersion: state.version,
        expectedSceneVersion: scene.version,
        movementKind: 'FORCED',
        originalPath: [...path]
      },
      sceneVersion: scene.version,
      sceneTokens: scene.tokens,
      sceneGrid: scene.grid,
      actorIdByTokenId: input.actorIdByTokenId,
      currentPosition: path[0]!,
      occurrenceVersion: 0,
      reactionTimeline: [],
      targets,
      ...step
    },
    {
      discoverPassage: async () => null,
      ...nativeSpatialStepCallbacks(
        {
          state,
          userId,
          autoRoll,
          carefully: undefined,
          captured: { actors, capture, spatialEffects, runtime },
          random,
          finalActors
        },
        step
      ),
      preparePassage: async () => {
        throw new Error('A forced movement has no passage choice.')
      },
      currentReactionGroup: async () => {
        throw new Error('A forced movement provokes no reaction.')
      },
      runtime: async () => runtime
    }
  )
  if (outcome.kind === 'PENDING') throw new Error('A forced movement contact asked for a choice.')
  const { settlementInputs, rules } = nativeMovementSettlementInputs({
    state,
    actors,
    targets,
    finalActors,
    planned: { outcome, settlements }
  })
  return {
    outcome,
    settlements: settlementInputs,
    rules,
    // A 0 HP stop ends the path where the creature drops (D170).
    segment: preparedMovementSegment({ path, startDistance: 0, outcome })
  }
}
