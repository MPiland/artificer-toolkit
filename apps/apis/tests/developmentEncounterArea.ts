import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import {
  type EncounterCommandResultDto,
  type EncounterExecuteInput,
  type EncounterTimelineDto,
  encounterGmProjectionDtoSchema,
  type RemoveAreaTargetInputDto,
  type ResolveEncounterActionInputDto,
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

export type EncounterAreaBrowserFixture = {
  scene: { id: string; name: string }
  sessionNumber: number
  actionLabel: string
  /** The creatures the area catches from the picked point, by the label their tokens carry. */
  caughtLabels: { ally: string; enemy: string; hero: string }
  /** Creatures the area must not catch. */
  outsideLabels: string[]
}

export type EncounterAreaBrowserControls = {
  /** Picks the origin on the map (and proves Escape cancels aiming), then resolves the action. */
  startArea: () => Promise<{
    command: ResolveEncounterActionInputDto
    result: EncounterCommandResultDto
  }>
  assertGmSaves: (caught: string[]) => Promise<void>
  removeFromArea: (
    label: string
  ) => Promise<{ command: RemoveAreaTargetInputDto; result: EncounterCommandResultDto }>
  assertPlayerSaves: (ownLabel: string, others: string[]) => Promise<void>
  answerSave: (
    by: 'OWNER' | 'PLAYER',
    label: string,
    face: number
  ) => Promise<{ command: ResolveRuleOccurrenceInputDto; result: EncounterCommandResultDto }>
  assertHistory: (entry: { issuerLines: string[]; gmLines: string[] }) => Promise<void>
}

export type EncounterAreaBrowserRunner = (
  fixture: EncounterAreaBrowserFixture,
  verify: (controls: EncounterAreaBrowserControls) => Promise<void>
) => Promise<void>

type PlacedCreature = { id: string; label: string; x: number; y: number }

/**
 * Plays one Fireball from a point through the browser: a GM-controlled caster, a GM ally, a GM enemy
 * and the player's Character inside a 20-foot sphere, and a far Wolf and the caster outside it.
 */
export async function verifyEncounterArea({
  owner,
  player,
  campaignId,
  characterId,
  playerUserId,
  casterId,
  allyId,
  enemyId,
  farId,
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
  casterId: string
  allyId: string
  enemyId: string
  farId: string
  initiativePolicyDefinitionId: string
  initiativePolicyCatalogueId: string
  /** Publishes what the room holds to Convex: a running table saves only at save points (D90). */
  checkpoint: () => Promise<void>
  readTimeline: () => Promise<EncounterTimelineDto | null>
  browser: EncounterAreaBrowserRunner
}) {
  assert.notEqual(owner, player, 'Area verification requires independent clients.')
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
  // Each save follows its roller's auto-roll preference; with it off, Assisted prompts for d20s.
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
  const blueprint = await owner.mutation(api.encounters.blueprints.create, {
    gameSystemId: campaign.gameSystemId,
    name: 'Area from a point fixture',
    commandId: crypto.randomUUID(),
    enemies: [casterId, allyId, enemyId, farId].map((sourceId) => ({
      kind: 'CREATURE' as const,
      sourceId
    }))
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
    assert.ok(resolutions < 30, 'Area initiative did not settle.')
    const pending = started.occurrence.pending
    let resolution: Extract<
      EncounterExecuteInput['command'],
      { type: 'RESOLVE_RULE_OCCURRENCE' }
    >['resolution']
    if (pending?.kind === 'INITIATIVE_EVIDENCE') {
      resolution = {
        kind: 'ENTER_INTEGER',
        requestId: pending.request.requestId,
        value: pending.request.max
      }
    } else if (pending?.kind === 'INITIATIVE_ORDER') {
      const entityId = pending.optionIds[0]
      if (!entityId) throw new Error('Area fixture has no initiative choice.')
      resolution = { kind: 'INITIATIVE_ENTITY', requestId: pending.requestId, entityId }
    } else {
      throw new Error('Area fixture requested an unexpected initiative continuation.')
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
  const creatureActor = (sourceId: string) => {
    const actor = run.actors.find(
      (entry) => entry.kind === 'CREATURE' && entry.sourceId === sourceId
    )
    if (!actor) throw new Error('Area fixture creature is absent from the Run.')
    return actor
  }
  const caster = creatureActor(casterId)
  const ally = creatureActor(allyId)
  const enemy = creatureActor(enemyId)
  const far = creatureActor(farId)
  const hero = run.actors.find(
    (actor) => actor.kind === 'CHARACTER' && actor.sourceId === characterId
  )
  if (!hero) throw new Error('Area fixture Character is absent from the Run.')
  if (run.currentActorId !== caster.id)
    run = encounterGmProjectionDtoSchema.parse(
      (
        await owner.mutation(executeEncounterCommand, {
          command: {
            type: 'SET_CURRENT_ACTOR',
            encounterId: run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: run.version,
            actorId: caster.id
          }
        })
      ).projection
    )

  // 1 px is 0.1 ft, so the 20-foot sphere picked at (600, 300) catches the three creatures around it.
  const placed: PlacedCreature[] = [
    { id: caster.id, label: caster.label, x: 100, y: 100 },
    { id: ally.id, label: ally.label, x: 550, y: 300 },
    { id: enemy.id, label: enemy.label, x: 650, y: 300 },
    { id: hero.id, label: hero.label, x: 600, y: 380 },
    { id: far.id, label: far.label, x: 1100, y: 500 }
  ]
  const tokens = placed.map((creature) => ({ ...creature, tokenId: crypto.randomUUID() }))
  const { createEncounterLifecycleScene } = await import('./developmentEncounterScenes')
  const { bindScene, bindToken } = await import('./developmentEncounterLifecycle')
  const name = 'Area from a point browser scene'
  const token = (index: number) => {
    const entry = tokens[index]
    if (!entry) throw new Error('Area fixture token is missing.')
    return {
      id: entry.tokenId,
      assetId: null,
      controlledByUserIds: entry.id === hero.id ? [playerUserId] : [],
      height: 50,
      hidden: false,
      label: entry.label,
      locked: false,
      position: { x: entry.x, y: entry.y },
      rotationDegrees: 0,
      vision: null,
      width: 50
    }
  }
  const preparedScene = await createEncounterLifecycleScene({
    owner,
    campaignId,
    name,
    options: {
      // A player sees only explored tokens (D87); this proof checks the area, not fog.
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
      tokens: [token(0), token(1), token(2), token(3), token(4)]
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
  for (const { id: actorId, tokenId } of tokens) {
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
    title: 'Area from a point session'
  })
  const before = run
  const choices = await owner.query(actionChoices, {
    encounterId: run.id,
    expectedVersion: run.version,
    actorId: caster.id
  })
  const choice = choices?.actions.find((action) => action.label.startsWith('Acid Breath'))
  if (!choice) throw new Error('The area caster has no Acid Breath action choice.')
  await checkpoint()

  const hitPoints = (projection: typeof run, actorId: string) => {
    const actor = projection.actors.find((entry) => entry.id === actorId)
    if (!actor) throw new Error('Area fixture actor is absent from the Run.')
    return actor.currentHitPoints
  }
  const pendingArea = (result: EncounterCommandResultDto) => {
    const pending = result.occurrence?.pending
    if (result.occurrence?.status !== 'PENDING' || pending?.kind !== 'AREA_SAVES')
      throw new Error('Expected the area saves to be pending.')
    return pending
  }
  const saveLabels = (result: EncounterCommandResultDto) =>
    pendingArea(result)
      .saves.map((save) => placed.find((entry) => entry.id === save.actorId)?.label)
      .sort()

  await browser(
    {
      scene: { id: preparedScene.liveSceneId, name },
      sessionNumber: session.sessionNumber,
      actionLabel: choice.sourceLabel ? `${choice.label} · ${choice.sourceLabel}` : choice.label,
      caughtLabels: { ally: ally.label, enemy: enemy.label, hero: hero.label },
      outsideLabels: [caster.label, far.label]
    },
    async (controls) => {
      // 1. The GM aims at a point on the map and resolves; the area catches the three creatures in it.
      const issued = await controls.startArea()
      assert.equal(issued.command.target.kind, 'POINT')
      assert.equal(issued.command.actorId, caster.id)
      assert.equal(issued.command.actionId, choice.id)
      const opened = pendingArea(issued.result)
      assert.deepEqual(opened.caught.slice().sort(), [ally.label, enemy.label, hero.label].sort())
      assert.deepEqual(saveLabels(issued.result), [ally.label, enemy.label, hero.label].sort())
      await controls.assertGmSaves(opened.caught)

      // 2. The GM removes the ally before it rolls.
      const removed = await controls.removeFromArea(ally.label)
      assert.equal(removed.command.actorId, ally.id)
      assert.deepEqual(
        pendingArea(removed.result).caught.slice().sort(),
        [enemy.label, hero.label].sort()
      )
      assert.deepEqual(saveLabels(removed.result), [enemy.label, hero.label].sort())

      // 3. The player sees only their Character's save, then answers it.
      await controls.assertPlayerSaves(hero.label, [
        ally.label,
        enemy.label,
        far.label,
        caster.label
      ])
      const heroSave = await controls.answerSave('PLAYER', hero.label, 20)
      // The player's receipt is their own view: nothing of the enemy's save. The GM's drawer shows the rest.
      assert.equal(heroSave.result.occurrence?.status, 'PENDING')

      // 4. The GM answers the last save; the area commits once.
      const enemySave = await controls.answerSave('OWNER', enemy.label, 1)
      assert.equal(enemySave.result.occurrence?.status, 'COMPLETE')
      await checkpoint()
      const after = encounterGmProjectionDtoSchema.parse(
        await owner.query(api.encounters.projectionReads.get, { encounterId: run.id })
      )
      assert.ok(
        hitPoints(after, enemy.id) < hitPoints(before, enemy.id),
        'The enemy failed its save and takes damage.'
      )
      assert.ok(
        hitPoints(after, hero.id) < hitPoints(before, hero.id),
        'The Character took half damage on its success.'
      )
      for (const untouched of [ally.id, far.id, caster.id])
        assert.equal(hitPoints(after, untouched), hitPoints(before, untouched))

      // 5. The GM's history records the area with issuer lines and the GM-only removal line.
      const timeline = await readTimeline()
      assert.ok(timeline, 'The room must push the held Run timeline.')
      const entries = timeline.entries.filter((entry) => entry.commandType === 'RESOLVE_ACTION')
      assert.equal(entries.length, 1)
      const [entry] = entries
      assert.ok(entry)
      assert.ok(entry.gmLines.some((line) => line.includes(ally.label)))
      assert.ok(entry.issuerLines.some((line) => line.includes(enemy.label)))
      await controls.assertHistory({ issuerLines: entry.issuerLines, gmLines: entry.gmLines })
    }
  )
  console.log('Native area from a point journey passed.')
}
