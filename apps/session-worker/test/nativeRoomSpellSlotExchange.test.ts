import { runInDurableObject } from 'cloudflare:test'
import { characterActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'

/**
 * SPELLS-31.T5j: the EXCHANGE_SPELL_SLOTS Sheet command in the real local room. A level 5 Wizard's
 * player recovers expended slots with Arcane Recovery, read back from the Character's stored play.
 */

const ACTOR_ID = testUuid(0x5a0)
const CHARACTER_ID = testUuid(0x5a1)

afterEach(closeTrackedSockets)

function wizardRoom() {
  return movementRoom({
    actors: [characterActor({ id: ACTOR_ID, characterId: CHARACTER_ID })],
    moverActorId: ACTOR_ID,
    positions: { [ACTOR_ID]: { x: 150, y: 150 } },
    characterClassFeatures: [srdByLabel(wizard.features ?? [], 'Arcane Recovery')],
    characterPlay: {
      characterClass: wizard,
      classLevel: 5,
      spellSlots: [
        { slotKey: 'STANDARD:1', used: 3 },
        { slotKey: 'STANDARD:2', used: 1 }
      ]
    }
  })
}

type Room = Awaited<ReturnType<typeof wizardRoom>>

function storedPlay(room: Room) {
  return runInDurableObject(room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return { streamVersion: row.streamVersion, play: readCharacterPlay(row) }
  })
}

/** The player's Sheet, its Arcane Recovery action and a sender for that player's Sheet commands. */
async function playerSheet(room: Room) {
  const player = await connectPlayer(room.base)
  player.socket.send(
    JSON.stringify({ type: 'SUBSCRIBE_CHARACTER_SHEET', characterId: CHARACTER_ID })
  )
  const sheet = await vi.waitFor(() => {
    const message = player.messages.find((each) => each.type === 'CHARACTER_SHEET')
    if (message?.type !== 'CHARACTER_SHEET') throw new Error('The room sent no Sheet.')
    return message.sheet
  })
  const recovery = sheet.actions.items.find(({ label }) => label === 'Arcane Recovery')
  if (!recovery) throw new Error('The Sheet lists no Arcane Recovery action.')
  async function send(slotKeys: string[]) {
    const commandId = crypto.randomUUID()
    const { streamVersion } = await storedPlay(room)
    player.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command: {
          scope: 'CHARACTER_SHEET',
          characterId: CHARACTER_ID,
          encounterId: room.encounterId,
          command: {
            type: 'EXCHANGE_SPELL_SLOTS',
            commandId,
            expectedVersion: streamVersion,
            actionId: recovery.id,
            selection: { kind: 'SLOTS', slotKeys }
          }
        }
      })
    )
    return vi.waitFor(() => {
      const answer = player.messages.find(
        (message) =>
          (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
          message.commandId === commandId
      )
      if (!answer) throw new Error('The room has not answered.')
      return answer.type
    })
  }
  return { sheet, recovery, send }
}

describe('a player exchanging spell slots in the room (SPELLS-31.T5j)', () => {
  it('recovers 3 slot levels with Arcane Recovery and spends its one use', async () => {
    const room = await wizardRoom()
    const { recovery, send } = await playerSheet(room)
    expect(recovery.mechanic?.outcomes).toEqual([
      expect.objectContaining({
        spellSlotExchange: { mode: 'RECOVER_SLOTS', levelBudget: 3, maximumSlotLevel: 5 }
      })
    ])

    expect(await send(['STANDARD:1', 'STANDARD:2'])).toBe('COMMAND_COMMITTED')

    const { play } = await storedPlay(room)
    expect(play.spellSlots).toEqual([{ slotKey: 'STANDARD:1', used: 2 }])
    expect(play.resourceUsage.map(({ used }) => used)).toEqual([1])
  })

  it('refuses a recovery over the level budget and stores nothing', async () => {
    const room = await wizardRoom()
    const { send } = await playerSheet(room)
    const before = await storedPlay(room)

    expect(await send(['STANDARD:1', 'STANDARD:1', 'STANDARD:2'])).toBe('COMMAND_REJECTED')

    expect(await storedPlay(room)).toEqual(before)
  })
})
