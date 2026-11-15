import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { continualFlame } from '@artificer-toolkit/source-data/srd/spells/continual-flame.js'
import { light } from '@artificer-toolkit/source-data/srd/spells/light.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-15.T3j (compile half): the SRD Light and Continual Flame, object manifestations, cast at a
 * Wolf through a real room. The target holds the object, its light and its attachment as an active
 * effect that counts down its turns, ends with its duration or the cast's undo, and never expires
 * when it lasts until dispelled. The scene does not read it yet (QUALITY-15.T3j2).
 */

const CHARACTER_ACTOR_ID = testUuid(0x7e0)
const CHARACTER_ID = testUuid(0x7e1)
const WOLF_ID = testUuid(0x7e2)
const RANGE_UNCHECKED = ['TARGET_RANGE_UNCHECKED' as const]
/** 1 hour of 6-second turns. */
const ONE_HOUR = 600

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** `spell` with its fixed result block lasting one minute instead, to expire inside a test. */
function lastingOneMinute(spell: SpellAuthored): SpellAuthored {
  return {
    ...spell,
    effects: spell.effects?.map((effect) => ({
      ...effect,
      paths: effect.paths.map((path) =>
        path.selectionKind === 'FIXED'
          ? {
              ...path,
              resultBlock: {
                ...path.resultBlock,
                duration: { id: testUuid(0x7e3), durationKind: 'MINUTE', amount: 1 }
              }
            }
          : path
      )
    }))
  }
}

/** A 3rd-level Wizard who prepares `spell` and a Wolf beside her. */
function manifestationRoom(spell: SpellAuthored) {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // A turn change reads the Character's frozen identity.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterPlay: { classLevel: 3 },
    characterAction: (action) => action.label.startsWith(spell.label)
  })
}

type ManifestationRoom = Awaited<ReturnType<typeof manifestationRoom>>

/** The object manifestations the Wolf's held effects carry, with the turns each effect has left. */
async function wolfManifestations(room: ManifestationRoom) {
  const { activeEffects } = await readRoomHistory(room.room.base.stub)
  return activeEffects
    .filter(({ targetActorId }) => targetActorId === WOLF_ID)
    .map(({ definitionJson, lifecycle }) => ({
      manifestations: activeRuleEffectDefinitionDtoSchema
        .parse(JSON.parse(definitionJson))
        .stateContributions.filter(({ kind }) => kind === 'OBJECT_MANIFESTATION'),
      remainingTicks: lifecycle.remainingTicks
    }))
}

async function castAtWolf(room: ManifestationRoom) {
  const { answer } = await room.startAction(WOLF_ID, RANGE_UNCHECKED)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

describe('the SRD Light as a timed object manifestation in the room (QUALITY-15.T3j)', () => {
  it('holds the lit object for its hour and counts the holder turns down', async () => {
    const room = await manifestationRoom(light)
    await castAtWolf(room)
    expect(await wolfManifestations(room)).toEqual([
      {
        manifestations: [
          {
            kind: 'OBJECT_MANIFESTATION',
            manifestationOutcomeId: expect.any(String),
            label: 'Light',
            attachmentKind: 'TOUCHED_OBJECT',
            light: {
              bright: { amount: 20, unit: 'FEET' },
              dimAdditional: { amount: 20, unit: 'FEET' }
            },
            properties: ['CAN_BE_COVERED_OR_HIDDEN']
          }
        ],
        remainingTicks: ONE_HOUR
      }
    ])

    await room.advanceTurn()
    await room.advanceTurn()
    const [held] = await wolfManifestations(room)
    expect(held?.manifestations).toHaveLength(1)
    expect(held?.remainingTicks).toBeLessThan(ONE_HOUR)
  }, 120000)

  it('ends the manifestation when its duration runs out', async () => {
    const room = await manifestationRoom(lastingOneMinute(light))
    await castAtWolf(room)
    expect(await wolfManifestations(room)).toHaveLength(1)

    // One minute is ten of the Wolf's turns; the Character's turns between them count nothing.
    for (let turn = 0; turn < 22; turn += 1) await room.advanceTurn()
    expect(await wolfManifestations(room)).toEqual([])
  }, 240000)

  it('undoes the cast, leaving no manifestation behind', async () => {
    const room = await manifestationRoom(light)
    await castAtWolf(room)
    expect(await wolfManifestations(room)).toHaveLength(1)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await wolfManifestations(room)).toEqual([])
  }, 120000)
})

describe('the SRD Continual Flame as an until-dispelled manifestation in the room (QUALITY-15.T3j)', () => {
  it('holds the flame with every property and never counts it down', async () => {
    const room = await manifestationRoom(continualFlame)
    await castAtWolf(room)
    for (let turn = 0; turn < 6; turn += 1) await room.advanceTurn()
    expect(await wolfManifestations(room)).toEqual([
      {
        manifestations: [
          expect.objectContaining({
            label: 'Continual Flame',
            attachmentKind: 'TOUCHED_OBJECT',
            properties: [
              'CANNOT_BE_QUENCHED',
              'CANNOT_BE_SMOTHERED',
              'CAN_BE_COVERED_OR_HIDDEN',
              'NO_HEAT',
              'NO_OXYGEN_USE'
            ]
          })
        ],
        remainingTicks: null
      }
    ])
  }, 240000)
})
