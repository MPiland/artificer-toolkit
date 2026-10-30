import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import type {
  EncounterCommandResultDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { api } from '../convex/_generated/api.js'
import type { DevelopmentClient } from './developmentClient'
import { startPlayerEncounterJourney } from './developmentEncounterPlayerJourney'

export type EncounterDelegatedAttackBrowserFixture = {
  scene: { id: string; name: string }
  familiar: { label: string }
  target: { label: string }
}

/** Everything the player does in their own browser; the cast, the turns and the dice stand in through the owner's API. */
export type EncounterDelegatedAttackBrowserControls = {
  /** Picks the familiar's Claws under the Character's actions, targets the creature and resolves. */
  attackWithFamiliar: () => Promise<{
    command: ResolveEncounterActionInputDto
    result: EncounterCommandResultDto
  }>
  /** The Actions drawer no longer lists the familiar's attack. */
  assertAttackGone: () => Promise<void>
}

export type EncounterDelegatedAttackBrowserRunner = (
  fixture: EncounterDelegatedAttackBrowserFixture,
  verify: (controls: EncounterDelegatedAttackBrowserControls) => Promise<void>
) => Promise<void>

/**
 * A Character holding a DELEGATED_ATTACK grant conjures its familiar beside a creature (owner stand-in).
 * On the Character's turn the Actions drawer lists the familiar's attack, and picking it sends the
 * familiar's attack commanded by the Character. Its one attack spent, the choice is gone.
 */
export async function verifyEncounterDelegatedAttack({
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
  browser: EncounterDelegatedAttackBrowserRunner
}) {
  const { encounterId, hero, creature, scene, execute, readProjection, readChoices, settle } =
    await startPlayerEncounterJourney({
      name: 'Delegated attack',
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

  // The familiar appears one square from the creature, within the summon's 10 feet of the Character.
  const summon = (await readChoices(hero.id)).actions.find(
    ({ target }) => target.kind === 'POINT' && target.summonForms
  )
  if (summon?.target.kind !== 'POINT') throw new Error('The Character has no summon to cast.')
  const form = summon.target.summonForms?.find(({ label }) => label === 'Cat')
  const creatureType = summon.target.creatureTypes?.find(({ label }) => label === 'Fey')
  if (!form || !creatureType) throw new Error('The summon must offer the Cat and the Fey type.')
  const header = await owner.query(api.scenes.recipientReads.header, { sceneId: scene.id })
  const cast = await execute({
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: summon.warnings.map(({ code }) => code),
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
    actionId: summon.id,
    optionalCombatIntent: null,
    sceneContext: null
  })
  await settle(cast, 20)

  const familiar = (await readProjection()).actors.find(
    (actor) => actor.kind === 'CREATURE' && actor.id !== creature.id
  )
  if (!familiar) throw new Error('The cast conjured no familiar.')
  // The turns go round to the Character again with its Action back.
  let turns = 0
  do {
    await execute({
      type: 'ADVANCE_TURN',
      encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: (await readProjection()).version
    })
    turns += 1
  } while (turns < 4 && (await readProjection()).currentActorId !== hero.id)
  assert.equal((await readProjection()).currentActorId, hero.id)

  const delegatedChoices = async () =>
    (await readChoices(hero.id)).actions.filter(
      ({ delegateActorId }) => delegateActorId === familiar.id
    )
  assert.equal((await delegatedChoices()).length, 1, 'The Character lists the familiar’s attack.')
  const creatureHitPoints = async () =>
    (await readProjection()).actors.find((actor) => actor.id === creature.id)?.currentHitPoints

  await browser(
    {
      scene,
      familiar: { label: familiar.label },
      target: { label: creature.label }
    },
    async (controls) => {
      const full = (await creatureHitPoints()) ?? 0
      const attack = await controls.attackWithFamiliar()
      assert.equal(attack.command.actorId, familiar.id)
      assert.equal(attack.command.delegatingActorId, hero.id)
      const attackTarget = attack.command.target
      if (attackTarget?.kind !== 'ACTOR') throw new Error('The attack must target the creature.')
      assert.equal(attackTarget.actorId, creature.id)

      const settled = await settle(attack.result, 19)
      assert.equal(settled.occurrence?.status, 'COMPLETE')
      assert.ok(((await creatureHitPoints()) ?? 0) < full, 'The familiar hurt the creature.')

      assert.deepEqual(await delegatedChoices(), [], 'The Character’s one attack is spent.')
      await controls.assertAttackGone()
    }
  )
}
