import type { EncounterGmProjectionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { EncounterPlayerHealthViewer } from '@artificer-toolkit/rules-runtime/encounterPlayerProjection'
import { readEncounterCharacterPlay } from './characterPlay.js'
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
  // Party visibility lives on the small play record, so this never loads a Character document.
  const plays = await Promise.all(characterIds.map((id) => readEncounterCharacterPlay(ctx, id)))
  return {
    userId,
    characters: new Map(
      plays.flatMap((play) =>
        play
          ? [
              [
                play.characterId,
                {
                  ownerUserId: play.userId,
                  health: ctx.ports.readCharacterPlay(play).partyVisibility.health
                }
              ] as const
            ]
          : []
      )
    )
  }
}
