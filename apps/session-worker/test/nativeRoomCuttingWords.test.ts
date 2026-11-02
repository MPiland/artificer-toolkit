import { runInDurableObject } from 'cloudflare:test'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { DND5E_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { bard } from '@artificer-toolkit/source-data/srd/classes/bard.js'
import {
  collegeOfLore,
  cuttingWordsReaction
} from '@artificer-toolkit/source-data/srd/classes/college-of-lore.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  readActorHitPoints,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-31.T4c3b1: a Wolf's Bite attack roll opens a d20 window for a Character beside it who holds
 * an attack-roll reaction (D207). Used, the reactor's die comes off the roll, and its reaction and the
 * charge it costs are spent with the action, so one undo restores them. The engine knows no feature:
 * the SRD Cutting Words and a homebrew free reaction take the same path.
 */

const ATTACKER_ID = testUuid(0x7c0)
const TARGET_ID = testUuid(0x7c1)
const REACTOR_ACTOR_ID = testUuid(0x7c2)
const REACTOR_ID = testUuid(0x7c3)
const attackBite = biteWolf('ATTACK')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The id of the grant a Character's reconciliation records for the Bard's Bardic Inspiration. */
const inspirationGrantId = `resource:${bard.id}:${bard.resources?.id}`

/**
 * A homebrew Fighter feature: a free reaction (no charge) that takes 1d4 from another creature's
 * attack roll, otherwise authored as Cutting Words is.
 */
const heckle = ((): ClassFeature => {
  if (cuttingWordsReaction.invocation.kind !== 'ACTION')
    throw new Error('The SRD Cutting Words is not an action.')
  const { resourceUse: _charge, ...invocation } = cuttingWordsReaction.invocation
  const [path] = cuttingWordsReaction.paths ?? []
  if (!path || !('resultBlock' in path)) throw new Error('Expected a result-block path.')
  const [outcome] = path.resultBlock.outcomes
  if (!outcome || !invocation.range) throw new Error('The SRD Cutting Words has no ranged outcome.')
  return {
    ...srdByLabel(collegeOfLore.features ?? [], 'Cutting Words'),
    id: testUuid(0x7d0),
    label: 'Heckle',
    availableAtLevel: 1,
    effects: [
      {
        ...cuttingWordsReaction,
        id: testUuid(0x7d1),
        invocation: { ...invocation, range: { ...invocation.range, id: testUuid(0x7d2) } },
        paths: [
          {
            ...path,
            id: testUuid(0x7d3),
            resultBlock: {
              ...path.resultBlock,
              id: testUuid(0x7d4),
              outcomes: [
                {
                  ...outcome,
                  id: testUuid(0x7d5),
                  die: { count: 1, faces: 4, sign: 'SUBTRACT', timing: 'AFTER_ROLL' }
                }
              ]
            }
          }
        ]
      }
    ]
  }
})()

/**
 * A Wolf whose Bite (+4) attacks a Wolf (AC 13), with a Character 10 ft away: a level 3 Lore Bard
 * holding Cutting Words with `used` of its one Bardic Inspiration spent, or a Fighter holding Heckle.
 */
function reactorRoom(reactor: 'LORE_BARD' | 'HECKLER', used = 0) {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attackBite }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf }),
      characterActor({ id: REACTOR_ACTOR_ID, characterId: REACTOR_ID })
    ],
    ownerFeatureId: creatureFeature(attackBite, 'Bite').id,
    ...(reactor === 'LORE_BARD'
      ? {
          characterPlay: {
            characterClass: bard,
            characterSubclass: collegeOfLore,
            classLevel: 3,
            resourceUsage: [
              { owner: { kind: 'AUTHORED_GRANT', resourceGrantId: inspirationGrantId }, used }
            ]
          }
        }
      : { characterClassFeatures: [heckle] })
  })
}
type Room = Awaited<ReturnType<typeof reactorRoom>>

/** The attacker rolls a natural 10: 14 hits AC 13, and any die taken off it makes it miss. */
async function rollAttack(room: Room) {
  expect((await room.startAction(TARGET_ID)).answer.type).toBe('COMMAND_COMMITTED')
  const attack = await room.pendingDecision()
  if (attack.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack prompt.')
  const { request } = attack.pending
  const rolled = await room.resolve(attack, {
    kind: 'ENTER_DICE',
    requestId: request.requestId,
    rawFaces: [10],
    rollMode: request.rollMode
  })
  expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
}

async function openWindow(room: Room) {
  await rollAttack(room)
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_WINDOW')
    throw new Error(`Expected the d20 window, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

const inspirationUsed = (room: Room) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const play = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((row) => row.characterId === REACTOR_ID)
    if (!play) throw new Error('Missing room Character play state.')
    return (
      readCharacterPlay(play).resourceUsage.find(
        ({ owner }) =>
          owner.kind === 'AUTHORED_GRANT' && owner.resourceGrantId === inspirationGrantId
      )?.used ?? 0
    )
  })

async function reactionUsed(room: Room) {
  const row = (await readRoomHistory(room.room.base.stub)).actors.find(
    ({ id }) => id === REACTOR_ACTOR_ID
  )
  if (!row) throw new Error('The room holds no reactor.')
  return encounterRuleUsageUsed(readStoredRunActor(row), DND5E_REACTION_ALLOWANCE_DEFINITION_ID)
}

const targetHitPoints = async (room: Room) =>
  readActorHitPoints(await readRoomHistory(room.room.base.stub), TARGET_ID)

async function undoLastAction(room: Room) {
  const undone = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
}

describe('Cutting Words against an attack roll in the room (SPELLS-31.T4c3b1)', () => {
  it('asks the Lore Bard, not the attacker, once the attack is rolled, spending nothing yet', async () => {
    const room = await reactorRoom('LORE_BARD')
    const { pending } = await openWindow(room)
    expect(pending).toMatchObject({
      rollerActorId: REACTOR_ACTOR_ID,
      d20: { selectedNatural: 10 },
      options: [{ label: 'Cutting Words', count: 1, faces: 6, sign: 'SUBTRACT' }]
    })
    expect(await inspirationUsed(room)).toBe(0)
    expect(await reactionUsed(room)).toBe(0)
  })

  it('takes the die off the roll, so the Bite misses; the reaction and inspiration are spent, and one undo restores them', async () => {
    const room = await reactorRoom('LORE_BARD')
    const before = await readRoomHistory(room.room.base.stub)
    const hitPoints = await targetHitPoints(room)
    const { decision, pending } = await openWindow(room)
    const used = await room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: pending.options[0]!.optionId,
      faces: [3]
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await targetHitPoints(room)).toBe(hitPoints)
    expect(await inspirationUsed(room)).toBe(1)
    expect(await reactionUsed(room)).toBe(1)

    await undoLastAction(room)
    expect(await inspirationUsed(room)).toBe(0)
    expect(await reactionUsed(room)).toBe(0)
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  })

  it('lets the Bite hit when the Bard declines, spending neither', async () => {
    const room = await reactorRoom('LORE_BARD')
    const hitPoints = await targetHitPoints(room)
    const { decision, pending } = await openWindow(room)
    const declined = await room.resolve(decision, {
      kind: 'D20_WINDOW_DECLINE',
      requestId: pending.requestId
    })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await targetHitPoints(room)).toBeLessThan(hitPoints)
    expect(await inspirationUsed(room)).toBe(0)
    expect(await reactionUsed(room)).toBe(0)
  })

  it('never pauses for a Bard with no Bardic Inspiration left', async () => {
    const room = await reactorRoom('LORE_BARD', 1)
    await rollAttack(room)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await reactionUsed(room)).toBe(0)
  })

  it('takes a homebrew free reaction’s d4 the same way, spending only the reaction', async () => {
    const room = await reactorRoom('HECKLER')
    const hitPoints = await targetHitPoints(room)
    const { decision, pending } = await openWindow(room)
    expect(pending).toMatchObject({
      rollerActorId: REACTOR_ACTOR_ID,
      options: [{ label: 'Heckle', count: 1, faces: 4, sign: 'SUBTRACT' }]
    })
    const used = await room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: pending.options[0]!.optionId,
      faces: [2]
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await targetHitPoints(room)).toBe(hitPoints)
    expect(await reactionUsed(room)).toBe(1)
  })
})
