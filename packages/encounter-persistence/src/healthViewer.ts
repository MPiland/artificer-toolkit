import type { EncounterGmProjectionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { EncounterPlayerHealthViewer } from '@artificer-toolkit/rules-runtime/encounterPlayerProjection'
import type { EncounterReadTransaction } from './ports.js'

/** Each Character actor's player and "Show my health to the party" (ADR 0034 decision 5). */
export async function readEncounterHealthViewer(
  ctx: EncounterReadTransaction,
  projection: Pick<EncounterGmProjectionDto, 'actors'>,
  userId: string
): Promise<EncounterPlayerHealthViewer> {
  const characterIds = [
    ...new Set(
      projection.actors.flatMap((actor) =>
        actor.kind === 'CHARACTER' && actor.sourceId ? [actor.sourceId] : []
      )
    )
  ]
  const rows = await Promise.all(
    characterIds.map((id) =>
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', id))
        .unique()
    )
  )
  return {
    userId,
    characters: new Map(
      rows.flatMap((row) =>
        row
          ? [
              [
                row.id,
                {
                  ownerUserId: row.userId,
                  health: ctx.ports.readCharacterSheetState(row).partyVisibility.health
                }
              ] as const
            ]
          : []
      )
    )
  }
}
