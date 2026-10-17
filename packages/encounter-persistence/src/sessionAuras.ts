import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import type { readSceneSpatialRows } from './sceneSpatialRows.js'
import type { EncounterReadContext } from './store.js'

/**
 * The auras (circles centered on a token) the member may draw: a visible one whose source actor is
 * among `seenActorIds`, the actors the member's own projection lists. The projection already applies
 * the one visibility rule (D121) for the GM, a Convex read and the room alike, so an aura never
 * reveals a source the member cannot see.
 */
export async function readSessionAuras(
  ctx: EncounterReadContext,
  input: {
    encounterId: string
    rows: Awaited<ReturnType<typeof readSceneSpatialRows>>
    seenActorIds: ReadonlySet<string>
  }
): Promise<EncounterSessionStateDto['auras']> {
  const { encounterId, rows, seenActorIds } = input
  const auras = rows.flatMap(({ id, placement, spatialState }) =>
    placement.anchorKind === 'TOKEN' &&
    placement.sourceTokenId !== null &&
    placement.geometry.shape.kind === 'CIRCLE' &&
    (placement.visibility === 'PUBLIC' || spatialState.revealed)
      ? [
          {
            id,
            label: placement.label ?? null,
            radius: placement.geometry.shape.radius,
            sourceTokenId: placement.sourceTokenId
          }
        ]
      : []
  )
  const seen = await Promise.all(
    auras.map(async ({ sourceTokenId }) => {
      const binding = await ctx.db
        .query('encounterActorTokenBindings')
        .withIndex('by_encounterId_tokenId', (q) =>
          q.eq('encounterId', encounterId).eq('tokenId', sourceTokenId)
        )
        .unique()
      return binding !== null && seenActorIds.has(binding.actorId)
    })
  )
  return auras.filter((_, index) => seen[index])
}
