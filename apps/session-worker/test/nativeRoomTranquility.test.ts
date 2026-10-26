import { runInDurableObject } from 'cloudflare:test'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import {
  characterStandingEffects,
  prepareRestStandingEffects
} from '@artificer-toolkit/rules-runtime/standingEffectPlans'
import {
  evaluateSrdCharacter,
  srdFeature
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { wayOfTheOpenHand } from '@artificer-toolkit/source-data/srd/classes/way-of-the-open-hand.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { SRD_SYSTEM_ID, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-31.1: the SRD Tranquility is a standing Sanctuary. A Monk's long rest turns it on and an
 * attacker that fails the Monk's Wisdom save loses the attack; its holder's attack on an enemy ends
 * it, and the next long rest turns it back on.
 */

const HOLDER_ID = testUuid(0x5f8)
const ENEMY_ID = testUuid(0x5f9)
const BYSTANDER_ID = testUuid(0x5fa)
const MONK_ACTOR_ID = testUuid(0x5fb)
const MONK_ID = testUuid(0x5fc)
const REST_COMMAND_ID = testUuid(0x5fd)
/** The save face (zero-based dice) that fails any Tranquility DC. */
const SAVE_FAILS = 0
/** The attack d20 face the Bite adds 4 to: a hit on any armor class. */
const ATTACK_HITS = 19

const tranquility = (() => {
  const found = wayOfTheOpenHand.features?.find((feature) => feature.label === 'Tranquility')
  if (!found) throw new Error('The SRD Way of the Open Hand must author Tranquility.')
  const { availableAtLevel: _level, ...feature } = found
  return feature
})()
const [tranquilityEffect] = tranquility.effects ?? []
const weapon = biteWolf('ATTACK')
const tranquilWolf: CreatureAuthored = {
  ...weapon,
  features: [...(weapon.features ?? []), tranquility]
}

afterEach(() => {
  closeTrackedSockets()
})

/** The ward an SRD Way of the Open Hand Monk's long rest turns on, as the Sheet rest plans it. */
function monkRestWard() {
  const monk = evaluateSrdCharacter({
    classes: [{ label: 'Monk', level: 11, subclass: 'Way of the Open Hand' }],
    abilities: { WISDOM: 16 },
    features: [
      srdFeature({
        owner: 'SUBCLASS',
        classLabel: 'Monk',
        subclassLabel: 'Way of the Open Hand',
        featureLabel: 'Tranquility',
        level: 11
      })
    ]
  })
  const [ward, ...others] = prepareRestStandingEffects({
    standing: characterStandingEffects({
      sources: monk.standingEffectSources,
      gameSystemId: SRD_SYSTEM_ID,
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
    }),
    restKind: 'LONG',
    holder: {
      actorId: MONK_ACTOR_ID,
      conditionIds: [],
      effectiveSize: null,
      lifetimeScope: 'OWNER',
      hidden: false,
      held: []
    },
    origin: { characterId: MONK_ID, occurrenceId: REST_COMMAND_ID, commandId: REST_COMMAND_ID }
  })
  if (!ward || others.length) throw new Error('A Monk’s long rest must turn on one Tranquility.')
  return ward
}

/** A hostile Wolf bites the Monk, whose rested Tranquility holds; a bystander is the other target. */
function monkRoom() {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: ENEMY_ID, creature: weapon, disposition: 'HOSTILE' }),
      characterActor({ id: MONK_ACTOR_ID, characterId: MONK_ID }),
      srdCreatureActor({ id: BYSTANDER_ID, creature: plainWolf, disposition: 'NEUTRAL' })
    ],
    ownerFeatureId: creatureFeature(weapon, 'Bite').id,
    autoRoll: 'BOTH',
    rolls: [SAVE_FAILS, ATTACK_HITS],
    fallbackRoll: 0,
    characterSpellcasting: { spells: [fireball], prepared: [fireball.id] },
    seed: async ({ effects, encounterId, occurredAt }) => {
      const ward = monkRestWard()
      await effects.create({
        id: ward.id,
        // The room fixture moves a Character actor's effects onto the Character, as a live Run holds them.
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: MONK_ACTOR_ID },
        definition: ward.definition,
        lifecycle: ward.lifecycle,
        occurredAt
      })
    }
  })
}

function monkHitPoints(room: Awaited<ReturnType<typeof monkRoom>>) {
  return runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === MONK_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).hitpoints.current
  })
}

/** A Creature holds the SRD Tranquility, rests in the room, and bites a hostile Wolf. */
function tranquilRoom() {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: HOLDER_ID, creature: tranquilWolf, disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: ENEMY_ID, creature: weapon, disposition: 'HOSTILE' })
    ],
    ownerFeatureId: creatureFeature(tranquilWolf, 'Bite').id,
    autoRoll: 'BOTH',
    rolls: [ATTACK_HITS],
    fallbackRoll: 0
  })
}
type TranquilRoom = Awaited<ReturnType<typeof tranquilRoom>>

/** The authored effects the room holds now. */
async function held(room: TranquilRoom) {
  const { activeEffects } = await readRoomHistory(room.room.base.stub)
  return activeEffects.map(
    ({ definitionJson }) =>
      (JSON.parse(definitionJson) as { authoredEffectId: string }).authoredEffectId
  )
}

async function longRest(room: TranquilRoom) {
  const answer = await room.send({
    type: 'CREATURE_REST',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    restKind: 'LONG',
    actorIds: [HOLDER_ID]
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

describe('room Tranquility (SPELLS-31.1)', () => {
  it('makes an attacker that fails the Monk’s Wisdom save lose its attack', async () => {
    const room = await monkRoom()
    const [ward] = (await readRoomHistory(room.room.base.stub)).characterEffects
    if (!ward) throw new Error('The Monk must hold its rested Tranquility.')
    const before = await monkHitPoints(room)

    const { answer } = await room.startAction(MONK_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const decision = await readPendingActionDecision(room.room.base.stub)
    if (decision?.pending.kind !== 'ATTACK_RETARGET_CHOICE')
      throw new Error(`No retarget is pending (${decision?.pending.kind}).`)
    const lost = await room.resolve(decision, { kind: 'DECLINE' })
    expect(lost.type, JSON.stringify(lost)).toBe('COMMAND_COMMITTED')

    const history = await readRoomHistory(room.room.base.stub)
    expect(await monkHitPoints(room)).toBe(before)
    const gated = history.receipts.flatMap((receipt) => {
      const execution = parseReceiptExecution(receipt)
      return receipt.commandType === 'RESOLVE_ACTION' &&
        execution.status === 'AGGREGATE_CHOICE_COMPLETE' &&
        execution.applicationOutputs.kind === 'ENCOUNTER_GATED_ACTION'
        ? [execution.applicationOutputs]
        : []
    })
    expect(gated).toMatchObject([
      { lost: 'ATTACK', gate: { holderActorId: MONK_ACTOR_ID, effectId: ward.id } }
    ])
    expect(history.characterEffects.map(({ id }) => id)).toEqual([ward.id])
  })

  it('ends when its holder attacks an enemy, and the next long rest restores it', async () => {
    if (!tranquilityEffect) throw new Error('The SRD Tranquility has no effect.')
    const room = await tranquilRoom()
    await longRest(room)
    expect(await held(room)).toEqual([tranquilityEffect.id])

    const { answer } = await room.startAction(ENEMY_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await held(room)).toEqual([])

    await longRest(room)
    expect(await held(room)).toEqual([tranquilityEffect.id])
  })
})
