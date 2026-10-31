import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { monk } from '@artificer-toolkit/source-data/srd/classes/monk.js'
import { paladin } from '@artificer-toolkit/source-data/srd/classes/paladin.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorConditionIds, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T4f: Stillness of Mind (a monk ends a charm or fright on itself) and Cleansing Touch
 * (a paladin ends a spell on a willing touched creature, spending a Charisma-modifier use) are
 * authored END_EFFECTS actions with no feature-specific code.
 */

const ACTOR_ID = testUuid(0x9d0)
const CHARACTER_ID = testUuid(0x9d1)
const WOLF_ID = testUuid(0x9d2)
const OTHER_RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

const conditionId = (code: string) => {
  const found = srdSystemRecord.conditionTypes.find((condition) => condition.code === code)
  if (!found) throw new Error(`The SRD names the ${code} condition.`)
  return found.id
}

const feature = (cls: typeof monk, label: string) => {
  const found = cls.features?.find((entry) => entry.label === label)
  if (!found) throw new Error(`The SRD authors ${label}.`)
  // The room's Character is 1st level, so it gains the Feature at 1st.
  return { ...found, availableAtLevel: 1 }
}

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A monk holding one effect per condition in `held`, or a paladin beside a Wolf holding spells cast at `levels`. */
const room = (input: { held: readonly string[] } | { levels: readonly number[] }) =>
  actionRoom({
    actors: [
      characterActor({ id: ACTOR_ID, characterId: CHARACTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    characterClassFeatures: [
      'held' in input ? feature(monk, 'Stillness of Mind') : feature(paladin, 'Cleansing Touch')
    ],
    characterAction: (action) =>
      action.label.startsWith('held' in input ? 'Stillness of Mind' : 'Cleansing Touch'),
    seed: async (context) => {
      if ('held' in input)
        for (const ownedConditionId of input.held)
          await seedModifierGrant({
            sourceActorId: WOLF_ID,
            holderActorId: ACTOR_ID,
            lifecycle: {},
            ownedConditionId
          })(context)
      else
        for (const spellCastLevel of input.levels)
          await seedModifierGrant({
            sourceActorId: WOLF_ID,
            holderActorId: WOLF_ID,
            lifecycle: {},
            spellCastLevel
          })(context)
    }
  })

type Room = Awaited<ReturnType<typeof room>>

const heldState = async (fixture: Room, actorId: string) => {
  const history = await readRoomHistory(fixture.room.base.stub)
  return {
    effectIds: history.activeEffects.map(({ id }) => id).sort(),
    conditionIds: [...readActorConditionIds(history, actorId)].sort()
  }
}

const use = async (fixture: Room, targetActorId: string, chosenEffectId?: string) =>
  fixture.send({
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: OTHER_RANGE,
    encounterId: fixture.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await fixture.version(),
    actorId: ACTOR_ID,
    target: { kind: 'ACTOR', actorId: targetActorId, ...(chosenEffectId && { chosenEffectId }) },
    actionId: fixture.actionId,
    optionalCombatIntent: null,
    sceneContext: null
  })

describe('room Stillness of Mind (SPELLS-31.T4f)', () => {
  it('ends the chosen charm or fright on the user and leaves other effects', async () => {
    const fixture = await room({
      held: [conditionId('FRIGHTENED'), conditionId('CHARMED'), conditionId('POISONED')]
    })
    const held = async () =>
      (await readRoomHistory(fixture.room.base.stub)).characterEffects.map(
        ({ id, definitionJson }) => ({ id, definitionJson })
      )
    const before = await held()
    expect(before).toHaveLength(3)
    expect((await use(fixture, ACTOR_ID)).type).not.toBe('COMMAND_COMMITTED')

    const frightened = before.find(({ definitionJson }) =>
      definitionJson.includes(conditionId('FRIGHTENED'))
    )
    if (!frightened) throw new Error('The room holds the frightened effect.')
    const answer = await use(fixture, ACTOR_ID, frightened.id)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const after = await held()
    expect(after.map(({ id }) => id)).not.toContain(frightened.id)
    expect(after).toHaveLength(2)
    expect(
      after.some(({ definitionJson }) => definitionJson.includes(conditionId('POISONED')))
    ).toBe(true)
  }, 120000)

  it('warns when the user holds no charm or fright', async () => {
    const fixture = await room({ held: [conditionId('POISONED')] })
    expect(JSON.stringify(await use(fixture, ACTOR_ID))).toContain('TARGET_NOTHING_TO_END')
  }, 120000)
})

describe('room Cleansing Touch (SPELLS-31.T4f)', () => {
  it('ends the one spell on a touched creature', async () => {
    const fixture = await room({ levels: [3] })
    const answer = await use(fixture, WOLF_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await heldState(fixture, WOLF_ID)).effectIds).toEqual([])
  }, 120000)

  it('needs a pick among several spells, ends only that one, and one undo restores it', async () => {
    const fixture = await room({ levels: [1, 5] })
    const before = await heldState(fixture, WOLF_ID)
    expect((await use(fixture, WOLF_ID)).type).not.toBe('COMMAND_COMMITTED')
    const answer = await use(fixture, WOLF_ID, before.effectIds[0])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await heldState(fixture, WOLF_ID)).effectIds).toHaveLength(1)

    const undone = await fixture.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: fixture.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await fixture.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await heldState(fixture, WOLF_ID)).toEqual(before)
  }, 120000)
})
