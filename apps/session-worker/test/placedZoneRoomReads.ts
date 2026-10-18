import { runInDurableObject } from 'cloudflare:test'
import { expect, vi } from 'vitest'

import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import type { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { connectPlayer } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

type ActionRoom = Awaited<ReturnType<typeof actionRoom>>

/** The id of the zone option `label` a spell's cast-time pick offers (D140). */
export function choiceOptionIdOf(spell: SpellAuthored, label: string) {
  const path = spell.effects?.[0]?.paths[0]
  const option =
    path?.selectionKind === 'CHOICE' ? path.options.find((each) => each.label === label) : undefined
  if (!option) throw new Error(`${spell.label} must offer the zone option ${label}.`)
  return option.id
}

/** The zones the room's Encounter holds. */
export function readZones(room: ActionRoom) {
  return runInDurableObject(room.room.base.stub, async (_instance, context) =>
    new RoomEncounterStore(context.storage).documents('encounterSpatialRuleEffects')
  )
}

/** The Concentration states the room's Encounter holds. */
export function readMaintainedStates(room: ActionRoom) {
  return runInDurableObject(room.room.base.stub, async (_instance, context) =>
    new RoomEncounterStore(context.storage).documents('encounterMaintainedEffectStates')
  )
}

export async function hitPointsOf(room: ActionRoom, actorId: string) {
  return vitalsOf(await readRoomHistory(room.room.base.stub)).find(({ id }) => id === actorId)
    ?.currentHitPoints
}

/** The Scene version each room has reached: a walk that triggers nothing leaves no receipt to read it from. */
const sceneVersions = new WeakMap<ActionRoom, number>()

/**
 * A token of the room (the second unless `tokenIndex` names another) walks `path` through the room's
 * Scene command. A walk that triggers nothing leaves no receipt, so it reports no executions.
 */
export async function walkerMoves(
  room: ActionRoom,
  path: readonly { x: number; y: number }[],
  carefully = false,
  tokenIndex = 1
) {
  const receiptsBefore = (await room.room.receipts()).length
  const answer = await room.room.move(
    path,
    await room.version(),
    sceneVersions.get(room) ?? room.room.scene.version,
    room.room.scene.tokens[tokenIndex]!.id,
    carefully
  )
  const committed = answer.type === 'COMMAND_COMMITTED' ? answer.delta : null
  if (committed?.scope !== 'SCENE')
    throw new Error(`The walk was not committed: ${JSON.stringify(answer)}`)
  sceneVersions.set(room, committed.result.version)
  const [move] = (await room.room.receipts())
    .slice(receiptsBefore)
    .filter(({ commandType }) => commandType === 'MOVE_SCENE_TOKEN')
  const walked = move?.result as
    | {
        status: string
        terminalPosition: { x: number; y: number }
        executions: { execution: { movementInterruption: unknown }; applications: unknown[] }[]
      }
    | undefined
  const { delta } = committed.result
  const terminalPosition =
    walked?.terminalPosition ?? (delta?.kind === 'TOKEN_MOVED' ? delta.position : null)
  if (!terminalPosition) throw new Error('The walk moved no token.')
  return { terminalPosition, status: walked?.status ?? null, executions: walked?.executions ?? [] }
}

/** The Character's Sheet stream version the room holds. */
export function readSheetStreamVersion(room: ActionRoom, characterId: string) {
  return runInDurableObject(room.room.base.stub, (_instance, context) => {
    const play = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((row) => row.characterId === characterId)
    if (!play) throw new Error('Missing room Character play state.')
    return play.streamVersion
  })
}

/**
 * The player of `characterId` ends the Character's Concentration on the Sheet, as its holder may at
 * any time; the room's answer, not yet checked.
 */
export async function endConcentrationAtSheet(room: ActionRoom, characterId: string) {
  const streamVersion = await readSheetStreamVersion(room, characterId)
  const player = await connectPlayer(room.room.base)
  const commandId = crypto.randomUUID()
  player.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'CHARACTER_SHEET',
        characterId,
        encounterId: room.room.encounterId,
        command: { type: 'END_CONCENTRATION', commandId, expectedVersion: streamVersion }
      }
    })
  )
  return vi.waitFor(() => {
    const answer = player.messages.find(
      (message) =>
        (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
        message.commandId === commandId
    )
    if (!answer) throw new Error('The room has not answered yet.')
    return answer
  })
}

/** The GM takes back the last action. */
export async function revertLastAction(room: ActionRoom) {
  const undone = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
}
