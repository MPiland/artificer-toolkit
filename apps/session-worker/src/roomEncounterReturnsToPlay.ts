import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { EncounterWriteContext } from '@artificer-toolkit/encounter-persistence/store'
import { appendSystemRunEntry } from '@artificer-toolkit/encounter-persistence/systemRunEntries'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterReturnedToPlayInputSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { sceneTokenFootprintsOverlap } from '@artificer-toolkit/shared/vtt'
import type { RoomTransaction } from './roomEncounterStore.js'
import { readRoomSceneState } from './roomSceneRead.js'

/** The actors the effect holds out of play: the ones a command may return (D178). */
export const actorIdsOutOfPlayByEffect = (actors: readonly EncounterRunActorState[]) =>
  new Set(
    actors.flatMap(({ id, absence }) =>
      absence === 'EFFECT' || absence === 'EFFECT_KEEPS_TURN' ? [id] : []
    )
  )

/**
 * Flags the actors a committed command returned to play onto a space another visible token holds
 * (D184). The room never moves a Scene token for the return: the GM places the creature by hand, so
 * the flag is one GM-only `RETURN_SPACE_OCCUPIED` timeline entry. An actor with no token on the
 * Encounter's Scene, or whose space is free, raises nothing. Returns whether an entry was written.
 */
export async function flagRoomReturnsOntoOccupiedSpace(input: {
  ctx: EncounterWriteContext
  transaction: RoomTransaction
  encounterId: string
  userId: string
  occurredAt: string
  /** The actors the effect held out of play before the command. */
  outOfPlayBefore: ReadonlySet<string>
}): Promise<boolean> {
  if (input.outOfPlayBefore.size === 0) return false
  const { ctx, encounterId } = input
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', encounterId))
    .unique()
  if (!run) return false
  const returned = (await readRunActors(ctx, readRunState(run))).filter(
    ({ id, absence }) => input.outOfPlayBefore.has(id) && absence == null
  )
  if (returned.length === 0) return false
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (query) => query.eq('encounterId', encounterId))
    .unique()
  if (!binding) return false
  const tokenBindings = await ctx.db
    .query('encounterActorTokenBindings')
    .withIndex('by_encounterId_actorId', (query) => query.eq('encounterId', encounterId))
    .take(MAX_ENCOUNTER_ACTORS)
  const { scene } = await readRoomSceneState(input.transaction, binding.sceneId)
  const crowded = returned.filter((actor) => {
    const tokenId = tokenBindings.find(({ actorId }) => actorId === actor.id)?.tokenId
    const token = scene.tokens.find(({ id }) => id.toLowerCase() === tokenId)
    return (
      token !== undefined &&
      scene.tokens.some(
        (other) =>
          other.id !== token.id && !other.hidden && sceneTokenFootprintsOverlap(token, other)
      )
    )
  })
  if (crowded.length === 0) return false
  await appendSystemRunEntry(ctx, {
    encounterId,
    userId: input.userId,
    occurredAt: input.occurredAt,
    command: encounterReturnedToPlayInputSchema.parse({
      type: 'RETURNED_TO_PLAY',
      commandId: crypto.randomUUID(),
      encounterId
    }),
    label: `${crowded.map(({ label }) => label).join(', ')} returned to play onto an occupied space`,
    ruleOverrides: [
      {
        code: 'RETURN_SPACE_OCCUPIED',
        message: "A returning creature's space is occupied: place it by hand."
      }
    ]
  })
  return true
}
