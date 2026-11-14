import { expect, it } from 'vitest'
import { setupAutomaticCharacterMovement } from '../../tests/fixtures/automaticCharacterMovement'
import {
  readCheckpointedTokenPosition,
  useMovementReactionsInRoom
} from '../../tests/fixtures/automaticSceneMovement'
import {
  executeSceneInRoom,
  queueRoomRolls,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { reactionBinding } from '../../tests/fixtures/reactionBinding'
import { expectedReactionContact } from '../../tests/fixtures/reactionContact'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { joinCharacterPlay } from '../characters/stateDocuments'

useLocalRoomWorker()

// The reaction's ordinal, the spatial prefix's executions and their order before the contact are
// room-held receipt history: apps/session-worker/test/nativeMovementEvidence.test.ts ("stops a
// Character's movement at a used reaction ...") pins them.
it.each([false, true])(
  'stops native Character movement at a used automatic reaction with spatial prefix %s',
  async (withSpatialPrefix) => {
    const value = await setupAutomaticCharacterMovement(['AUTOMATIC', 'AUTOMATIC'], true)
    // The Bite's attack d20 is the only die drawn: the prefix and the Bite deal fixed damage.
    await queueRoomRolls(value.base.campaign.id, { rolls: [14], repeat: 0 })
    if (withSpatialPrefix) {
      await seedSpatialEffect({ ...value.base, sceneId: value.sceneId }, { x: 230, y: 50 }, 5)
    }
    // Beyond the contact, so the STOP must leave it unapplied.
    const suffix = withSpatialPrefix
      ? await seedSpatialEffect({ ...value.base, sceneId: value.sceneId }, { x: 375, y: 50 }, 5)
      : null
    /** Convex's rows as they stand; the room holds the Run's newer state until it checkpoints (D85). */
    const readRows = () =>
      value.base.t.run(async (ctx) => ({
        characters: await Promise.all(
          (await ctx.db.query('characters').collect()).map((row) => joinCharacterPlay(ctx, row))
        ),
        spatialEffects: await ctx.db.query('encounterSpatialRuleEffects').collect(),
        characterReceipts: await ctx.db.query('characterCommandReceipts').collect(),
        runs: await ctx.db.query('encounterRuns').collect(),
        entities: await ctx.db.query('sceneLiveEntities').collect()
      }))
    // Assisted play offers the authored automatic reaction as Use/Decline; the GM uses it, and the
    // root commit at that choice already settled any spatial prefix.
    const root = (await executeSceneInRoom(value.owner.caller, value.rootInput)).result
    const choice = root?.occurrence?.pending
    if (!choice || choice.kind !== 'REACTION_CHOICE')
      throw new Error('Expected the automatic reaction choice.')
    expect(choice.targetActorId).toBe(value.base.reactors[0]!.id)
    const [origin, destination] = value.rootInput.path
    if (!origin || !destination) throw new Error('Expected Character movement path.')
    const pathLength = Math.hypot(destination.x - origin.x, destination.y - origin.y)
    // Nothing is checkpointed yet, so the baseline is Convex's pre-move state.
    const before = await readRows()
    const beforeCharacter = before.characters.find((row) => row.id === value.base.character.id)
    const beforeRun = before.runs.find((row) => row.id === value.base.run.id)
    if (!beforeCharacter || !beforeRun) throw new Error('Automatic Character state is unavailable.')
    // Production checkpoints periodically, including while a reaction choice is pending; the mover's
    // token waits at the contact then (D219). Restated (QUALITY-18.T5): the offer no longer carries
    // the contact's path distance (the unified Reaction choice), so the contact is read here and
    // proved equal to the product reach function's contact, and to lie on the path.
    const contact = await readCheckpointedTokenPosition(value, value.moverTokenId)
    expect(contact).toEqual(
      expectedReactionContact({
        ...value.geometry,
        grid: value.grid,
        movingTokenId: value.moverTokenId,
        path: value.rootInput.path,
        reach: { amount: 5, unit: 'FEET' },
        reactorTokenId: value.reactorTokenIds[0]!,
        stage: reactionBinding.stage,
        tokens: value.geometry.sceneTokens
      })
    )
    const along =
      ((contact.x - origin.x) * (destination.x - origin.x) +
        (contact.y - origin.y) * (destination.y - origin.y)) /
      pathLength
    expect(along).toBeGreaterThan(0)
    expect(along).toBeLessThan(pathLength)
    expect(
      Math.hypot(
        contact.x - (origin.x + ((destination.x - origin.x) * along) / pathLength),
        contact.y - (origin.y + ((destination.y - origin.y) * along) / pathLength)
      )
    ).toBeLessThan(0.001)

    const used = await useMovementReactionsInRoom(value, 1, root)
    expect(used.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    // The STOP ends the move at the contact, not the destination.
    expect(await readCheckpointedTokenPosition(value, value.moverTokenId)).toEqual(contact)
    expect(contact).not.toEqual(destination)
    const after = await readRows()
    expect(after.characterReceipts).toHaveLength(before.characterReceipts.length)
    // The Character's stream advances once for the used reaction, and once more for the prefix's damage.
    expect(
      after.characters.find((row) => row.id === value.base.character.id)?.play.streamVersion
    ).toBe(beforeCharacter.play.streamVersion + (withSpatialPrefix ? 2 : 1))
    // Restated (QUALITY-18.T2b3): the used reaction commits as the reactor's own action and the
    // room's resume then ends the move at the contact (D219), so the Run advances once more than
    // when the Use answer committed both at once.
    expect(after.runs.find((row) => row.id === value.base.run.id)?.version).toBe(
      beforeRun.version + (withSpatialPrefix ? 3 : 2)
    )
    expect(after.spatialEffects.map((effect) => effect.id)).toEqual(suffix ? [suffix.id] : [])
    expect(after.entities).toMatchObject([
      { entityId: value.moverTokenId, value: { entity: { position: contact } } }
    ])
  },
  30_000
)
