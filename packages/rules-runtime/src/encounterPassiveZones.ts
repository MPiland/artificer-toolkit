import { v5 as uuidv5 } from 'uuid'
import type { LiveSessionPlacedSpatialEffect } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { EncounterOptionalCombatPolicyFacts } from '@artificer-toolkit/schema/shared/optionalCombat'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { CompiledActionZonePlacement } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SceneGrid, SpatialSceneToken } from '@artificer-toolkit/shared/vtt'

import type { CharacterRuleEvaluationResult } from './character/characterRuleEvaluation.js'
import type { EffectActionCapabilityDescriptor } from './characterActionCapabilityDiscovery.js'
import { discoverCharacterActionCapabilities } from './characterActionCapabilityDiscovery.js'
import { CharacterRuleActionUnsupportedCompilationError } from './characterRuleActionSystemAdapter.js'
import { characterRuleActionSystemAdapterRegistry } from './platformEncounterPolicy.js'
import { buildCompiledActionTargetPolicy } from './encounterActionEntryPointCompiler.js'
import { systemAbilityDefinitions } from './encounterActionSources.js'
import { snapshotAbilityScore } from './encounterActorState.js'
import { compileEncounterPointArea } from './encounterAreaAction.js'
import {
  compilePassiveZone,
  discoverEncounterFeatureActions
} from './encounterFeatureActionCapabilityDiscoveryRegistry.js'
import {
  planEncounterPlacedZone,
  zoneShapeAtSource,
  type PlacedZoneSource
} from './encounterPlacedZone.js'
import { abilityScoreCapabilityRegistry } from './platformPolicyModules.js'
import { resolveEncounterSceneGrid } from './sceneGridPolicy.js'

const PASSIVE_ZONE_NAMESPACE = '13ea735c-3dd6-4f0c-929d-175f96c227f7'

/** The rules a Character's passive zones are discovered from and resolved against (D155). */
export type EncounterPassiveZoneCharacterRules = Pick<
  CharacterRuleEvaluationResult,
  'passiveZoneSources'
> & {
  facts: Pick<CharacterRuleEvaluationResult['facts'], 'abilityDefinitions'>
  output: Pick<CharacterRuleEvaluationResult['output'], 'abilityModifiers'>
  snapshot: Pick<CharacterRuleEvaluationResult['snapshot'], 'classes'>
}

/**
 * The zones the given actors' passive features keep around their tokens (D144, D155): one per
 * passive zone feature of each Creature or Character bound to a token in the Scene, anchored to that
 * token, depending on no Concentration, with its save bonus and class-level radius resolved against
 * the actor. A zone's id is fixed by the Encounter, the actor and the feature Effect, so placing an
 * actor's zones again names the zones it already has.
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
  /** The current rules of each given Character actor, by Character id; one without keeps no zones. */
  characterRules: ReadonlyMap<string, EncounterPassiveZoneCharacterRules>
}): LiveSessionPlacedSpatialEffect[] {
  const conditionDefinitionIds = input.system.conditionTypes.map(({ id }) => id)
  const abilityDefinitions = systemAbilityDefinitions(input.system)
  const grid = resolveEncounterSceneGrid({
    encounter: input.state,
    sceneGrid: input.sceneGrid
  })
  return input.actors.flatMap((actor) => {
    if (actor.kind === 'CUSTOM') return []
    const tokenId = [...input.actorIdByTokenId].find(([, actorId]) => actorId === actor.id)?.[0]
    const token = input.tokens.find((candidate) => candidate.id === tokenId)
    if (!token) return []
    const characterRules =
      actor.kind === 'CHARACTER' ? input.characterRules.get(actor.sourceId) : undefined
    const discovered =
      actor.kind === 'CREATURE'
        ? {
            passiveZones: discoverEncounterFeatureActions({
              actor,
              conditionDefinitionIds,
              abilityDefinitions,
              spells: new Map()
            }).passiveZones,
            source: creatureZoneSource(actor, input.system.id)
          }
        : characterRules &&
          characterPassiveZones(characterRules, input.system.id, conditionDefinitionIds)
    if (!discovered) return []
    const { source } = discovered
    return discovered.passiveZones.map(({ capability, zone }) => {
      const area = compileEncounterPointArea(
        {
          ...buildCompiledActionTargetPolicy(capability),
          // A passive zone is centered on its holder, whatever range its trait authors.
          range: { id: capability.effectId, rangeKind: 'SELF' },
          targeting: { selectionKind: 'AREA_CONTENTS', dispositionKind: 'ANY' },
          shape: zoneShapeAtSource(zone.shape, source)
        },
        grid
      )
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
        saveDc: null,
        source
      })
    })
  })
}

/** A Creature resolves a zone against its snapshot ability scores; it has no class levels. */
function creatureZoneSource(actor: EncounterRunActorState, gameSystemId: string): PlacedZoneSource {
  const { abilityModifier } = abilityScoreCapabilityRegistry.require(gameSystemId)
  return {
    abilityModifier: (ability) => {
      const score = snapshotAbilityScore(actor, ability)
      if (score === null) throw new Error('The Creature has no score in the zone’s ability.')
      return abilityModifier(score)
    },
    classLevel: () => 0
  }
}

/**
 * The zones a Character's passive features keep (D155), resolved against its ability modifiers and
 * class levels. A zone its System cannot execute is not placed.
 */
function characterPassiveZones(
  rules: EncounterPassiveZoneCharacterRules,
  gameSystemId: string,
  conditionDefinitionIds: readonly string[]
): {
  passiveZones: {
    capability: EffectActionCapabilityDescriptor
    zone: CompiledActionZonePlacement
  }[]
  source: PlacedZoneSource
} {
  const abilityDefinitions = rules.facts.abilityDefinitions
  const source: PlacedZoneSource = {
    abilityModifier: (ability) => {
      const modifier = rules.output.abilityModifiers.find((entry) => entry.ability === ability)
      if (!modifier) throw new Error('The Character has no modifier in the zone’s ability.')
      return modifier.value
    },
    classLevel: (classId) =>
      rules.snapshot.classes.find((entry) => entry.classId === classId)?.level ?? 0
  }
  const { candidates, entryPoints } = rules.passiveZoneSources
  if (!candidates.length) return { passiveZones: [], source }
  const adapter = characterRuleActionSystemAdapterRegistry.require(gameSystemId)
  const passiveZones = discoverCharacterActionCapabilities({
    gameSystemId,
    candidates,
    conditionDefinitionIds,
    abilityDefinitions,
    entryPoints
  }).flatMap((capability) => {
    try {
      return [{ capability, zone: compilePassiveZone(adapter, capability) }]
    } catch (error) {
      if (error instanceof CharacterRuleActionUnsupportedCompilationError) return []
      throw error
    }
  })
  return { passiveZones, source }
}

/** Whether a spatial effect is a Creature's passive zone (D144): kept on its token by no Concentration. */
export function isEncounterPassiveZone(
  effect: Pick<EncounterSpatialRuleEffectRecord, 'maintainedEffectStateId' | 'placement'>
): boolean {
  return effect.maintainedEffectStateId === null && effect.placement.anchorKind === 'TOKEN'
}
