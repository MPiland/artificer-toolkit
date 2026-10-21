import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { DND5E_SAVE_DC_FACT_KEY } from '@artificer-toolkit/rules-runtime/systems/dnd5e/effectActionContracts'
import { spiritGuardians } from '@artificer-toolkit/source-data/srd/spells/spirit-guardians.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { LiveSessionWebSocketServerMessageDto } from '@artificer-toolkit/schema/api/liveSessions'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'
import {
  endConcentrationAtSheet,
  hitPointsOf,
  readMaintainedStates,
  readZones,
  revertLastAction,
  walkerMoves,
  choiceOptionIdOf
} from './placedZoneRoomReads.js'

/**
 * SPELLS-20 T1b: the SRD Spirit Guardians, authored as a SOURCE zone from core options, leaves a 15 ft
 * aura on the caster's token. The real compile, cast, commit and movement path run on it; the wizard
 * fixture casts it (its spell save DC is 8 + 2 proficiency + 1 Intelligence = 11).
 */

const CASTER_ACTOR_ID = testUuid(0x2100)
const CASTER_ID = testUuid(0x2101)
const WOLF_ID = testUuid(0x2102)

const WIZARD_SAVE_DC = 11

/** Every die the room rolls shows this face (zero-based): the save is a 2 against DC 11, each d8 a 2. */
const DIE = 1
const ROLLED_DAMAGE = 3 * (DIE + 1)
/** Every die shows a d20 20 and a d8 4 (zero-based 19), so the save is made and each d8 deals 4. */
const MADE_SAVE_DIE = 19
const D8_FACE_ON_MADE_SAVE = 4

/** A token is 100 px and a cell 5 ft: the caster stands at (150, 150), the aura reaches 300 px past its edge. */
const OUTSIDE_THE_AURA = { x: 150, y: 650 }
const INSIDE_THE_AURA = { x: 150, y: 450 }
/** The authored 15 ft (300 px) plus half the 100 px token. */
const AURA_RADIUS = 350
const FAR_EAST = { x: 750, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function auraRoom(
  wolfAt: { x: number; y: number },
  { label = 'Spirit Guardians (3rd level)', die = DIE }: { label?: string; die?: number } = {}
) {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        snapshot: { kind: 'CHARACTER', id: CASTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    positions: { [WOLF_ID]: wolfAt },
    characterSpellcasting: { spells: [spiritGuardians], prepared: [spiritGuardians.id] },
    characterAction: (action) => action.label === label,
    autoRoll: 'EVERYONE',
    fallbackRoll: die
  })
}

type Room = Awaited<ReturnType<typeof auraRoom>>

/** The auras a member's Encounter session frame lists, read from a fresh subscription. */
async function aurasListedTo(client: {
  messages: LiveSessionWebSocketServerMessageDto[]
  socket: { send(data: string): void }
}) {
  const first = client.messages.length
  client.socket.send(JSON.stringify({ type: 'SUBSCRIBE_ENCOUNTER_SESSION', timeline: false }))
  return vi.waitFor(() => {
    const message = client.messages
      .slice(first)
      .find((candidate) => candidate.type === 'ENCOUNTER_SESSION')
    if (message?.type !== 'ENCOUNTER_SESSION' || !message.session.held)
      throw new Error('The room has not sent the held Encounter session.')
    return message.session.state.auras
  })
}

const RADIANT = choiceOptionIdOf(spiritGuardians, 'Radiant')
const NECROTIC = choiceOptionIdOf(spiritGuardians, 'Necrotic (evil caster)')

/** The cast picks radiant damage unless a test picks another option (D140). */
async function castAura(room: Room, unaffectedActorIds?: string[], choiceOptionId = RADIANT) {
  const { answer } = await room.startCasterCenteredAreaAction([], 'GM', {
    choiceOptionId,
    ...(unaffectedActorIds ? { unaffectedActorIds } : {})
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The caster's player ends their Character's Concentration on the Sheet, as its holder may at any time. */
async function endCasterConcentration(room: Room) {
  const answer = await endConcentrationAtSheet(room, CASTER_ID)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

describe('Spirit Guardians as a source aura (SPELLS-20 T1b)', () => {
  it('leaves one aura on the caster’s token that carries the caster’s spell save DC, putting nobody through its save', async () => {
    const room = await auraRoom(OUTSIDE_THE_AURA)
    const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

    await castAura(room)

    const [zone, ...others] = await readZones(room)
    expect(others).toEqual([])
    expect(zone?.placement).toMatchObject({
      anchorKind: 'TOKEN',
      sourceTokenId: room.room.scene.tokens[0]!.id,
      geometry: { frame: 'TOKEN_LOCAL' },
      label: 'Spirit Guardians',
      visibility: 'PUBLIC'
    })
    expect(JSON.parse(zone!.definitionJson)).toMatchObject({
      adapterFacts: { [DND5E_SAVE_DC_FACT_KEY]: WIZARD_SAVE_DC }
    })
    expect(await room.room.pending()).toBeNull()
    expect(await hitPointsOf(room, WOLF_ID)).toBe(hitPointsBefore)
  })

  it('rolls the failed-save damage for a creature that enters the aura', async () => {
    const room = await auraRoom(OUTSIDE_THE_AURA)
    await castAura(room)
    await room.advanceTurn()
    const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

    const walk = await walkerMoves(room, [OUTSIDE_THE_AURA, INSIDE_THE_AURA])

    expect(walk.executions).toHaveLength(1)
    expect(walk.executions[0]).toMatchObject({
      applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: ROLLED_DAMAGE })]
    })
    expect(walk.executions[0]?.execution.movementInterruption ?? null).toBeNull()
    expect(walk.terminalPosition).toEqual(INSIDE_THE_AURA)
    expect(await hitPointsOf(room, WOLF_ID)).toBe((hitPointsBefore ?? 0) - ROLLED_DAMAGE)
  })

  it('moves with the caster: walking onto a creature outside it makes that creature take the damage, not the caster', async () => {
    const room = await auraRoom(FAR_EAST)
    await castAura(room)
    const wolfHitPoints = await hitPointsOf(room, WOLF_ID)
    const casterHitPoints = await hitPointsOf(room, CASTER_ACTOR_ID)

    const walk = await walkerMoves(
      room,
      [
        { x: 150, y: 150 },
        { x: 450, y: 150 }
      ],
      false,
      0
    )

    expect(walk.executions).toHaveLength(1)
    expect(walk.executions[0]).toMatchObject({
      applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: ROLLED_DAMAGE })]
    })
    expect(await hitPointsOf(room, WOLF_ID)).toBe((wolfHitPoints ?? 0) - ROLLED_DAMAGE)
    expect(await hitPointsOf(room, CASTER_ACTOR_ID)).toBe(casterHitPoints)
  })

  it('removes the aura with the Action when the GM takes it back', async () => {
    const room = await auraRoom(OUTSIDE_THE_AURA)
    await castAura(room)
    expect(await readZones(room)).toHaveLength(1)

    await revertLastAction(room)

    expect(await readZones(room)).toEqual([])
    await room.advanceTurn()
    const walk = await walkerMoves(room, [OUTSIDE_THE_AURA, INSIDE_THE_AURA])
    expect(walk.executions).toEqual([])
  })

  it('opens the caster’s Concentration for the aura, which the aura depends on (D135)', async () => {
    const room = await auraRoom(OUTSIDE_THE_AURA)

    await castAura(room)

    const [state, ...otherStates] = await readMaintainedStates(room)
    expect(otherStates).toEqual([])
    expect(state).toMatchObject({ ownerActorId: CASTER_ACTOR_ID })
    expect(JSON.parse(String(state?.descriptorJson))).toMatchObject({
      sourceActorId: CASTER_ACTOR_ID,
      provenance: { kind: 'ACTION', sourceActionId: expect.any(String) }
    })
    const [zone] = await readZones(room)
    expect(zone?.maintainedEffectStateId).toBe(state!.id)
  })

  it('removes the Concentration with the aura when the GM takes the cast back', async () => {
    const room = await auraRoom(OUTSIDE_THE_AURA)
    await castAura(room)
    expect(await readMaintainedStates(room)).toHaveLength(1)

    await revertLastAction(room)

    expect(await readMaintainedStates(room)).toEqual([])
    expect(await readZones(room)).toEqual([])
  })

  it('lists the aura with its label, radius and source token to the GM and to the caster’s player', async () => {
    const room = await auraRoom(OUTSIDE_THE_AURA)
    expect(await aurasListedTo(room.room.base)).toEqual([])
    await castAura(room)

    const expected = [
      {
        id: (await readZones(room))[0]!.id,
        label: 'Spirit Guardians',
        radius: AURA_RADIUS,
        sourceTokenId: room.room.scene.tokens[0]!.id
      }
    ]
    expect(await aurasListedTo(room.room.base)).toEqual(expected)
    expect(await aurasListedTo(await connectPlayer(room.room.base))).toEqual(expected)
  })

  it('stops listing the aura when the GM takes the cast back', async () => {
    const room = await auraRoom(OUTSIDE_THE_AURA)
    await castAura(room)
    await revertLastAction(room)

    expect(await aurasListedTo(room.room.base)).toEqual([])
  })

  it('removes the aura in the same commit that ends the caster’s Concentration (D135)', async () => {
    const room = await auraRoom(OUTSIDE_THE_AURA)
    await castAura(room)
    expect(await readZones(room)).toHaveLength(1)

    await endCasterConcentration(room)

    expect(await readMaintainedStates(room)).toEqual([])
    expect(await readZones(room)).toEqual([])
    expect(await aurasListedTo(room.room.base)).toEqual([])
    await room.advanceTurn()
    const walk = await walkerMoves(room, [OUTSIDE_THE_AURA, INSIDE_THE_AURA])
    expect(walk.executions).toEqual([])
  })
})

describe('Spirit Guardians damage by save and slot level (SPELLS-20 T4a)', () => {
  async function enteringDamage(room: Room) {
    await castAura(room)
    await room.advanceTurn()
    const hitPointsBefore = (await hitPointsOf(room, WOLF_ID)) ?? 0
    const walk = await walkerMoves(room, [OUTSIDE_THE_AURA, INSIDE_THE_AURA])
    return { walk, lost: hitPointsBefore - ((await hitPointsOf(room, WOLF_ID)) ?? 0) }
  }

  it.each([
    { label: 'Spirit Guardians (3rd level)', dice: 3 },
    { label: 'Spirit Guardians (4th level)', dice: 4 }
  ])('rolls $dice d8 for a creature that fails the save at $label', async ({ label, dice }) => {
    const room = await auraRoom(OUTSIDE_THE_AURA, { label })

    const { walk, lost } = await enteringDamage(room)

    expect(walk.executions[0]).toMatchObject({
      applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: dice * (DIE + 1) })]
    })
    expect(lost).toBe(dice * (DIE + 1))
  })

  it.each([
    { label: 'Spirit Guardians (3rd level)', dice: 3 },
    { label: 'Spirit Guardians (4th level)', dice: 4 }
  ])(
    'deals half the rolled damage to a creature that makes the save at $label',
    async ({ label, dice }) => {
      const room = await auraRoom(OUTSIDE_THE_AURA, { label, die: MADE_SAVE_DIE })
      const half = Math.floor((dice * D8_FACE_ON_MADE_SAVE) / 2)

      const { walk, lost } = await enteringDamage(room)

      expect(walk.executions).toHaveLength(1)
      expect(walk.executions[0]).toMatchObject({
        applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: half })]
      })
      expect(lost).toBe(half)
    }
  )
})

describe('Spirit Guardians designated unaffected creatures (SPELLS-20 T4c)', () => {
  it('never puts a creature the caster designated through the save or its damage', async () => {
    const room = await auraRoom(OUTSIDE_THE_AURA)
    await castAura(room, [WOLF_ID])
    await room.advanceTurn()
    const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

    const walk = await walkerMoves(room, [OUTSIDE_THE_AURA, INSIDE_THE_AURA])

    expect(walk.executions).toEqual([])
    expect(await hitPointsOf(room, WOLF_ID)).toBe(hitPointsBefore)
  })

  it('keeps the designation on the aura it left, and leaves nobody out when none is named', async () => {
    const designated = await auraRoom(OUTSIDE_THE_AURA)
    await castAura(designated, [WOLF_ID])
    expect(await readZones(designated)).toMatchObject([
      { placement: { unaffectedActorIds: [WOLF_ID] } }
    ])

    const open = await auraRoom(OUTSIDE_THE_AURA)
    await castAura(open)
    expect((await readZones(open))[0]?.placement).not.toHaveProperty('unaffectedActorIds')
  })

  it('refuses a designation of a creature that is not in the Encounter', async () => {
    const room = await auraRoom(OUTSIDE_THE_AURA)

    const { answer } = await room.startCasterCenteredAreaAction([], 'GM', {
      choiceOptionId: RADIANT,
      unaffectedActorIds: [crypto.randomUUID()]
    })

    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })
    expect(await readZones(room)).toEqual([])
  })
})

describe('Spirit Guardians halves an affected creature’s speed in the aura (SPELLS-20 T4d, D156)', () => {
  /** The feet the actor's movements this Encounter used, as the room recorded them. */
  async function feetMoved(room: Room, actorId: string) {
    const movements = await runInDurableObject(room.room.base.stub, async (_instance, context) =>
      new RoomEncounterStore(context.storage).documents('encounterTurnMovements')
    )
    return movements
      .filter((movement) => movement.actorId === actorId)
      .reduce((total, { usedFeet }) => total + usedFeet, 0)
  }

  const DEEPER_IN_THE_AURA = { x: 150, y: 350 }

  /** The Wolf's feet for one step that stays inside the aura, cast with these designations or not at all. */
  async function wolfStepFeet(cast: { unaffectedActorIds?: string[] } | null) {
    const room = await auraRoom(INSIDE_THE_AURA)
    if (cast) await castAura(room, cast.unaffectedActorIds)
    await room.advanceTurn()
    await walkerMoves(room, [INSIDE_THE_AURA, DEEPER_IN_THE_AURA])
    return feetMoved(room, WOLF_ID)
  }

  it('charges a creature it affects double for movement inside it', async () => {
    const plainFeet = await wolfStepFeet(null)

    expect(plainFeet).toBeGreaterThan(0)
    expect(await wolfStepFeet({})).toBe(2 * plainFeet)
  })

  it('charges a creature the caster designated unaffected only the plain cost', async () => {
    expect(await wolfStepFeet({ unaffectedActorIds: [WOLF_ID] })).toBe(await wolfStepFeet(null))
  })

  it('never slows the caster it is anchored to', async () => {
    const step = [
      { x: 150, y: 150 },
      { x: 250, y: 150 }
    ]
    const plain = await auraRoom(FAR_EAST)
    await walkerMoves(plain, step, false, 0)

    const room = await auraRoom(FAR_EAST)
    await castAura(room)
    await walkerMoves(room, step, false, 0)

    expect(await feetMoved(room, CASTER_ACTOR_ID)).toBe(await feetMoved(plain, CASTER_ACTOR_ID))
  })
})

describe('Spirit Guardians damage type picked at cast (SPELLS-20 T4e, D140)', () => {
  const damageTypeIdOf = (code: string) =>
    srdSystemRecord.damageTypes.find((damageType) => damageType.code === code)!.id

  it.each([
    { label: 'Radiant', optionId: RADIANT, code: 'RADIANT' },
    { label: 'Necrotic (evil caster)', optionId: NECROTIC, code: 'NECROTIC' }
  ])(
    'deals $code damage to a creature that walks in later after the caster picks $label',
    async ({ optionId, code }) => {
      const room = await auraRoom(OUTSIDE_THE_AURA)
      await castAura(room, undefined, optionId)
      await room.advanceTurn()
      const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

      const walk = await walkerMoves(room, [OUTSIDE_THE_AURA, INSIDE_THE_AURA])

      expect(walk.executions).toHaveLength(1)
      expect(walk.executions[0]).toMatchObject({
        applications: [
          expect.objectContaining({
            kind: 'DAMAGE',
            damageTypeId: damageTypeIdOf(code),
            appliedAmount: ROLLED_DAMAGE
          })
        ]
      })
      expect(await hitPointsOf(room, WOLF_ID)).toBe((hitPointsBefore ?? 0) - ROLLED_DAMAGE)
    }
  )

  it('keeps the picked damage type on the aura it left', async () => {
    const room = await auraRoom(OUTSIDE_THE_AURA)

    await castAura(room, undefined, NECROTIC)

    const [zone] = await readZones(room)
    expect(zone?.definitionJson).toContain(damageTypeIdOf('NECROTIC'))
    expect(zone?.definitionJson).not.toContain(damageTypeIdOf('RADIANT'))
  })

  it.each([
    { name: 'no pick', choices: {} },
    { name: 'a pick the spell does not offer', choices: { choiceOptionId: crypto.randomUUID() } }
  ])('refuses a cast with $name and leaves no aura', async ({ choices }) => {
    const room = await auraRoom(OUTSIDE_THE_AURA)

    const { answer } = await room.startCasterCenteredAreaAction([], 'GM', choices)

    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })
    expect(await readZones(room)).toEqual([])
  })
})
