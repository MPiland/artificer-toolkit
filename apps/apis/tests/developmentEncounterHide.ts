import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import {
  type EncounterCommandResultDto,
  type EncounterExecuteInput,
  type SetConcealmentObserversInputDto,
  encounterGmProjectionDtoSchema,
  encounterPlayerProjectionDtoSchema,
  resolveEncounterActionInputDtoSchema
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

export type EncounterHideBrowserFixture = {
  scene: { id: string; name: string }
  hiderLabel: string
  /** The creatures the Hide hid the creature from, by the label their rows carry. */
  hiddenFromLabels: string[]
  /** The creature the GM stops hiding the hider from. */
  revealLabel: string
}

export type EncounterHideBrowserControls = {
  /** The GM opens the hidden creature in the turn order and sees who it is hidden from (D116). */
  assertGmObservers: (input: { hidden: string[]; noticed: string[] }) => Promise<void>
  revealTo: (label: string) => Promise<{
    command: SetConcealmentObserversInputDto
    result: EncounterCommandResultDto
  }>
  /** The player's turn order shows no observer list, and the room's frames to the player carry none. */
  assertPlayerSeesNoObservers: (input: {
    commandId: string
    observerActorIds: string[]
    effectId: string
  }) => Promise<void>
}

export type EncounterHideBrowserRunner = (
  fixture: EncounterHideBrowserFixture,
  verify: (controls: EncounterHideBrowserControls) => Promise<void>
) => Promise<void>

/**
 * Hides a Wolf from the creatures around it, then has the GM stop hiding it from one through the
 * browser (D116): the GM's turn order lists who it is hidden from and the player's never does.
 */
export async function verifyEncounterHide({
  owner,
  player,
  campaignId,
  characterId,
  hiderId,
  watcherIds,
  initiativePolicyDefinitionId,
  initiativePolicyCatalogueId,
  checkpoint,
  browser
}: {
  owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
  player: DevelopmentClient
  campaignId: string
  characterId: string
  hiderId: string
  watcherIds: readonly [string, string]
  initiativePolicyDefinitionId: string
  initiativePolicyCatalogueId: string
  /** Publishes what the room holds to Convex: a running table saves only at save points (D90). */
  checkpoint: () => Promise<void>
  browser: EncounterHideBrowserRunner
}) {
  assert.notEqual(owner, player, 'Hide verification requires independent clients.')
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
  // With auto-roll off, the Hide's Stealth check prompts for the d20.
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
    name: 'Hide fixture',
    commandId: crypto.randomUUID(),
    enemies: [hiderId, ...watcherIds].map((sourceId) => ({
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
    assert.ok(resolutions < 30, 'Hide initiative did not settle.')
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
      if (!entityId) throw new Error('Hide fixture has no initiative choice.')
      resolution = { kind: 'INITIATIVE_ENTITY', requestId: pending.requestId, entityId }
    } else {
      throw new Error('Hide fixture requested an unexpected initiative continuation.')
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
    if (!actor) throw new Error('Hide fixture creature is absent from the Run.')
    return actor
  }
  const hider = creatureActor(hiderId)
  const watchers = watcherIds.map(creatureActor)
  const hero = run.actors.find(
    (actor) => actor.kind === 'CHARACTER' && actor.sourceId === characterId
  )
  if (!hero) throw new Error('Hide fixture Character is absent from the Run.')
  const execute = async (command: EncounterExecuteInput['command']) =>
    owner.mutation(executeEncounterCommand, { command })
  // A creature is hidden only from those that are not its allies: the watchers side with the party.
  for (const watcher of watchers)
    run = encounterGmProjectionDtoSchema.parse(
      (
        await execute({
          type: 'UPDATE_ACTOR',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: run.version,
          actorId: watcher.id,
          disposition: 'FRIENDLY'
        })
      ).projection
    )
  if (run.currentActorId !== hider.id)
    run = encounterGmProjectionDtoSchema.parse(
      (
        await execute({
          type: 'SET_CURRENT_ACTOR',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: run.version,
          actorId: hider.id
        })
      ).projection
    )

  const { createEncounterLifecycleScene } = await import('./developmentEncounterScenes')
  const name = 'Hide browser scene'
  // The tabletop opens on the live Scene; the hide is an Encounter matter, so no token is bound.
  const preparedScene = await createEncounterLifecycleScene({
    owner,
    campaignId,
    name,
    options: {
      fogMode: 'OFF',
      map: { width: 400, height: 200 },
      grid: {
        kind: 'SQUARE',
        origin: { x: 0, y: 0 },
        cellSize: 50,
        distancePerCell: 5,
        diagonalPolicy: 'EQUAL',
        unit: 'FEET'
      },
      tokens: []
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

  // The GM hides the Wolf, rolling a natural 20 on its Stealth check as physical dice.
  const choices = await owner.query(actionChoices, {
    encounterId: run.id,
    expectedVersion: run.version,
    actorId: hider.id
  })
  const hide = choices?.actions.find((action) => action.label === 'Hide')
  if (!hide) throw new Error('The Wolf has no Hide action choice.')
  const { gmRollVisibility } = await owner.query(api.account.rollPreferences, {})
  const hiding = await execute(
    resolveEncounterActionInputDtoSchema.parse({
      type: 'RESOLVE_ACTION',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: run.version,
      actorId: hider.id,
      target: { kind: 'ACTOR', actorId: hider.id },
      actionId: hide.id,
      sceneContext: null,
      visibility: gmRollVisibility,
      acknowledgedWarnings: [],
      acceptedWieldConflict: null,
      optionalCombatIntent: null
    })
  )
  const pendingCheck = hiding.occurrence?.pending
  assert.equal(pendingCheck?.kind, 'D20_EVIDENCE', 'The Hide asks for the Stealth d20.')
  if (pendingCheck?.kind !== 'D20_EVIDENCE' || !hiding.occurrence)
    throw new Error('The Hide asks for the Stealth d20.')
  const hidden = await execute({
    type: 'RESOLVE_RULE_OCCURRENCE',
    encounterId: run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: hiding.projection.version,
    correlationId: null,
    occurrenceId: hiding.occurrence.occurrenceId,
    expectedOccurrenceVersion: hiding.occurrence.occurrenceVersion,
    resolution: {
      kind: 'ENTER_DICE',
      requestId: pendingCheck.request.requestId,
      rawFaces: pendingCheck.request.rollMode === 'NORMAL' ? [20] : [20, 20],
      rollMode: pendingCheck.request.rollMode
    }
  })
  assert.equal(hidden.occurrence?.status, 'COMPLETE')
  run = encounterGmProjectionDtoSchema.parse(hidden.projection)
  const concealment = run.actors.find((actor) => actor.id === hider.id)?.concealment
  assert.ok(concealment, 'The settled Hide gives the GM a concealment.')
  const labelOf = (actorId: string) => {
    const actor = run.actors.find((entry) => entry.id === actorId)
    if (!actor) throw new Error('Hide fixture actor is absent from the Run.')
    return actor.label
  }
  // A natural 20 beats every passive Perception the party has, so the hider is hidden from all of it.
  assert.deepEqual(
    concealment.observerActorIds.slice().sort(),
    [...watchers.map(({ id }) => id), hero.id].sort()
  )
  const reveal = watchers[0]
  await checkpoint()

  await browser(
    {
      scene: { id: preparedScene.liveSceneId, name },
      hiderLabel: hider.label,
      hiddenFromLabels: concealment.observerActorIds.map(labelOf),
      revealLabel: reveal.label
    },
    async (controls) => {
      // 1. The GM's turn order lists who the hider is hidden from.
      await controls.assertGmObservers({
        hidden: concealment.observerActorIds.map(labelOf),
        noticed: []
      })

      // 2. The GM stops hiding the hider from one watcher.
      const revealed = await controls.revealTo(reveal.label)
      assert.equal(revealed.command.type, 'SET_CONCEALMENT_OBSERVERS')
      assert.equal(revealed.command.activeEffectId, concealment.effectId)
      assert.deepEqual(revealed.command.remove, [reveal.id])
      assert.deepEqual(revealed.command.add, [])
      const expectedObservers = concealment.observerActorIds.filter((id) => id !== reveal.id).sort()
      const committed = encounterGmProjectionDtoSchema.parse(revealed.result.projection)
      assert.deepEqual(
        committed.actors.find((actor) => actor.id === hider.id)?.concealment?.observerActorIds,
        expectedObservers
      )
      await controls.assertGmObservers({
        hidden: expectedObservers.map(labelOf),
        noticed: [reveal.label]
      })

      // 3. The GM's stored projection holds the edit; the player's holds no concealment at all.
      await checkpoint()
      const [gmRun, playerRun] = await Promise.all([
        owner.query(api.encounters.projectionReads.get, { encounterId: run.id }),
        player.query(api.encounters.projectionReads.get, { encounterId: run.id })
      ])
      assert.deepEqual(
        encounterGmProjectionDtoSchema.parse(gmRun).actors.find((actor) => actor.id === hider.id)
          ?.concealment?.observerActorIds,
        expectedObservers
      )
      const projection = encounterPlayerProjectionDtoSchema.parse(playerRun)
      assert.deepEqual(projection, playerRun)
      const serialized = JSON.stringify(playerRun)
      for (const secret of ['concealment', 'observerActorIds', concealment.effectId])
        assert.ok(!serialized.includes(secret), `The player projection carries ${secret}.`)

      // 4. The player's table updates for the edit and shows nothing of who the hider is hidden from.
      await controls.assertPlayerSeesNoObservers({
        commandId: revealed.command.commandId,
        observerActorIds: concealment.observerActorIds,
        effectId: concealment.effectId
      })
    }
  )
  console.log('Native Hide observer editor journey passed.')
}
