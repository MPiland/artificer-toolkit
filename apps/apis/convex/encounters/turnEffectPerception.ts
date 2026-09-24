import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SceneCurrentEntityPage } from '@artificer-toolkit/schema/api/sceneRecipient'
import { resolveEncounterTurnEffectPerception } from '@artificer-toolkit/rules-runtime/encounterTurnEffectPerception'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import type { CampaignSceneState } from '@artificer-toolkit/shared/vtt'
import type { MutationCtx } from '../_generated/server'
import { readDefinitionRoot } from '../content/definitionStore'
import { requireSystem } from '../content/systemDocuments'
import { readLiveScene } from '../scenes/liveDocuments'
import { readCurrentEntities } from '../scenes/currentEntities'
import { createSpatialRuleEffectStore } from '../rules/spatialEffectStore'
import { loadMovementTargets } from './movementTargets'

/** Resolves the target's perception of this effect's immutable source from current Scene facts. */
export async function resolveNativeTurnEffectPerception(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    actors: readonly EncounterRunActorState[]
    userId: string
    target: MovementTarget
    targets: ReadonlyMap<string, MovementTarget>
    effect: ActiveRuleEffectRecord
  }
) {
  return resolveEncounterTurnEffectPerception({
    state: input.state,
    actors: input.actors,
    target: input.target,
    targets: input.targets,
    effect: input.effect,
    loadScene: async ({ observerActorId, subjectActorId }) => {
      const binding = await ctx.db
        .query('encounterSceneBindings')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', input.state.id))
        .unique()
      if (!binding) return null
      const [observerBinding, subjectBinding] = await Promise.all([
        ctx.db
          .query('encounterActorTokenBindings')
          .withIndex('by_encounterId_actorId', (q) =>
            q.eq('encounterId', input.state.id).eq('actorId', observerActorId)
          )
          .unique(),
        ctx.db
          .query('encounterActorTokenBindings')
          .withIndex('by_encounterId_actorId', (q) =>
            q.eq('encounterId', input.state.id).eq('actorId', subjectActorId)
          )
          .unique()
      ])
      if (!observerBinding || !subjectBinding) return null
      if (
        binding.campaignId !== input.state.campaignId ||
        observerBinding.sceneId !== binding.sceneId ||
        subjectBinding.sceneId !== binding.sceneId
      )
        throw new Error('Turn effect perception binding is stale.')
      const { header } = await readLiveScene(ctx, binding.sceneId, 'MEMBER')
      if (header.campaignId !== input.state.campaignId)
        throw new Error('Turn effect Scene is stale.')
      const scene: Pick<
        CampaignSceneState,
        | 'ambientIllumination'
        | 'barriers'
        | 'darknessZones'
        | 'doorStates'
        | 'grid'
        | 'lights'
        | 'tokens'
      > = {
        ambientIllumination: header.ambientIllumination,
        barriers: [],
        darknessZones: [],
        doorStates: {},
        grid: header.grid,
        lights: [],
        tokens: []
      }
      for (const collection of ['tokens', 'barriers', 'darknessZones', 'lights'] as const) {
        let cursor: SceneCurrentEntityPage['next'] = { phase: 'BASE', afterOrdinal: null }
        while (cursor) {
          const page = await readCurrentEntities(
            ctx,
            {
              sceneId: header.id,
              expectedVersion: header.version,
              definitionSaveId: header.definitionSaveId,
              collection,
              numItems: 8,
              ...cursor
            },
            'MEMBER'
          )
          for (const entry of page.page) {
            const value = entry.value
            if (value.collection === 'tokens') scene.tokens.push(value.entity)
            else if (value.collection === 'barriers') {
              scene.barriers.push(value.entity)
              if (entry.doorState !== null) scene.doorStates[value.entity.id] = entry.doorState
            } else if (value.collection === 'darknessZones') scene.darknessZones.push(value.entity)
            else if (value.collection === 'lights') scene.lights.push(value.entity)
          }
          cursor = page.next
        }
      }
      return {
        id: header.id,
        version: header.version,
        scene,
        observerTokenId: observerBinding.tokenId,
        subjectTokenId: subjectBinding.tokenId
      }
    },
    loadTarget: async (actorId) =>
      (
        await loadMovementTargets(ctx, {
          encounterId: input.state.id,
          expectedEncounterVersion: input.state.version,
          targetActorIds: [actorId]
        })
      ).get(actorId),
    loadDefinition: (id) => readDefinitionRoot(ctx, id, input.userId),
    loadSystem: () => requireSystem(ctx, input.state.gameSystemId),
    loadSpatialEffects: async (sceneId) => {
      const scope = await createSpatialRuleEffectStore(ctx).scope({
        encounterId: input.state.id,
        sceneId
      })
      if (!scope) throw new Error('Turn effect perception Scene scope is unavailable.')
      return scope.list()
    }
  })
}
