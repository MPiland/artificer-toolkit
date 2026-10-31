import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import type {
  EncounterCommandResultDto,
  MoveHeldEffectInputDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { DevelopmentClient } from './developmentClient'
import { startPlayerEncounterJourney } from './developmentEncounterPlayerJourney'

export type EncounterHeldEffectBrowserFixture = {
  scene: { id: string; name: string }
  map: { width: number; height: number }
  hero: { label: string }
  /** The creature that holds the mark first. */
  marked: { label: string }
  /** The creature the mark moves to, standing at `x`, `y` on the Scene. */
  next: { label: string; x: number; y: number }
}

/** The offer row the Character is shown once the marked creature is down. */
export type HeldEffectOfferRow = { holderLabel: string }

type CastStep = { command: ResolveEncounterActionInputDto; result: EncounterCommandResultDto }
type MoveStep = { command: MoveHeldEffectInputDto; result: EncounterCommandResultDto }

/** Everything the player does in their own browser; the creatures' turns, damage and the undo stand in through the owner's API. */
export type EncounterHeldEffectBrowserControls = {
  /** Casts Hunter's Mark on the first creature and closes the Actions drawer. */
  castHuntersMark: () => Promise<CastStep>
  /** Ends the player's own turn from the turn-order drawer. */
  endTurn: () => Promise<void>
  /** The Actions drawer lists the move offer for the downed holder. */
  assertOfferRow: (row: HeldEffectOfferRow) => Promise<void>
  /** The Actions drawer lists no move offer. */
  assertNoOfferRow: () => Promise<void>
  /** Chooses the offer, picks the next holder on the map and moves the effect. */
  moveToPickedOnMap: () => Promise<MoveStep>
}

export type EncounterHeldEffectBrowserRunner = (
  fixture: EncounterHeldEffectBrowserFixture,
  verify: (controls: EncounterHeldEffectBrowserControls) => Promise<void>
) => Promise<void>

/**
 * A Character marks a creature with Hunter's Mark. When that creature is at 0 hit points, the Character's
 * next turn offers to move the mark: the player picks the new holder on the map and the effect moves. The
 * GM's exact undo puts it back, and the offer returns. The creatures' turns, the damage and the undo go
 * through the owner's API as stand-ins: the proof is the player's own surface.
 */
export async function verifyEncounterHeldEffect({
  owner,
  player,
  campaignId,
  characterId,
  playerUserId,
  markedSourceId,
  nextSourceId,
  spellSubjectIds,
  classId,
  initiativePolicyDefinitionId,
  initiativePolicyCatalogueId,
  checkpoint,
  browser
}: {
  owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
  player: DevelopmentClient
  campaignId: string
  characterId: string
  playerUserId: string
  markedSourceId: string
  nextSourceId: string
  /** The Hunter's Mark copy the Character may know, by source id. */
  spellSubjectIds: readonly string[]
  classId: string
  initiativePolicyDefinitionId: string
  initiativePolicyCatalogueId: string
  /** Publishes what the room holds to Convex: a running table saves only at save points (D90). */
  checkpoint: () => Promise<void>
  browser: EncounterHeldEffectBrowserRunner
}) {
  const {
    encounterId,
    hero,
    creature: marked,
    extraCreature: next,
    scene,
    execute,
    readProjection,
    readChoices,
    settle
  } = await startPlayerEncounterJourney({
    name: 'Held effect',
    owner,
    player,
    campaignId,
    characterId,
    playerUserId,
    creatureSourceId: markedSourceId,
    extraCreatureSourceId: nextSourceId,
    spellSubjectIds,
    classId,
    initiativePolicyDefinitionId,
    initiativePolicyCatalogueId,
    checkpoint
  })
  if (!next) throw new Error('The held effect journey needs its second creature.')
  const readOffers = async () => (await readChoices(hero.id)).effectOffers
  const backToHero = async () => {
    for (let turns = 0; (await readProjection()).currentActorId !== hero.id; turns++) {
      assert.ok(turns < 5, 'The turn order did not return to the Character.')
      await execute({
        type: 'ADVANCE_TURN',
        encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: (await readProjection()).version
      })
    }
  }

  await browser(
    {
      scene,
      map: { width: 600, height: 300 },
      hero: { label: hero.label },
      marked: { label: marked.label },
      next: { label: next.label, x: 400, y: 100 }
    },
    async (controls) => {
      assert.equal((await readProjection()).currentActorId, hero.id)
      assert.deepEqual(await readOffers(), [], 'No move is offered before the cast.')

      // 1. The Character marks the first creature; the mark is held, but the creature is up.
      const cast = await controls.castHuntersMark()
      assert.equal(cast.command.actorId, hero.id)
      const castTarget = cast.command.target
      if (castTarget?.kind !== 'ACTOR') throw new Error('The cast must target the marked creature.')
      assert.equal(castTarget.actorId, marked.id)
      await settle(cast.result, 20)
      assert.deepEqual(await readOffers(), [], 'A mark on a standing creature offers no move.')

      // 2. The marked creature drops to 0 hit points (owner stand-in); the Character's next turn returns.
      await controls.endTurn()
      await execute({
        type: 'UPDATE_ACTOR',
        encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: (await readProjection()).version,
        actorId: marked.id,
        currentHitPoints: 0
      })
      await backToHero()

      // 3. The offer to move the mark is listed against the downed holder.
      const [offer, ...rest] = await readOffers()
      assert.deepEqual(rest, [])
      if (offer?.kind !== 'MOVE_HELD_EFFECT') throw new Error('Expected the move offer.')
      assert.equal(offer.holderActorId, marked.id)
      assert.equal(offer.activation, 'BONUS_ACTION')
      await controls.assertOfferRow({ holderLabel: marked.label })

      // 4. The player picks the next creature on the map; the effect moves to it.
      const moved = await controls.moveToPickedOnMap()
      assert.equal(moved.command.effectId, offer.effectId)
      assert.equal(moved.command.offerIndex, offer.offerIndex)
      assert.equal(moved.command.target.actorId, next.id)
      assert.deepEqual(await readOffers(), [], 'A moved mark rests on a standing creature.')
      await controls.assertNoOfferRow()

      // 5. The GM undoes the move (owner stand-in): the mark is back and so is the offer.
      await execute({
        type: 'REVERT_LAST_ACTION',
        encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: (await readProjection()).version
      })
      const [restored] = await readOffers()
      assert.equal(restored?.kind, 'MOVE_HELD_EFFECT')
      assert.equal(restored?.holderActorId, marked.id)
      await controls.assertOfferRow({ holderLabel: marked.label })
    }
  )
  console.log('Native held effect move journey passed.')
}
