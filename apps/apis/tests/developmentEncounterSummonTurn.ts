import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api.js'
import type { DevelopmentClient } from './developmentClient'
import { startPlayerEncounterJourney } from './developmentEncounterPlayerJourney'

export type EncounterSummonTurnBrowserFixture = {
  scene: { id: string; name: string }
  hero: { label: string }
  summon: { label: string }
}

/** Everything the player does in their own browser; the cast and the dice stand in through the owner's API. */
export type EncounterSummonTurnBrowserControls = {
  /** The player ends their Character's turn from the turn order drawer. */
  endCharacterTurn: () => Promise<void>
  /** The turn prompt names the summon and its owner, and no prompt shows on the Character's own turn. */
  assertPromptedForSummon: () => Promise<void>
  /** The player ends the summon's turn; the prompt goes and the turn leaves the summon. */
  endSummonTurn: () => Promise<void>
}

export type EncounterSummonTurnBrowserRunner = (
  fixture: EncounterSummonTurnBrowserFixture,
  verify: (controls: EncounterSummonTurnBrowserControls) => Promise<void>
) => Promise<void>

/**
 * A Character conjures a summon authored to act right after its owner (owner stand-in). When the
 * Character's player ends their turn, the summon's turn starts and the player is prompted; ending the
 * summon's turn clears the prompt.
 */
export async function verifyEncounterSummonTurn({
  owner,
  player,
  campaignId,
  characterId,
  playerUserId,
  creatureSourceId,
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
  creatureSourceId: string
  /** The summoning spell copy the Character may know, by source id. */
  spellSubjectIds: readonly string[]
  classId: string
  initiativePolicyDefinitionId: string
  initiativePolicyCatalogueId: string
  /** Publishes what the room holds to Convex: a running table saves only at save points (D90). */
  checkpoint: () => Promise<void>
  browser: EncounterSummonTurnBrowserRunner
}) {
  const { encounterId, hero, creature, scene, execute, readProjection, readChoices, settle } =
    await startPlayerEncounterJourney({
      name: 'Summon turn',
      owner,
      player,
      campaignId,
      characterId,
      playerUserId,
      creatureSourceId,
      spellSubjectIds,
      classId,
      initiativePolicyDefinitionId,
      initiativePolicyCatalogueId,
      checkpoint
    })

  const summonAction = (await readChoices(hero.id)).actions.find(
    ({ target }) => target.kind === 'POINT' && target.summonForms
  )
  if (summonAction?.target.kind !== 'POINT') throw new Error('The Character has no summon to cast.')
  const form = summonAction.target.summonForms?.find(({ label }) => label === 'Cat')
  const creatureType = summonAction.target.creatureTypes?.find(({ label }) => label === 'Fey')
  if (!form || !creatureType) throw new Error('The summon must offer the Cat and the Fey type.')
  const header = await owner.query(api.scenes.recipientReads.header, { sceneId: scene.id })
  const cast = await execute({
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: summonAction.warnings.map(({ code }) => code),
    encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: (await readProjection()).version,
    actorId: hero.id,
    target: {
      kind: 'POINT',
      sceneId: scene.id,
      expectedSceneVersion: header.version,
      point: { x: 200, y: 100 },
      formId: form.id,
      creatureTypeId: creatureType.id
    },
    actionId: summonAction.id,
    optionalCombatIntent: null,
    sceneContext: null
  })
  await settle(cast, 20)

  const conjured = (await readProjection()).actors.find(
    (actor) => actor.kind === 'CREATURE' && actor.id !== creature.id
  )
  if (!conjured) throw new Error('The cast conjured no summon.')
  assert.equal(
    conjured.owner?.ownerActorId,
    hero.id,
    'DEBUG ' +
      JSON.stringify({
        c: conjured.controllerUserIds,
        h: hero.controllerUserIds,
        o: conjured.owner,
        ph: playerUserId
      })
  )
  assert.equal(conjured.owner?.turnTiming, 'AFTER_OWNER', 'The summon acts right after its owner.')
  assert.equal((await readProjection()).currentActorId, hero.id)

  await browser(
    { scene, hero: { label: hero.label }, summon: { label: conjured.label } },
    async (controls) => {
      await controls.endCharacterTurn()
      assert.equal(
        (await readProjection()).currentActorId,
        conjured.id,
        "The summon's turn follows its owner's."
      )
      await controls.assertPromptedForSummon()
      await controls.endSummonTurn()
      assert.notEqual((await readProjection()).currentActorId, conjured.id)
    }
  )
}
