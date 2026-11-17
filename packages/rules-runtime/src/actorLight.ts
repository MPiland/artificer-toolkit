import type { EncounterProjectionActorInput } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ActiveRuleEffectObjectManifestationContributionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { lengthMeasurementInFeet } from '@artificer-toolkit/shared/core'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import {
  effectiveSpatialGeometry,
  lengthMeasurementInSceneUnits,
  sceneDistanceAsCoordinateLength,
  type CampaignSceneState,
  type SceneActorVision,
  type SceneZoneLight
} from '@artificer-toolkit/shared/vtt'
import { snapshotFeatures } from './encounterFeatureActionCapabilityDiscovery.js'

type LightActor = Pick<EncounterProjectionActorInput, 'kind' | 'snapshot'>

/** The attachments that put a held object's light on the token of the actor holding it. */
const TOKEN_ATTACHMENTS: ReadonlySet<string | null> = new Set([
  'SOURCE',
  'PRIMARY_TARGET',
  'TOUCHED_OBJECT'
])

/**
 * The light an actor sheds around itself: the farthest-reaching light it carries as a MANIFEST
 * OBJECT, the same authored light a torch or the Light spell carries. A Creature carries it from its
 * passive Features; any actor carries it from the object manifestations its active effects hold
 * (Light cast on it). A shaped light, such as a lantern's cone, is not a light around the token.
 */
export function actorEmittedLight(
  actor: LightActor,
  activeEffects: readonly ActiveRuleEffectRecord[]
): SceneActorVision['light'] {
  let bright = 0
  let dim = 0
  const take = (
    light: NonNullable<ActiveRuleEffectObjectManifestationContributionDto['light']>
  ) => {
    const brightFeet = lengthMeasurementInFeet(light.bright)
    bright = Math.max(bright, brightFeet)
    dim = Math.max(dim, brightFeet + lengthMeasurementInFeet(light.dimAdditional))
  }
  if (actor.kind === 'CREATURE')
    for (const feature of snapshotFeatures(actor))
      for (const effect of feature.effects ?? []) {
        if (effect.invocation.kind !== 'PASSIVE') continue
        for (const entry of compileEffect(effect).entries) {
          if (
            !('outcome' in entry) ||
            entry.outcome.effectKind !== 'MANIFEST' ||
            entry.outcome.manifestKind !== 'OBJECT' ||
            entry.outcome.attachmentKind !== 'SOURCE' ||
            !entry.outcome.light ||
            entry.outcome.shape
          )
            continue
          take(entry.outcome.light)
        }
      }
  for (const effect of activeEffects)
    for (const contribution of effect.definition.stateContributions)
      if (
        contribution.kind === 'OBJECT_MANIFESTATION' &&
        contribution.light &&
        TOKEN_ATTACHMENTS.has(contribution.attachmentKind)
      )
        take(contribution.light)
  return dim > 0
    ? { bright: { amount: bright, unit: 'FEET' }, dim: { amount: dim, unit: 'FEET' } }
    : undefined
}

/** The light each bound actor sheds, keyed by its token, to compose onto the Scene. */
export function actorTokenLights(
  bindings: Iterable<{ actorId: string; tokenId: string }>,
  actors: readonly (LightActor & { id: string })[],
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
) {
  const actorById = new Map(actors.map((actor) => [actor.id, actor]))
  return [...bindings].flatMap(({ actorId, tokenId }) => {
    const actor = actorById.get(actorId)
    const light = actor && actorEmittedLight(actor, activeEffectsByActorId.get(actorId) ?? [])
    return light ? [{ tokenId, light }] : []
  })
}

/**
 * The light each placed zone sheds from its whole area, where it stands on the Scene now (a zone on
 * a token moves with it), to compose onto the Scene beside its own lights. A zone whose area cannot
 * be resolved sheds none (fails closed).
 */
export function placedZoneLights(
  effects: readonly Pick<EncounterSpatialRuleEffectRecord, 'placement'>[],
  scene: Pick<CampaignSceneState, 'grid' | 'tokens'>
): SceneZoneLight[] {
  const coordinates = (length: Parameters<typeof lengthMeasurementInSceneUnits>[0]) =>
    sceneDistanceAsCoordinateLength(scene.grid, lengthMeasurementInSceneUnits(length, scene.grid))
  return effects.flatMap(({ placement }) => {
    const geometry = placement.light && effectiveSpatialGeometry(placement, scene.tokens)
    if (!placement.light || !geometry) return []
    const brightRadius = coordinates(placement.light.bright)
    return [
      {
        geometry,
        brightRadius,
        dimRadius: brightRadius + coordinates(placement.light.dimAdditional)
      }
    ]
  })
}
