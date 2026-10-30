import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import {
  type EncounterCommandResultDto,
  type EncounterExecuteInput,
  encounterGmProjectionDtoSchema
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

/**
 * A running Encounter on a live Scene for a one-player browser journey: the player's spell Character,
 * on its turn, and one creature, with dice typed and the owner's API standing in for everything else.
 */
export async function startPlayerEncounterJourney({
  name,
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
}: {
  /** Names the journey's records and failures. */
  name: string
  owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
  player: DevelopmentClient
  campaignId: string
  characterId: string
  playerUserId: string
  creatureSourceId: string
  /** The spell copies the Character may know, by source id. */
  spellSubjectIds: readonly string[]
  classId: string
  initiativePolicyDefinitionId: string
  initiativePolicyCatalogueId: string
  /** Publishes what the room holds to Convex: a running table saves only at save points (D90). */
  checkpoint: () => Promise<void>
}) {
  assert.notEqual(owner, player, `${name} verification requires independent clients.`)
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
    name: `${name} journey fixture`,
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE' as const, sourceId: creatureSourceId }]
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
    assert.ok(resolutions < 30, `${name} journey initiative did not settle.`)
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
      if (!entityId) throw new Error(`${name} journey has no initiative choice.`)
      resolution = { kind: 'INITIATIVE_ENTITY', requestId: pending.requestId, entityId }
    } else {
      throw new Error(`${name} journey requested an unexpected initiative continuation.`)
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
  const creature = run.actors.find(
    (actor) => actor.kind === 'CREATURE' && actor.sourceId === creatureSourceId
  )
  const hero = run.actors.find(
    (actor) => actor.kind === 'CHARACTER' && actor.sourceId === characterId
  )
  if (!creature || !hero) throw new Error(`${name} journey actors are absent from the Run.`)
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

  // The creature stands thirty feet from the Character.
  const heroPlacement = {
    id: hero.id,
    label: hero.label,
    x: 100,
    y: 100,
    controlledByUserIds: [playerUserId],
    tokenId: crypto.randomUUID()
  }
  const creaturePlacement = {
    id: creature.id,
    label: creature.label,
    x: 250,
    y: 100,
    controlledByUserIds: [],
    tokenId: crypto.randomUUID()
  }
  const sceneToken = (placement: typeof heroPlacement) => ({
    id: placement.tokenId,
    assetId: null,
    controlledByUserIds: placement.controlledByUserIds,
    height: 50,
    hidden: false as const,
    label: placement.label,
    locked: false as const,
    position: { x: placement.x, y: placement.y },
    rotationDegrees: 0,
    senses: [],
    vision: null,
    width: 50
  })
  const { createEncounterLifecycleScene } = await import('./developmentEncounterScenes')
  const { bindScene, bindToken } = await import('./developmentEncounterLifecycle')
  const sceneName = `${name} journey browser scene`
  const preparedScene = await createEncounterLifecycleScene({
    owner,
    campaignId,
    name: sceneName,
    options: {
      // A player sees only explored tokens (D87); these proofs do not check fog.
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
      tokens: [sceneToken(heroPlacement), sceneToken(creaturePlacement)]
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
  for (const { id: actorId, tokenId } of [heroPlacement, creaturePlacement]) {
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
    title: `${name} journey session`
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
  const readChoices = async (actorId: string) => {
    const projection = await readProjection()
    const choices = await owner.query(actionChoices, {
      encounterId: run.id,
      expectedVersion: projection.version,
      actorId
    })
    if (!choices) throw new Error('The actor has no action choices.')
    return choices
  }
  /** Stands in for every die of an action: each d20 shows `d20`, each damage roll its minimum. */
  const settle = async (start: EncounterCommandResultDto, d20: number) => {
    let current = start
    for (let answers = 0; current.occurrence?.status === 'PENDING'; answers++) {
      assert.ok(answers < 10, `The ${name} dice did not settle.`)
      const { occurrence } = current
      // The player's receipt hides a decision the GM answers, such as a creature's save.
      await checkpoint()
      const pending =
        occurrence.pending ??
        (await owner.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: run.id
        }))
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
        throw new Error(`${name} journey met an unexpected pending ${pending?.kind ?? 'none'}.`)
      current = await execute({
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: pending.encounterVersion,
        correlationId: null,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        resolution
      })
    }
    return current
  }

  return {
    encounterId: run.id,
    hero,
    creature,
    scene: { id: preparedScene.liveSceneId, name: sceneName },
    execute,
    readProjection,
    readChoices,
    settle
  }
}
