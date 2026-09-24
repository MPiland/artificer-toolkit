import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CombatPerceptionEnvironment } from '@artificer-toolkit/shared/rules'
import { createEncounterMovementReactionPerception } from '@artificer-toolkit/rules-runtime/encounterMovementReactionPerception'
import type { EncounterMovementReactionContact } from '@artificer-toolkit/rules-runtime/encounterMovementReactionContacts'
import type { EncounterMovementReactionSource } from '@artificer-toolkit/rules-runtime/encounterMovementReactionSources'
import { type CampaignSceneState, type SceneGrid } from '@artificer-toolkit/shared/vtt'

import type { MutationCtx } from '../_generated/server'
import { readDefinitionRoot } from '../content/definitionStore'
import { requireSystem } from '../content/systemDocuments'
import { requireIdentity } from '../lib/identity'
import { createSpatialRuleEffectStore } from '../rules/spatialEffectStore'
import { readLiveScene } from '../scenes/liveDocuments'
import { readRunActors, readRunState } from './documents'
import type { MovementTarget } from './movementTargets'

type PerceptionScene = Pick<
  CampaignSceneState,
  'ambientIllumination' | 'barriers' | 'darknessZones' | 'doorStates' | 'grid' | 'lights' | 'tokens'
>

/** Creates a resolver over current authorized facts for one frozen Scene movement. */
export async function createNativeMovementReactionPerception(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    actors: readonly EncounterRunActorState[]
    targets: ReadonlyMap<string, MovementTarget>
    movingTokenId: string
    actorIdByTokenId: ReadonlyMap<string, string>
    sceneId: string
    sceneVersion: number
    sceneGrid: SceneGrid
  } & (
    | { scene: PerceptionScene; resolveEnvironment?: never }
    | {
        scene: Pick<CampaignSceneState, 'tokens'>
        resolveEnvironment: (input: {
          observerToken: Pick<CampaignSceneState['tokens'][number], 'position' | 'width' | 'height'>
          subjectToken: Pick<CampaignSceneState['tokens'][number], 'position' | 'width' | 'height'>
        }) => CombatPerceptionEnvironment
      }
  ),
  /** Fresh current authority and geometry from this transaction, before any writes. */
  currentRead?: {
    ctx: MutationCtx
    userId: string
    state: EncounterRunState
    actors: readonly EncounterRunActorState[]
    header: Awaited<ReturnType<typeof readLiveScene>>['header']
  }
): Promise<
  (contact: EncounterMovementReactionContact<EncounterMovementReactionSource>) => Promise<boolean>
> {
  let userId: string
  let currentState: EncounterRunState
  if (currentRead) {
    if (currentRead.ctx !== ctx)
      throw new Error('Movement perception read context belongs to another transaction.')
    userId = currentRead.userId
    currentState = currentRead.state
  } else {
    userId = (await requireIdentity(ctx)).userId
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', input.state.id))
      .unique()
    if (!run) throw new Error('Encounter Run was not found.')
    currentState = readRunState(run)
  }
  if (
    currentState.id !== input.state.id ||
    currentState.version !== input.state.version ||
    currentState.gameSystemId !== input.state.gameSystemId
  )
    throw new Error('Encounter perception facts are stale.')
  const actors = currentRead?.actors ?? (await readRunActors(ctx, currentState))
  const inputActorIds = new Set(input.actors.map((actor) => actor.id))
  if (
    inputActorIds.size !== input.actors.length ||
    actors.length !== inputActorIds.size ||
    actors.some((actor) => !inputActorIds.has(actor.id))
  )
    throw new Error('Encounter perception actors are stale.')
  const header = currentRead?.header ?? (await readLiveScene(ctx, input.sceneId, 'MEMBER')).header
  if (header.version !== input.sceneVersion || header.id !== input.sceneId)
    throw new Error('Scene perception facts are stale.')
  const scope = await createSpatialRuleEffectStore(ctx).scope({
    encounterId: input.state.id,
    sceneId: input.sceneId
  })
  if (!scope) throw new Error('Encounter Scene perception binding is unavailable.')
  const spatialEffects = await scope.list()
  return createEncounterMovementReactionPerception({
    ...input,
    state: currentState,
    actors,
    loadSystem: () => requireSystem(ctx, currentState.gameSystemId),
    loadDefinition: (id) => readDefinitionRoot(ctx, id, userId),
    loadSpatialEffects: async () => spatialEffects
  })
}
