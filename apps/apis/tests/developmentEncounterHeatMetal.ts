import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import type {
  EncounterCommandResultDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { DevelopmentClient } from './developmentClient'
import { startPlayerEncounterJourney } from './developmentEncounterPlayerJourney'

export type EncounterHeatMetalBrowserFixture = {
  scene: { id: string; name: string }
  hero: { label: string }
  ogre: { label: string }
  itemLabel: string
}

/** The repeat row the Character is shown on a later turn: its label, holder, cast level and frozen DC. */
export type HeatMetalRepeatRow = {
  label: string
  holderLabel: string
  castLevel: number
  dc: number
}

type Step = { command: ResolveEncounterActionInputDto; result: EncounterCommandResultDto }

/** Everything the player does in their own browser; the Ogre's saves and the dice stand in through the owner's API. */
export type EncounterHeatMetalBrowserControls = {
  /** Picks Heat Metal, targets the Ogre, chooses its Longsword and resolves the cast. */
  castHeatMetal: () => Promise<Step>
  /** Ends the player's own turn from the turn-order drawer. */
  endTurn: () => Promise<void>
  /** The Actions drawer lists the repeat with the cast level and the DC the cast froze. */
  assertRepeatRow: (row: HeatMetalRepeatRow) => Promise<void>
  /** Uses the repeat row. */
  useRepeat: (row: HeatMetalRepeatRow) => Promise<Step>
  /** The Actions drawer lists no repeat row once the effect has ended. */
  assertNoRepeatRow: () => Promise<void>
}

export type EncounterHeatMetalBrowserRunner = (
  fixture: EncounterHeatMetalBrowserFixture,
  verify: (controls: EncounterHeatMetalBrowserControls) => Promise<void>
) => Promise<void>

/**
 * A Character casts Heat Metal on an Ogre's Longsword; the Ogre keeps it. On the Character's next turn the
 * Actions drawer lists the repeat at the cast level and frozen DC, and using it costs only the bonus action.
 * The Ogre's turn and the dice go through the owner's API as stand-ins: the proof is the player's own surface.
 */
export async function verifyEncounterHeatMetal({
  owner,
  player,
  campaignId,
  characterId,
  playerUserId,
  ogreSourceId,
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
  ogreSourceId: string
  /** The Heat Metal copy the Character may know, by source id. */
  spellSubjectIds: readonly string[]
  classId: string
  initiativePolicyDefinitionId: string
  initiativePolicyCatalogueId: string
  /** Publishes what the room holds to Convex: a running table saves only at save points (D90). */
  checkpoint: () => Promise<void>
  browser: EncounterHeatMetalBrowserRunner
}) {
  const {
    encounterId,
    hero,
    creature: ogre,
    scene,
    execute,
    readProjection,
    readChoices,
    settle
  } = await startPlayerEncounterJourney({
    name: 'Heat Metal',
    owner,
    player,
    campaignId,
    characterId,
    playerUserId,
    creatureSourceId: ogreSourceId,
    spellSubjectIds,
    classId,
    initiativePolicyDefinitionId,
    initiativePolicyCatalogueId,
    checkpoint
  })
  const readOffers = async () => (await readChoices(hero.id)).effectOffers

  await browser(
    {
      scene,
      hero: { label: hero.label },
      ogre: { label: ogre.label },
      itemLabel: 'Longsword'
    },
    async (controls) => {
      assert.equal((await readProjection()).currentActorId, hero.id)
      assert.deepEqual(await readOffers(), [], 'No repeat is offered before the cast.')
      const ogreHitPoints = async () =>
        (await readProjection()).actors.find((actor) => actor.id === ogre.id)?.currentHitPoints

      // 1. The Character casts Heat Metal; the Ogre's save succeeds (a 20), so it keeps the Longsword.
      const cast = await controls.castHeatMetal()
      assert.equal(cast.command.actorId, hero.id)
      const castTarget = cast.command.target
      if (castTarget?.kind !== 'ACTOR') throw new Error('The cast must target the Ogre.')
      assert.equal(castTarget.actorId, ogre.id)
      assert.ok(castTarget.boundItemInstanceId, 'The cast binds the chosen Longsword.')
      const full = (await ogreHitPoints()) ?? 0
      const settled = await settle(cast.result, 20)
      assert.equal(settled.occurrence?.status, 'COMPLETE')
      const afterCast = (await ogreHitPoints()) ?? 0
      assert.ok(afterCast < full, 'Heat Metal hurt the Ogre on the cast.')

      // 2. A later turn: the Ogre's turn passes (owner stand-in), then the Character's returns.
      await controls.endTurn()
      assert.equal((await readProjection()).currentActorId, ogre.id)
      await execute({
        type: 'ADVANCE_TURN',
        encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: (await readProjection()).version
      })
      assert.equal((await readProjection()).currentActorId, hero.id)

      // 3. The Character sees the repeat row at the cast level and the DC the cast froze, and uses it.
      const [offer, ...rest] = await readOffers()
      assert.deepEqual(rest, [])
      if (offer?.kind !== 'REPEAT_SOURCE_PATH') throw new Error('Expected the repeat offer.')
      assert.equal(offer.holderActorId, ogre.id)
      assert.equal(offer.activation, 'BONUS_ACTION')
      assert.equal(offer.castLevel, 2)
      if (offer.dc === undefined) throw new Error('The repeat offer must carry the frozen DC.')
      const row: HeatMetalRepeatRow = {
        label: offer.label,
        holderLabel: ogre.label,
        castLevel: 2,
        dc: offer.dc
      }
      await controls.assertRepeatRow(row)
      const repeat = await controls.useRepeat(row)
      assert.equal(repeat.command.actionId, offer.actionId)
      const repeatTarget = repeat.command.target
      if (repeatTarget?.kind !== 'ACTOR') throw new Error('The repeat must target the Ogre.')
      assert.equal(repeatTarget.actorId, ogre.id)
      // The Ogre now fails its save (a 1): it drops the Longsword, which ends the effect.
      const repeated = await settle(repeat.result, 1)
      assert.equal(repeated.occurrence?.status, 'COMPLETE')
      assert.ok(
        ((await ogreHitPoints()) ?? afterCast) < afterCast,
        'The repeat hurt the Ogre again.'
      )
      assert.deepEqual(await readOffers(), [], 'The released item ends the effect and its offer.')
      await controls.assertNoRepeatRow()
    }
  )
  console.log('Native Heat Metal repeat journey passed.')
}
