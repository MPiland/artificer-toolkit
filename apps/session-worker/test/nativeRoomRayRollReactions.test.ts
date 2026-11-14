import { runInDurableObject } from 'cloudflare:test'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { DND5E_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { bard } from '@artificer-toolkit/source-data/srd/classes/bard.js'
import { collegeOfLore } from '@artificer-toolkit/source-data/srd/classes/college-of-lore.js'
import { scorchingRay } from '@artificer-toolkit/source-data/srd/spells/scorching-ray.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  readActorHitPoints,
  readPendingActionDecision,
  readPendingApplicationContext,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * QUALITY-13.T1c3: each ray of a chosen list is one attack roll, so a creature that may answer an
 * attack roll it sees (D207) is asked at each ray's rolled d20. Used, the reaction runs as its
 * holder's own action under the cast (D219) and its die comes off the ray's kept d20; a reaction spent
 * at one ray is not offered at the next, and the cast's one undo restores every spend. The engine
 * knows no feature: the SRD Cutting Words is the source.
 */

const CASTER_ACTOR_ID = testUuid(0x9b0)
const CASTER_ID = testUuid(0x9b1)
const BARD_ACTOR_ID = testUuid(0x9b2)
const BARD_ID = testUuid(0x9b3)
const WOLF_ID = testUuid(0x9b4)
const WOLF_HIT_POINTS = 20
// The first of a ray's 2d6 twice over: a raw die is its face less one.
const RAY_DAMAGE = 1 + 2
const TWO_RAYS = [WOLF_ID, WOLF_ID]

afterEach(() => {
  closeTrackedSockets()
})

/** The College of Lore with only its SRD Cutting Words (its proficiency choice needs the Builder). */
const loreCuttingWords = {
  ...collegeOfLore,
  features: [srdByLabel(collegeOfLore.features ?? [], 'Cutting Words')]
}
const inspirationGrantId = `resource:${bard.id}:${bard.resources?.id}`

/**
 * A Caster with Scorching Ray, a level 3 Lore Bard 30 ft from it with `used` of its one Bardic
 * Inspiration spent, and a Wolf 30 ft beyond the Bard.
 */
function bystanderRoom(used = 0) {
  return actionRoom({
    sceneGrid: {
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      cellSize: 100,
      distancePerCell: 30,
      diagonalPolicy: 'EQUAL',
      unit: 'FEET'
    },
    actors: [
      characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
      characterActor({ id: BARD_ACTOR_ID, characterId: BARD_ID }),
      srdCreatureActor({
        id: WOLF_ID,
        creature: { ...plainWolf, hitPoints: WOLF_HIT_POINTS },
        currentHitPoints: WOLF_HIT_POINTS
      })
    ],
    characterSpellcasting: { spells: [scorchingRay], prepared: [scorchingRay.id] },
    secondCharacter: {
      characterId: BARD_ID,
      play: {
        characterClass: bard,
        characterSubclass: loreCuttingWords,
        classLevel: 3,
        resourceUsage: [
          { owner: { kind: 'AUTHORED_GRANT', resourceGrantId: inspirationGrantId }, used }
        ]
      }
    },
    characterAction: (action) => action.label === 'Scorching Ray (2nd level)',
    rolls: [0, 1, 0, 1],
    fallbackRoll: 5
  })
}
type Room = Awaited<ReturnType<typeof bystanderRoom>>

const inspirationUsed = (room: Room) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const play = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((row) => row.characterId === BARD_ID)
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
    ({ id }) => id === BARD_ACTOR_ID
  )
  if (!row) throw new Error('The room holds no Bard.')
  return encounterRuleUsageUsed(readStoredRunActor(row), DND5E_REACTION_ALLOWANCE_DEFINITION_ID)
}

const wolfHitPoints = async (room: Room) =>
  readActorHitPoints(await readRoomHistory(room.room.base.stub), WOLF_ID)

async function cast(room: Room) {
  const { answer } = await room.startActorsAction(TWO_RAYS, [], true)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

async function pendingRolls(room: Room) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'AREA_SAVES')
    throw new Error(`Expected the pending rolls, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

/** The natural face with which the ray now asked hits the Wolf by exactly `margin`. */
async function faceHittingBy(room: Room, margin: number) {
  const context = await readPendingApplicationContext(room.room.base.stub)
  if (context.kind !== 'ENCOUNTER_AREA_ACTION') throw new Error('Expected the pending ray list.')
  const policies = context.targets.flatMap(({ snapshot, testedJson }) => {
    const inner = snapshot.applicationContext
    return testedJson === undefined && inner.kind === 'ENCOUNTER_ACTION' && inner.d20Policy
      ? [inner.d20Policy]
      : []
  })
  const [policy] = policies
  if (!policy) throw new Error('No ray waits for its d20.')
  return policy.dc + margin - policy.modifier
}

/** The ray now asked is rolled, hitting the Wolf by exactly `margin` (0 meets its Armor Class). */
async function rollRay(room: Room, margin: number) {
  const face = await faceHittingBy(room, margin)
  const { decision, pending } = await pendingRolls(room)
  const [roll] = pending.saves
  if (!roll) throw new Error('No ray is asked.')
  const answer = await room.send(
    room.resolveCommand(decision, {
      kind: 'ENTER_DICE',
      requestId: roll.request.requestId,
      rawFaces: [face],
      rollMode: roll.request.rollMode
    })
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return face
}

/** The reaction choice the rolled ray holds for the Bard. */
async function offered(room: Room) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'REACTION_CHOICE')
    throw new Error(`Expected the reaction choice, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

async function decline(room: Room) {
  const { decision } = await offered(room)
  const declined = await room.resolve(decision, { kind: 'DECLINE' })
  expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
}

/** The Bard uses Cutting Words; its own action waits for its die, which is entered by hand. */
async function cutWith(room: Room, value: number) {
  const { decision, pending } = await offered(room)
  const used = await room.resolve(decision, {
    kind: 'OPTION',
    optionId: pending.options[0]!.optionId
  })
  expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
  const die = await room.pendingDecision()
  if (die.pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
    throw new Error(`Expected the reaction's die, got ${die.pending.kind}.`)
  expect(die.pending.request).toMatchObject({ min: 1, max: 6 })
  const rolled = await room.resolve(die, {
    kind: 'ENTER_INTEGER',
    requestId: die.pending.request.requestId,
    value
  })
  expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
}

/** The committed casts: the rays, and the reactions that ran as their children. */
async function committedActions(room: Room) {
  const actions = (await readRoomHistory(room.room.base.stub)).commands
    .filter((row) => row.commandType === 'RESOLVE_ACTION')
    .map((row) => resolveEncounterActionInputDtoSchema.parse(JSON.parse(row.commandJson)))
  return {
    children: actions.filter((command) => command.systemTrigger?.trigger === 'REACTION'),
    root: actions.find((command) => !command.systemTrigger) ?? null
  }
}

async function undoLastAction(room: Room) {
  const undone = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
}

describe('a bystander answers each ray’s attack roll, as its own action (QUALITY-13.T1c3, D219)', () => {
  it('holds the rolled ray on the Bard’s choice, showing the roll and spending nothing', async () => {
    const room = await bystanderRoom()
    await cast(room)
    const face = await rollRay(room, 1)

    const { pending } = await offered(room)
    expect(pending.targetActorId).toBe(BARD_ACTOR_ID)
    expect(pending.allowedResponses).toEqual(['DECLINE', 'OPTION'])
    expect(pending.options).toHaveLength(1)
    expect(pending.attackRoll).toMatchObject({
      attackerActorId: CASTER_ACTOR_ID,
      selectedNatural: face
    })
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS)
    expect(await inspirationUsed(room)).toBe(0)
    expect(await reactionUsed(room)).toBe(0)
  }, 120000)

  it('takes the die off the ray’s kept roll so it misses, asks the next ray with no second offer, and undoes with the cast', async () => {
    const room = await bystanderRoom()
    const before = await readRoomHistory(room.room.base.stub)
    await cast(room)
    await rollRay(room, 1)
    await cutWith(room, 3)

    // The reaction committed as the Bard's own action under the cast, which went on to its next ray.
    expect(await inspirationUsed(room)).toBe(1)
    expect(await reactionUsed(room)).toBe(1)
    expect((await pendingRolls(room)).pending.saves).toHaveLength(1)

    // The second ray hits: the Bard's reaction is spent, so nothing is offered and the cast commits.
    await rollRay(room, 1)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS - RAY_DAMAGE)
    expect(await inspirationUsed(room)).toBe(1)
    const { root, children } = await committedActions(room)
    expect(children).toHaveLength(1)
    expect(children[0]).toMatchObject({
      actorId: BARD_ACTOR_ID,
      systemTrigger: { trigger: 'REACTION', parentCommandId: root?.commandId }
    })

    await undoLastAction(room)
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS)
    expect(await inspirationUsed(room)).toBe(0)
    expect(await reactionUsed(room)).toBe(0)
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  }, 120000)

  it('keeps the ray a hit when the die taken off its roll still meets the Armor Class', async () => {
    const room = await bystanderRoom()
    await cast(room)
    await rollRay(room, 3)
    await cutWith(room, 3)

    await rollRay(room, -1)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS - RAY_DAMAGE)
  }, 120000)

  it('runs both hits when the Bard declines at each ray, spending nothing', async () => {
    const room = await bystanderRoom()
    await cast(room)
    for (const _ray of TWO_RAYS) {
      await rollRay(room, 1)
      await decline(room)
    }

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS - 2 * RAY_DAMAGE)
    expect(await inspirationUsed(room)).toBe(0)
    expect(await reactionUsed(room)).toBe(0)
    expect((await committedActions(room)).children).toEqual([])
  }, 120000)

  it('keeps the first ray’s hit when the reaction declined at it is used at the second', async () => {
    const room = await bystanderRoom()
    await cast(room)
    await rollRay(room, 1)
    await decline(room)
    await rollRay(room, 1)
    await cutWith(room, 3)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS - RAY_DAMAGE)
    expect(await inspirationUsed(room)).toBe(1)
    expect((await committedActions(room)).children).toHaveLength(1)
  }, 120000)

  it('never holds a ray for a Bard with no Bardic Inspiration left', async () => {
    const room = await bystanderRoom(1)
    await cast(room)
    await rollRay(room, 1)
    await rollRay(room, 1)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS - 2 * RAY_DAMAGE)
    expect(await reactionUsed(room)).toBe(0)
  }, 120000)

  it('leaves the Run as before the cast when the GM voids it after a ray’s reaction ran', async () => {
    const room = await bystanderRoom()
    const before = await readRoomHistory(room.room.base.stub)
    await cast(room)
    await rollRay(room, 1)
    await cutWith(room, 3)
    const { decision } = await pendingRolls(room)

    const voided = await room.send({
      type: 'VOID_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: room.room.encounterId,
      expectedVersion: await room.version(),
      occurrenceId: decision.occurrence.id,
      expectedOccurrenceVersion: decision.occurrence.version
    })
    expect(voided.type, JSON.stringify(voided)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await inspirationUsed(room)).toBe(0)
    expect(await reactionUsed(room)).toBe(0)
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  }, 120000)
})
