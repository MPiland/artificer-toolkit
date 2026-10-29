import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { divineFavor } from '@artificer-toolkit/source-data/srd/spells/divine-favor.js'
import { huntersMark } from '@artificer-toolkit/source-data/srd/spells/hunters-mark.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'
import {
  CONCENTRATION_STATE_ID,
  movementRoom,
  type MovementRoomConfig
} from './movementRoomFixture.js'

/**
 * SPELLS-8.6: a mark the Character's live Concentration keeps on a Creature shows on the room's Sheet
 * as the die it adds to the Character's damage against that Creature only (the room's fill of the
 * placed effects); a die the Character adds to all its damage joins the Sheet's damage roll.
 */

const ACTOR_ID = testUuid(0x8f10)
const CHARACTER_ID = testUuid(0x8f11)
const WOLF_ID = testUuid(0x8f12)

afterEach(closeTrackedSockets)

function markingRoom(marked: boolean, seed?: MovementRoomConfig['seed']) {
  return movementRoom({
    actors: [
      characterActor({ id: ACTOR_ID, characterId: CHARACTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    moverActorId: ACTOR_ID,
    positions: { [ACTOR_ID]: { x: 150, y: 150 }, [WOLF_ID]: { x: 250, y: 150 } },
    characterPlay: { equipped: true },
    concentration: true,
    ...(seed && { seed }),
    ...(marked && {
      seed: seedModifierGrant({
        sourceActorId: ACTOR_ID,
        holderActorId: WOLF_ID,
        lifecycle: {},
        effect: huntersMark.effects![0]!,
        sourceLabel: huntersMark.label,
        maintainedEffectStateId: CONCENTRATION_STATE_ID
      })
    })
  })
}

/** The attack row of the Sheet the room sends the Character's player, and that player. */
async function attackRow(room: Awaited<ReturnType<typeof markingRoom>>) {
  const player = await connectPlayer(room.base)
  player.socket.send(
    JSON.stringify({ type: 'SUBSCRIBE_CHARACTER_SHEET', characterId: CHARACTER_ID })
  )
  const sheet = await vi.waitFor(() => {
    const message = player.messages.find((each) => each.type === 'CHARACTER_SHEET')
    if (message?.type !== 'CHARACTER_SHEET') throw new Error('The room sent no Sheet.')
    return message.sheet
  })
  const row = sheet.actions.items.find((action) => action.mechanic?.attackBonus != null)
  if (!row?.mechanic) throw new Error('The Sheet lists no attack row.')
  return { player, label: row.label, mechanic: row.mechanic }
}

/** The added damage dice on the attack row of the Sheet the room sends the Character's player. */
async function attackRowDamageDice(room: Awaited<ReturnType<typeof markingRoom>>) {
  return (await attackRow(room)).mechanic.damageAddedDice
}

describe("a live mark on the room's Sheet (SPELLS-8.6)", () => {
  it('lists the die the mark adds to damage against the marked Creature only', async () => {
    expect(await attackRowDamageDice(await markingRoom(true))).toEqual([
      {
        label: huntersMark.label,
        count: 1,
        faces: 6,
        sign: 'ADD',
        damageTypeId: null,
        againstHolderOnly: true
      }
    ])
  })

  it('lists no added damage die while the Character marks nothing', async () => {
    expect(await attackRowDamageDice(await markingRoom(false))).toBeUndefined()
  })
})

describe("a die the Character adds to all its damage on the room's Sheet roll (SPELLS-8.6)", () => {
  it('adds the die the damage row shows to the damage roll', async () => {
    const room = await markingRoom(false, async ({ effects, encounterId }) => {
      await effects.create({
        id: crypto.randomUUID(),
        owner: { kind: 'CHARACTER', characterId: CHARACTER_ID },
        definition: plannedModifierGrant({
          encounterId,
          sourceActorId: ACTOR_ID,
          holderActorId: ACTOR_ID,
          lifecycle: {},
          effect: divineFavor.effects![0]!,
          sourceLabel: divineFavor.label,
          rounds: 10,
          lifetimeScope: 'OWNER'
        }).definition,
        lifecycle: { schemaVersion: 1, remainingTicks: 10 }
      })
    })
    const { player, label, mechanic } = await attackRow(room)
    expect(mechanic.damageAddedDice).toEqual([
      expect.objectContaining({ label: divineFavor.label, count: 1, faces: 4, sign: 'ADD' })
    ])
    const damage = mechanic.outcomes.find((outcome) => outcome.kind === 'DAMAGE')
    if (damage?.kind !== 'DAMAGE') throw new Error('The attack row deals no damage.')
    const rollId = crypto.randomUUID()
    player.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command: {
          scope: 'CAMPAIGN_CHAT',
          command: {
            type: 'EXECUTE_ROLL',
            commandId: rollId,
            input: {
              campaignId: room.base.capture.campaignId,
              destination: 'TABLE',
              clientNonce: rollId,
              roll: {
                characterId: CHARACTER_ID,
                expression: damage.expression,
                source: { kind: 'DAMAGE', label: `${label} damage` }
              }
            }
          }
        }
      })
    )
    const roll = await vi.waitFor(() => {
      const reply = player.messages.find(
        (message) =>
          (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
          message.commandId === rollId
      )
      if (
        reply?.type !== 'COMMAND_COMMITTED' ||
        reply.delta?.scope !== 'CAMPAIGN_CHAT' ||
        !reply.delta.entry
      )
        throw new Error(JSON.stringify(reply ?? null))
      return reply.delta.entry.roll
    })
    expect(roll?.normalizedExpression).toMatch(/\+ 1d4$/)
  })
})
