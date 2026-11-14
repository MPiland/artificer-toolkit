import { runInDurableObject } from 'cloudflare:test'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { DND5E_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  OPTIONAL_POOL_STRIKE_CHARGE_ID,
  optionalPoolStrike
} from '@artificer-toolkit/rules-runtime/testing/optionalSmite'
import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import {
  type EncounterAreaActionPendingContextDto,
  serverAggregateChoicePendingSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { bard } from '@artificer-toolkit/source-data/srd/classes/bard.js'
import { collegeOfLore } from '@artificer-toolkit/source-data/srd/classes/college-of-lore.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { shieldWood } from '@artificer-toolkit/source-data/srd/equipment/shield-wood.js'
import { eldritchBlast } from '@artificer-toolkit/source-data/srd/spells/eldritch-blast.js'
import { scorchingRay } from '@artificer-toolkit/source-data/srd/spells/scorching-ray.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { expireReactionOffer } from './reactionTimeoutClock.js'
import {
  readActorHitPoints,
  readPendingActionDecision,
  readPendingApplicationContext,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * QUALITY-13.T1c3b: each ray of a chosen list is one attack, so a creature that may answer an attack
 * aimed at another (D217) is asked before each ray's d20, as it is before a single attack's. Used, the
 * reaction runs as its holder's own action under the cast (D219) and the ray is rolled with the roll
 * mode it authors; a reaction spent at one ray is not offered at the next, and the cast's one undo
 * restores it. The engine knows no feature: the SRD Protection is the source.
 */

const CASTER_ACTOR_ID = testUuid(0x9d0)
const CASTER_ID = testUuid(0x9d1)
const WOLF_ID = testUuid(0x9d2)
const NEAR_ACTOR_ID = testUuid(0x9d3)
const NEAR_ID = testUuid(0x9d4)
const FAR_ACTOR_ID = testUuid(0x9d5)
const FAR_ID = testUuid(0x9d6)
const WOLF_HIT_POINTS = 20
// The first of a ray's 2d6 twice over: a raw die is its face less one.
const RAY_DAMAGE = 1 + 2
const TWO_RAYS = [WOLF_ID, WOLF_ID]
/** Natural d20 faces: a hit that is no critical hit, and a miss. */
const HIT = 19
const MISS = 2

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const protectionOption = fighter.features
  ?.find(({ label }) => label === 'Fighting Style')
  ?.options?.find(({ label }) => label === 'Protection')
if (!protectionOption?.effects) throw new Error('The SRD Fighter has no Protection.')

/** The SRD option as a Character's Feature, exactly as authored. */
const protection: ClassFeature = {
  id: protectionOption.id,
  label: protectionOption.label,
  description: protectionOption.description,
  availableAtLevel: 1,
  order: 1,
  effects: protectionOption.effects
}
const protector = { classFeatures: [protection], equipment: [shieldWood] }

/**
 * A Caster with Scorching Ray, a Wolf 15 feet from it, and beside the Wolf one Character with
 * Protection and a shield, or two when `reactors` is 2 (each 100 px is 5 feet).
 */
function protectorRoom(reactors: 1 | 2 = 1) {
  return actionRoom({
    actors: [
      characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
      srdCreatureActor({
        id: WOLF_ID,
        creature: { ...plainWolf, hitPoints: WOLF_HIT_POINTS },
        currentHitPoints: WOLF_HIT_POINTS
      }),
      characterActor({ id: NEAR_ACTOR_ID, characterId: NEAR_ID }),
      ...(reactors === 2 ? [characterActor({ id: FAR_ACTOR_ID, characterId: FAR_ID })] : [])
    ],
    positions: {
      [CASTER_ACTOR_ID]: { x: 150, y: 150 },
      [WOLF_ID]: { x: 450, y: 150 },
      [NEAR_ACTOR_ID]: { x: 350, y: 150 },
      ...(reactors === 2 && { [FAR_ACTOR_ID]: { x: 550, y: 150 } })
    },
    characterSpellcasting: { spells: [scorchingRay], prepared: [scorchingRay.id] },
    secondCharacter: { characterId: NEAR_ID, ...protector },
    ...(reactors === 2 && { thirdCharacter: { characterId: FAR_ID, ...protector } }),
    characterAction: (action) => action.label === 'Scorching Ray (2nd level)',
    rolls: [0, 1, 0, 1],
    fallbackRoll: 5
  })
}
type Room = Awaited<ReturnType<typeof actionRoom>>

async function reactionUsed(room: Room, actorId = NEAR_ACTOR_ID) {
  const row = (await readRoomHistory(room.room.base.stub)).actors.find(({ id }) => id === actorId)
  if (!row) throw new Error('The room holds no such reactor.')
  return encounterRuleUsageUsed(readStoredRunActor(row), DND5E_REACTION_ALLOWANCE_DEFINITION_ID)
}

const wolfHitPoints = async (room: Room) =>
  readActorHitPoints(await readRoomHistory(room.room.base.stub), WOLF_ID)

async function cast(room: Room, targets: readonly string[] = TWO_RAYS) {
  const { answer } = await room.startActorsAction(targets, [], true)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The one ray now asked for its d20. */
async function askedRay(room: Room) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'AREA_SAVES')
    throw new Error(`Expected the pending rolls, got ${decision.pending.kind}.`)
  expect(decision.pending.saves).toHaveLength(1)
  return { decision, request: decision.pending.saves[0]!.request }
}

/** The ray now asked is rolled with these natural faces; the answer must commit. */
async function rollRay(room: Room, rawFaces: readonly number[]) {
  const { decision, request } = await askedRay(room)
  const answer = await room.send(
    room.resolveCommand(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [...rawFaces],
      rollMode: request.rollMode
    })
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The reaction choice the room now asks. */
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

async function use(room: Room) {
  const { decision, pending } = await offered(room)
  expect(pending.options).toHaveLength(1)
  const used = await room.resolve(decision, {
    kind: 'OPTION',
    optionId: pending.options[0]!.optionId
  })
  expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
}

/** The pending list's rays, each with its own sealed attack. */
async function rays(room: Room) {
  const context = await readPendingApplicationContext(room.room.base.stub)
  if (context.kind !== 'ENCOUNTER_AREA_ACTION') throw new Error('Expected the pending ray list.')
  return context.targets.map((target) => {
    const inner = target.snapshot.applicationContext
    if (inner.kind !== 'ENCOUNTER_ACTION') throw new Error('Expected a ray’s attack.')
    return { target, inner }
  })
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

describe('a bystander answers each ray’s aim before its d20 (QUALITY-13.T1c3b, D217, D219)', () => {
  it('holds the first ray, unrolled, on the Character’s choice in the shared reaction pause, spending nothing', async () => {
    const room = await protectorRoom()
    await cast(room)

    const { pending } = await offered(room)
    expect(pending.targetActorId).toBe(NEAR_ACTOR_ID)
    expect(pending.allowedResponses).toEqual(['DECLINE', 'OPTION'])
    expect(pending.options).toHaveLength(1)
    const [first, second] = await rays(room)
    if (first?.inner.pause?.kind !== 'CAST_REACTION')
      throw new Error('Expected the shared reaction pause on the first ray.')
    expect(first.inner.pause.payload.kind).toBe('ATTACK_ON_OTHER')
    expect(first.inner.pause.payload.reactions).toMatchObject([
      { reactorActorId: NEAR_ACTOR_ID, trigger: 'ATTACK_ON_OTHER' }
    ])
    expect(first.inner.rollerActorId).toBe(NEAR_ACTOR_ID)
    expect(first.target.testedJson).toBeUndefined()
    expect(second?.inner.pause).toBeUndefined()
    expect(await reactionUsed(room)).toBe(0)
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS)
  }, 120000)

  it('rolls the ray with disadvantage when used, so the lower face misses; the next ray has no second offer, and one undo restores the reaction', async () => {
    const room = await protectorRoom()
    const before = await readRoomHistory(room.room.base.stub)
    await cast(room)
    await use(room)

    // The reaction committed as the Character's own action under the cast, and is spent by it alone.
    expect(await reactionUsed(room)).toBe(1)
    const { children } = await committedActions(room)
    expect(children).toHaveLength(1)
    expect(children[0]).toMatchObject({
      actorId: NEAR_ACTOR_ID,
      systemTrigger: { trigger: 'REACTION' }
    })
    const [first] = await rays(room)
    expect(first?.inner.reactionChildren).toEqual([
      {
        commandId: children[0]!.commandId,
        resumeOutcome: { kind: 'ROLL_MODE', rollMode: 'DISADVANTAGE' }
      }
    ])
    expect((await askedRay(room)).request.rollMode).toBe('DISADVANTAGE')
    await rollRay(room, [HIT, MISS])

    // The second ray is asked as it was: the reaction is spent, so nobody is heard before it.
    expect((await askedRay(room)).request.rollMode).toBe('NORMAL')
    await rollRay(room, [HIT])
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS - RAY_DAMAGE)
    expect(await reactionUsed(room)).toBe(1)
    const committed = await committedActions(room)
    expect(committed.root).not.toBeNull()
    expect(committed.children.map(({ systemTrigger }) => systemTrigger?.parentCommandId)).toEqual([
      committed.root?.commandId
    ])

    await undoLastAction(room)
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS)
    expect(await reactionUsed(room)).toBe(0)
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  }, 120000)

  it('rolls a declined ray as it was and asks again at the next ray, where the reaction is used', async () => {
    const room = await protectorRoom()
    await cast(room)
    await decline(room)
    expect((await askedRay(room)).request.rollMode).toBe('NORMAL')
    await rollRay(room, [HIT])
    expect(await reactionUsed(room)).toBe(0)

    await use(room)
    expect((await askedRay(room)).request.rollMode).toBe('DISADVANTAGE')
    await rollRay(room, [HIT, MISS])

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS - RAY_DAMAGE)
    expect(await reactionUsed(room)).toBe(1)
    expect((await committedActions(room)).children).toHaveLength(1)
  }, 120000)

  it('runs both rays as they were when the Character declines at each, spending nothing', async () => {
    const room = await protectorRoom()
    await cast(room)
    for (const _ray of TWO_RAYS) {
      await decline(room)
      expect((await askedRay(room)).request.rollMode).toBe('NORMAL')
      await rollRay(room, [HIT])
    }

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS - 2 * RAY_DAMAGE)
    expect(await reactionUsed(room)).toBe(0)
    expect((await committedActions(room)).children).toEqual([])
  }, 120000)

  it('hears two Characters in turn on one ray: the second is asked once the first declines, and the one left is asked at the next ray', async () => {
    const room = await protectorRoom(2)
    await cast(room)

    const first = (await offered(room)).pending.targetActorId
    expect([NEAR_ACTOR_ID, FAR_ACTOR_ID]).toContain(first)
    const other = first === NEAR_ACTOR_ID ? FAR_ACTOR_ID : NEAR_ACTOR_ID
    await decline(room)

    // Still before the first ray's d20: the other Character is heard on the same ray.
    expect((await offered(room)).pending.targetActorId).toBe(other)
    expect((await rays(room))[0]?.target.testedJson).toBeUndefined()
    await use(room)
    expect(await reactionUsed(room, other)).toBe(1)
    expect(await reactionUsed(room, first)).toBe(0)
    expect((await askedRay(room)).request.rollMode).toBe('DISADVANTAGE')
    await rollRay(room, [HIT, MISS])

    // The second ray asks only the Character whose reaction is left.
    const again = await offered(room)
    expect(again.pending.targetActorId).toBe(first)
    await use(room)
    expect((await askedRay(room)).request.rollMode).toBe('DISADVANTAGE')
    await rollRay(room, [MISS, HIT])

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS)
    expect(await reactionUsed(room, first)).toBe(1)
    const { root, children } = await committedActions(room)
    expect(children.map(({ actorId }) => actorId)).toEqual([other, first])
    expect(new Set(children.map(({ systemTrigger }) => systemTrigger?.parentCommandId))).toEqual(
      new Set([root?.commandId])
    )
  }, 120000)

  it('declines the offer once its time runs out, so the ray is rolled as it was (D207)', async () => {
    const room = await protectorRoom()
    await cast(room)
    await offered(room)

    await expireReactionOffer(room.room.base.stub)
    expect((await askedRay(room)).request.rollMode).toBe('NORMAL')
    expect(await reactionUsed(room)).toBe(0)
  }, 120000)

  it('never holds a ray aimed at the Character itself', async () => {
    const room = await protectorRoom()
    await cast(room, [NEAR_ACTOR_ID, NEAR_ACTOR_ID])
    expect((await askedRay(room)).request.rollMode).toBe('NORMAL')
  }, 120000)

  it('keeps a held aim honest: only the creature its offer asks may hold an unrolled ray', async () => {
    const room = await protectorRoom()
    await cast(room)
    await offered(room)

    const snapshot = await runInDurableObject(room.room.base.stub, async (_instance, context) => {
      const store = new RoomEncounterStore(context.storage)
      const occurrence = store
        .documents('encounterRuleOccurrences')
        .find((candidate) => candidate.state === 'PENDING')
      if (!occurrence) throw new Error('No list is pending.')
      return readPendingSnapshot({ db: store.store }, occurrence)
    })
    type Targets = EncounterAreaActionPendingContextDto['targets']
    const accepts = (mutate: (targets: Targets) => void) => {
      const copy = structuredClone(snapshot)
      if (copy?.applicationContext.kind !== 'ENCOUNTER_AREA_ACTION')
        throw new Error('Expected the pending list.')
      mutate(copy.applicationContext.targets)
      return serverAggregateChoicePendingSnapshotDtoSchema.safeParse(copy).success
    }
    const held = (targets: Targets) => {
      const inner = targets[0]?.snapshot.applicationContext
      if (inner?.kind !== 'ENCOUNTER_ACTION') throw new Error('Expected a ray’s attack.')
      return inner
    }

    expect({
      intact: accepts(() => undefined),
      noOffer: accepts((targets) => {
        delete held(targets).pause
      })
    }).toEqual({ intact: true, noOffer: false })
  }, 120000)

  it('leaves the Run as before the cast when the GM voids it after a ray’s reaction ran', async () => {
    const room = await protectorRoom()
    const before = await readRoomHistory(room.room.base.stub)
    await cast(room)
    await use(room)
    const { decision } = await askedRay(room)

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
    expect(await reactionUsed(room)).toBe(0)
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  }, 120000)
})

describe('one ray hears its aim, its roll, its hit and its caster’s rider in order (QUALITY-13.T1c3b)', () => {
  const TARGET_ACTOR_ID = testUuid(0x9d7)
  const TARGET_ID = testUuid(0x9d8)
  const BARD_ACTOR_ID = testUuid(0x9d9)
  const BARD_ID = testUuid(0x9da)
  const TARGET_HIT_POINTS = 8
  const BEAM_DAMAGE = 1
  const POOL_DAMAGE = 2
  const POOL_COST = 2
  const TWO_BEAMS = [TARGET_ACTOR_ID, TARGET_ACTOR_ID]
  const loreCuttingWords = {
    ...collegeOfLore,
    features: [srdByLabel(collegeOfLore.features ?? [], 'Cutting Words')]
  }

  /**
   * A Caster with Eldritch Blast (two beams) and a homebrew on-hit pool rider; 15 feet from it a
   * Character who holds the SRD Shield; and beside that Character a Lore Bard who holds the SRD
   * Cutting Words and, with a shield, the SRD Protection.
   */
  const chainRoom = () =>
    actionRoom({
      actors: [
        characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        characterActor({ id: TARGET_ACTOR_ID, characterId: TARGET_ID }),
        characterActor({ id: BARD_ACTOR_ID, characterId: BARD_ID })
      ],
      positions: {
        [CASTER_ACTOR_ID]: { x: 150, y: 150 },
        [TARGET_ACTOR_ID]: { x: 450, y: 150 },
        [BARD_ACTOR_ID]: { x: 550, y: 150 }
      },
      characterSpellcasting: { spells: [eldritchBlast], prepared: [eldritchBlast.id] },
      characterPlay: { currentHitPoints: 5, classLevel: 5 },
      characterClassFeatures: [
        optionalPoolStrike({
          maximum: 3,
          cost: POOL_COST,
          diceConfig: '2d6',
          damageTypeCode: 'COLD',
          triggerCode: 'RANGED_SPELL_ATTACK'
        })
      ],
      secondCharacter: {
        characterId: TARGET_ID,
        play: { currentHitPoints: TARGET_HIT_POINTS },
        spellcasting: { spells: [shield], prepared: [shield.id] }
      },
      thirdCharacter: {
        characterId: BARD_ID,
        play: { characterClass: bard, characterSubclass: loreCuttingWords, classLevel: 3 },
        ...protector
      },
      characterAction: (action) => action.label === 'Eldritch Blast',
      rolls: [],
      fallbackRoll: 0
    })

  const readPlay = (room: Room, characterId: string) =>
    runInDurableObject(room.room.base.stub, (_instance, context) => {
      const row = new RoomEncounterStore(context.storage)
        .documents('characterPlayStates')
        .find((candidate) => candidate.characterId === characterId)
      if (!row) throw new Error('Missing room Character play state.')
      return readCharacterPlay(row)
    })
  const targetHitPoints = async (room: Room) => (await readPlay(room, TARGET_ID)).hitpoints.current
  const poolUsed = async (room: Room) =>
    ((await readPlay(room, CASTER_ID)).resourceUsage ?? [])
      .filter(
        ({ owner }) =>
          owner.kind === 'AUTHORED_SOURCE' && owner.chargeId === OPTIONAL_POOL_STRIKE_CHARGE_ID
      )
      .map(({ used }) => used)

  /** The Caster pays the pool rider its hit offers. */
  async function payPool(room: Room) {
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'ON_HIT_CHOICE')
      throw new Error(`Expected the on-hit choice, got ${decision.pending.kind}.`)
    expect(decision.pending.attackerActorId).toBe(CASTER_ACTOR_ID)
    const option = decision.pending.options.find(({ kind }) => kind === 'RESOURCE_POOL')
    if (!option) throw new Error('The pool rider is not offered.')
    const used = await room.resolve(decision, { kind: 'OPTION', optionId: option.optionId })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
  }

  it('rolls a beam with the disadvantage a bystander gave it, then asks its creature’s reaction, then its caster’s rider', async () => {
    const room = await chainRoom()
    await cast(room, TWO_BEAMS)

    // Before the d20: the Bard's Protection, used.
    expect((await offered(room)).pending.targetActorId).toBe(BARD_ACTOR_ID)
    await use(room)
    expect((await askedRay(room)).request.rollMode).toBe('DISADVANTAGE')
    await rollRay(room, [HIT, HIT])

    // The hit: the Bard's reaction is spent, so the struck Character's Shield is asked next, then
    // the Caster's rider.
    expect((await offered(room)).pending.targetActorId).toBe(TARGET_ACTOR_ID)
    await decline(room)
    await payPool(room)

    // The second beam is asked as it was.
    expect((await askedRay(room)).request.rollMode).toBe('NORMAL')
    await rollRay(room, [MISS])
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await targetHitPoints(room)).toBe(TARGET_HIT_POINTS - BEAM_DAMAGE - POOL_DAMAGE)
    expect(await poolUsed(room)).toEqual([POOL_COST])
    expect(await reactionUsed(room, BARD_ACTOR_ID)).toBe(1)
    expect(await reactionUsed(room, TARGET_ACTOR_ID)).toBe(0)
  }, 120000)

  it('asks the bystander again at the rolled d20 it declined to aim against, then the creature’s reaction, then the rider', async () => {
    const room = await chainRoom()
    await cast(room, TWO_BEAMS)

    // Before the d20: the Bard's Protection, declined. The beam is rolled as it was.
    expect((await offered(room)).pending.targetActorId).toBe(BARD_ACTOR_ID)
    await decline(room)
    expect((await askedRay(room)).request.rollMode).toBe('NORMAL')
    await rollRay(room, [HIT])

    // The rolled d20: the Bard's Cutting Words, used as its own action; its lowest die leaves the hit.
    const roll = await offered(room)
    expect(roll.pending.targetActorId).toBe(BARD_ACTOR_ID)
    expect(roll.pending.attackRoll).toMatchObject({
      attackerActorId: CASTER_ACTOR_ID,
      selectedNatural: HIT
    })
    await use(room)
    const die = await room.pendingDecision()
    if (die.pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
      throw new Error(`Expected the reaction's die, got ${die.pending.kind}.`)
    const rolled = await room.resolve(die, {
      kind: 'ENTER_INTEGER',
      requestId: die.pending.request.requestId,
      value: 1
    })
    expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')

    // The hit: the struck Character's Shield, declined; then the Caster's rider.
    expect((await offered(room)).pending.targetActorId).toBe(TARGET_ACTOR_ID)
    await decline(room)
    await payPool(room)

    // The Bard's reaction is spent: the second beam is asked with nobody heard before it.
    expect((await askedRay(room)).request.rollMode).toBe('NORMAL')
    await rollRay(room, [MISS])
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await targetHitPoints(room)).toBe(TARGET_HIT_POINTS - BEAM_DAMAGE - POOL_DAMAGE)
    expect(await poolUsed(room)).toEqual([POOL_COST])
    expect(await reactionUsed(room, BARD_ACTOR_ID)).toBe(1)
    expect((await committedActions(room)).children.map(({ actorId }) => actorId)).toEqual([
      BARD_ACTOR_ID
    ])
  }, 120000)
})
