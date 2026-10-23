import type { EncounterGmProjectionDto } from '@artificer-toolkit/schema/api/encounterData'
import {
  unseenConditionTypeIds,
  unseenEncounterActorIds,
  type EncounterPlayerViewer,
  type EncounterProjectionViewer
} from '@artificer-toolkit/rules-runtime/encounterPlayerProjection'
import { readEncounterCharacterPlay } from './characterPlay.js'
import type { EncounterReadTransaction } from './ports.js'

/**
 * The actors the member cannot see (D121): the shared rule over the Encounter's Scene, each actor's
 * token there (one indexed read per actor) and the tokens the host draws for the member, if it can tell.
 */
async function readUnseenActorIds(
  ctx: EncounterReadTransaction,
  encounterId: string,
  actors: readonly Pick<EncounterGmProjectionDto['actors'][number], 'id' | 'kind'>[],
  viewer: Parameters<EncounterReadTransaction['ports']['readViewerSceneTokens']>[0]
): Promise<ReadonlySet<string>> {
  const scene = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
    .unique()
  if (!scene) return new Set()
  const bindings = (
    await Promise.all(
      actors.map((actor) =>
        ctx.db
          .query('encounterActorTokenBindings')
          .withIndex('by_encounterId_actorId', (q) =>
            q.eq('encounterId', encounterId).eq('actorId', actor.id)
          )
          .unique()
      )
    )
  ).filter((binding) => binding !== null)
  const vision = bindings.length === 0 ? null : await ctx.ports.readViewerSceneTokens(viewer)
  return unseenEncounterActorIds({
    actors,
    sceneId: scene.sceneId,
    bindings,
    visibleTokenIds: vision?.sceneId === scene.sceneId ? vision.visibleTokenIds : null
  })
}

/**
 * What a player sees of the Run: each Character actor's player and "Show my health to the party"
 * (ADR 0034 decision 5), and the creatures whose token they cannot see (ATTACK-17.3).
 */
export async function readEncounterPlayerViewer(
  ctx: EncounterReadTransaction,
  projection: {
    id: string
    actors: readonly Pick<EncounterGmProjectionDto['actors'][number], 'id' | 'kind' | 'sourceId'>[]
  },
  viewer: Parameters<EncounterReadTransaction['ports']['readViewerSceneTokens']>[0]
): Promise<EncounterPlayerViewer> {
  const characterIds = [
    ...new Set(
      projection.actors.flatMap((actor) =>
        actor.kind === 'CHARACTER' && actor.sourceId ? [actor.sourceId] : []
      )
    )
  ]
  // Party visibility lives on the small play record, so this never loads a Character document.
  const [plays, assignments, unseenActorIds] = await Promise.all([
    Promise.all(characterIds.map((id) => readEncounterCharacterPlay(ctx, id))),
    Promise.all(
      characterIds.map((characterId) =>
        ctx.db
          .query('campaignCharacterAssignments')
          .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
          .unique()
      )
    ),
    readUnseenActorIds(ctx, projection.id, projection.actors, viewer)
  ])
  const grantsByCharacterId = new Map(
    assignments.flatMap((assignment) =>
      assignment?.controllerUserIds
        ? [[assignment.characterId, assignment.controllerUserIds] as const]
        : []
    )
  )
  return {
    userId: viewer.userId,
    unseenActorIds,
    characters: new Map(
      plays.flatMap((play) =>
        play
          ? [
              [
                play.characterId,
                {
                  ownerUserId: play.userId,
                  controllerUserIds: grantsByCharacterId.get(play.characterId) ?? [],
                  health: ctx.ports.readCharacterPlay(play).partyVisibility.health
                }
              ] as const
            ]
          : []
      )
    )
  }
}

/** The viewer a player projection is built for: what the member sees, and the System Invisible condition types (D131). */
export async function readEncounterProjectionViewer(
  ctx: EncounterReadTransaction,
  projection: Parameters<typeof readEncounterPlayerViewer>[1] & { gameSystemId: string },
  viewer: Parameters<typeof readEncounterPlayerViewer>[2]
): Promise<EncounterProjectionViewer> {
  const sight = await readEncounterPlayerViewer(ctx, projection, viewer)
  // Only an unseen creature needs the System's Invisible condition types, so a table that sees everyone reads no System.
  return {
    ...sight,
    unseenConditionTypeIds: sight.unseenActorIds.size
      ? unseenConditionTypeIds(
          (await ctx.ports.requireSystem(projection.gameSystemId)).conditionTypes
        )
      : new Set()
  }
}
