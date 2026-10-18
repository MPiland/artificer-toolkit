import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { slow } from '@artificer-toolkit/source-data/srd/spells/slow.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2a5 (D156): Slow, authored from core Modifier Grants. A creature that fails its Wisdom
 * save holds the six modifiers of the slowed state through one effect under the caster's
 * Concentration, and rolls the save again at the end of each of its turns, ending the effect on a
 * success.
 */

const CASTER_ID = testUuid(0x9c0)
const CHARACTER_ID = testUuid(0x9c1)
const FIRST_ID = testUuid(0x9c2)
const SECOND_ID = testUuid(0x9c3)
const SLOWED = [FIRST_ID, SECOND_ID].sort()

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The Character casts Slow at x = 1150; the two Wolves stand inside its cube. Rolls are zero-based:
 * the two area saves roll natural 1s, and every later die is `turnSaveDie`.
 */
function slowRoom(turnSaveDie: number) {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CASTER_ID, characterId: CHARACTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      ...[FIRST_ID, SECOND_ID].map((id) => srdCreatureActor({ id, creature: plainWolf }))
    ],
    positions: {
      [FIRST_ID]: { x: 1100, y: 150 },
      [SECOND_ID]: { x: 1200, y: 150 }
    },
    characterSpellcasting: { spells: [slow], prepared: [slow.id] },
    characterAction: (action) => action.label === 'Slow (3rd level)',
    autoRoll: 'GAME_MASTER',
    rolls: [0, 0],
    fallbackRoll: turnSaveDie
  })
}

type SlowRoom = Awaited<ReturnType<typeof slowRoom>>

/** The walking budget the GM's Encounter session shows `actorId` this turn. */
async function walkBudget(room: SlowRoom, actorId: string) {
  const { base } = room.room
  const first = base.messages.length
  base.socket.send(JSON.stringify({ type: 'SUBSCRIBE_ENCOUNTER_SESSION', timeline: false }))
  const state = await vi.waitFor(() => {
    const message = base.messages
      .slice(first)
      .find((candidate) => candidate.type === 'ENCOUNTER_SESSION')
    if (message?.type !== 'ENCOUNTER_SESSION' || !message.session.held)
      throw new Error('The room has not sent the held Encounter session.')
    return message.session.state
  })
  return state.turnMovement
    .find((movement) => movement.actorId === actorId)
    ?.allowances.find(({ code }) => code === 'WALK')?.budget
}

/** The Character casts Slow; both Wolves fail their Wisdom saves. */
async function castSlow(room: SlowRoom) {
  const { answer } = await room.startAreaAction({ x: 1150, y: 150 })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  for (;;) {
    const decision = await readPendingActionDecision(room.room.base.stub)
    if (decision?.pending.kind !== 'AREA_SAVES') break
    const [save] = decision.pending.saves
    if (!save) break
    const answered = await room.send(
      room.resolveCommand(decision, {
        kind: 'ENTER_DICE',
        requestId: save.request.requestId,
        rawFaces: [1],
        rollMode: save.request.rollMode
      })
    )
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
  }
}

const SLOWED_MODIFIERS = [
  'ACTION_BONUS_ACTION_EXCLUSIVITY:ENABLE',
  'ARMOR_CLASS:PENALTY',
  'ATTACKS_PER_ATTACK_ACTION:CAP_VALUE',
  'REACTION_COUNT:SET_VALUE',
  'SAVING_THROW_MODIFIER:PENALTY',
  'SPEED:MULTIPLY'
]

describe('room cast of Slow (SPELLS-4.T2a5)', () => {
  it('holds the six slowed modifiers on each creature that fails its save, halving its speed, as one effect under Concentration', async () => {
    const room = await slowRoom(5)
    const fullSpeed = await walkBudget(room, FIRST_ID)
    expect(fullSpeed).toBeGreaterThan(0)

    await castSlow(room)

    const history = await readRoomHistory(room.room.base.stub)
    expect(history.activeEffects.map(({ targetActorId }) => targetActorId).sort()).toEqual(SLOWED)
    for (const effect of history.activeEffects) {
      const { recurrence, frozenGraphNodeId, stateContributions } = JSON.parse(
        effect.definitionJson
      )
      expect(
        stateContributions
          .flatMap(({ modifiers }: { modifiers: { valueDomainCode: string }[] }) => modifiers)
          .map((modifier: { valueDomainCode: string; modifierKind: string }) =>
            [modifier.valueDomainCode, modifier.modifierKind].join(':')
          )
          .sort()
      ).toEqual(SLOWED_MODIFIERS)
      expect(recurrence.expiration).toMatchObject({ kind: 'TICKS', initialRemaining: 10 })
      expect(recurrence.recurrenceStage).toBe('END_OF_TURN')
      expect(frozenGraphNodeId).toBe('repeat-save-test')
    }
    expect(await walkBudget(room, FIRST_ID)).toBe(fullSpeed! / 2)
    expect(await walkBudget(room, SECOND_ID)).toBe(fullSpeed! / 2)
  }, 120000)

  // Zero-based dice: 0 is a natural 1 and 19 a natural 20.
  describe("at the end of its holder's turn, the effect rolls its repeating Wisdom save", () => {
    /** The cast, then the caster's turn ends and the first Wolf's: its effect's save rolls. */
    async function castThenEndTwoTurns(turnSaveDie: number) {
      const room = await slowRoom(turnSaveDie)
      await castSlow(room)
      await room.advanceTurn()
      await room.advanceTurn()
      return { room, history: await readRoomHistory(room.room.base.stub) }
    }

    it("ends on a passed save, restoring the creature's speed and leaving the other slowed", async () => {
      const { room, history } = await castThenEndTwoTurns(19)
      expect(history.activeEffects.map(({ targetActorId }) => targetActorId)).toEqual([SECOND_ID])
      expect(await walkBudget(room, SECOND_ID)).toBe((await walkBudget(room, FIRST_ID))! / 2)
    }, 120000)

    it('continues on a failed save, one round shorter', async () => {
      const { history } = await castThenEndTwoTurns(0)
      expect(
        history.activeEffects
          .map(({ targetActorId, lifecycle }) => [targetActorId, lifecycle])
          .sort()
      ).toEqual(
        [FIRST_ID, SECOND_ID]
          .map((id) => [id, { schemaVersion: 1, remainingTicks: id === FIRST_ID ? 9 : 10 }])
          .sort()
      )
    }, 120000)
  })
})
