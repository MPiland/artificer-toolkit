import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import {
  type EncounterCommandResultDto,
  type ResolveRuleOccurrenceInputDto,
  resolveEncounterActionInputDtoSchema
} from '@artificer-toolkit/schema/api/encounters'
import { api } from '../convex/_generated/api.js'
import type { DevelopmentClient } from './developmentClient'
import { startPlayerEncounterJourney } from './developmentEncounterPlayerJourney'

export type EncounterGiantKillerBrowserFixture = {
  scene: { id: string; name: string }
  ogre: { label: string }
}

/** Everything the player does in their own browser; the Ogre's turn and the dice stand in through the owner's API. */
export type EncounterGiantKillerBrowserControls = {
  /** The drawer offers the reaction; the player picks the first Giant Killer option. */
  useReaction: () => Promise<{
    command: ResolveRuleOccurrenceInputDto
    result: EncounterCommandResultDto
  }>
}

export type EncounterGiantKillerBrowserRunner = (
  fixture: EncounterGiantKillerBrowserFixture,
  verify: (controls: EncounterGiantKillerBrowserControls) => Promise<void>
) => Promise<void>

/**
 * A Hunter with Giant Killer stands beside a Large Ogre. The Ogre's Greatclub hits the Hunter (owner
 * stand-in), which raises the Hunter's reaction offer (D219). The player answers it in the decision
 * drawer, the reaction attack runs in the same command, and it lands on the Ogre.
 */
export async function verifyEncounterGiantKiller({
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
  spellSubjectIds: readonly string[]
  classId: string
  initiativePolicyDefinitionId: string
  initiativePolicyCatalogueId: string
  /** Publishes what the room holds to Convex: a running table saves only at save points (D90). */
  checkpoint: () => Promise<void>
  browser: EncounterGiantKillerBrowserRunner
}) {
  const {
    encounterId,
    hero,
    creature,
    scene,
    tokenIds,
    execute,
    readProjection,
    readChoices,
    settle
  } = await startPlayerEncounterJourney({
    name: 'Giant Killer',
    owner,
    player,
    campaignId,
    characterId,
    playerUserId,
    creatureSourceId,
    // The Ogre stands one square from the Character: inside its 5 feet of reach.
    creatureX: 150,
    spellSubjectIds,
    classId,
    initiativePolicyDefinitionId,
    initiativePolicyCatalogueId,
    checkpoint
  })
  const hitPoints = async (actorId: string) =>
    (await readProjection()).actors.find((actor) => actor.id === actorId)?.currentHitPoints

  // Stand-in for the Ogre's turn: the owner's API issues its Greatclub at the Hunter and enters its dice.
  await execute({
    type: 'SET_CURRENT_ACTOR',
    encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: (await readProjection()).version,
    actorId: creature.id
  })
  const greatclub = (await readChoices(creature.id)).actions.find(({ label }) =>
    label.startsWith('Greatclub')
  )
  if (!greatclub) throw new Error('The Ogre has no Greatclub action choice.')
  const { gmRollVisibility } = await owner.query(api.account.rollPreferences, {})
  const header = await owner.query(api.scenes.recipientReads.header, { sceneId: scene.id })
  const ogreFull = (await hitPoints(creature.id)) ?? 0
  const heroFull = (await hitPoints(hero.id)) ?? 0
  const attack = await execute(
    resolveEncounterActionInputDtoSchema.parse({
      type: 'RESOLVE_ACTION',
      encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: (await readProjection()).version,
      actorId: creature.id,
      target: { kind: 'ACTOR', actorId: hero.id },
      actionId: greatclub.id,
      sceneContext: {
        sceneId: scene.id,
        expectedSceneVersion: header.version,
        sourceTokenId: tokenIds.creature,
        targetTokenId: tokenIds.hero
      },
      visibility: gmRollVisibility,
      acknowledgedWarnings: [],
      acceptedWieldConflict: null,
      optionalCombatIntent: null
    })
  )
  // The Ogre's d20 shows a hit; the room then raises the Hunter's reaction offer as the pending decision.
  const offered = await settle(attack, 19, 'REACTION_OFFER')
  assert.equal(offered.occurrence?.pending?.kind, 'REACTION_OFFER', 'The hit raises the offer.')
  assert.ok(((await hitPoints(hero.id)) ?? 0) < heroFull, 'The Greatclub hit the Hunter.')
  assert.equal(await hitPoints(creature.id), ogreFull, 'The Ogre is unhurt before the answer.')

  await browser({ scene, ogre: { label: creature.label } }, async (controls) => {
    const answer = await controls.useReaction()
    assert.equal(answer.command.type, 'RESOLVE_RULE_OCCURRENCE')
    assert.equal(answer.command.resolution.kind, 'OPTION')
    // The chosen reaction attack is the Hunter's: its d20 and damage dice are entered as the owner.
    const settled = await settle(answer.result, 19)
    assert.equal(settled.occurrence?.status, 'COMPLETE')
    assert.ok(((await hitPoints(creature.id)) ?? 0) < ogreFull, 'Giant Killer hurt the Ogre.')
  })
}
