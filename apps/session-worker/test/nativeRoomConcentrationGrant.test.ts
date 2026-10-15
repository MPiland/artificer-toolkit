import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/concentration.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom, type ActionRoomConfig } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { dependentEffectDefinition } from './movementRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-5.7 through the room: a homebrew Feature's +2 AC grant needs Concentration, so it depends on
 * the Character's maintained Concentration and ends when a new Concentration replaces it.
 */

const FIGHTER_ACTOR_ID = testUuid(0xd00)
const FIGHTER_ID = testUuid(0xd01)
const WOLF_ID = testUuid(0xd02)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Fighter Feature granting +2 AC for 1 minute while the Fighter concentrates: on itself or one target. */
function wardFeature(input: { seed: number; label: string; self: boolean }): ClassFeature {
  return {
    id: testUuid(input.seed),
    label: input.label,
    description: 'Wards a creature while you concentrate.',
    availableAtLevel: 1,
    order: 1,
    effects: [
      {
        id: testUuid(input.seed + 1),
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: 'ACTIVATED',
          activation: { code: 'ACTION', amount: 1 },
          range: { id: testUuid(input.seed + 2), rangeKind: input.self ? 'SELF' : 'UNLIMITED' },
          targeting: input.self
            ? { selectionKind: 'SELF' }
            : { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        },
        paths: [
          {
            id: testUuid(input.seed + 3),
            order: 1,
            pathCode: 'ON_USE',
            groupType: 'SINGLE',
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: testUuid(input.seed + 4),
              resultKind: 'SINGLE',
              maintenanceDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
              duration: { id: testUuid(input.seed + 5), durationKind: 'MINUTE', amount: 1 },
              outcomes: [
                {
                  id: testUuid(input.seed + 6),
                  effectKind: 'APPLY_GRANT',
                  grants: {
                    modifiers: [
                      {
                        id: testUuid(input.seed + 7),
                        grantKind: 'MODIFIER_GRANT',
                        valueDomainCode: 'ARMOR_CLASS',
                        domain: {},
                        modifierKind: 'BONUS',
                        scope: 'GLOBAL',
                        selectionKind: 'GRANTED',
                        payload: { valueKind: 'FIXED', amount: 2 },
                        order: 1
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  }
}

const selfWard = wardFeature({ seed: 0xd100, label: 'Self Ward', self: true })
const targetedWard = wardFeature({ seed: 0xd200, label: 'Targeted Ward', self: false })

/** A Fighter Feature whose 1-minute self grant keeps its holder from casting spells or holding Concentration. */
const spellLock: ClassFeature = {
  id: testUuid(0xd400),
  label: 'Spell Lock',
  description: 'Seals the holder’s spellcasting for a minute.',
  availableAtLevel: 1,
  order: 1,
  effects: [
    {
      id: testUuid(0xd401),
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'ACTIVATED',
        activation: { code: 'ACTION', amount: 1 },
        range: { id: testUuid(0xd402), rangeKind: 'SELF' },
        targeting: { selectionKind: 'SELF' }
      },
      paths: [
        {
          id: testUuid(0xd403),
          order: 1,
          pathCode: 'ON_USE',
          groupType: 'SINGLE',
          originKind: 'SOURCE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: testUuid(0xd404),
            resultKind: 'SINGLE',
            duration: { id: testUuid(0xd405), durationKind: 'MINUTE', amount: 1 },
            outcomes: [
              {
                id: testUuid(0xd406),
                effectKind: 'APPLY_GRANT',
                grants: {
                  modifiers: [
                    {
                      id: testUuid(0xd407),
                      grantKind: 'MODIFIER_GRANT',
                      valueDomainCode: 'SPELLCASTING_LOCK',
                      domain: {},
                      modifierKind: 'ENABLE',
                      scope: 'GLOBAL',
                      selectionKind: 'GRANTED',
                      order: 1
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    }
  ]
}

function wardRoom(seed?: ActionRoomConfig['seed']) {
  return actionRoom({
    seed,
    autoRoll: 'BOTH',
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    characterClassFeatures: [selfWard, targetedWard, spellLock],
    characterAction: (action) => action.label.includes('Self Ward')
  })
}

type WardRoom = Awaited<ReturnType<typeof wardRoom>>

/** Sends a Sheet command for the Fighter as the GM, at its current stream version. */
async function gmSheet(room: WardRoom, command: Record<string, unknown>) {
  const streamVersion = await runInDurableObject(room.room.base.stub, (_instance, context) => {
    const play = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((row) => row.characterId === FIGHTER_ID)
    if (!play) throw new Error('Missing room Character play state.')
    return play.streamVersion
  })
  const commandId = crypto.randomUUID()
  return room.room.send(commandId, {
    scope: 'CHARACTER_SHEET',
    characterId: FIGHTER_ID,
    encounterId: room.room.encounterId,
    command: { ...command, commandId, expectedVersion: streamVersion }
  })
}

describe('a grant that needs Concentration (SPELLS-5.7)', () => {
  it('depends on the Character’s Concentration and ends when a new Concentration replaces it', async () => {
    const room = await wardRoom()
    const first = await room.startAction(FIGHTER_ACTOR_ID)
    expect(first.answer.type, JSON.stringify(first.answer)).toBe('COMMAND_COMMITTED')

    const afterFirst = await readRoomHistory(room.room.base.stub)
    const [concentration] = afterFirst.maintainedStates
    expect(afterFirst.maintainedStates).toHaveLength(1)
    expect(concentration!.maintenanceDefinitionId).toBe(
      SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
    )
    expect(afterFirst.characterEffects).toHaveLength(1)
    expect(afterFirst.characterEffects[0]!.maintainedEffectStateId).toBe(concentration!.id)

    const targetedActionId = (await room.actionChoices()).actions.find(({ label }) =>
      label.includes('Targeted Ward')
    )?.id
    if (!targetedActionId) throw new Error('The Fighter offers no Targeted Ward.')
    // Both actions use the turn's one Action: the second is a soft override.
    const second = await room.startAction(
      WOLF_ID,
      ['ACTION_ECONOMY_UNAVAILABLE'],
      null,
      null,
      targetedActionId
    )
    expect(second.answer.type, JSON.stringify(second.answer)).toBe('COMMAND_COMMITTED')

    const afterSecond = await readRoomHistory(room.room.base.stub)
    const [replacement] = afterSecond.maintainedStates
    expect(afterSecond.maintainedStates).toHaveLength(1)
    expect(replacement!.id).not.toBe(concentration!.id)
    expect(afterSecond.characterEffects).toEqual([])
    const wolfGrants = afterSecond.activeEffects.filter(
      ({ targetActorId }) => targetActorId === WOLF_ID
    )
    expect(wolfGrants).toHaveLength(1)
    expect(wolfGrants[0]!.maintainedEffectStateId).toBe(replacement!.id)
  })

  it('ends a carried grant its caster’s new Concentration replaces, keeps others, and refuses undo (SPELLS-5.7)', async () => {
    const STAMPED_ID = testUuid(0xd300)
    const UNSTAMPED_ID = testUuid(0xd301)
    const room = await wardRoom(async ({ effects, encounterId, occurredAt }) => {
      for (const [id, concentrationCasterCharacterId] of [
        [STAMPED_ID, FIGHTER_ID],
        [UNSTAMPED_ID, null]
      ] as const)
        await effects.create({
          id,
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: FIGHTER_ACTOR_ID },
          lifecycle: { schemaVersion: 1, remainingTicks: 3, concentrationCasterCharacterId },
          definition: dependentEffectDefinition({ encounterId, sourceActorId: FIGHTER_ACTOR_ID }),
          occurredAt
        })
    })
    const before = await readRoomHistory(room.room.base.stub)
    expect(before.characterEffects.map(({ id }) => id).sort()).toEqual([STAMPED_ID, UNSTAMPED_ID])

    const cast = await room.startAction(FIGHTER_ACTOR_ID)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    expect(after.characterEffects.map(({ id }) => id)).not.toContain(STAMPED_ID)
    expect(after.characterEffects.map(({ id }) => id)).toContain(UNSTAMPED_ID)
    expect(before.runs[0]!.concentrationCasterCharacterIds).toEqual([])
    expect(after.runs[0]!.concentrationCasterCharacterIds).toEqual([FIGHTER_ID])

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'REVERT_UNAVAILABLE',
      message: expect.stringContaining('a replaced maintained effect')
    })
  })

  it('ends with the Concentration when its caster is incapacitated (D95)', async () => {
    const room = await wardRoom()
    const ward = await room.startAction(FIGHTER_ACTOR_ID)
    expect(ward.answer.type, JSON.stringify(ward.answer)).toBe('COMMAND_COMMITTED')
    expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(1)

    const paralyzed = SRD_CONDITION_TYPES.find(({ code }) => code === 'PARALYZED')
    if (!paralyzed) throw new Error('The SRD Paralyzed condition is missing.')
    const edit = await gmSheet(room, { type: 'ADD_CONDITION', conditionTypeId: paralyzed.id })
    expect(edit.type, JSON.stringify(edit)).toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(room.room.base.stub)
    expect(after.maintainedStates).toEqual([])
    expect(after.characterEffects).toEqual([])
  })

  it('ends with the Concentration when a spellcasting lock is applied, and refuses a new Concentration while it is held (D95)', async () => {
    const room = await wardRoom()
    const ward = await room.startAction(FIGHTER_ACTOR_ID)
    expect(ward.answer.type, JSON.stringify(ward.answer)).toBe('COMMAND_COMMITTED')
    expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(1)

    const lockActionId = (await room.actionChoices()).actions.find(({ label }) =>
      label.includes('Spell Lock')
    )?.id
    if (!lockActionId) throw new Error('The Fighter offers no Spell Lock.')
    // Both actions use the turn's one Action: the second is a soft override.
    const locked = await room.startAction(
      FIGHTER_ACTOR_ID,
      ['ACTION_ECONOMY_UNAVAILABLE'],
      null,
      null,
      lockActionId
    )
    expect(locked.answer.type, JSON.stringify(locked.answer)).toBe('COMMAND_COMMITTED')
    const afterLock = await readRoomHistory(room.room.base.stub)
    // The ward ended with the Concentration; the lock grant, which needs none, is what remains.
    expect(afterLock.maintainedStates).toEqual([])
    expect(afterLock.characterEffects).toHaveLength(1)
    expect(afterLock.characterEffects[0]!.maintainedEffectStateId).toBeNull()

    const refused = await room.startAction(FIGHTER_ACTOR_ID, ['ACTION_ECONOMY_UNAVAILABLE'])
    expect(refused.answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'SOURCE_REQUIREMENTS_NOT_MET'
    })
    const afterRefusal = await readRoomHistory(room.room.base.stub)
    expect(afterRefusal.maintainedStates).toEqual([])
    expect(afterRefusal.characterEffects).toHaveLength(1)
  })
})
