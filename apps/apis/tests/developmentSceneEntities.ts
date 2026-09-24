import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import type {
  SceneGeometryExecuteInput,
  SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type {
  SceneRecipientPage,
  SceneRecipientPageInput
} from '@artificer-toolkit/schema/api/sceneRecipient'
import type {
  SceneLiveCommandInputDto,
  SceneCommandResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  canLightPassBetween,
  canMoveBetween,
  measureSceneDistance,
  resolveSceneCombatPerceptionEnvironment
} from '@artificer-toolkit/shared/vtt'
import { api } from '../convex/_generated/api'
import type { DevelopmentClient } from './developmentClient'
import type { verifyEncounterLifecycle } from './developmentEncounterLifecycle'

const geometry = makeFunctionReference<
  'action',
  SceneGeometryExecuteInput,
  SceneGeometryCommandResult
>('scenes/geometryActions:execute')
const execute = makeFunctionReference<
  'mutation',
  { input: SceneLiveCommandInputDto },
  SceneCommandResultDto
>('scenes/commands:execute')
const recipient = makeFunctionReference<'action', SceneRecipientPageInput, SceneRecipientPage>(
  'scenes/recipientActions:entities'
)
const rollback = makeFunctionReference<
  'action',
  { sceneId: string; expectedVersion: number },
  { rolledBack: true }
>('scenes/developmentProof:verifyRollback')

export async function verifySceneEntities({
  owner,
  player,
  anonymous,
  playerUserId,
  campaignId,
  fixture
}: {
  owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
  player: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
  anonymous: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
  playerUserId: string
  campaignId: string
  fixture: Awaited<ReturnType<typeof verifyEncounterLifecycle>>
}) {
  const sceneId = fixture.scenes[0].liveSceneId
  const preservedInput = { campaignId, sceneId: fixture.scenes[0].sceneId }
  const otherSceneInput = { sceneId: fixture.scenes[1].liveSceneId }
  const [definitionBefore, otherSceneBefore] = await Promise.all([
    owner.query(api.scenes.definitionReads.get, preservedInput),
    owner.query(api.scenes.liveReads.header, otherSceneInput)
  ])
  const [presentation, initial] = await Promise.all([
    owner.query(api.scenes.presentations.get, { campaignId }),
    owner.query(api.scenes.liveReads.header, { sceneId })
  ])
  assert.ok(presentation && presentation.sceneId === sceneId)
  let version = initial.version
  const read = async (
    client: typeof owner,
    collection: SceneRecipientPageInput['collection'],
    afterEntityId: string | null = null,
    numItems = 8
  ) => {
    const header = await client.query(api.scenes.recipientReads.header, { sceneId })
    return client.action(recipient, {
      sceneId,
      expectedVersion: version,
      expectedRecipientRevision: header.recipientRevision,
      collection,
      afterEntityId,
      numItems
    })
  }
  const originalTokens = await read(owner, 'tokens')
  const original = originalTokens.page.find(
    ({ value }) => value.entity.id === fixture.scenes[0].tokenIds[0]
  )?.value
  assert.ok(original?.collection === 'tokens')
  const controlled = {
    ...original.entity,
    controlledByUserIds: [playerUserId],
    position: { x: 10, y: 10 }
  }
  const move: SceneGeometryExecuteInput = {
    input: {
      type: 'UPSERT_SCENE_TOKEN',
      sceneId,
      expectedSceneVersion: version,
      commandId: crypto.randomUUID(),
      token: controlled
    },
    presentation: { expectedPresentationVersion: presentation.version }
  }
  const moved = await owner.action(geometry, move)
  assert.equal(moved.version, ++version)
  assert.deepEqual(
    moved.fogPatches,
    [],
    'The human fixture must not acquire invented Character vision.'
  )
  assert.deepEqual(await owner.action(geometry, move), { ...moved, replayed: true })
  await assert.rejects(player.action(geometry, move))
  await assert.rejects(anonymous.action(geometry, move))
  const explored = await owner.action(geometry, {
    input: {
      ...move.input,
      type: 'UPSERT_SCENE_TOKEN',
      commandId: crypto.randomUUID(),
      expectedSceneVersion: version,
      token: {
        ...controlled,
        vision: {
          enabled: true,
          brightRange: 30,
          dimRange: 60,
          angleDegrees: 360,
          directionDegrees: 0
        }
      }
    },
    presentation: move.presentation
  })
  assert.equal(explored.version, ++version)
  assert.ok(explored.fogPatches.some((patch) => patch.ownerUserId === playerUserId))

  const barrier = {
    id: crypto.randomUUID(),
    kind: 'DOOR' as const,
    a: { x: 25, y: 0 },
    b: { x: 25, y: 64 },
    blocksLightWhenClosed: true,
    blocksMovementWhenClosed: true,
    initialState: 'CLOSED' as const,
    openAngleDegrees: 90
  }
  const door = await owner.action(geometry, {
    input: {
      type: 'UPSERT_SCENE_BARRIER',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: version,
      barrier
    }
  })
  assert.equal(door.version, ++version)
  const noteId = crypto.randomUUID()
  const secretId = crypto.randomUUID()
  const lightId = crypto.randomUUID()
  const zoneId = crypto.randomUUID()
  const measurementId = crypto.randomUUID()
  const commandBase = () => ({
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: version
  })
  const inline = async (input: SceneLiveCommandInputDto, client = owner) => {
    const result = await client.mutation(execute, { input })
    assert.equal(result.version, ++version)
    return result
  }
  await inline({
    ...commandBase(),
    type: 'UPSERT_SCENE_ANNOTATION',
    annotation: {
      id: secretId,
      position: { x: 10, y: 10 },
      text: 'Private fixture note',
      visibility: 'GM_ONLY'
    }
  })
  await inline({
    ...commandBase(),
    type: 'UPSERT_SCENE_ANNOTATION',
    annotation: {
      id: noteId,
      position: { x: 10, y: 10 },
      text: 'Visible fixture note',
      visibility: 'TABLE'
    }
  })
  await inline({
    ...commandBase(),
    type: 'UPSERT_SCENE_LIGHT',
    light: {
      id: lightId,
      kind: 'POINT',
      position: { x: 10, y: 10 },
      brightRadius: 20,
      dimRadius: 40,
      color: '#ffffff',
      intensity: 1
    }
  })
  await inline({
    ...commandBase(),
    type: 'UPSERT_SCENE_DARKNESS',
    zone: {
      id: zoneId,
      opacity: 1,
      mechanicalIllumination: 'MAGICAL_DARKNESS',
      mechanicalObscurement: 'HEAVY',
      polygon: {
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
          { x: 0, y: 20 }
        ]
      }
    }
  })
  const measurement: SceneLiveCommandInputDto = {
    ...commandBase(),
    type: 'UPSERT_SCENE_MEASUREMENT',
    measurement: {
      id: measurementId,
      createdByUserId: playerUserId,
      label: 'One foot',
      path: [
        { x: 0, y: 10 },
        { x: 50, y: 10 }
      ]
    }
  }
  const measured = await inline(measurement, player)
  assert.deepEqual(await player.mutation(execute, { input: measurement }), {
    ...measured,
    replayed: true
  })

  const pages = await Promise.all(
    (['tokens', 'barriers', 'annotations', 'lights', 'darknessZones', 'measurements'] as const).map(
      (collection) => read(owner, collection)
    )
  )
  assert.deepEqual(
    pages.map((page) => page.page.length),
    [2, 1, 2, 1, 1, 1]
  )
  assert.ok(pages.every((page) => page.next === null))
  const barriers = pages[1]!.page.flatMap(({ value }) =>
    value.collection === 'barriers' ? [value.entity] : []
  )
  const lights = pages[3]!.page.flatMap(({ value }) =>
    value.collection === 'lights' ? [value.entity] : []
  )
  const darknessZones = pages[4]!.page.flatMap(({ value }) =>
    value.collection === 'darknessZones' ? [value.entity] : []
  )
  const state = {
    barriers,
    lights,
    darknessZones,
    doorStates: { [barrier.id]: pages[1]!.page[0]!.doorState! },
    grid: initial.grid,
    ambientIllumination: initial.ambientIllumination
  }
  assert.equal(canMoveBetween(state, { x: 10, y: 10 }, { x: 40, y: 10 }), false)
  assert.equal(canLightPassBetween(state, { x: 10, y: 10 }, { x: 40, y: 10 }), false)
  assert.equal(
    measureSceneDistance(
      initial.grid,
      measurement.measurement.path[0]!,
      measurement.measurement.path[1]!
    ),
    1
  )
  const perception = resolveSceneCombatPerceptionEnvironment({
    scene: state,
    observer: { ...controlled, position: { x: 40, y: 10 } },
    subject: controlled,
    sharedSurface: false,
    invisibleChannels: [],
    suppressedChannels: []
  })
  assert.equal(perception.lineOfEffect, false)
  assert.equal(perception.illumination, 'MAGICAL_DARKNESS')
  assert.equal(perception.obscurement, 'HEAVY')

  const playerNotes = await read(player, 'annotations', null, 1)
  assert.deepEqual(
    playerNotes.page.map(({ value }) => value.entity.id),
    [noteId]
  )
  assert.equal(playerNotes.next, null)
  await assert.rejects(read(player, 'annotations', secretId))
  assert.ok(
    (await read(player, 'tokens')).page.some(({ value }) => value.entity.id === controlled.id)
  )
  await assert.rejects(read(anonymous, 'tokens'))
  const publicHeader = await player.query(api.scenes.recipientReads.header, { sceneId })
  assert.notEqual(publicHeader.recipientRevision, pages[5]!.recipientRevision)
  assert.deepEqual(await read(player, 'measurements'), {
    ...pages[5],
    recipientRevision: publicHeader.recipientRevision
  })
  for (const key of ['counts', 'currentCounts', 'fogLayerCount', 'definitionSaveId'])
    assert.equal(key in publicHeader, false)

  const beforeRace = version
  const open: SceneGeometryExecuteInput = {
    input: { type: 'SET_SCENE_DOOR_STATE', ...commandBase(), barrierId: barrier.id, state: 'OPEN' }
  }
  const race = await Promise.allSettled([
    owner.action(geometry, open),
    owner.action(geometry, {
      input: {
        ...open.input,
        commandId: crypto.randomUUID(),
        type: 'SET_SCENE_DOOR_STATE',
        barrierId: barrier.id,
        state: 'LOCKED'
      }
    })
  ])
  assert.equal(race.filter((result) => result.status === 'fulfilled').length, 1)
  version++
  const winner = race.find((result) => result.status === 'fulfilled')
  assert.ok(winner?.status === 'fulfilled')
  assert.equal(winner.value.version, version)
  const currentDoor = await read(owner, 'barriers')
  const isOpen = currentDoor.page[0]!.doorState === 'OPEN'
  assert.equal(
    canMoveBetween(
      { barriers, doorStates: { [barrier.id]: currentDoor.page[0]!.doorState! } },
      { x: 10, y: 10 },
      { x: 40, y: 10 }
    ),
    isOpen
  )
  const staleRecipientHeader = await owner.query(api.scenes.recipientReads.header, { sceneId })
  await assert.rejects(
    owner.action(recipient, {
      sceneId,
      expectedVersion: beforeRace,
      expectedRecipientRevision: staleRecipientHeader.recipientRevision,
      collection: 'barriers',
      afterEntityId: null,
      numItems: 8
    })
  )
  await assert.rejects(
    owner.action(geometry, {
      input: {
        type: 'SET_SCENE_DOOR_STATE',
        sceneId,
        expectedSceneVersion: beforeRace,
        commandId: crypto.randomUUID(),
        barrierId: barrier.id,
        state: 'CLOSED'
      }
    })
  )

  const opened = await owner.action(geometry, {
    input: { ...commandBase(), type: 'SET_SCENE_DOOR_STATE', barrierId: barrier.id, state: 'OPEN' }
  })
  assert.equal(opened.version, ++version)
  const openedDoor = await read(owner, 'barriers')
  assert.equal(openedDoor.page[0]!.doorState, 'OPEN')
  const openedState = { barriers, doorStates: { [barrier.id]: openedDoor.page[0]!.doorState! } }
  assert.equal(canMoveBetween(openedState, { x: 10, y: 10 }, { x: 40, y: 10 }), true)
  assert.equal(canLightPassBetween(openedState, { x: 10, y: 10 }, { x: 40, y: 10 }), true)
  const hidden = await owner.action(geometry, {
    input: { ...commandBase(), type: 'UPSERT_SCENE_TOKEN', token: { ...controlled, hidden: true } }
  })
  assert.equal(hidden.version, ++version)
  assert.equal(
    (await read(player, 'tokens')).page.some(({ value }) => value.entity.id === controlled.id),
    false
  )
  await inline({ ...commandBase(), type: 'REMOVE_SCENE_DARKNESS', zoneId })
  assert.equal((await read(owner, 'darknessZones')).page.length, 0)
  assert.deepEqual(await owner.action(rollback, { sceneId, expectedVersion: version }), {
    rolledBack: true
  })
  await assert.rejects(player.action(rollback, { sceneId, expectedVersion: version }))
  await assert.rejects(anonymous.action(rollback, { sceneId, expectedVersion: version }))
  assert.equal((await owner.query(api.scenes.liveReads.header, { sceneId })).version, version)
  assert.deepEqual(
    await owner.query(api.scenes.definitionReads.get, preservedInput),
    definitionBefore
  )
  assert.deepEqual(
    await owner.query(api.scenes.liveReads.header, otherSceneInput),
    otherSceneBefore
  )
  console.log(
    'V03 native Scene lifecycle: ' +
      JSON.stringify({ sceneId, version, collections: 6, rolledBack: true })
  )
}
