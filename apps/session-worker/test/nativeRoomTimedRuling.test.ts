import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { suggestion } from '@artificer-toolkit/source-data/srd/spells/suggestion.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readMaintainedStates } from './placedZoneRoomReads.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-15.T3 (D187a): the SRD Suggestion, a Concentration GM ruling with an 8-hour duration, cast
 * through a real room. A Wolf that fails its save holds a timed ruling carrying the authored text
 * for the GM; the ruling counts down its turns and ends with the caster's Concentration, and an
 * undo of the cast leaves nothing behind.
 */

const CHARACTER_ACTOR_ID = testUuid(0x7d0)
const CHARACTER_ID = testUuid(0x7d1)
const WOLF_ID = testUuid(0x7d2)
const RANGE_UNCHECKED = ['TARGET_RANGE_UNCHECKED' as const]
/** 8 hours of 6-second turns. */
const EIGHT_HOURS = 4800

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A 3rd-level Character who prepares Suggestion and a Wolf that rolls a 1 on its save. */
function suggestionRoom() {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // A turn change reads the Character's frozen identity.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    characterSpellcasting: { spells: [suggestion], prepared: [suggestion.id] },
    characterPlay: { classLevel: 3 },
    // A raw die is its face less one: the Wolf's save is a natural 1.
    autoRoll: 'BOTH',
    rolls: [0],
    fallbackRoll: 0,
    characterAction: (action) => action.label.startsWith(suggestion.label)
  })
}

type SuggestionRoom = Awaited<ReturnType<typeof suggestionRoom>>

/** The rulings the Wolf's held effects carry, with the turns each effect has left. */
async function wolfRulings(room: SuggestionRoom) {
  const { activeEffects } = await readRoomHistory(room.room.base.stub)
  return activeEffects
    .filter(({ targetActorId }) => targetActorId === WOLF_ID)
    .map(({ definitionJson, lifecycle }) => ({
      rulings: activeRuleEffectDefinitionDtoSchema
        .parse(JSON.parse(definitionJson))
        .stateContributions.filter(({ kind }) => kind === 'GM_RULING'),
      remainingTicks: lifecycle.remainingTicks
    }))
}

const streamVersionOf = (room: SuggestionRoom) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return row.streamVersion
  })

async function castAtWolf(room: SuggestionRoom) {
  const { answer } = await room.startAction(WOLF_ID, RANGE_UNCHECKED)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

describe('the SRD Suggestion as a timed GM ruling in the room (QUALITY-15.T3)', () => {
  it('holds the ruling text for its duration and ends it with the Concentration', async () => {
    const room = await suggestionRoom()
    await castAtWolf(room)
    expect(await wolfRulings(room)).toEqual([
      {
        rulings: [
          {
            kind: 'GM_RULING',
            rulingOutcomeId: expect.any(String),
            label: 'Judge the Suggested Course',
            instructions:
              'The suggestion must be worded in such a manner as to make the course of action sound reasonable.'
          }
        ],
        remainingTicks: EIGHT_HOURS
      }
    ])
    expect(await readMaintainedStates(room)).toHaveLength(1)

    // A round passes: the ruling still holds, a turn shorter.
    await room.advanceTurn()
    await room.advanceTurn()
    const [held] = await wolfRulings(room)
    expect(held?.rulings).toHaveLength(1)
    expect(held?.remainingTicks).toBeLessThan(EIGHT_HOURS)

    const commandId = crypto.randomUUID()
    const ended = await room.room.send(commandId, {
      scope: 'CHARACTER_SHEET',
      characterId: CHARACTER_ID,
      encounterId: room.room.encounterId,
      command: {
        type: 'END_CONCENTRATION',
        commandId,
        expectedVersion: await streamVersionOf(room)
      }
    })
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')
    expect(await wolfRulings(room)).toEqual([])
    expect(await readMaintainedStates(room)).toEqual([])
  }, 120000)

  it('undoes the cast, leaving no ruling and no Concentration behind', async () => {
    const room = await suggestionRoom()
    await castAtWolf(room)
    expect(await wolfRulings(room)).toHaveLength(1)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await wolfRulings(room)).toEqual([])
    expect(await readMaintainedStates(room)).toEqual([])
  }, 120000)
})
