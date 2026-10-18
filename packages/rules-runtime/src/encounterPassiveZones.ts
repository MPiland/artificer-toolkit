import { v5 as uuidv5 } from 'uuid'
import type { LiveSessionPlacedSpatialEffect } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { EncounterOptionalCombatPolicyFacts } from '@artificer-toolkit/schema/shared/optionalCombat'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { SceneGrid, SpatialSceneToken } from '@artificer-toolkit/shared/vtt'

import { buildCompiledActionTargetPolicy } from './encounterActionEntryPointCompiler.js'
import { systemAbilityDefinitions } from './encounterActionSources.js'
import { compileEncounterPointArea } from './encounterAreaAction.js'
import { discoverEncounterFeatureActions } from './encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { planEncounterPlacedZone } from './encounterPlacedZone.js'
import { encounterSceneGridPolicyRegistry } from './sceneGridPolicyRegistry.js'

const PASSIVE_ZONE_NAMESPACE = '13ea735c-3dd6-4f0c-929d-175f96c227f7'

/**
 * The zones the given Creatures' passive features keep around their tokens (D144): one per passive
 * zone feature of each Creature bound to a token in the Scene, anchored to that token, depending on
 * no Concentration. A zone's id is fixed by the Encounter, the Creature and the feature Effect, so
 * placing a Creature's zones again names the zones it already has.
 */
export function planEncounterPassiveZones(input: {
  state: EncounterOptionalCombatPolicyFacts & { id: string }
  occurrenceId: string
  rootCommandId: string
  actors: readonly EncounterRunActorState[]
  system: SystemAuthoredDto
  sceneGrid: SceneGrid
  tokens: readonly SpatialSceneToken[]
  actorIdByTokenId: ReadonlyMap<string, string>
}): LiveSessionPlacedSpatialEffect[] {
  const conditionDefinitionIds = input.system.conditionTypes.map(({ id }) => id)
  const abilityDefinitions = systemAbilityDefinitions(input.system)
  const grid = encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
    encounter: input.state,
    sceneGrid: input.sceneGrid
  })
  return input.actors.flatMap((actor) => {
    if (actor.kind !== 'CREATURE') return []
    const tokenId = [...input.actorIdByTokenId].find(([, actorId]) => actorId === actor.id)?.[0]
    const token = input.tokens.find((candidate) => candidate.id === tokenId)
    if (!token) return []
    const { passiveZones } = discoverEncounterFeatureActions({
      actor,
      conditionDefinitionIds,
      abilityDefinitions
    })
    return passiveZones.map(({ capability, zone }) => {
      const area = compileEncounterPointArea(buildCompiledActionTargetPolicy(capability), grid)
      if (!area) throw new Error('A passive zone needs a size the Scene can show.')
      return planEncounterPlacedZone({
        zone,
        id: uuidv5(`${input.state.id}:${actor.id}:${capability.effectId}`, PASSIVE_ZONE_NAMESPACE),
        maintainedEffectStateId: null,
        encounterId: input.state.id,
        occurrenceId: input.occurrenceId,
        rootCommandId: input.rootCommandId,
        sourceActorId: actor.id,
        point: token.position,
        area,
        sourceToken: { tokenId: token.id, width: token.width },
        saveDc: null
      })
    })
  })
}

/** Whether a spatial effect is a Creature's passive zone (D144): kept on its token by no Concentration. */
export function isEncounterPassiveZone(
  effect: Pick<EncounterSpatialRuleEffectRecord, 'maintainedEffectStateId' | 'placement'>
): boolean {
  return effect.maintainedEffectStateId === null && effect.placement.anchorKind === 'TOKEN'
}
