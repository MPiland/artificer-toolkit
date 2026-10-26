import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { divineWord } from '@artificer-toolkit/source-data/srd/spells/divine-word.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { runInDurableObject } from 'cloudflare:test'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { readRoomHistory } from './roomHistoryReads.js'

const CASTER_ACTOR_ID = testUuid(0xf40)
const CASTER_ID = testUuid(0xf41)
const WOLF_ID = testUuid(0xf42)

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

type SpellEffect = NonNullable<SpellAuthored['effects']>[number]
type TablePath = Extract<SpellEffect['paths'][number], { selectionKind: 'ROLL_TABLE' }>
type TableRow = TablePath['rows'][number]

function lastingRow(order: number, rollRange: [number, number], condition: string): TableRow {
  return {
    id: testUuid(0xf50 + order),
    order,
    rollRange,
    resolutionKind: 'RESULT',
    resultBlock: {
      id: testUuid(0xf60 + order),
      resultKind: 'SINGLE',
      duration: { id: testUuid(0xf70 + order), durationKind: 'ROUND', amount: 1 },
      outcomes: [{ id: testUuid(0xf80 + order), effectKind: 'CONDITION', conditionId: condition }]
    }
  }
}

/**
 * Homebrew (parity with any authored table): Divine Word's saving throw at one creature, whose
 * failure rolls a d6, blinded for a round on 1-3 and deafened for a round on 4-6.
 */
const [wordEffect] = divineWord.effects!
const shock: SpellAuthored = {
  ...divineWord,
  id: testUuid(0xf43),
  label: 'Homebrew System Shock',
  effects: [
    {
      ...wordEffect!,
      invocation: {
        ...wordEffect!.invocation,
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: [
        {
          id: testUuid(0xf44),
          order: 1,
          pathCode: 'ON_SAVE_FAIL',
          groupType: 'SINGLE',
          originKind: 'SOURCE',
          selectionKind: 'ROLL_TABLE',
          rollTableKind: 'RANGE',
          dieConfig: '1d6',
          rows: [lastingRow(1, [1, 3], BLINDED), lastingRow(2, [4, 6], DEAFENED)]
        }
      ]
    }
  ]
}

/** The GM's dice roll themselves, zero-based: a natural 1 on the save, then `tableFace` on the d6. */
function shockRoom(tableFace: number) {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: [0, tableFace - 1],
    actors: [
      {
        ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: CASTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf, currentHitPoints: plainWolf.hitPoints })
    ],
    characterSpellcasting: { spells: [shock], prepared: [shock.id] },
    characterPlay: { classLevel: 17 },
    characterAction: (action) => action.label.startsWith(shock.label)
  })
}

async function wolfConditions(room: Awaited<ReturnType<typeof shockRoom>>) {
  const wolf = vitalsOf(await readRoomHistory(room.room.base.stub)).find(({ id }) => id === WOLF_ID)
  if (!wolf) throw new Error('The Wolf is missing.')
  return ((wolf.conditions ?? []) as { conditionTypeId: string }[]).map(
    ({ conditionTypeId }) => conditionTypeId
  )
}

describe('a roll table row that lasts, cast by a Character (ATTACK-16.T1a2)', () => {
  it.each([
    [2, BLINDED],
    [5, DEAFENED]
  ])(
    'holds the row a failed save rolls %i on until the end of the target’s next turn',
    async (tableFace, condition) => {
      const room = await shockRoom(tableFace)
      const { answer } = await room.startAction(WOLF_ID, ['TARGET_RANGE_UNCHECKED'])
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      expect(await wolfConditions(room)).toEqual([condition])

      // The caster's turn ends: the Wolf still holds the row's condition.
      await room.advanceTurn()
      expect(await wolfConditions(room)).toEqual([condition])

      // The Wolf's own turn ends, and the round the row lasts with it.
      await room.advanceTurn()
      expect(await wolfConditions(room)).toEqual([])
    },
    120000
  )
})

/**
 * Homebrew: a test-less self Effect whose own ON_USE path rolls the same d6 table, no save first
 * (ATTACK-16.T1c2a).
 */
const { savingThrow: _save, ...wordInvocation } = wordEffect!.invocation as Extract<
  SpellEffect['invocation'],
  { triggerCode: 'SAVING_THROW' }
>
const selfShock: SpellAuthored = {
  ...shock,
  id: testUuid(0xf45),
  label: 'Homebrew Self Shock',
  effects: [
    {
      ...shock.effects![0]!,
      invocation: {
        ...wordInvocation,
        triggerCode: 'ACTIVATED',
        range: { id: testUuid(0xf46), rangeKind: 'SELF' },
        targeting: { selectionKind: 'SELF' }
      },
      paths: [{ ...(shock.effects![0]!.paths[0] as TablePath), pathCode: 'ON_USE' }]
    }
  ]
}

/** A Character holds its conditions in its play state. */
function casterConditions(room: Awaited<ReturnType<typeof actionRoom>>) {
  return runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CASTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return (readCharacterPlay(row).conditions ?? []).map(({ conditionTypeId }) => conditionTypeId)
  })
}

describe('a roll table on a test-less self action, used by a Character (ATTACK-16.T1c2a)', () => {
  it.each([
    [3, BLINDED],
    [4, DEAFENED]
  ])(
    'holds on the user the row its table rolls %i on',
    async (tableFace, condition) => {
      const room = await actionRoom({
        autoRoll: 'BOTH',
        rolls: [tableFace - 1],
        actors: [
          {
            ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
            snapshot: { kind: 'CHARACTER', id: CASTER_ID, systemId: srdSystemRecord.id }
          },
          srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
        ],
        characterSpellcasting: { spells: [selfShock], prepared: [selfShock.id] },
        characterPlay: { classLevel: 17 },
        characterAction: (action) => action.label.startsWith(selfShock.label)
      })
      const { answer } = await room.startAction(CASTER_ACTOR_ID)
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      expect(await casterConditions(room)).toEqual([condition])
    },
    120000
  )
})
