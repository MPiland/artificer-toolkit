import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import {
  type EncounterCommandResultDto,
  type EncounterExecuteInput,
  encounterGmProjectionDtoSchema,
  type ResolveEncounterActionInputDto
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
  assert.notEqual(owner, player, 'Heat Metal verification requires independent clients.')
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
    { type: 'SET_PREPARED_SPELLS' as const, classId, spellIds: [...spellSubjectIds] }
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
    name: 'Heat Metal journey fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE' as const, sourceId: ogreSourceId }]
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
    assert.ok(resolutions < 30, 'Heat Metal journey initiative did not settle.')
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
      if (!entityId) throw new Error('Heat Metal journey has no initiative choice.')
      resolution = { kind: 'INITIATIVE_ENTITY', requestId: pending.requestId, entityId }
    } else {
      throw new Error('Heat Metal journey requested an unexpected initiative continuation.')
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
  const ogre = run.actors.find(
    (actor) => actor.kind === 'CREATURE' && actor.sourceId === ogreSourceId
  )
  const hero = run.actors.find(
    (actor) => actor.kind === 'CHARACTER' && actor.sourceId === characterId
  )
  if (!ogre || !hero) throw new Error('Heat Metal journey actors are absent from the Run.')
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

  // The Ogre stands within Heat Metal's 60 feet of the Character.
  const heroPlacement = {
    id: hero.id,
    label: hero.label,
    x: 100,
    y: 100,
    controlledByUserIds: [playerUserId],
    tokenId: crypto.randomUUID()
  }
  const ogrePlacement = {
    id: ogre.id,
    label: ogre.label,
    x: 250,
    y: 100,
    controlledByUserIds: [],
    tokenId: crypto.randomUUID()
  }
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
  const name = 'Heat Metal journey browser scene'
  const preparedScene = await createEncounterLifecycleScene({
    owner,
    campaignId,
    name,
    options: {
      // A player sees only explored tokens (D87); this proof checks the repeat row, not fog.
      fogMode: 'OFF',
      map: { width: 600, height: 300 },
      grid: {
        kind: 'SQUARE',
        origin: { x: 0, y: 0 },
        cellSize: 50,
        distancePerCell: 5,
        diagonalPolicy: 'EQUAL',
        unit: 'FEET'
      },
      tokens: [sceneToken(heroPlacement), sceneToken(ogrePlacement)]
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
  for (const { id: actorId, tokenId } of [heroPlacement, ogrePlacement]) {
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
  await owner.mutation(api.campaigns.sessions.create, {
    campaignId,
    title: 'Heat Metal journey session'
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
  const readOffers = async () => {
    const projection = await readProjection()
    const choices = await owner.query(actionChoices, {
      encounterId: run.id,
      expectedVersion: projection.version,
      actorId: hero.id
    })
    if (!choices) throw new Error('The Character has no action choices.')
    return choices.effectOffers
  }
  /** Stands in for every die of an action: each save shows `d20`, each damage roll its minimum. */
  const settle = async (start: EncounterCommandResultDto, d20: number) => {
    let current = start
    for (let answers = 0; current.occurrence?.status === 'PENDING'; answers++) {
      assert.ok(answers < 10, 'The Heat Metal dice did not settle.')
      const { occurrence } = current
      const pending = occurrence.pending
      let resolution: Resolution
      if (pending?.kind === 'D20_EVIDENCE') {
        resolution = {
          kind: 'ENTER_DICE',
          requestId: pending.request.requestId,
          rawFaces: pending.request.rollMode === 'NORMAL' ? [d20] : [d20, d20],
          rollMode: pending.request.rollMode
        }
      } else if (pending?.kind === 'ACTION_OUTCOME_EVIDENCE') {
        resolution = {
          kind: 'ENTER_INTEGER',
          requestId: pending.request.requestId,
          value: pending.request.min
        }
      } else
        throw new Error(`Heat Metal journey met an unexpected pending ${pending?.kind ?? 'none'}.`)
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

  await browser(
    {
      scene: { id: preparedScene.liveSceneId, name },
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
      assert.deepEqual(cast.command.target, { kind: 'ACTOR', actorId: ogre.id })
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
        encounterId: run.id,
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
      assert.deepEqual(repeat.command.target, { kind: 'ACTOR', actorId: ogre.id })
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
