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
import { withSceneTokenLights, type CampaignSceneState } from '@artificer-toolkit/shared/vtt'

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
    loadScene: async (actors) => {
      const loaded = await readNativeLivePerceptionScene({
        ...actors,
        campaignId: input.state.campaignId,
        capture: input.capture
      })
      if (!loaded) return null
      sceneFence = {
        sceneId: loaded.id,
        sceneVersion: loaded.version,
        definitionSaveId: loaded.definitionSaveId
      }
      input.onSceneRead(sceneFence)
      return loaded
    },
    loadTarget: input.loadTarget,
    loadDefinition: (id) =>
      readNativeLiveDefinition({
        gameSystemId: input.state.gameSystemId,
        definitionId: id,
        capture: input.capture
      }),
    loadSystem: async () => {
      if (input.system.id !== input.state.gameSystemId)
        throw new Error('Turn effect perception System binding mismatch.')
      return input.system
    },
    loadSpatialEffects: async (sceneId) => {
      if (!sceneFence || sceneId !== sceneFence.sceneId)
        throw new Error('Turn effect perception Scene scope is unavailable.')
      return readNativeLiveSpatialEffects({
        encounterId: input.state.id,
        sceneId,
        sceneVersion: sceneFence.sceneVersion,
        capture: input.capture
      })
    }
  })
}

/** Reads one reusable definition of the Encounter's System through the live capture. */
export async function readNativeLiveDefinition(input: {
  gameSystemId: string
  definitionId: string
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
}) {
  const response = await input.capture({ kind: 'DEFINITION', definitionId: input.definitionId })
  if (response.kind !== 'DEFINITION')
    throw new Error('Turn effect perception definition capture kind mismatch.')
  const current = response.definition
  if (!current) return null
  if (current.id !== input.definitionId || current.gameSystemId !== input.gameSystemId)
    throw new Error('Turn effect perception definition binding mismatch.')
  return {
    definitionFamilyKey: current.definitionFamilyKey,
    gameSystemId: current.gameSystemId,
    current
  }
}

/** Reads every spatial effect of one Scene through bounded, cursor-checked pages of the live capture. */
export async function readNativeLiveSpatialEffects(input: {
  encounterId: string
  sceneId: string
  sceneVersion: number
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
}) {
  const { sceneId } = input
  const effects: Extract<
    LiveSessionEncounterRulesResponse,
    { kind: 'SCENE_SPATIAL_EFFECTS' }
  >['effects'] = []
  let afterEffectId: string | null = null
  for (;;) {
    const response = await input.capture({
      kind: 'SCENE_SPATIAL_EFFECTS',
      sceneId,
      expectedSceneVersion: input.sceneVersion,
      afterEffectId
    })
    if (
      response.kind !== 'SCENE_SPATIAL_EFFECTS' ||
      response.sceneId !== sceneId ||
      response.sceneVersion !== input.sceneVersion ||
      response.effects.length > 4
    )
      throw new Error('Turn effect spatial page binding mismatch.')
    let lastId: string | null = afterEffectId
    for (const effect of response.effects) {
      if (
        (lastId !== null && effect.id <= lastId) ||
        effect.encounterId !== input.encounterId ||
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

/** Reads the perception Scene through bounded, cursor-checked entity pages of the live capture. */
export async function readNativeLivePerceptionScene(input: {
  campaignId: string
  observerActorId: string
  subjectActorId: string
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
}) {
  const response = await input.capture({
    kind: 'SCENE_PERCEPTION',
    observerActorId: input.observerActorId,
    subjectActorId: input.subjectActorId
  })
  if (response.kind !== 'SCENE_PERCEPTION')
    throw new Error('Turn effect perception capture kind mismatch.')
  if (!response.context) return null
  const { header, observerTokenId, subjectTokenId, tokenLights } = response.context
  if (header.campaignId !== input.campaignId) throw new Error('Turn effect Scene is stale.')
  const scene: Pick<
    CampaignSceneState,
    | 'ambientIllumination'
    | 'barriers'
    | 'daylight'
    | 'darknessZones'
    | 'doorStates'
    | 'grid'
    | 'lights'
    | 'tokens'
  > = {
    ambientIllumination: header.ambientIllumination,
    daylight: header.daylight,
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
  return {
    id: header.id,
    version: header.version,
    definitionSaveId: header.definitionSaveId,
    scene: withSceneTokenLights(scene, tokenLights),
    observerTokenId,
    subjectTokenId
  }
}
