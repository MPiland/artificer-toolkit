import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { aid } from '@artificer-toolkit/source-data/srd/spells/aid.js'
import { darkvision } from '@artificer-toolkit/source-data/srd/spells/darkvision.js'
import { fly } from '@artificer-toolkit/source-data/srd/spells/fly.js'
import { longstrider } from '@artificer-toolkit/source-data/srd/spells/longstrider.js'
import { rayOfFrost } from '@artificer-toolkit/source-data/srd/spells/ray-of-frost.js'
import { shieldOfFaith } from '@artificer-toolkit/source-data/srd/spells/shield-of-faith.js'
import { shockingGrasp } from '@artificer-toolkit/source-data/srd/spells/shocking-grasp.js'
import { viciousMockery } from '@artificer-toolkit/source-data/srd/spells/vicious-mockery.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readMaintainedStates } from './placedZoneRoomReads.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-8.3: each SRD APPLY_GRANT spell applies its grant through a cast in the room. The spell
 * runs as authored; the held effect carries the spell's own modifier or sense grants, frozen at
 * cast. Heroism (nativeRoomTemporaryHitPointSpells), Protection from Energy (nativeRoomCastChoice)
 * and Shield (nativeRoomReaction) are cast in their own room tests.
 */

const CHARACTER_ACTOR_ID = testUuid(0xa80)
const CHARACTER_ID = testUuid(0xa81)
const WOLF_ID = testUuid(0xa82)
const RANGE_UNCHECKED = ['TARGET_RANGE_UNCHECKED' as const]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A Character of `level` who knows `spell`, and a Wolf beside it (`allied`, or hostile), `rolls` as
 * every die in turn (a raw die is its face less one).
 */
function casterRoom(
  spell: SpellAuthored,
  label: string,
  config: { level?: number; allied?: boolean; rolls?: readonly number[] } = {}
) {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({
        id: WOLF_ID,
        creature: plainWolf,
        ...(config.allied && { disposition: 'FRIENDLY' as const })
      })
    ],
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    ...(config.level && { characterPlay: { classLevel: config.level } }),
    ...(config.rolls && { autoRoll: 'BOTH' as const, rolls: config.rolls, fallbackRoll: 0 }),
    characterAction: (action) => action.label === label
  })
}

type CasterRoom = Awaited<ReturnType<typeof casterRoom>>

/** The Character's current hit points as its room play state holds them. */
const characterHitPoints = (room: CasterRoom) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).hitpoints.current
  })

/** The spell's authored modifier grants, in the shape a held effect freezes them. */
function authoredModifiers(spell: SpellAuthored) {
  return (spell.effects ?? []).flatMap(({ paths }) =>
    paths.flatMap((path) =>
      path.selectionKind === 'FIXED'
        ? path.resultBlock.outcomes.flatMap((outcome) =>
            outcome.effectKind === 'APPLY_GRANT'
              ? (outcome.grants.modifiers ?? []).map(
                  ({ valueDomainCode, modifierKind, domain, payload }) => ({
                    valueDomainCode,
                    modifierKind,
                    domain,
                    payload
                  })
                )
              : []
          )
        : []
    )
  )
}

interface HeldGrant {
  kind: string
  modifiers?: {
    valueDomainCode: string
    modifierKind: string
    domain: unknown
    payload?: unknown
  }[]
  senses?: { grantId: string; range: unknown }[]
}

/** The Wolf's held effects and the grants they carry. */
async function wolfGrants(room: CasterRoom) {
  const history = await readRoomHistory(room.room.base.stub)
  const effects = history.activeEffects.filter(({ targetActorId }) => targetActorId === WOLF_ID)
  const grants = effects.flatMap(
    ({ definitionJson }) =>
      (JSON.parse(definitionJson) as { stateContributions: HeldGrant[] }).stateContributions
  )
  const modifierGrants = grants.filter(({ kind }) => kind === 'MODIFIER_GRANT')
  const wolf = vitalsOf(history).find(({ id }) => id === WOLF_ID)
  if (!wolf) throw new Error('The room holds the Wolf.')
  return {
    effects,
    wolf,
    modifiers: modifierGrants.flatMap(({ modifiers = [] }) =>
      modifiers.map(({ valueDomainCode, modifierKind, domain, payload }) => ({
        valueDomainCode,
        modifierKind,
        domain,
        payload
      }))
    ),
    senses: modifierGrants.flatMap(({ senses = [] }) => senses)
  }
}

describe('SRD APPLY_GRANT spells cast in an Encounter (SPELLS-8.3)', () => {
  it.each([
    { spell: longstrider, label: 'Longstrider (1st level)', level: undefined, concentration: 0 },
    { spell: fly, label: 'Fly (3rd level)', level: 5, concentration: 1 },
    {
      spell: shieldOfFaith,
      label: 'Shield of Faith (1st level)',
      level: undefined,
      concentration: 1
    }
  ])(
    '$label holds its authored grant on the allied target',
    async ({ spell, label, level, concentration }) => {
      const room = await casterRoom(spell, label, { allied: true, ...(level && { level }) })

      const { answer } = await room.startAction(WOLF_ID, RANGE_UNCHECKED)
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      const held = await wolfGrants(room)
      expect(held.effects).toHaveLength(1)
      expect(held.modifiers).toEqual(authoredModifiers(spell))
      expect(await readMaintainedStates(room)).toHaveLength(concentration)
    },
    120000
  )

  it('Darkvision holds the 60 ft Darkvision sense on the touched target', async () => {
    const room = await casterRoom(darkvision, 'Darkvision (2nd level)', { allied: true, level: 3 })

    const { answer } = await room.startAction(WOLF_ID, RANGE_UNCHECKED)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const held = await wolfGrants(room)
    expect(held.effects).toHaveLength(1)
    const outcome = darkvision.effects?.[0]?.paths[0]
    if (outcome?.selectionKind !== 'FIXED') throw new Error('Darkvision has a fixed result.')
    const [grant] = outcome.resultBlock.outcomes.flatMap((each) =>
      each.effectKind === 'APPLY_GRANT' ? (each.grants.senses ?? []) : []
    )
    if (!grant) throw new Error('Darkvision grants a sense.')
    expect(held.senses).toEqual([
      expect.objectContaining({
        grantId: grant.id,
        range: expect.objectContaining({ amount: 60, unit: 'FEET' })
      })
    ])
  }, 120000)

  it.each([
    { level: 3, label: 'Aid (2nd level)', bonus: 5 },
    { level: 5, label: 'Aid (3rd level)', bonus: 10 }
  ])(
    '$label holds a $bonus hit point maximum bonus on the chosen target',
    async ({ level, label, bonus }) => {
      const room = await casterRoom(aid, label, { allied: true, level })

      const { answer } = await room.startActorsAction([WOLF_ID], RANGE_UNCHECKED)
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      const held = await wolfGrants(room)
      expect(held.effects).toHaveLength(1)
      expect(held.modifiers).toEqual([
        {
          valueDomainCode: 'HIT_POINTS_MAX',
          modifierKind: 'BONUS',
          domain: {},
          payload: { valueKind: 'FIXED', amount: bonus }
        }
      ])
      // The Wolf starts at its maximum; the heal after the grant sees the raised one (SPELLS-8.T16).
      expect(held.wolf.currentHitPoints).toBe(plainWolf.hitPoints + bonus)
    },
    120000
  )

  it.each([
    { level: 3, label: 'Aid (2nd level)', bonus: 5 },
    { level: 5, label: 'Aid (3rd level)', bonus: 10 }
  ])(
    '$label raises a Character at full hit points by $bonus (SPELLS-8.T16)',
    async ({ level, label, bonus }) => {
      const room = await casterRoom(aid, label, { allied: true, level })
      const before = await characterHitPoints(room)

      const { answer } = await room.startActorsAction([CHARACTER_ACTOR_ID], RANGE_UNCHECKED)
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      expect(await characterHitPoints(room), JSON.stringify(answer)).toBe(before + bonus)
    },
    120000
  )

  it.each([
    // The attack's d20 (a 16) hits the Wolf's AC 13; the damage die rolls a 4.
    { spell: rayOfFrost, label: 'Ray of Frost', rolls: [15, 3] },
    { spell: shockingGrasp, label: 'Shocking Grasp', rolls: [15, 3] },
    // The Wolf's Wisdom save (a 1) fails; the damage die rolls a 2.
    { spell: viciousMockery, label: 'Vicious Mockery', rolls: [0, 1] }
  ])(
    '$label damages the hostile target and holds its authored grant on it',
    async ({ spell, label, rolls }) => {
      const room = await casterRoom(spell, label, { rolls })

      const { answer } = await room.startAction(WOLF_ID, RANGE_UNCHECKED)
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      const held = await wolfGrants(room)
      expect(held.wolf.currentHitPoints).toBeLessThan(plainWolf.hitPoints)
      expect(held.effects).toHaveLength(1)
      expect(held.modifiers).toEqual(authoredModifiers(spell))
    },
    120000
  )
})
