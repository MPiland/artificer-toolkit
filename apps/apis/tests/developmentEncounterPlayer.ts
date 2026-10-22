import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import {
  type EncounterCommandResultDto,
  type EncounterExecuteInput,
  type EncounterTimelineDto,
  encounterGmProjectionDtoSchema,
  type ResolveEncounterActionInputDto,
  resolveEncounterActionInputDtoSchema,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterActionChoicesResponseDto,
  GetEncounterActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import { api } from '../convex/_generated/api.js'
import { type DevelopmentClient, executeEncounterCommand } from './developmentClient'

const actionChoices = makeFunctionReference<
  'query',
  GetEncounterActionChoicesInputDto,
  EncounterActionChoicesResponseDto
>('encounters/actionChoices:get')

type Resolution = Extract<
  EncounterExecuteInput['command'],
  { type: 'RESOLVE_RULE_OCCURRENCE' }
>['resolution']

export type EncounterPlayerBrowserFixture = {
  scene: { id: string; name: string }
  sessionNumber: number
  map: { width: number; height: number }
  hero: { label: string; x: number; y: number }
  wolf: { label: string; x: number; y: number }
}

type PlayerStep<Command> = { command: Command; result: EncounterCommandResultDto }

/** Everything the player does in their own browser; none of it needs the GM. */
export type EncounterPlayerBrowserControls = {
  /** Picks the Club, picks the Wolf's token on the map as the target, and resolves the attack. */
  attackWolfFromMap: () => Promise<PlayerStep<ResolveEncounterActionInputDto>>
  /** Types the value into the open evidence row of the pending decision and submits it. */
  answerEvidence: (value: number) => Promise<PlayerStep<ResolveRuleOccurrenceInputDto>>
  /** Takes the offered reaction from the pending decision. */
  useReaction: () => Promise<PlayerStep<ResolveRuleOccurrenceInputDto>>
  /** Picks Thunderwave, aims it on the map from the Character toward the Wolf, and resolves it. */
  castThunderwaveFromMap: () => Promise<PlayerStep<ResolveEncounterActionInputDto>>
  /** Ends the player's own turn from the turn-order drawer. */
  endTurn: () => Promise<void>
  /** The pending death-save decision is the one titled "Death save". */
  assertDeathSaveOffered: () => Promise<void>
  assertDeathSaveSettled: () => Promise<void>
}

export type EncounterPlayerBrowserRunner = (
  fixture: EncounterPlayerBrowserFixture,
  verify: (controls: EncounterPlayerBrowserControls) => Promise<void>
) => Promise<void>

/**
 * Plays a player's own turns through the browser with no GM step: a 1-HP Character casts Thunderwave
 * from the map and targets the Wolf from the map. The Wolf's turns and the dice it rolls go through the
 * owner's API as stand-ins, because the proof is about the player's actions, not the GM's.
 */
export async function verifyEncounterPlayer({
  owner,
  player,
  campaignId,
  characterId,
  playerUserId,
  wolfSourceId,
  spellSubjectIds,
  classId,
  initiativePolicyDefinitionId,
  initiativePolicyCatalogueId,
  checkpoint,
  readTimeline,
  browser
}: {
  owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
  player: DevelopmentClient
  campaignId: string
  characterId: string
  playerUserId: string
  wolfSourceId: string
  /** The Shield and Thunderwave copies the Character may know, by source id. */
  spellSubjectIds: readonly string[]
  classId: string
  initiativePolicyDefinitionId: string
  initiativePolicyCatalogueId: string
  /** Publishes what the room holds to Convex: a running table saves only at save points (D90). */
  checkpoint: () => Promise<void>
  readTimeline: () => Promise<EncounterTimelineDto | null>
  browser: EncounterPlayerBrowserRunner
}) {
  assert.notEqual(owner, player, 'Player verification requires independent clients.')
  let campaign = await owner.query(api.campaigns.queries.get, { id: campaignId })
  if (!campaign.additionalRulesCatalogueIds.includes(initiativePolicyCatalogueId)) {
    await owner.mutation(api.campaigns.update.update, {
      campaignId,
      expectedVersion: campaign.version,
      additionalRulesCatalogueIds: [
        ...campaign.additionalRulesCatalogueIds,
        initiativePolicyCatalogueId
      ]
    })
    campaign = await owner.query(api.campaigns.queries.get, { id: campaignId })
  }
  // The room caches each roller's preference, so both stay off for the whole journey: dice are typed.
  await owner.mutation(api.account.setAutoRollDice, { autoRollDice: false })
  await player.mutation(api.account.setAutoRollDice, { autoRollDice: false })
  const settings = await owner.query(api.campaigns.playSettings.get, { campaignId })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await owner.mutation(api.campaigns.playSettings.save, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId,
    initiativeTieDefinitionId: null
  })
  await player.mutation(api.campaigns.assignments.assign, { campaignId, characterId })

  // Sheet commands go through Convex, so they come before the room holds the Character.
  const sheet = await player.query(api.characters.sheet.get, { id: characterId })
  assert.ok(sheet, 'The player Character sheet must be readable.')
  let streamVersion = sheet.meta.streamVersion
  for (const command of [
    { type: 'SET_KNOWN_SPELLS' as const, classId, spellIds: [...spellSubjectIds] },
    { type: 'SET_PREPARED_SPELLS' as const, classId, spellIds: [...spellSubjectIds] },
    // One hit point: the Wolf's second bite drops the Character to 0 and starts death saves.
    { type: 'SET_HIT_POINTS' as const, current: 1 }
  ]) {
    streamVersion = (
      await player.mutation(api.characters.sheetCommands.execute, {
        id: characterId,
        command: { ...command, commandId: crypto.randomUUID(), expectedVersion: streamVersion }
      })
    ).streamVersion
  }

  const blueprint = await owner.mutation(api.encounters.blueprints.create, {
    gameSystemId: campaign.gameSystemId,
    name: 'Player journey fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE' as const, sourceId: wolfSourceId }]
  })
  const created = await owner.mutation(api.encounters.runs.create, {
    campaignId,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  let started = await owner.mutation(executeEncounterCommand, {
    command: {
      type: 'START',
      encounterId: created.id,
      commandId: crypto.randomUUID(),
      expectedVersion: created.version
    }
  })
  for (let resolutions = 0; started.occurrence?.status === 'PENDING'; resolutions++) {
    assert.ok(resolutions < 30, 'Player journey initiative did not settle.')
    const pending = started.occurrence.pending
    let resolution: Resolution
    if (pending?.kind === 'INITIATIVE_EVIDENCE') {
      resolution = {
        kind: 'ENTER_INTEGER',
        requestId: pending.request.requestId,
        value: pending.request.max
      }
    } else if (pending?.kind === 'INITIATIVE_ORDER') {
      const entityId = pending.optionIds[0]
      if (!entityId) throw new Error('Player journey has no initiative choice.')
      resolution = { kind: 'INITIATIVE_ENTITY', requestId: pending.requestId, entityId }
    } else {
      throw new Error('Player journey requested an unexpected initiative continuation.')
    }
    started = await owner.mutation(executeEncounterCommand, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: created.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version,
        correlationId: null,
        occurrenceId: started.occurrence.occurrenceId,
        expectedOccurrenceVersion: started.occurrence.occurrenceVersion,
        resolution
      }
    })
  }
  let run = encounterGmProjectionDtoSchema.parse(started.projection)
  const wolf = run.actors.find(
    (actor) => actor.kind === 'CREATURE' && actor.sourceId === wolfSourceId
  )
  const hero = run.actors.find(
    (actor) => actor.kind === 'CHARACTER' && actor.sourceId === characterId
  )
  if (!wolf || !hero) throw new Error('Player journey actors are absent from the Run.')
  const wolfId = wolf.id
  if (run.currentActorId !== hero.id)
    run = encounterGmProjectionDtoSchema.parse(
      (
        await owner.mutation(executeEncounterCommand, {
          command: {
            type: 'SET_CURRENT_ACTOR',
            encounterId: run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: run.version,
            actorId: hero.id
          }
        })
      ).projection
    )

  // The Wolf stands next to the Character, inside reach and inside Thunderwave's cube.
  const heroPlacement = {
    id: hero.id,
    label: hero.label,
    x: 600,
    y: 300,
    controlledByUserIds: [playerUserId],
    tokenId: crypto.randomUUID()
  }
  const wolfPlacement = {
    id: wolf.id,
    label: wolf.label,
    x: 650,
    y: 300,
    controlledByUserIds: [],
    tokenId: crypto.randomUUID()
  }
  const placed = [heroPlacement, wolfPlacement]
  const sceneToken = (creature: typeof heroPlacement) => ({
    id: creature.tokenId,
    assetId: null,
    controlledByUserIds: creature.controlledByUserIds,
    height: 50,
    hidden: false as const,
    label: creature.label,
    locked: false as const,
    position: { x: creature.x, y: creature.y },
    rotationDegrees: 0,
    senses: [],
    vision: null,
    width: 50
  })
  const { createEncounterLifecycleScene } = await import('./developmentEncounterScenes')
  const { bindScene, bindToken } = await import('./developmentEncounterLifecycle')
  const name = 'Player journey browser scene'
  const preparedScene = await createEncounterLifecycleScene({
    owner,
    campaignId,
    name,
    options: {
      // A player sees only explored tokens (D87); this proof checks the player's actions, not fog.
      fogMode: 'OFF',
      map: { width: 1200, height: 600 },
      grid: {
        kind: 'SQUARE',
        origin: { x: 0, y: 0 },
        cellSize: 50,
        distancePerCell: 5,
        diagonalPolicy: 'EQUAL',
        unit: 'FEET'
      },
      tokens: [sceneToken(heroPlacement), sceneToken(wolfPlacement)]
    }
  })
  const presentation = await owner.query(api.scenes.presentations.get, { campaignId })
  await owner.action(api.scenes.presentations.setLive, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    campaignId,
    sceneId: preparedScene.liveSceneId,
    expectedPresentationVersion: presentation?.version ?? null
  })
  await owner.mutation(bindScene, {
    type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
    encounterId: run.id,
    commandId: crypto.randomUUID()
  })
  run = encounterGmProjectionDtoSchema.parse(
    await owner.query(api.encounters.projectionReads.get, { encounterId: run.id })
  )
  for (const { id: actorId, tokenId } of placed) {
    run = encounterGmProjectionDtoSchema.parse(
      (
        await owner.mutation(bindToken, {
          input: {
            type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
            commandId: crypto.randomUUID(),
            encounterId: run.id,
            expectedEncounterVersion: run.version,
            actorId,
            sceneId: preparedScene.liveSceneId,
            tokenId
          }
        })
      ).projection
    )
  }
  const session = await owner.mutation(api.campaigns.sessions.create, {
    campaignId,
    title: 'Player journey session'
  })
  // Snapshot builds run a moment after each publish; the room refuses to activate on a stale head.
  const snapshotDeadline = Date.now() + 60_000
  for (;;) {
    const { sources, campaign: campaignHead } = await player.query(
      api.contentSnapshots.manifest.manifest,
      { systemId: campaign.gameSystemId, characterId }
    )
    const heads = [...sources.map((source) => source.head), campaignHead?.head]
    // A scope with no content has no head; the room reads it as empty.
    if (heads.every((head) => !head || head.builtRevision === head.revision)) break
    assert.ok(
      Date.now() < snapshotDeadline,
      `Content snapshot heads did not finish building: ${JSON.stringify(
        heads.map((head) => head && { revision: head.revision, built: head.builtRevision })
      )}`
    )
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  await checkpoint()

  const execute = (command: EncounterExecuteInput['command']) =>
    owner.mutation(executeEncounterCommand, { command })
  const readProjection = async () => {
    await checkpoint()
    return encounterGmProjectionDtoSchema.parse(
      await owner.query(api.encounters.projectionReads.get, { encounterId: run.id })
    )
  }
  const actorOf = (projection: typeof run, actorId: string) => {
    const actor = projection.actors.find((entry) => entry.id === actorId)
    if (!actor) throw new Error('Player journey actor is absent from the Run.')
    return actor
  }
  type Pending = NonNullable<NonNullable<EncounterCommandResultDto['occurrence']>['pending']>
  const pendingOf = <Kind extends Pending['kind']>(
    result: EncounterCommandResultDto,
    kind: Kind
  ) => {
    const pending = result.occurrence?.pending
    if (result.occurrence?.status !== 'PENDING' || pending?.kind !== kind)
      throw new Error(
        `Expected ${kind} to be pending; the occurrence is ${result.occurrence?.status ?? 'absent'} with ${pending?.kind ?? 'nothing'} pending.`
      )
    return pending as Extract<Pending, { kind: Kind }>
  }
  const readRun = async () => {
    const projection = await readProjection()
    return {
      currentActorId: projection.currentActorId,
      heroHitPoints: actorOf(projection, hero.id).currentHitPoints,
      wolfHitPoints: actorOf(projection, wolf.id).currentHitPoints
    }
  }

  // Stand-in for the Wolf's turn: the owner's API issues its Bite and enters the dice it rolls.
  const wolfBites = async (attackFace: number) => {
    const projection = await readProjection()
    const choices = await owner.query(actionChoices, {
      encounterId: run.id,
      expectedVersion: projection.version,
      actorId: wolf.id
    })
    const bite = choices?.actions.find((action) => action.label.startsWith('Bite'))
    if (!bite) throw new Error('The Wolf has no Bite action choice.')
    const { gmRollVisibility } = await owner.query(api.account.rollPreferences, {})
    const header = await owner.query(api.scenes.recipientReads.header, {
      sceneId: preparedScene.liveSceneId
    })
    const issued = await execute(
      resolveEncounterActionInputDtoSchema.parse({
        type: 'RESOLVE_ACTION',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: projection.version,
        actorId: wolf.id,
        target: { kind: 'ACTOR', actorId: hero.id },
        actionId: bite.id,
        sceneContext: {
          sceneId: preparedScene.liveSceneId,
          expectedSceneVersion: header.version,
          sourceTokenId: wolfPlacement.tokenId,
          targetTokenId: heroPlacement.tokenId
        },
        visibility: gmRollVisibility,
        acknowledgedWarnings: [],
        acceptedWieldConflict: null,
        optionalCombatIntent: null
      })
    )
    return answerOwnerDice(issued, attackFace)
  }
  const endWolfTurn = async () =>
    execute({
      type: 'ADVANCE_TURN',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: (await readProjection()).version
    })

  await browser(
    {
      scene: { id: preparedScene.liveSceneId, name },
      sessionNumber: session.sessionNumber,
      map: { width: 1200, height: 600 },
      hero: { label: hero.label, x: heroPlacement.x, y: heroPlacement.y },
      wolf: { label: wolf.label, x: wolfPlacement.x, y: wolfPlacement.y }
    },
    async (controls) => {
      const start = await readRun()
      assert.equal(start.currentActorId, hero.id)
      assert.equal(start.heroHitPoints, 1)

      // 1. The player attacks, picking the Wolf's token on the map; no list order is assumed.
      const attack = await controls.attackWolfFromMap()
      assert.equal(attack.command.actorId, hero.id)
      assert.deepEqual(attack.command.target, { kind: 'ACTOR', actorId: wolf.id })
      const attackRoll = pendingOf(attack.result, 'D20_EVIDENCE')
      assert.equal(attackRoll.rollerActorId, hero.id)
      const attackRolled = await controls.answerEvidence(attackRoll.request.max - 5)
      const damage = pendingOf(attackRolled.result, 'ACTION_OUTCOME_EVIDENCE')
      assert.equal(damage.rollerActorId, hero.id)
      const struck = await controls.answerEvidence(damage.request.min)
      assert.equal(struck.result.occurrence?.status, 'COMPLETE')
      const afterAttack = await readRun()
      assert.ok(afterAttack.wolfHitPoints < start.wolfHitPoints, 'The Club hit the Wolf.')
      await controls.endTurn()
      assert.equal((await readRun()).currentActorId, wolf.id)

      // 2. The Wolf bites (owner stand-in); the player spends their reaction on Shield, with no GM step.
      const bitten = await wolfBites(9)
      pendingOf(bitten, 'REACTION_CHOICE')
      const shielded = await controls.useReaction()
      assert.equal(shielded.result.occurrence?.status, 'COMPLETE')
      assert.equal(
        (await readRun()).heroHitPoints,
        1,
        'Shield turns the Bite away, so the Character keeps its one hit point.'
      )
      await endWolfTurn()
      assert.equal((await readRun()).currentActorId, hero.id)

      // 3. The player casts Thunderwave, aiming it on the map; the Wolf's save is the owner's stand-in.
      const cast = await controls.castThunderwaveFromMap()
      assert.equal(cast.command.actorId, hero.id)
      assert.equal(cast.command.target.kind, 'DIRECTED')
      const saves = pendingOf(cast.result, 'AREA_SAVES')
      assert.deepEqual(saves.caught, [wolf.label])
      // A 1 fails the Wolf's save; the area's damage is rolled once for the cast, with no further roll.
      const beforeThunder = (await readRun()).wolfHitPoints
      const thundered = await answerOwnerDice(cast.result, 1)
      assert.equal(thundered.occurrence?.status, 'COMPLETE')
      assert.ok((await readRun()).wolfHitPoints < beforeThunder, 'Thunderwave hurt the Wolf.')
      await controls.endTurn()
      assert.equal((await readRun()).currentActorId, wolf.id)

      // 4. The Wolf bites again (owner stand-in) with no Shield left; the Character drops to 0.
      const felled = await wolfBites(15)
      assert.equal(felled.occurrence?.status, 'COMPLETE')
      assert.equal((await readRun()).heroHitPoints, 0)

      // 5. The Wolf's turn ends; the Character's turn opens with a death save the player rolls.
      const turn = await endWolfTurn()
      const deathSave = pendingOf(turn, 'D20_EVIDENCE')
      assert.equal(deathSave.rollerActorId, hero.id)
      assert.equal(deathSave.trigger?.kind, 'DEATH_SAVE')
      await controls.assertDeathSaveOffered()
      const saveRolled = await controls.answerEvidence(12)
      assert.equal(saveRolled.result.occurrence?.status, 'COMPLETE')
      await controls.assertDeathSaveSettled()
      // The roll's outcome is on the player's Character Sheet: the tabletop shows only the prompt.
      await checkpoint()
      const sheet = await player.query(api.characters.sheet.get, { id: characterId })
      assert.ok(sheet)
      assert.deepEqual(
        {
          successes: sheet.overview.deathSaves.successes,
          failures: sheet.overview.deathSaves.failures
        },
        { successes: 1, failures: 0 }
      )
      const timeline = await readTimeline()
      assert.ok(timeline, 'The room must push the held Run timeline.')
    }
  )
  console.log('Native player journey passed.')

  /** Answers the dice the owner owes for the Wolf; leaves the player's own pendings alone. */
  async function answerOwnerDice(
    start: EncounterCommandResultDto,
    d20: number
  ): Promise<EncounterCommandResultDto> {
    let current = start
    for (let answers = 0; current.occurrence?.status === 'PENDING'; answers++) {
      assert.ok(answers < 10, 'The Wolf dice did not settle.')
      const { occurrence } = current
      const pending = occurrence.pending
      let resolution: Resolution
      if (pending?.kind === 'D20_EVIDENCE' && pending.rollerActorId === wolfId) {
        resolution = {
          kind: 'ENTER_DICE',
          requestId: pending.request.requestId,
          rawFaces: pending.request.rollMode === 'NORMAL' ? [d20] : [d20, d20],
          rollMode: pending.request.rollMode
        }
      } else if (pending?.kind === 'ACTION_OUTCOME_EVIDENCE' && pending.rollerActorId === wolfId) {
        resolution = {
          kind: 'ENTER_INTEGER',
          requestId: pending.request.requestId,
          value: pending.request.min
        }
      } else if (pending?.kind === 'AREA_SAVES') {
        // The caster's command result lists no one else's saves; the owner's view lists the Wolf's.
        await checkpoint()
        const { pending: ownerView } = await owner.query(api.encounters.activeReads.active, {
          campaignId
        })
        const save =
          ownerView?.kind === 'AREA_SAVES'
            ? ownerView.saves.find((entry) => entry.actorId === wolfId)
            : undefined
        if (!save) return current
        resolution = {
          kind: 'ENTER_DICE',
          requestId: save.request.requestId,
          rawFaces: save.request.rollMode === 'NORMAL' ? [d20] : [d20, d20],
          rollMode: save.request.rollMode
        }
      } else return current
      current = await execute({
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: current.projection.version,
        correlationId: null,
        occurrenceId: occurrence.occurrenceId,
        expectedOccurrenceVersion: occurrence.occurrenceVersion,
        resolution
      })
    }
    return current
  }
}
