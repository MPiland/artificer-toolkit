import { runInDurableObject } from 'cloudflare:test'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { DND5E_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { bard } from '@artificer-toolkit/source-data/srd/classes/bard.js'
import { collegeOfLore } from '@artificer-toolkit/source-data/srd/classes/college-of-lore.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CharacterPlayOverrides } from '../src/testing/characterPageFixture.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T4c3b2: an opportunity attack a walk provokes opens the same d20 window for a Character
 * holding an attack-roll reaction as an action's attack does (D207). The reactor answers it: the mover
 * itself, or a Character beside the walk. A used die comes off the roll and its reaction and charge are
 * spent with the movement reaction; nothing is spent on a decline.
 */

const WOLF_ID = testUuid(0x7e0)
const MOVER_ID = testUuid(0x7e1)
const MOVER_CHARACTER_ID = testUuid(0x7e2)
const BARD_ACTOR_ID = testUuid(0x7e3)
const BARD_CHARACTER_ID = testUuid(0x7e4)
const SECOND_WOLF_ID = testUuid(0x7e5)
const MOVER_START: ScenePoint = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The College of Lore with only its SRD Cutting Words: its Bonus Proficiencies choice would leave the
 * captured Character awaiting Builder repair.
 */
const loreCuttingWords = {
  ...collegeOfLore,
  features: [srdByLabel(collegeOfLore.features ?? [], 'Cutting Words')]
}

/** The id of the grant a Character's reconciliation records for the Bard's Bardic Inspiration. */
const inspirationGrantId = `resource:${bard.id}:${bard.resources?.id}`

/** A level 3 Lore Bard with `used` of its one Bardic Inspiration spent. */
const loreBard = (play: CharacterPlayOverrides = {}, used = 0): CharacterPlayOverrides => ({
  characterClass: bard,
  characterSubclass: loreCuttingWords,
  classLevel: 3,
  resourceUsage: [{ owner: { kind: 'AUTHORED_GRANT', resourceGrantId: inspirationGrantId }, used }],
  ...play
})

/**
 * A Character walks east out of a hostile Wolf's reach, provoking its Bite (+4). The Lore Bard is the
 * mover (`MOVER`) or a second Character at `bardAt` (`BYSTANDER`); the Wolf's rolls are automatic.
 * `secondWolf` adds a Wolf north of the mover, asked after the first.
 */
function walkRoom(input: {
  bard: 'MOVER' | 'BYSTANDER'
  bardPlay?: CharacterPlayOverrides
  bardAt?: ScenePoint
  secondWolf?: boolean
}) {
  const bardPlay = input.bardPlay ?? loreBard()
  return movementRoom({
    actors: [
      srdCreatureActor({ id: WOLF_ID, creature: reactionWolf }),
      ...(input.secondWolf
        ? [srdCreatureActor({ id: SECOND_WOLF_ID, creature: reactionWolf })]
        : []),
      characterActor({ id: MOVER_ID, characterId: MOVER_CHARACTER_ID }),
      ...(input.bard === 'BYSTANDER'
        ? [characterActor({ id: BARD_ACTOR_ID, characterId: BARD_CHARACTER_ID })]
        : [])
    ],
    moverActorId: MOVER_ID,
    positions: {
      [WOLF_ID]: { x: 50, y: 150 },
      ...(input.secondWolf ? { [SECOND_WOLF_ID]: { x: 150, y: 50 } } : {}),
      [MOVER_ID]: MOVER_START,
      ...(input.bard === 'BYSTANDER' ? { [BARD_ACTOR_ID]: input.bardAt ?? { x: 150, y: 350 } } : {})
    },
    autoRoll: 'GAME_MASTER',
    // The Bite's d20 is a natural 10 (14 to hit); every later die lands on its minimum.
    rolls: [9],
    fallbackRoll: 0,
    ...(input.bard === 'MOVER'
      ? { characterPlay: bardPlay }
      : { secondCharacter: { characterId: BARD_CHARACTER_ID, play: bardPlay } })
  })
}
type Room = Awaited<ReturnType<typeof walkRoom>>

/** Walks into the Wolf's opportunity attack and has it attack; returns the Use (see `useReaction`). */
async function provokeAttack(room: Room) {
  await room.move([MOVER_START, { x: 450, y: 150 }])
  const used = await room.useReaction()
  expect(used.answer.type, JSON.stringify(used.answer)).toBe('COMMAND_COMMITTED')
  return used
}

/**
 * Provokes the attack and returns the d20 window its roll opens, as a viewer of the reactor reads
 * it, with the command id of the attack's action.
 *
 * Restated (QUALITY-18.T2b3): the attack is the Wolf's own action (D219), so the window is that
 * action's decision, read while the move is SUSPENDED, where it was a phase of the move's.
 */
async function openWindow(room: Room) {
  const { childCommandId } = await provokeAttack(room)
  const shown = (await readPendingActionDecision(room.base.stub, false))?.pending
  if (shown?.kind !== 'ROLL_WINDOW') throw new Error(`Expected a d20 window, got ${shown?.kind}.`)
  return { shown, attackCommandId: childCommandId }
}

const inspirationUsed = (room: Room, characterId: string) =>
  runInDurableObject(room.base.stub, (_instance, context) => {
    const play = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((row) => row.characterId === characterId)
    if (!play) throw new Error('Missing room Character play state.')
    return (
      readCharacterPlay(play).resourceUsage.find(
        ({ owner }) =>
          owner.kind === 'AUTHORED_GRANT' && owner.resourceGrantId === inspirationGrantId
      )?.used ?? 0
    )
  })

async function reactionUsed(room: Room, actorId: string) {
  const row = (await readRoomHistory(room.base.stub)).actors.find(({ id }) => id === actorId)
  if (!row) throw new Error('The room holds no such actor.')
  return encounterRuleUsageUsed(readStoredRunActor(row), DND5E_REACTION_ALLOWANCE_DEFINITION_ID)
}

/**
 * A settled opportunity attack's d20 and its attacker.
 *
 * Restated (QUALITY-18.T2b3): the attack settles as its own action (D219), so its d20 is in the
 * receipt of that action's command, where it was in a reaction execution of the move's terminal.
 */
async function settledAttack(room: Room, attackCommandId: string) {
  const receipt = (await room.receipts()).find((entry) => entry.commandId === attackCommandId)
  if (!receipt) throw new Error('The attack left no receipt.')
  const result = storedRuleExecutionResultDtoSchema.parse(receipt.result)
  if (result.status !== 'COMPLETE') throw new Error(`Got ${result.status}.`)
  if (result.applicationOutputs.kind !== 'CHARACTER_MECHANICS_BATCH')
    throw new Error('Expected a Character movement reaction target.')
  return {
    d20: result.applicationOutputs.d20,
    attackerActorId: result.applicationOutputs.sourceActorId
  }
}

describe('Cutting Words against an opportunity attack (SPELLS-31.T4c3b2)', () => {
  it('asks a Lore Bard beside the walk, naming the Wolf, and takes its die off the roll', async () => {
    const room = await walkRoom({ bard: 'BYSTANDER' })
    const { shown, attackCommandId } = await openWindow(room)
    expect(shown).toMatchObject({
      rollerActorId: BARD_ACTOR_ID,
      attackerActorId: WOLF_ID,
      d20: { selectedNatural: 10 },
      options: [{ label: 'Cutting Words', count: 1, faces: 6, sign: 'SUBTRACT' }]
    })
    expect(await inspirationUsed(room, BARD_CHARACTER_ID)).toBe(0)
    expect(await reactionUsed(room, BARD_ACTOR_ID)).toBe(0)

    const used = await room.respondToChild({
      kind: 'ROLL_WINDOW_USE',
      requestId: shown.requestId,
      optionId: shown.options[0]!.optionId,
      faces: [5]
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await room.pending()).toBeNull()
    const { d20 } = await settledAttack(room, attackCommandId)
    expect(d20?.total).toBe((d20?.selectedNatural ?? 0) + (d20?.modifier ?? 0) - 5)
    expect(await inspirationUsed(room, BARD_CHARACTER_ID)).toBe(1)
    expect(await reactionUsed(room, BARD_ACTOR_ID)).toBe(1)
    // The Wolf's own reaction is its opportunity attack; the mover spends nothing.
    expect(await reactionUsed(room, MOVER_ID)).toBe(0)
  }, 120_000)

  it('asks the mover itself when it is the Lore Bard the Wolf attacks', async () => {
    const room = await walkRoom({ bard: 'MOVER' })
    const { shown, attackCommandId } = await openWindow(room)
    expect(shown).toMatchObject({ rollerActorId: MOVER_ID, attackerActorId: WOLF_ID })

    const used = await room.respondToChild({
      kind: 'ROLL_WINDOW_USE',
      requestId: shown.requestId,
      optionId: shown.options[0]!.optionId,
      faces: [5]
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await room.pending()).toBeNull()
    const { d20 } = await settledAttack(room, attackCommandId)
    expect(d20?.total).toBe((d20?.selectedNatural ?? 0) + (d20?.modifier ?? 0) - 5)
    expect(await inspirationUsed(room, MOVER_CHARACTER_ID)).toBe(1)
    expect(await reactionUsed(room, MOVER_ID)).toBe(1)
  }, 120_000)

  it('leaves the roll and spends nothing when the Bard declines', async () => {
    const room = await walkRoom({ bard: 'BYSTANDER' })
    const { shown, attackCommandId } = await openWindow(room)
    const declined = await room.respondToChild({
      kind: 'ROLL_WINDOW_DECLINE',
      requestId: shown.requestId
    })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(await room.pending()).toBeNull()
    const { d20 } = await settledAttack(room, attackCommandId)
    expect(d20?.addedDice).toBeUndefined()
    expect(await inspirationUsed(room, BARD_CHARACTER_ID)).toBe(0)
    expect(await reactionUsed(room, BARD_ACTOR_ID)).toBe(0)
  }, 120_000)

  // Restated (QUALITY-18.T2b3), renamed from 'replays the used die when a later opportunity attack
  // is answered': each attack is an action of its own (D219), so answering the second Wolf replays
  // nothing. The first attack's receipt keeps the Bard's die, and the second attack's has none.
  it('keeps the used die on its attack when a later opportunity attack is answered', async () => {
    const room = await walkRoom({ bard: 'BYSTANDER', secondWolf: true })
    const { shown, attackCommandId } = await openWindow(room)
    expect(shown).toMatchObject({ rollerActorId: BARD_ACTOR_ID, attackerActorId: WOLF_ID })
    const used = await room.respondToChild({
      kind: 'ROLL_WINDOW_USE',
      requestId: shown.requestId,
      optionId: shown.options[0]!.optionId,
      faces: [5]
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    // The Bard's reaction is spent, so the second attack opens no window.
    const second = await room.pending()
    if (second?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
      throw new Error(`Expected the second Wolf's decision, got ${second?.context.kind}.`)
    expect(second.context.reactionTimeline[0]?.group.reactorActorId).toBe(SECOND_WOLF_ID)
    const attacked = await room.useReaction()
    expect(attacked.answer.type, JSON.stringify(attacked.answer)).toBe('COMMAND_COMMITTED')
    expect(await room.pending()).toBeNull()

    const first = await settledAttack(room, attackCommandId)
    expect(first.attackerActorId).toBe(WOLF_ID)
    expect(first.d20?.total).toBe(
      (first.d20?.selectedNatural ?? 0) + (first.d20?.modifier ?? 0) - 5
    )
    const secondAttack = await settledAttack(room, attacked.childCommandId)
    expect(secondAttack.attackerActorId).toBe(SECOND_WOLF_ID)
    expect(secondAttack.d20?.addedDice).toBeUndefined()
    expect(await inspirationUsed(room, BARD_CHARACTER_ID)).toBe(1)
    expect(await reactionUsed(room, BARD_ACTOR_ID)).toBe(1)
  }, 120_000)

  it.each([
    { name: 'has no Bardic Inspiration left', bardPlay: loreBard({}, 1) },
    {
      name: 'is dead (D63)',
      bardPlay: loreBard({
        currentHitPoints: 0,
        deathSaves: { successes: 0, failures: 3, stable: false }
      })
    },
    // 13 cells of 5 ft from the Wolf: beyond Cutting Words' 60 ft.
    { name: 'is out of range', bardPlay: loreBard(), bardAt: { x: 50, y: 1450 } }
  ])(
    'never pauses for a Bard who $name',
    async ({ bardPlay, bardAt }) => {
      const room = await walkRoom({ bard: 'BYSTANDER', bardPlay, ...(bardAt ? { bardAt } : {}) })
      await provokeAttack(room)
      // Restated (QUALITY-18.T2b3): a window would be the attack action's decision (D219), so no
      // decision of any kind may wait once the attack has run and the room has resumed the move.
      expect(await readPendingActionDecision(room.base.stub)).toBeNull()
      expect(await reactionUsed(room, BARD_ACTOR_ID)).toBe(0)
    },
    120_000
  )
})
