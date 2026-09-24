import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { SceneCurrentEntityPage } from '@artificer-toolkit/schema/api/sceneRecipient'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { MAX_SPATIAL_RULE_EFFECTS_PER_SCENE } from '@artificer-toolkit/schema/shared/spatial'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { resolveEncounterTurnEffectPerception } from '@artificer-toolkit/rules-runtime/encounterTurnEffectPerception'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import type { CampaignSceneState } from '@artificer-toolkit/shared/vtt'

type SceneFence = { sceneId: string; sceneVersion: number; definitionSaveId: string }

/** Supplies bounded, authorized live captures to the shared perception resolver. */
export async function resolveNativeLiveTurnEffectPerception(input: {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  target: MovementTarget
  targets: ReadonlyMap<string, MovementTarget>
  effect: ActiveRuleEffectRecord
  system: SystemAuthoredDto
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
  loadTarget: (actorId: string) => Promise<MovementTarget | undefined>
  onSceneRead: (fence: SceneFence) => void
}) {
  let sceneFence: SceneFence | null = null
  return resolveEncounterTurnEffectPerception({
    state: input.state,
    actors: input.actors,
    target: input.target,
    targets: input.targets,
    effect: input.effect,
    loadScene: async ({ observerActorId, subjectActorId }) => {
      const response = await input.capture({
        kind: 'SCENE_PERCEPTION',
        observerActorId,
        subjectActorId
      })
      if (response.kind !== 'SCENE_PERCEPTION')
        throw new Error('Turn effect perception capture kind mismatch.')
      if (!response.context) return null
      const { header, observerTokenId, subjectTokenId } = response.context
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
        const ids = new Set<string>()
        const cursors = new Set<string>()
        let cursor: SceneCurrentEntityPage['next'] = { phase: 'BASE', afterOrdinal: null }
        while (cursor) {
          const key = `${cursor.phase}:${cursor.afterOrdinal ?? ''}`
          if (cursors.has(key)) throw new Error('Turn effect Scene page cursor repeated.')
          cursors.add(key)
          const response = await input.capture({
            kind: 'SCENE_PERCEPTION_ENTITIES',
            page: {
              sceneId: header.id,
              expectedVersion: header.version,
              definitionSaveId: header.definitionSaveId,
              collection,
              numItems: 8,
              ...cursor
            }
          })
          if (
            response.kind !== 'SCENE_PERCEPTION_ENTITIES' ||
            response.page.version !== header.version ||
            response.page.collection !== collection ||
            response.page.page.length > 8
          )
            throw new Error('Turn effect Scene page binding mismatch.')
          let lastOrdinal = cursor.afterOrdinal ?? -1
          for (const entry of response.page.page) {
            const value = entry.value
            if (
              value.collection !== collection ||
              entry.ordinal <= lastOrdinal ||
              ids.has(value.entity.id)
            )
              throw new Error('Turn effect Scene page geometry mismatch.')
            lastOrdinal = entry.ordinal
            ids.add(value.entity.id)
            if (ids.size > header.currentCounts[collection])
              throw new Error('Turn effect Scene page count mismatch.')
            if (value.collection === 'tokens') scene.tokens.push(value.entity)
            else if (value.collection === 'barriers') {
              scene.barriers.push(value.entity)
              if (entry.doorState !== null) scene.doorStates[value.entity.id] = entry.doorState
            } else if (value.collection === 'darknessZones') scene.darknessZones.push(value.entity)
            else if (value.collection === 'lights') scene.lights.push(value.entity)
          }
          const next = response.page.next
          if (
            (next?.phase === cursor.phase &&
              (next.afterOrdinal === null ||
                next.afterOrdinal <= (cursor.afterOrdinal ?? -1) ||
                (response.page.page.length > 0 && next.afterOrdinal < lastOrdinal))) ||
            (next?.phase === 'BASE' && cursor.phase === 'APPENDED') ||
            (cursor.phase === 'BASE' && next?.phase === 'APPENDED' && next.afterOrdinal !== null) ||
            (next === null && cursor.phase === 'BASE')
          )
            throw new Error('Turn effect Scene page cursor mismatch.')
          cursor = next
        }
        if (ids.size !== header.currentCounts[collection])
          throw new Error('Turn effect Scene page count mismatch.')
      }
      sceneFence = {
        sceneId: header.id,
        sceneVersion: header.version,
        definitionSaveId: header.definitionSaveId
      }
      input.onSceneRead(sceneFence)
      return {
        id: header.id,
        version: header.version,
        scene,
        observerTokenId,
        subjectTokenId
      }
    },
    loadTarget: input.loadTarget,
    loadDefinition: async (id) => {
      const response = await input.capture({ kind: 'DEFINITION', definitionId: id })
      if (response.kind !== 'DEFINITION')
        throw new Error('Turn effect perception definition capture kind mismatch.')
      const current = response.definition
      if (!current) return null
      if (current.id !== id || current.gameSystemId !== input.state.gameSystemId)
        throw new Error('Turn effect perception definition binding mismatch.')
      return {
        definitionFamilyKey: current.definitionFamilyKey,
        gameSystemId: current.gameSystemId,
        current
      }
    },
    loadSystem: async () => {
      if (input.system.id !== input.state.gameSystemId)
        throw new Error('Turn effect perception System binding mismatch.')
      return input.system
    },
    loadSpatialEffects: async (sceneId) => {
      if (!sceneFence || sceneId !== sceneFence.sceneId)
        throw new Error('Turn effect perception Scene scope is unavailable.')
      const effects: Extract<
        LiveSessionEncounterRulesResponse,
        { kind: 'SCENE_SPATIAL_EFFECTS' }
      >['effects'] = []
      let afterEffectId: string | null = null
      for (;;) {
        const response = await input.capture({
          kind: 'SCENE_SPATIAL_EFFECTS',
          sceneId,
          expectedSceneVersion: sceneFence.sceneVersion,
          afterEffectId
        })
        if (
          response.kind !== 'SCENE_SPATIAL_EFFECTS' ||
          response.sceneId !== sceneId ||
          response.sceneVersion !== sceneFence.sceneVersion ||
          response.effects.length > 4
        )
          throw new Error('Turn effect spatial page binding mismatch.')
        let lastId: string | null = afterEffectId
        for (const effect of response.effects) {
          if (
            (lastId !== null && effect.id <= lastId) ||
            effect.encounterId !== input.state.id ||
            effect.sceneId !== sceneId
          )
            throw new Error('Turn effect spatial page identity mismatch.')
          lastId = effect.id
          effects.push(effect)
        }
        if (effects.length > MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)
          throw new Error('Turn effect spatial effects exceed the supported bound.')
        if (response.continueAfter === null) {
          if (response.effects.length === 4)
            throw new Error('Turn effect spatial page cursor mismatch.')
          break
        }
        if (response.effects.length !== 4 || response.continueAfter !== lastId)
          throw new Error('Turn effect spatial page cursor mismatch.')
        afterEffectId = response.continueAfter
      }
      return effects
    }
  })
}
