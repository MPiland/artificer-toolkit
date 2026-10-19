import type { EncounterProjectionActorInput } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { lengthMeasurementInFeet } from '@artificer-toolkit/shared/core'
import type { SceneActorVision } from '@artificer-toolkit/shared/vtt'
import { snapshotFeatures } from './encounterFeatureActionCapabilityDiscovery.js'

/**
 * The light a Creature sheds around itself: the farthest-reaching light its passive Features
 * attach to it as a MANIFEST OBJECT, the same authored light a torch or the Light spell carries.
 * A shaped light, such as a lantern's cone, is not a light around the token and is not shed here.
 */
export function creatureEmittedLight(
  actor: Pick<EncounterProjectionActorInput, 'kind' | 'snapshot'>
): SceneActorVision['light'] {
  if (actor.kind !== 'CREATURE') return undefined
  let bright = 0
  let dim = 0
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
        const brightFeet = lengthMeasurementInFeet(entry.outcome.light.bright)
        bright = Math.max(bright, brightFeet)
        dim = Math.max(dim, brightFeet + lengthMeasurementInFeet(entry.outcome.light.dimAdditional))
      }
    }
  return dim > 0
    ? { bright: { amount: bright, unit: 'FEET' }, dim: { amount: dim, unit: 'FEET' } }
    : undefined
}

/** The light each bound Creature sheds, keyed by its token, to compose onto the Scene. */
export function creatureTokenLights(
  bindings: Iterable<{ actorId: string; tokenId: string }>,
  actors: readonly (Pick<EncounterProjectionActorInput, 'kind' | 'snapshot'> & { id: string })[]
) {
  const actorById = new Map(actors.map((actor) => [actor.id, actor]))
  return [...bindings].flatMap(({ actorId, tokenId }) => {
    const actor = actorById.get(actorId)
    const light = actor && creatureEmittedLight(actor)
    return light ? [{ tokenId, light }] : []
  })
}
