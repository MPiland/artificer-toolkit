import type {
  EncounterProjectionDto,
  EncounterSessionStateDto
} from '@artificer-toolkit/schema/api/encounterData'
import { isEncounterPassiveZone } from '@artificer-toolkit/rules-runtime/encounterPassiveZones'
import type { readSceneSpatialRows } from './sceneSpatialRows.js'
import type { EncounterReadContext } from './store.js'

/**
 * The visible zones that raise movement cost (D154, D156), as the member's map prices a dragged
 * path. A token-anchored zone needs its source among `actors`, the member's own projection (D121),
 * and rests while it is a defeated Creature's passive zone (D144), as the room's movement charge
 * does. Designations name only listed actors, so a hidden actor's id never reaches the member.
 */
export async function readSessionMovementCostZones(
  ctx: EncounterReadContext,
  input: {
    encounterId: string
    rows: Awaited<ReturnType<typeof readSceneSpatialRows>>
    actors: readonly Pick<EncounterProjectionDto['actors'][number], 'id' | 'defeated'>[]
  }
): Promise<EncounterSessionStateDto['movementCostZones']> {
  const { encounterId, rows, actors } = input
  const actorsById = new Map(actors.map((actor) => [actor.id, actor]))
  const zones = await Promise.all(
    rows.map(async (row) => {
      const { placement, spatialState } = row
      if (
        placement.movementCostMultiplier === undefined ||
        (placement.visibility !== 'PUBLIC' && !spatialState.revealed)
      )
        return []
      if (placement.anchorKind === 'TOKEN') {
        if (placement.sourceTokenId === null) return []
        const sourceTokenId = placement.sourceTokenId
        const binding = await ctx.db
          .query('encounterActorTokenBindings')
          .withIndex('by_encounterId_tokenId', (q) =>
            q.eq('encounterId', encounterId).eq('tokenId', sourceTokenId)
          )
          .unique()
        const source = binding && actorsById.get(binding.actorId)
        if (!source || (isEncounterPassiveZone(row) && source.defeated)) return []
      }
      return [
        {
          id: row.id,
          multiplier: placement.movementCostMultiplier,
          anchorKind: placement.anchorKind,
          geometry: placement.geometry,
          sourceTokenId: placement.sourceTokenId,
          unaffectedActorIds: (placement.unaffectedActorIds ?? []).filter((id) =>
            actorsById.has(id)
          )
        }
      ]
    })
  )
  return zones.flat()
}
