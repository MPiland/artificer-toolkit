import { runInDurableObject } from 'cloudflare:test'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { circleOfTheLand } from '@artificer-toolkit/source-data/srd/classes/circle-of-the-land.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { creatureTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readActorHitPoints,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-31.T4k2b (D156): a Druid's Nature's Sanctuary, authored as an `INCOMING_ATTACK_GATE` grant on
 * its holder, makes a beast or plant that attacks the Druid first make the Druid's Wisdom save, or lose
 * the attack. Other creatures attack as usual.
 */

const ATTACKER_ID = testUuid(0xe20)
const CHARACTER_ACTOR_ID = testUuid(0xe21)
const CHARACTER_ID = testUuid(0xe22)
const BYSTANDER_ID = testUuid(0xe23)
/** The save faces (zero-based dice; a player enters one more) that pass any Sanctuary DC and fail it. */
const SAVE_PASSES = 19
const SAVE_FAILS = 0
/** The attack d20 face the Bite adds 4 to: a hit on any armor class. */
const ATTACK_HITS = 19

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The SRD Nature's Sanctuary feature, acquired by the fixture Character at its first level. */
const naturesSanctuary = () => {
  const found = circleOfTheLand.features?.find((feature) => feature.label === "Nature's Sanctuary")
  if (!found) throw new Error("The SRD Circle of the Land must author Nature's Sanctuary.")
  return { ...found, availableAtLevel: 1 }
}

/** The same Wolf Bite, from a creature of another type. */
const humanoidBiter = () => ({ ...biteWolf('ATTACK'), creatureTypeId: creatureTypeId('HUMANOID') })

/** A hostile creature bites the Druid; a bystander is the only other creature a failed save can turn it on. */
async function sanctuaryRoom(config: {
  rolls: number[]
  creature?: ReturnType<typeof biteWolf>
  sanctuary?: boolean
}) {
  const creature = config.creature ?? biteWolf('ATTACK')
  return actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature, disposition: 'HOSTILE' }),
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: BYSTANDER_ID, creature: plainWolf, disposition: 'NEUTRAL' })
    ],
    ownerFeatureId: creatureFeature(creature, 'Bite').id,
    autoRoll: 'BOTH',
    rolls: config.rolls,
    fallbackRoll: 0,
    characterSpellcasting: { spells: [fireball], prepared: [fireball.id] },
    characterClassFeatures: config.sanctuary === false ? [] : [naturesSanctuary()]
  })
}

type SanctuaryRoom = Awaited<ReturnType<typeof sanctuaryRoom>>

function readDruidHitPoints(room: SanctuaryRoom) {
  return runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).hitpoints.current
  })
}

async function standing(room: SanctuaryRoom) {
  const history = await readRoomHistory(room.room.base.stub)
  return {
    history,
    druidHitPoints: await readDruidHitPoints(room),
    gated: history.receipts.flatMap((receipt) => {
      const execution = parseReceiptExecution(receipt)
      return receipt.commandType === 'RESOLVE_ACTION' &&
        execution.status === 'AGGREGATE_CHOICE_COMPLETE' &&
        execution.applicationOutputs.kind === 'ENCOUNTER_GATED_ACTION'
        ? [execution.applicationOutputs]
        : []
    })
  }
}

async function bite(room: SanctuaryRoom) {
  const { answer } = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

async function retargetOffer(room: SanctuaryRoom) {
  const decision = await readPendingActionDecision(room.room.base.stub)
  if (decision?.pending.kind !== 'ATTACK_RETARGET_CHOICE')
    throw new Error(`No retarget is pending (${decision?.pending.kind}).`)
  return { decision, options: decision.pending.options }
}

describe("room Nature's Sanctuary (SPELLS-31.T4k2b)", () => {
  it('lets a beast that passes the Druid’s save attack', async () => {
    const room = await sanctuaryRoom({ rolls: [SAVE_PASSES, ATTACK_HITS] })
    const before = await standing(room)

    await bite(room)

    const after = await standing(room)
    expect(after.gated).toEqual([])
    expect(after.druidHitPoints).toBe(before.druidHitPoints - 1)
  })

  it('offers a beast that fails the save a new target, and loses the attack when it declines', async () => {
    const room = await sanctuaryRoom({ rolls: [SAVE_FAILS, ATTACK_HITS] })
    const before = await standing(room)

    await bite(room)
    const { decision, options } = await retargetOffer(room)
    expect(options.map((option) => option.targetActorId)).toEqual([BYSTANDER_ID])
    const lost = await room.resolve(decision, { kind: 'DECLINE' })
    expect(lost.type, JSON.stringify(lost)).toBe('COMMAND_COMMITTED')

    const after = await standing(room)
    expect(after.druidHitPoints).toBe(before.druidHitPoints)
    const [gated] = after.gated
    expect(gated?.lost).toBe('ATTACK')
    expect(gated?.gate.holderActorId).toBe(CHARACTER_ACTOR_ID)
  })

  it('turns a failed beast on the creature it chooses', async () => {
    const room = await sanctuaryRoom({ rolls: [SAVE_FAILS, ATTACK_HITS] })
    const before = await standing(room)
    await bite(room)

    const { decision, options } = await retargetOffer(room)
    const turned = await room.resolve(decision, { kind: 'OPTION', optionId: options[0]!.optionId })
    expect(turned.type, JSON.stringify(turned)).toBe('COMMAND_COMMITTED')

    const after = await standing(room)
    expect(after.druidHitPoints).toBe(before.druidHitPoints)
    expect(readActorHitPoints(after.history, BYSTANDER_ID)).toBeLessThan(
      readActorHitPoints(before.history, BYSTANDER_ID)
    )
  })

  it('does not gate a creature that is neither a beast nor a plant', async () => {
    const room = await sanctuaryRoom({ rolls: [ATTACK_HITS], creature: humanoidBiter() })
    const before = await standing(room)

    await bite(room)

    const after = await standing(room)
    expect(after.gated).toEqual([])
    expect(after.druidHitPoints).toBe(before.druidHitPoints - 1)
  })

  it('does not gate a beast that attacks a Druid without the feature', async () => {
    const room = await sanctuaryRoom({ rolls: [ATTACK_HITS], sanctuary: false })
    const before = await standing(room)

    await bite(room)

    expect((await standing(room)).druidHitPoints).toBe(before.druidHitPoints - 1)
  })
})
