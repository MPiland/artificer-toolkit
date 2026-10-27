import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import type { Dnd5eOptionalCombatReusableDefinitionDocumentDto } from '@artificer-toolkit/schema/shared/optionalCombat'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { runInDurableObject } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'

/**
 * ATTACK-16.T1c2b: an optional combat rule's failed save raises the rule's own action on the holder,
 * a SYSTEM root the rule, never a player, starts. Homebrew system shock (parity with any authored
 * rule): the massive-damage rule's failed save rolls a d6 on its holder, blinded for a round on 1-3
 * and deafened for a round on 4-6.
 */

const ATTACKER_ID = testUuid(0x16f0)
const HOLDER_ID = testUuid(0x16f1)
const CHARACTER_ACTOR_ID = testUuid(0x16f2)
const CHARACTER_ID = testUuid(0x16f3)
const SHOCK_EFFECT_ID = testUuid(0x16f4)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const conditionId = (code: string) => {
  const entry = srdSystemRecord.conditionTypes.find((type) => type.code === code)
  if (!entry) throw new Error(`Condition ${code} required.`)
  return entry.id
}
const BLINDED = conditionId('BLINDED')
const DEAFENED = conditionId('DEAFENED')

type RaisedEffect = NonNullable<
  Dnd5eOptionalCombatReusableDefinitionDocumentDto['raisedEffects']
>[number]
type TablePath = Extract<RaisedEffect['paths'][number], { selectionKind: 'ROLL_TABLE' }>

function lastingRow(order: number, rollRange: [number, number], condition: string) {
  return {
    id: testUuid(0x1700 + order),
    order,
    rollRange,
    resolutionKind: 'RESULT',
    resultBlock: {
      id: testUuid(0x1710 + order),
      resultKind: 'SINGLE',
      duration: { id: testUuid(0x1720 + order), durationKind: 'ROUND', amount: 1 },
      outcomes: [{ id: testUuid(0x1730 + order), effectKind: 'CONDITION', conditionId: condition }]
    }
  } satisfies TablePath['rows'][number]
}

const shockEffect = {
  id: SHOCK_EFFECT_ID,
  order: 1,
  invocation: {
    kind: 'ACTION',
    triggerCode: 'ACTIVATED',
    activation: { code: 'ACTION', amount: 1 },
    range: { id: testUuid(0x16f5), rangeKind: 'SELF' },
    targeting: { selectionKind: 'SELF' }
  },
  paths: [
    {
      id: testUuid(0x16f6),
      order: 1,
      pathCode: 'ON_USE',
      groupType: 'SINGLE',
      originKind: 'SOURCE',
      selectionKind: 'ROLL_TABLE',
      rollTableKind: 'RANGE',
      dieConfig: '1d6',
      rows: [lastingRow(1, [1, 3], BLINDED), lastingRow(2, [4, 6], DEAFENED)]
    }
  ]
} satisfies RaisedEffect

/** The GM's massive-damage copy authors the shock; `raises` names it as the failed save's action. */
function systemShock(raises: boolean) {
  return (
    document: Dnd5eOptionalCombatReusableDefinitionDocumentDto
  ): Dnd5eOptionalCombatReusableDefinitionDocumentDto =>
    document.parameters.kind !== 'MASSIVE_DAMAGE'
      ? document
      : {
          ...document,
          raisedEffects: [shockEffect],
          parameters: {
            ...document.parameters,
            ...(raises && { failedSaveEffectId: SHOCK_EFFECT_ID })
          }
        }
}

/**
 * A Wolf bites `holder` for 7, half its maximum or more, and every die rolls itself, zero-based: a
 * 19 to hit, `saveFace` on the DC 15 Constitution save, then `tableFace` on the shock's d6.
 */
function shockRoom(input: {
  holder: 'CREATURE' | 'CHARACTER'
  saveFace: number
  tableFace: number
  raises?: boolean
}) {
  const attacker = biteWolf('ATTACK', { damage: 7 })
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: [18, input.saveFace - 1, input.tableFace - 1],
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
      input.holder === 'CREATURE'
        ? srdCreatureActor({ id: HOLDER_ID, creature: { ...plainWolf, hitPoints: 13 } })
        : {
            ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
            snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
          }
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    optionalCombatKinds: ['MASSIVE_DAMAGE'],
    optionalCombatHomebrew: systemShock(input.raises ?? true)
  })
}

type ShockRoom = Awaited<ReturnType<typeof shockRoom>>

async function creatureConditions(room: ShockRoom) {
  const holder = vitalsOf(await readRoomHistory(room.room.base.stub)).find(
    ({ id }) => id === HOLDER_ID
  )
  if (!holder) throw new Error('The holder is missing.')
  return ((holder.conditions ?? []) as { conditionTypeId: string }[]).map(
    ({ conditionTypeId }) => conditionTypeId
  )
}

/** A Character holds its conditions in its play state. */
function characterConditions(room: ShockRoom) {
  return runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return (readCharacterPlay(row).conditions ?? []).map(({ conditionTypeId }) => conditionTypeId)
  })
}

async function bite(room: ShockRoom, targetActorId: string) {
  const { answer } = await room.startAction(targetActorId)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

describe('a rule’s failed save raises its action on the holder (ATTACK-16.T1c2b)', () => {
  it.each([
    [2, BLINDED],
    [5, DEAFENED]
  ])(
    'shocks a Creature holder with the row its d6 rolls %i on, once',
    async (tableFace, condition) => {
      const room = await shockRoom({ holder: 'CREATURE', saveFace: 2, tableFace })
      await bite(room, HOLDER_ID)
      const after = await readRoomHistory(room.room.base.stub)
      expect(readActorHitPoints(after, HOLDER_ID)).toBe(6)
      expect(await creatureConditions(room)).toEqual([condition])
      // The raised root runs once: a later command raises nothing more from the same save.
      const version = await room.version()
      await room.advanceTurn()
      expect(await room.version()).toBe(version + 1)
    },
    120000
  )

  it('shocks a Character holder', async () => {
    const room = await shockRoom({ holder: 'CHARACTER', saveFace: 2, tableFace: 6 })
    await bite(room, CHARACTER_ACTOR_ID)
    expect(await characterConditions(room)).toEqual([DEAFENED])
  }, 120000)

  it('raises nothing on a made save or when the rule names no action for one', async () => {
    // Each room rigs the dice it is built with, so each is built just before it bites.
    for (const config of [
      { saveFace: 20, raises: true },
      { saveFace: 2, raises: false }
    ]) {
      const room = await shockRoom({ holder: 'CREATURE', tableFace: 2, ...config })
      const version = await room.version()
      await bite(room, HOLDER_ID)
      expect(await creatureConditions(room)).toEqual([])
      expect(await room.version()).toBe(version + 1)
    }
  }, 120000)

  it('undoes the shock with the Bite that raised it', async () => {
    const room = await shockRoom({ holder: 'CREATURE', saveFace: 2, tableFace: 2 })
    await bite(room, HOLDER_ID)
    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(readActorHitPoints(await readRoomHistory(room.room.base.stub), HOLDER_ID)).toBe(13)
    expect(await creatureConditions(room)).toEqual([])
  }, 120000)
})
