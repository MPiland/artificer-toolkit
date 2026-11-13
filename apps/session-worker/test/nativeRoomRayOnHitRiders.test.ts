import { runInDurableObject } from 'cloudflare:test'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  OPTIONAL_POOL_STRIKE_CHARGE_ID,
  optionalPoolStrike,
  optionalSmite
} from '@artificer-toolkit/rules-runtime/testing/optionalSmite'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import {
  type EncounterAreaActionPendingContextDto,
  serverAggregateChoicePendingSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { eldritchBlast } from '@artificer-toolkit/source-data/srd/spells/eldritch-blast.js'
import { scorchingRay } from '@artificer-toolkit/source-data/srd/spells/scorching-ray.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-13.T1c4: each ray of a list that hits offers its caster the optional on-hit riders an attack
 * at one creature offers (D123), held on that ray alone. The cast settles one slot and one pool, so a
 * rider that spends either is not offered again once an earlier ray of the list chose such a one.
 * The riders are homebrew Features built from core options that ride a ranged spell attack; the
 * spells are the SRD's.
 */

const CASTER_ACTOR_ID = testUuid(0x9c0)
const CASTER_ID = testUuid(0x9c1)
const WOLF_ID = testUuid(0x9c2)
const REACTOR_ACTOR_ID = testUuid(0x9c3)
const REACTOR_ID = testUuid(0x9c4)
const WOLF_HIT_POINTS = 40
const REACTOR_HIT_POINTS = 8
/** Natural d20 faces: a hit that is no critical hit, and a miss. */
const HIT = 19
const MISS = 1
// Every damage die shows 1: a beam's 1d10 or a ray's 2d6, the smite's 2d8 for a 1st-level slot and
// the pool strike's 2d6.
const LOWEST_FACE = 0
const BEAM_DAMAGE = 1
const SCORCHING_RAY_DAMAGE = 2
const SMITE_DAMAGE = 2
const POOL_DAMAGE = 2
const POOL_COST = 2
const FIRST_LEVEL_SLOT = [{ slotKey: 'STANDARD:1', used: 1 }]

const riders = [
  optionalSmite('RANGED_SPELL_ATTACK'),
  optionalPoolStrike({
    maximum: 3,
    cost: POOL_COST,
    diceConfig: '2d6',
    damageTypeCode: 'COLD',
    triggerCode: 'RANGED_SPELL_ATTACK'
  })
]

afterEach(() => {
  closeTrackedSockets()
})

/** A Caster of `classLevel` who knows `spell` and carries both riders, beside a Wolf. */
function casterRoom(options: { spell: SpellAuthored; label: string; classLevel: number }) {
  return actionRoom({
    actors: [
      characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
      srdCreatureActor({
        id: WOLF_ID,
        creature: { ...plainWolf, hitPoints: WOLF_HIT_POINTS },
        currentHitPoints: WOLF_HIT_POINTS
      })
    ],
    characterSpellcasting: { spells: [options.spell], prepared: [options.spell.id] },
    characterPlay: { currentHitPoints: 5, classLevel: options.classLevel },
    characterClassFeatures: riders,
    characterAction: (action) => action.label === options.label,
    rolls: [],
    fallbackRoll: LOWEST_FACE
  })
}
type Room = Awaited<ReturnType<typeof actionRoom>>

/** Eldritch Blast: two beams at 5th level, three at 11th. It spends no slot of its own. */
const blastRoom = (classLevel: 5 | 11) =>
  casterRoom({ spell: eldritchBlast, label: 'Eldritch Blast', classLevel })

const readPlay = (room: Room, characterId: string) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === characterId)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row)
  })
const slotsOf = async (room: Room, characterId = CASTER_ID) =>
  (await readPlay(room, characterId)).spellSlots ?? []
/** The Caster's recorded uses of the pool the homebrew strike spends. */
const poolUsed = async (room: Room) =>
  ((await readPlay(room, CASTER_ID)).resourceUsage ?? [])
    .filter(
      ({ owner }) =>
        owner.kind === 'AUTHORED_SOURCE' && owner.chargeId === OPTIONAL_POOL_STRIKE_CHARGE_ID
    )
    .map(({ used }) => used)
const wolfHitPoints = async (room: Room) =>
  vitalsOf(await readRoomHistory(room.room.base.stub)).find(({ id }) => id === WOLF_ID)
    ?.currentHitPoints

async function cast(room: Room, targets: readonly string[]) {
  const { answer } = await room.startActorsAction(targets, [], true)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The one pending ray, answered with a natural d20 face; the answer must commit. */
async function answerRoll(room: Room, face: number) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'AREA_SAVES')
    throw new Error(`Expected the pending rolls, got ${decision.pending.kind}.`)
  const [roll] = decision.pending.saves
  if (!roll) throw new Error('No roll is pending.')
  const answer = await room.send(
    room.resolveCommand(decision, {
      kind: 'ENTER_DICE',
      requestId: roll.request.requestId,
      rawFaces: [face],
      rollMode: roll.request.rollMode
    })
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The on-hit choice the room asks of the Caster. */
async function offered(room: Room) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'ON_HIT_CHOICE')
    throw new Error(`Expected the on-hit choice, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}
type Offer = Awaited<ReturnType<typeof offered>>
type Option = Offer['pending']['options'][number]

const optionKinds = ({ pending }: Offer) => [...new Set(pending.options.map(({ kind }) => kind))]
const firstLevelSlot = (option: Option) => option.kind === 'SPELL_SLOT' && option.slotLevel === 1
const pool = (option: Option) => option.kind === 'RESOURCE_POOL'

async function use(room: Room, { decision, pending }: Offer, pick: (option: Option) => boolean) {
  const option = pending.options.find(pick)
  if (!option) throw new Error(`No such rider is offered: ${JSON.stringify(pending.options)}.`)
  const used = await room.resolve(decision, { kind: 'OPTION', optionId: option.optionId })
  expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
}

async function decline(room: Room, { decision }: Pick<Offer, 'decision'>) {
  const declined = await room.resolve(decision, { kind: 'DECLINE' })
  expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
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

describe('a ray that hits offers its caster the on-hit riders (QUALITY-13.T1c4, D219)', () => {
  it('holds the ray that hit on its caster’s choice, applying and spending nothing', async () => {
    const room = await blastRoom(5)
    await cast(room, [WOLF_ID, WOLF_ID])
    await answerRoll(room, HIT)

    const offer = await offered(room)
    expect(offer.pending.attackerActorId).toBe(CASTER_ACTOR_ID)
    expect(offer.pending.allowedResponses).toEqual(['DECLINE', 'OPTION'])
    expect(optionKinds(offer).sort()).toEqual(['RESOURCE_POOL', 'SPELL_SLOT'])
    expect(offer.pending.options.filter(pool)).toMatchObject([{ cost: POOL_COST }])
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS)
    expect(await slotsOf(room)).toEqual([])
    expect(await poolUsed(room)).toEqual([])
  }, 120000)

  it('offers nothing at a ray that misses, and asks the next ray', async () => {
    const room = await blastRoom(5)
    await cast(room, [WOLF_ID, WOLF_ID])
    await answerRoll(room, MISS)

    const decision = await room.pendingDecision()
    expect(decision.pending.kind).toBe('AREA_SAVES')
  }, 120000)

  it('offers no slot once a ray paid one and no pool once a ray paid it, and settles one of each with the cast', async () => {
    const room = await blastRoom(11)
    const before = await readRoomHistory(room.room.base.stub)
    await cast(room, [WOLF_ID, WOLF_ID, WOLF_ID])

    // The first beam pays a slot: nothing is spent until the cast commits.
    await answerRoll(room, HIT)
    await use(room, await offered(room), firstLevelSlot)
    expect(await slotsOf(room)).toEqual([])
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS)

    // The second beam offers the pool alone, and pays it.
    await answerRoll(room, HIT)
    const second = await offered(room)
    expect(optionKinds(second)).toEqual(['RESOURCE_POOL'])
    await use(room, second, pool)

    // The third beam has no rider left to offer: its hit ends the cast.
    await answerRoll(room, HIT)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await wolfHitPoints(room)).toBe(
      WOLF_HIT_POINTS - 3 * BEAM_DAMAGE - SMITE_DAMAGE - POOL_DAMAGE
    )
    expect(await slotsOf(room)).toEqual(FIRST_LEVEL_SLOT)
    expect(await poolUsed(room)).toEqual([POOL_COST])

    await undoLastAction(room)
    expect(await slotsOf(room)).toEqual([])
    expect(await poolUsed(room)).toEqual([0])
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  }, 120000)

  it('still offers the slot at a later ray once the pool is paid', async () => {
    const room = await blastRoom(5)
    await cast(room, [WOLF_ID, WOLF_ID])
    await answerRoll(room, HIT)
    await use(room, await offered(room), pool)

    await answerRoll(room, HIT)
    const second = await offered(room)
    expect(optionKinds(second)).toEqual(['SPELL_SLOT'])
    await decline(room, second)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS - 2 * BEAM_DAMAGE - POOL_DAMAGE)
    expect(await slotsOf(room)).toEqual([])
    expect(await poolUsed(room)).toEqual([POOL_COST])
  }, 120000)

  it('offers every rider again at the next ray when declined, spending nothing', async () => {
    const room = await blastRoom(5)
    await cast(room, [WOLF_ID, WOLF_ID])
    await answerRoll(room, HIT)
    await decline(room, await offered(room))

    await answerRoll(room, HIT)
    const second = await offered(room)
    expect(optionKinds(second).sort()).toEqual(['RESOURCE_POOL', 'SPELL_SLOT'])
    await decline(room, second)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS - 2 * BEAM_DAMAGE)
    expect(await slotsOf(room)).toEqual([])
    expect(await poolUsed(room)).toEqual([])
  }, 120000)

  it('offers a cast that spends its own slot the pool alone, once', async () => {
    const room = await casterRoom({
      spell: scorchingRay,
      label: 'Scorching Ray (2nd level)',
      classLevel: 5
    })
    await cast(room, [WOLF_ID, WOLF_ID, WOLF_ID])

    await answerRoll(room, HIT)
    const first = await offered(room)
    expect(optionKinds(first)).toEqual(['RESOURCE_POOL'])
    await use(room, first, pool)

    // The pool is paid, and the cast's own slot leaves no slot rider: the later rays offer nothing.
    await answerRoll(room, HIT)
    await answerRoll(room, HIT)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await wolfHitPoints(room)).toBe(WOLF_HIT_POINTS - 3 * SCORCHING_RAY_DAMAGE - POOL_DAMAGE)
    expect(await slotsOf(room)).toEqual([{ slotKey: 'STANDARD:2', used: 1 }])
    expect(await poolUsed(room)).toEqual([POOL_COST])
  }, 120000)

  it('keeps a ray’s rider decision honest: only on the answered ray, on its own hit, from its own offer', async () => {
    const room = await blastRoom(5)
    await cast(room, [WOLF_ID, WOLF_ID])
    await answerRoll(room, HIT)
    await use(room, await offered(room), firstLevelSlot)

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
    const kept = (targets: Targets) => {
      const onHit = targets[0]?.onHit
      if (!onHit) throw new Error('The answered ray keeps no rider decision.')
      return onHit
    }

    expect({
      intact: accepts((targets) => expect(kept(targets).selection).toBe('USE')),
      anotherHit: accepts((targets) => {
        kept(targets).testExecutionChecksum = 'a'.repeat(64)
      }),
      unansweredRay: accepts((targets) => {
        targets[1]!.onHit = kept(targets)
      }),
      optionNotOffered: accepts((targets) => {
        const onHit = kept(targets)
        if (onHit.option?.kind !== 'SPELL_SLOT') throw new Error('Expected the slot rider.')
        onHit.option.slotLevel = 9
      })
    }).toEqual({
      intact: true,
      anotherHit: false,
      unansweredRay: false,
      optionNotOffered: false
    })
  }, 120000)

  it('leaves the Run as before the cast when the GM voids it with a ray held on its rider', async () => {
    const room = await blastRoom(5)
    const before = await readRoomHistory(room.room.base.stub)
    await cast(room, [WOLF_ID, WOLF_ID])
    await answerRoll(room, HIT)
    await use(room, await offered(room), firstLevelSlot)
    await answerRoll(room, HIT)
    const { decision } = await offered(room)

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
    expect(await slotsOf(room)).toEqual([])
    expect(await poolUsed(room)).toEqual([])
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  }, 120000)
})

describe('a ray’s hit asks its creature’s reaction before its caster’s rider (QUALITY-13.T1c4)', () => {
  // A natural face that hits the Character's Armor Class as it stands and misses it five higher.
  const NARROW_HIT = 12
  /** The Caster beside a Character who holds the SRD Shield, a cell apart and out of reach. */
  const reactorRoom = () =>
    actionRoom({
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
        characterActor({ id: REACTOR_ACTOR_ID, characterId: REACTOR_ID })
      ],
      characterSpellcasting: { spells: [eldritchBlast], prepared: [eldritchBlast.id] },
      characterPlay: { currentHitPoints: 5, classLevel: 5 },
      characterClassFeatures: riders,
      secondCharacter: {
        characterId: REACTOR_ID,
        play: { currentHitPoints: REACTOR_HIT_POINTS },
        spellcasting: { spells: [shield], prepared: [shield.id] }
      },
      characterAction: (action) => action.label === 'Eldritch Blast',
      rolls: [],
      fallbackRoll: LOWEST_FACE
    })
  const reactorHitPoints = async (room: Room) =>
    (await readPlay(room, REACTOR_ID)).hitpoints.current
  async function reaction(room: Room) {
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'REACTION_CHOICE')
      throw new Error(`Expected the reaction choice, got ${decision.pending.kind}.`)
    return { decision, pending: decision.pending }
  }

  it('offers the rider on the hit a declined reaction leaves', async () => {
    const room = await reactorRoom()
    await cast(room, [REACTOR_ACTOR_ID, REACTOR_ACTOR_ID])
    await answerRoll(room, NARROW_HIT)
    await decline(room, await reaction(room))

    await use(room, await offered(room), pool)
    await answerRoll(room, MISS)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await reactorHitPoints(room)).toBe(REACTOR_HIT_POINTS - BEAM_DAMAGE - POOL_DAMAGE)
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect(await poolUsed(room)).toEqual([POOL_COST])
  }, 120000)

  it('offers no rider on the hit a used reaction turns into a miss', async () => {
    const room = await reactorRoom()
    await cast(room, [REACTOR_ACTOR_ID, REACTOR_ACTOR_ID])
    await answerRoll(room, NARROW_HIT)
    const { decision, pending } = await reaction(room)
    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0]!.optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    // The reaction ran as the Character's own action; the cast went on to its second beam.
    await answerRoll(room, MISS)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await reactorHitPoints(room)).toBe(REACTOR_HIT_POINTS)
    expect(await slotsOf(room, REACTOR_ID)).toEqual(FIRST_LEVEL_SLOT)
    expect(await poolUsed(room)).toEqual([])
  }, 120000)
})
