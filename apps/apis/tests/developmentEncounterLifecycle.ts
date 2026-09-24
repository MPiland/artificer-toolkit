import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  type EncounterCommandResultDto,
  type EncounterExecuteInput
} from '@artificer-toolkit/schema/api/encounters'
import type {
  BindEncounterToPresentedSceneInputDto,
  BindEncounterToPresentedSceneResultDto,
  EncounterActorTokenBindingCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../convex/_generated/api.js'
import type { DevelopmentClient } from './developmentClient'
import { createEncounterLifecycleScenes } from './developmentEncounterScenes'

export const bindScene = makeFunctionReference<
  'mutation',
  BindEncounterToPresentedSceneInputDto,
  BindEncounterToPresentedSceneResultDto
>('encounters/sceneBindings:bind')
export const bindToken = makeFunctionReference<
  'mutation',
  { input: EncounterActorTokenBindingCommandInputDto },
  EncounterCommandResultDto
>('encounters/actorTokenBindings:execute')

// This proof uses the same commands and assertions locally and with authenticated HTTP clients.
export async function verifyEncounterLifecycle({
  owner,
  player,
  anonymous,
  campaignId
}: {
  owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
  player: DevelopmentClient
  anonymous: DevelopmentClient
  campaignId: string
}) {
  const settings = await owner.query(api.campaigns.playSettings.get, { campaignId })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await owner.mutation(api.campaigns.playSettings.save, {
    ...fields,
    expectedVersion: version,
    automationMode: 'MANUAL',
    manualReminderMode: 'SUBTLE',
    initiativePolicyDefinitionId: null,
    initiativeTieDefinitionId: null
  })
  const session = await owner.mutation(api.campaigns.sessions.create, { campaignId })
  const blueprint = await owner.mutation(api.encounters.blueprints.create, {
    gameSystemId: srdSystemRecord.id,
    name: 'Encounter execution fixture',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CUSTOM', label: 'First practice opponent', maxHitPoints: 10 },
      { kind: 'CUSTOM', label: 'Second practice opponent', maxHitPoints: 12 }
    ]
  })
  const create = {
    campaignId,
    sessionId: session.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  }
  await assert.rejects(anonymous.mutation(api.encounters.runs.create, create), /Unauthenticated/)
  await assert.rejects(player.mutation(api.encounters.runs.create, create), /Campaign not found/)
  const prepared = encounterGmProjectionDtoSchema.parse(
    await owner.mutation(api.encounters.runs.create, create)
  )
  assert.equal(prepared.status, 'PREPARED')
  assert.equal(prepared.version, 0)
  assert.equal(prepared.sessionId, session.id)
  assert.equal(prepared.blueprintChecksum, blueprint.setupChecksum)
  assert.equal(prepared.blueprintVersion, blueprint.version)
  assert.equal(prepared.automationMode, 'MANUAL')
  assert.equal(prepared.manualReminderMode, 'SUBTLE')
  assert.equal(prepared.actors.length, 2)
  assert.deepEqual(prepared.actors.map((actor) => [actor.label, actor.currentHitPoints]).sort(), [
    ['First practice opponent', 10],
    ['Second practice opponent', 12]
  ])
  const sameCreate = {
    campaignId: campaignId.toUpperCase(),
    sessionId: session.id.toUpperCase(),
    blueprintId: blueprint.id.toUpperCase(),
    commandId: create.commandId.toUpperCase()
  }
  assert.deepEqual(await owner.mutation(api.encounters.runs.create, sameCreate), prepared)
  const revisedBlueprint = await owner.mutation(api.encounters.blueprints.update, {
    blueprintId: blueprint.id,
    expectedVersion: blueprint.version,
    name: 'Edited after Run creation',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Replacement opponent', maxHitPoints: 99 }]
  })
  assert.deepEqual(await owner.mutation(api.encounters.runs.create, sameCreate), prepared)
  await assert.rejects(
    owner.mutation(api.encounters.runs.create, { ...create, blueprintId: crypto.randomUUID() }),
    /different input/
  )
  let projection = prepared
  const receipts: Array<{
    command: EncounterExecuteInput['command']
    result: EncounterCommandResultDto
  }> = []
  const commandBase = () => ({
    encounterId: prepared.id,
    commandId: crypto.randomUUID(),
    expectedVersion: projection.version
  })
  async function execute(command: EncounterExecuteInput['command']) {
    const result = encounterCommandResultDtoSchema.parse(
      await owner.mutation(api.encounters.commands.execute, { command })
    )
    projection = encounterGmProjectionDtoSchema.parse(result.projection)
    assert.equal(projection.version, command.expectedVersion + 1)
    assert.equal(projection.id, prepared.id)
    receipts.push({ command, result })
    return result
  }
  const actors = [...prepared.actors].sort((a, b) => b.id.localeCompare(a.id))
  const first = actors[0]!
  const second = actors[1]!
  for (const [index, actor] of actors.entries()) {
    await execute({
      ...commandBase(),
      type: 'SET_INITIATIVE',
      actorId: actor.id,
      initiative: 10 + index,
      manualOrder: index
    })
  }
  for (const order of [1, 0]) {
    await execute({
      ...commandBase(),
      type: 'UPSERT_REMINDER',
      reminder: {
        id: crypto.randomUUID(),
        label: `Round reminder ${order}`,
        timing: 'ROUND_START',
        round: null,
        actorId: null,
        public: false,
        notes: null,
        order
      }
    })
  }
  const reminders = projection.reminders
  assert.deepEqual(
    reminders.map((reminder) => reminder.order),
    [0, 1]
  )
  const start = { ...commandBase(), type: 'START' as const }
  await assert.rejects(
    player.mutation(api.encounters.commands.execute, { command: start }),
    /Campaign not found/
  )
  await assert.rejects(
    anonymous.mutation(api.encounters.commands.execute, { command: start }),
    /Unauthenticated/
  )
  await execute(start)
  assert.equal(projection.status, 'ACTIVE')
  assert.equal(projection.round, 1)
  assert.equal(projection.currentActorId, first.id)
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.active, { campaignId }),
    projection
  )
  await execute({ ...commandBase(), type: 'ADVANCE_TURN' })
  assert.equal(projection.currentActorId, second.id)
  await execute({ ...commandBase(), type: 'ADVANCE_TURN' })
  assert.equal(projection.round, 2)
  assert.equal(projection.currentActorId, first.id)
  await execute({ ...commandBase(), type: 'PREVIOUS_TURN' })
  assert.equal(projection.round, 1)
  assert.equal(projection.currentActorId, second.id)
  const actorsBeforeRoundCorrection = projection.actors
  await execute({ ...commandBase(), type: 'SET_ROUND', round: 2 })
  assert.equal(projection.round, 2)
  assert.equal(projection.currentActorId, second.id)
  assert.deepEqual(projection.actors, actorsBeforeRoundCorrection)
  await execute({ ...commandBase(), type: 'SET_CURRENT_ACTOR', actorId: null })
  const noCursor = projection
  await assert.rejects(
    owner.mutation(api.encounters.commands.execute, {
      command: { ...commandBase(), type: 'ADVANCE_TURN' }
    }),
    /current actor can advance/
  )
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, { encounterId: prepared.id }),
    noCursor
  )
  await execute({ ...commandBase(), type: 'SET_CURRENT_ACTOR', actorId: second.id })
  await execute({ ...commandBase(), type: 'ADVANCE_TURN' })
  assert.equal(projection.round, 3)
  assert.equal(projection.currentActorId, first.id)
  assert.deepEqual(projection.reminders, reminders)

  const { assetId, scenes } = await createEncounterLifecycleScenes({ owner, campaignId })
  async function captureScenes() {
    const definitions = []
    for (const scene of scenes) {
      const header = await owner.query(api.scenes.definitionReads.get, {
        campaignId,
        sceneId: scene.sceneId
      })
      const entities = await owner.query(api.scenes.definitionReads.entities, {
        campaignId,
        sceneId: scene.sceneId,
        saveId: header.saveId,
        collection: 'tokens',
        paginationOpts: { cursor: null, numItems: 8 }
      })
      assert.equal(entities.isDone, true)
      assert.equal(entities.page.length, 2)
      definitions.push({ header, entities: entities.page })
    }
    return definitions
  }
  const originalScenes = await captureScenes()
  const bindingInput: BindEncounterToPresentedSceneInputDto = {
    type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
    commandId: crypto.randomUUID(),
    encounterId: prepared.id
  }
  await assert.rejects(owner.mutation(bindScene, bindingInput), /not presenting/)
  await owner.mutation(api.scenes.presentations.set, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    sessionId: session.id,
    sceneId: scenes[0].liveSceneId,
    expectedPresentationVersion: null
  })
  await assert.rejects(player.mutation(bindScene, bindingInput), /Campaign not found/)
  await assert.rejects(anonymous.mutation(bindScene, bindingInput), /Unauthenticated/)
  const bound = await owner.mutation(bindScene, bindingInput)
  assert.equal(bound.sceneId, scenes[0].liveSceneId)
  assert.equal(bound.replayed, false)
  await owner.mutation(api.scenes.presentations.set, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    sessionId: session.id,
    sceneId: scenes[1].liveSceneId,
    expectedPresentationVersion: 0
  })
  const presentation = await owner.query(api.scenes.presentations.get, {
    campaignId,
    sessionId: session.id
  })
  assert.equal(presentation?.sceneId, scenes[1].liveSceneId)
  assert.deepEqual(await owner.mutation(bindScene, bindingInput), { ...bound, replayed: true })
  await assert.rejects(
    owner.mutation(bindScene, { ...bindingInput, commandId: crypto.randomUUID() }),
    /different.*binding/
  )
  const tokenInput: EncounterActorTokenBindingCommandInputDto = {
    type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
    commandId: crypto.randomUUID(),
    encounterId: prepared.id,
    actorId: first.id,
    sceneId: scenes[0].liveSceneId,
    tokenId: scenes[0].tokenIds[0],
    expectedEncounterVersion: projection.version
  }
  await assert.rejects(player.mutation(bindToken, { input: tokenInput }), /Campaign not found/)
  await assert.rejects(anonymous.mutation(bindToken, { input: tokenInput }), /Unauthenticated/)
  const tokenResult = await owner.mutation(bindToken, { input: tokenInput })
  projection = encounterGmProjectionDtoSchema.parse(tokenResult.projection)
  assert.equal(projection.version, tokenInput.expectedEncounterVersion + 1)
  await assert.rejects(
    owner.mutation(bindToken, {
      input: {
        ...tokenInput,
        commandId: crypto.randomUUID(),
        actorId: second.id,
        expectedEncounterVersion: projection.version
      }
    }),
    /already bound/
  )
  await assert.rejects(
    owner.mutation(bindToken, {
      input: {
        ...tokenInput,
        commandId: crypto.randomUUID(),
        sceneId: scenes[1].liveSceneId,
        expectedEncounterVersion: projection.version
      }
    }),
    /binding was not found/
  )
  await assert.rejects(
    owner.mutation(bindToken, { input: { ...tokenInput, commandId: crypto.randomUUID() } }),
    /changed/
  )
  const replaced = await owner.mutation(bindToken, {
    input: {
      ...tokenInput,
      commandId: crypto.randomUUID(),
      tokenId: scenes[0].tokenIds[1],
      expectedEncounterVersion: projection.version
    }
  })
  projection = encounterGmProjectionDtoSchema.parse(replaced.projection)
  const removed = await owner.mutation(bindToken, {
    input: {
      type: 'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
      commandId: crypto.randomUUID(),
      encounterId: prepared.id,
      actorId: first.id,
      sceneId: scenes[0].liveSceneId,
      expectedEncounterVersion: projection.version
    }
  })
  projection = encounterGmProjectionDtoSchema.parse(removed.projection)
  assert.deepEqual(await owner.mutation(bindToken, { input: tokenInput }), tokenResult)
  await execute({ ...commandBase(), type: 'COMPLETE' })
  assert.equal(projection.status, 'COMPLETED')
  assert.deepEqual(projection.reminders, reminders)
  assert.equal(await owner.query(api.encounters.projectionReads.active, { campaignId }), null)
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, { encounterId: prepared.id }),
    projection
  )
  assert.deepEqual(await owner.mutation(api.encounters.runs.create, sameCreate), projection)
  const timeline = await owner.query(api.encounters.timelineReads.timeline, {
    encounterId: prepared.id,
    limit: 100
  })
  for (const receipt of receipts) {
    assert.deepEqual(
      await owner.mutation(api.encounters.commands.execute, { command: receipt.command }),
      receipt.result
    )
  }
  assert.deepEqual(await owner.mutation(bindToken, { input: tokenInput }), tokenResult)
  await assert.rejects(
    owner.mutation(api.encounters.commands.execute, {
      command: { ...start, expectedVersion: projection.version }
    }),
    /different input/
  )
  await assert.rejects(
    owner.mutation(api.encounters.commands.execute, {
      command: { ...commandBase(), type: 'ADVANCE_TURN' }
    }),
    /Completed/
  )
  assert.deepEqual(
    await owner.query(api.encounters.timelineReads.timeline, {
      encounterId: prepared.id,
      limit: 100
    }),
    timeline
  )
  assert.deepEqual(await captureScenes(), originalScenes)
  assert.deepEqual(
    await owner.query(api.scenes.presentations.get, { campaignId, sessionId: session.id }),
    presentation
  )
  assert.deepEqual(
    await owner.query(api.campaigns.sessions.get, {
      campaignId,
      sessionNumber: session.sessionNumber
    }),
    session
  )
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, { encounterId: prepared.id }),
    projection
  )
  console.log(
    JSON.stringify({
      proof: 'V08 shared Manual lifecycle and Scene binding',
      campaignId,
      encounterId: prepared.id,
      commandReceipts: receipts.length,
      status: 'PASS'
    })
  )
  return { session, blueprint: revisedBlueprint, assetId, scenes, manualRun: projection }
}
