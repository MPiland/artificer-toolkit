import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import type {
  EncounterCommandResultDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { DevelopmentClient } from './developmentClient'
import { startPlayerEncounterJourney } from './developmentEncounterPlayerJourney'

export type EncounterConcentrationSheetBrowserFixture = {
  scene: { id: string; name: string }
  hero: { label: string }
  /** The creature Hunter's Mark lands on. */
  marked: { label: string }
  /** The creature Shield of Faith lands on. */
  warded: { label: string }
  /** The Character's public id: the Sheet route. */
  characterPublicId: string
}

type CastStep = { command: ResolveEncounterActionInputDto; result: EncounterCommandResultDto }

/** Everything the player does in their own browser; the creatures' turns stand in through the owner's API. */
export type EncounterConcentrationSheetBrowserControls = {
  /** Casts the named Concentration spell on the named creature from the Actions drawer. */
  cast: (spell: RegExp, targetLabel: string) => Promise<CastStep>
  /** Ends the player's own turn from the turn-order drawer. */
  endTurn: () => Promise<void>
  /** Opens the Sheet: it lists exactly these Concentrations, each with its own End button. */
  assertSheetConcentrations: (spellLabels: readonly string[]) => Promise<void>
  /** Ends the Concentration on `spellLabel` from its Sheet row. */
  endOnSheet: (spellLabel: string) => Promise<void>
}

export type EncounterConcentrationSheetBrowserRunner = (
  fixture: EncounterConcentrationSheetBrowserFixture,
  verify: (controls: EncounterConcentrationSheetBrowserControls) => Promise<void>
) => Promise<void>

/**
 * A Character who keeps two Concentrations casts Hunter's Mark, then Shield of Faith on its next turn.
 * Its Sheet lists both; the player ends Hunter's Mark from its own row and Shield of Faith stays, then
 * ends that one too (SPELLS-12.3). The creatures' turns go through the owner's API as stand-ins.
 */
export async function verifyEncounterConcentrationSheet({
  owner,
  player,
  campaignId,
  characterId,
  characterPublicId,
  playerUserId,
  markedSourceId,
  wardedSourceId,
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
  characterPublicId: string
  playerUserId: string
  markedSourceId: string
  wardedSourceId: string
  spellSubjectIds: readonly string[]
  classId: string
  initiativePolicyDefinitionId: string
  initiativePolicyCatalogueId: string
  /** Publishes what the room holds to Convex: a running table saves only at save points (D90). */
  checkpoint: () => Promise<void>
  browser: EncounterConcentrationSheetBrowserRunner
}) {
  const {
    encounterId,
    hero,
    creature: marked,
    extraCreature: warded,
    scene,
    execute,
    readProjection,
    settle
  } = await startPlayerEncounterJourney({
    name: 'Concentration sheet',
    owner,
    player,
    campaignId,
    characterId,
    playerUserId,
    creatureSourceId: markedSourceId,
    extraCreatureSourceId: wardedSourceId,
    spellSubjectIds,
    classId,
    initiativePolicyDefinitionId,
    initiativePolicyCatalogueId,
    checkpoint
  })
  if (!warded) throw new Error('The Concentration journey needs its second creature.')
  const holds = async () =>
    Boolean((await readProjection()).actors.find((actor) => actor.id === hero.id)?.concentration)
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
      hero: { label: hero.label },
      marked: { label: marked.label },
      warded: { label: warded.label },
      characterPublicId
    },
    async (controls) => {
      assert.equal((await readProjection()).currentActorId, hero.id)
      assert.equal(await holds(), false, 'No Concentration is held before the casts.')

      // 1. Two Concentrations on two turns: capacity lets the second keep the first.
      const first = await controls.cast(/^Hunter.s Mark/, marked.label)
      await settle(first.result, 20)
      await controls.endTurn()
      await backToHero()
      const second = await controls.cast(/^Shield of Faith/, warded.label)
      await settle(second.result, 20)
      assert.ok(await holds(), 'The Character holds Concentration after both casts.')

      // 2. The Sheet lists both; the player ends Hunter's Mark and Shield of Faith stays.
      await controls.assertSheetConcentrations(["Hunter's Mark", 'Shield of Faith'])
      await controls.endOnSheet("Hunter's Mark")
      await controls.assertSheetConcentrations(['Shield of Faith'])
      assert.ok(await holds(), 'Ending one Concentration leaves the other held.')

      // 3. Ending the last one leaves none.
      await controls.endOnSheet('Shield of Faith')
      await controls.assertSheetConcentrations([])
      assert.equal(await holds(), false, 'Ending both leaves no Concentration.')
    }
  )
  console.log('Native Concentration sheet journey passed.')
}
