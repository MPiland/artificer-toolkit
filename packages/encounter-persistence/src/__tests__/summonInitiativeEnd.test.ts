import { describe, expect, it } from 'vitest'
import { takesInitiativeTurns } from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import { initiativePolicySnapshot } from '@artificer-toolkit/rules-runtime/testing/initiativePolicySnapshot'
import {
  ENCOUNTER_ID,
  creatureActor,
  srdEncounterState
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  encounterActorTokenBindingSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterInitiativeParticipantDtoSchema,
  encounterInitiativeRoundDtoSchema,
  encounterInitiativeSideDtoSchema
} from '@artificer-toolkit/schema/shared/initiativeState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { insertReinforcementInitiative } from '../actorReinforcementInitiative.js'
import { insertRunActor, readRunState } from '../documents.js'
import { readEncounterInitiativeRound } from '../initiativeStore.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import { endOrphanedConjuredActors, removeConjuredActors } from '../summonRemoval.js'
import { presentTimelineEntry } from '../timelineEntries.js'

const FIRST_ID = '00000000-0000-4000-8000-0000000b6001'
const CASTER_ID = '00000000-0000-4000-8000-0000000b6002'
const SUMMON_ID = '00000000-0000-4000-8000-0000000b6003'
const OTHER_SUMMON_ID = '00000000-0000-4000-8000-0000000b6004'
const LAST_ID = '00000000-0000-4000-8000-0000000b6005'
const CARRIER_ID = '00000000-0000-4000-8000-0000000b6006'
const GM_USER_ID = '00000000-0000-4000-8000-0000000b6007'
const SCENE_ID = '00000000-0000-4000-8000-0000000b6008'
const COMMAND_ID = '00000000-0000-4000-8000-0000000b6009'
const OCCURRED_AT = '2026-10-30T00:00:00.000Z'

const unowned = (id: string) => creatureActor({ id, kind: 'CUSTOM', snapshot: {} })
const conjured = (id: string, turnTiming?: 'OWN_INITIATIVE' | 'AFTER_OWNER') => ({
  ...creatureActor({ id, kind: 'CUSTOM', snapshot: { label: 'Spectral Hand' } }),
  owner: {
    ownerActorId: CASTER_ID,
    sourceEffectId: CARRIER_ID,
    ...(turnTiming && { turnTiming })
  }
})

const SIDE_FIRST = '00000000-0000-4000-8000-0000000b6101'
const SIDE_CASTER = '00000000-0000-4000-8000-0000000b6102'

/**
 * A manual-order round with each actor that takes initiative in turn, `currentActorId` acting; or,
 * with `sideRoll`, a side-roll round whose two sides are SIDE_FIRST then SIDE_CASTER.
 */
async function runWithRound(
  actors: readonly EncounterRunActorState[],
  currentActorId: string | null,
  sideRoll = false
) {
  const policy = sideRoll
    ? initiativePolicySnapshot({ procedure: 'SIDE_ROLL', cadence: 'ENCOUNTER_START' })
    : null
  const memory = createMemoryEncounterStore()
  const removed: unknown[] = []
  const ctx = {
    db: memory.store,
    ports: { removeSummonTokens: async (input: unknown) => void removed.push(input) }
  }
  const state = srdEncounterState({
    actors,
    currentActorId,
    ...(policy
      ? {
          initiativePolicy: policy,
          sides: [
            { id: SIDE_FIRST, label: 'First' },
            { id: SIDE_CASTER, label: 'Caster' }
          ]
        }
      : { automationMode: 'MANUAL' as const })
  })
  await memory.store.insert('encounterRuns', {
    id: state.id,
    campaignId: state.campaignId,
    gameSystemId: state.gameSystemId,
    status: state.status,
    version: state.version,
    stateJson: JSON.stringify(state),
    stateChecksum: checksumCanonicalJson(state),
    createCommandId: CARRIER_ID,
    createCommandFingerprint: 'b'.repeat(64),
    concentrationCasterCharacterIds: [],
    createdAt: OCCURRED_AT,
    updatedAt: OCCURRED_AT
  })
  for (const actor of actors) await insertRunActor(ctx, actor)
  const order = actors.filter(takesInitiativeTurns)
  const activeIndex = order.findIndex(({ id }) => id === currentActorId)
  await memory.store.insert(
    'encounterInitiativeRounds',
    encounterInitiativeRoundDtoSchema.parse({
      encounterId: ENCOUNTER_ID,
      round: 1,
      procedure: policy ? 'SIDE_ROLL' : 'MANUAL',
      cadence: 'ENCOUNTER_START',
      status: 'ACTIVE',
      policySnapshotChecksum: policy?.checksum ?? null,
      nextTurnOrderOrdinal: order.length,
      version: 0,
      createdAt: OCCURRED_AT,
      updatedAt: OCCURRED_AT
    })
  )
  for (const [index, actor] of order.entries())
    await memory.store.insert(
      'encounterInitiativeParticipants',
      encounterInitiativeParticipantDtoSchema.parse({
        encounterId: ENCOUNTER_ID,
        round: 1,
        actorId: actor.id,
        sideId: actor.sideId,
        status: index < activeIndex ? 'ACTED' : index === activeIndex ? 'ACTIVE' : 'READY',
        initiativeScore: policy ? (actor.sideId === SIDE_FIRST ? 18 : 9) : null,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        declaration: null,
        declarationChecksum: null,
        turnOrderOrdinal: index,
        version: 0,
        createdAt: OCCURRED_AT,
        updatedAt: OCCURRED_AT
      })
    )
  if (policy)
    for (const [index, sideId] of [SIDE_FIRST, SIDE_CASTER].entries()) {
      const activeSideId = order[activeIndex]?.sideId
      const activeSideIndex = [SIDE_FIRST, SIDE_CASTER].indexOf(activeSideId ?? '')
      await memory.store.insert(
        'encounterInitiativeSides',
        encounterInitiativeSideDtoSchema.parse({
          encounterId: ENCOUNTER_ID,
          round: 1,
          sideId,
          status:
            index < activeSideIndex ? 'COMPLETED' : index === activeSideIndex ? 'ACTIVE' : 'READY',
          initiativeScore: index === 0 ? 18 : 9,
          evaluation: { occurrenceId: null, resultChecksum: null },
          tie: { occurrenceId: null, resultChecksum: null },
          sideOrderOrdinal: index,
          version: 0,
          createdAt: OCCURRED_AT,
          updatedAt: OCCURRED_AT
        })
      )
    }
  for (const [index, actor] of actors.entries())
    if (actor.owner)
      await memory.store.insert(
        'encounterActorTokenBindings',
        encounterActorTokenBindingSchema.parse({
          actorId: actor.id,
          encounterId: ENCOUNTER_ID,
          sceneId: SCENE_ID,
          tokenId: `00000000-0000-4000-8000-0000000b61${String(index).padStart(2, '0')}`
        })
      )
  return { memory, ctx, removed, state }
}

const caster = unowned(CASTER_ID)
const round = async (memory: ReturnType<typeof createMemoryEncounterStore>) =>
  readEncounterInitiativeRound({ db: memory.store }, { encounterId: ENCOUNTER_ID, round: 1 })
const placed = (state: Awaited<ReturnType<typeof round>>) =>
  state!.participants
    .slice()
    .sort((a, b) => a.turnOrderOrdinal! - b.turnOrderOrdinal!)
    .map(({ actorId, status, turnOrderOrdinal }) => [actorId, status, turnOrderOrdinal])

/** The caster's carrier effect is absent, as once its effect has ended. */
const sweepAfterCarrierEnded = (
  harness: Awaited<ReturnType<typeof runWithRound>>,
  encounterId = ENCOUNTER_ID
) =>
  endOrphanedConjuredActors(harness.ctx, {
    encounterId,
    userId: GM_USER_ID,
    occurredAt: OCCURRED_AT
  })

describe('removing creatures that took their own initiative (D200)', () => {
  const actors = [
    unowned(FIRST_ID),
    caster,
    conjured(SUMMON_ID, 'OWN_INITIATIVE'),
    conjured(OTHER_SUMMON_ID, 'OWN_INITIATIVE'),
    unowned(LAST_ID)
  ]

  it('takes the creature out of the round and renumbers the places behind it, keeping the cursor', async () => {
    const harness = await runWithRound(actors, CASTER_ID)
    expect(placed(await round(harness.memory))).toEqual([
      [FIRST_ID, 'ACTED', 0],
      [CASTER_ID, 'ACTIVE', 1],
      [SUMMON_ID, 'READY', 2],
      [OTHER_SUMMON_ID, 'READY', 3],
      [LAST_ID, 'READY', 4]
    ])

    const { state, initiative } = await removeConjuredActors(harness.ctx, {
      state: harness.state,
      commandId: COMMAND_ID,
      actorIds: [SUMMON_ID],
      occurredAt: OCCURRED_AT
    })

    expect(state.actorIds).not.toContain(SUMMON_ID)
    expect(state.currentActorId).toBe(CASTER_ID)
    expect(placed(await round(harness.memory))).toEqual([
      [FIRST_ID, 'ACTED', 0],
      [CASTER_ID, 'ACTIVE', 1],
      [OTHER_SUMMON_ID, 'READY', 2],
      [LAST_ID, 'READY', 3]
    ])
    expect(initiative).toEqual(await round(harness.memory))
  })

  it('removes several creatures in one call', async () => {
    const harness = await runWithRound(actors, FIRST_ID)
    const { initiative } = await removeConjuredActors(harness.ctx, {
      state: harness.state,
      commandId: COMMAND_ID,
      actorIds: [SUMMON_ID, OTHER_SUMMON_ID],
      occurredAt: OCCURRED_AT
    })
    expect(placed(initiative)).toEqual([
      [FIRST_ID, 'ACTIVE', 0],
      [CASTER_ID, 'READY', 1],
      [LAST_ID, 'READY', 2]
    ])
  })

  it('refuses the creature whose turn it is and removes nothing', async () => {
    const harness = await runWithRound(actors, SUMMON_ID)
    await expect(
      removeConjuredActors(harness.ctx, {
        state: harness.state,
        commandId: COMMAND_ID,
        actorIds: [SUMMON_ID],
        occurredAt: OCCURRED_AT
      })
    ).rejects.toThrow('during its own turn')
    expect(harness.removed).toEqual([])
    expect(harness.memory.documents('encounterRunActors')).toHaveLength(actors.length)
  })

  it('leaves the round alone for a creature that acts on its owner’s turn', async () => {
    const ownerTurn = [unowned(FIRST_ID), caster, conjured(SUMMON_ID)]
    const harness = await runWithRound(ownerTurn, CASTER_ID)
    const before = await round(harness.memory)
    const { initiative } = await removeConjuredActors(harness.ctx, {
      state: harness.state,
      commandId: COMMAND_ID,
      actorIds: [SUMMON_ID],
      occurredAt: OCCURRED_AT
    })
    expect(initiative).toBeNull()
    expect(await round(harness.memory)).toEqual(before)
  })
})

describe('the sweep when a carrier ends (D200)', () => {
  const actors = [
    unowned(FIRST_ID),
    caster,
    conjured(SUMMON_ID, 'OWN_INITIATIVE'),
    conjured(OTHER_SUMMON_ID),
    unowned(LAST_ID)
  ]

  it('records the round’s initiative on the entry and lists none of the removed creatures in it', async () => {
    const harness = await runWithRound(actors, CASTER_ID)

    expect(await sweepAfterCarrierEnded(harness)).toEqual({
      ended: true,
      currentActorOrphaned: false
    })

    const [stored] = harness.memory
      .documents('encounterRunCommands')
      .map(({ _id, _creationTime, ...row }) => encounterStoredRunCommandSchema.parse(row))
    expect(stored).toMatchObject({
      commandType: 'SUMMONS_ENDED',
      receipt: { removedActorIds: [SUMMON_ID, OTHER_SUMMON_ID].sort() }
    })
    const initiative = await round(harness.memory)
    expect(stored!.commandType === 'SUMMONS_ENDED' && stored!.initiativeStateJson).toBe(
      JSON.stringify(initiative)
    )
    expect(placed(initiative)).toEqual([
      [FIRST_ID, 'ACTED', 0],
      [CASTER_ID, 'ACTIVE', 1],
      [LAST_ID, 'READY', 2]
    ])
    expect(readRunState(harness.memory.documents('encounterRuns')[0]!).currentActorId).toBe(
      CASTER_ID
    )
    expect(() => presentTimelineEntry(stored!)).not.toThrow()
  })

  it('records no initiative for creatures that never held a place in it', async () => {
    const harness = await runWithRound([unowned(FIRST_ID), caster, conjured(SUMMON_ID)], CASTER_ID)
    await sweepAfterCarrierEnded(harness)
    const [stored] = harness.memory
      .documents('encounterRunCommands')
      .map(({ _id, _creationTime, ...row }) => encounterStoredRunCommandSchema.parse(row))
    expect(stored).toMatchObject({
      commandType: 'SUMMONS_ENDED',
      initiativeStateJson: null,
      initiativeStateChecksum: null
    })
  })

  it('leaves the creature acting now standing and reports it, removing the others', async () => {
    const harness = await runWithRound(actors, SUMMON_ID)
    const before = harness.memory.documents('encounterRuns')[0]!.version

    expect(await sweepAfterCarrierEnded(harness)).toEqual({
      ended: true,
      currentActorOrphaned: true
    })

    const run = harness.memory.documents('encounterRuns')[0]!
    expect(run.version).toBe(before + 1)
    expect(readRunState(run)).toMatchObject({ currentActorId: SUMMON_ID })
    expect(readRunState(run).actorIds).toContain(SUMMON_ID)
    expect(readRunState(run).actorIds).not.toContain(OTHER_SUMMON_ID)
    // The round stays one an ordinary advance can leave: the cursor on the standing creature.
    expect(placed(await round(harness.memory))).toEqual([
      [FIRST_ID, 'ACTED', 0],
      [CASTER_ID, 'ACTED', 1],
      [SUMMON_ID, 'ACTIVE', 2],
      [LAST_ID, 'READY', 3]
    ])
  })

  it('writes nothing while the only orphan is the creature acting now', async () => {
    const harness = await runWithRound(
      [unowned(FIRST_ID), caster, conjured(SUMMON_ID, 'OWN_INITIATIVE')],
      SUMMON_ID
    )
    const before = harness.memory.documents('encounterRuns')[0]!.version

    expect(await sweepAfterCarrierEnded(harness)).toEqual({
      ended: false,
      currentActorOrphaned: true
    })

    expect(harness.memory.documents('encounterRuns')[0]!.version).toBe(before)
    expect(harness.memory.documents('encounterRunCommands')).toEqual([])
  })

  it('rejects a stored entry whose initiative still lists a removed creature or whose checksum differs', async () => {
    const harness = await runWithRound(actors, CASTER_ID)
    const before = await round(harness.memory)
    await sweepAfterCarrierEnded(harness)
    const [row] = harness.memory.documents('encounterRunCommands')
    const stored = encounterStoredRunCommandSchema.parse(
      (({ _id, _creationTime, ...rest }) => rest)(row!)
    )
    if (stored.commandType !== 'SUMMONS_ENDED') throw new Error('Expected the summons entry.')

    expect(() =>
      presentTimelineEntry({
        ...stored,
        initiativeStateJson: JSON.stringify(before),
        initiativeStateChecksum: checksumCanonicalJson(before)
      })
    ).toThrow('initiative receipt mismatch')
    expect(() =>
      presentTimelineEntry({ ...stored, initiativeStateChecksum: 'c'.repeat(64) })
    ).toThrow('initiative receipt mismatch')
    expect(() => presentTimelineEntry({ ...stored, initiativeStateChecksum: null })).toThrow(
      'initiative receipt mismatch'
    )
  })
})

describe('seating a summon authored to act right after its owner (D200)', () => {
  const actors = [unowned(FIRST_ID), caster, unowned(LAST_ID)]
  const follower = conjured(SUMMON_ID, 'AFTER_OWNER')
  const seat = (harness: Awaited<ReturnType<typeof runWithRound>>) =>
    insertReinforcementInitiative({
      ctx: harness.ctx,
      state: harness.state,
      actors,
      actor: follower,
      initiative: null,
      anchorActorId: CASTER_ID,
      occurredAt: OCCURRED_AT
    })

  it('takes the place behind its owner while the owner acts, with the cursor staying put', async () => {
    const harness = await runWithRound(actors, CASTER_ID)
    const seated = await seat(harness)

    expect(placed(await round(harness.memory))).toEqual([
      [FIRST_ID, 'ACTED', 0],
      [CASTER_ID, 'ACTIVE', 1],
      [SUMMON_ID, 'READY', 2],
      [LAST_ID, 'READY', 3]
    ])
    expect(seated.state).toEqual(await round(harness.memory))
    expect(seated.actor).toMatchObject({ id: SUMMON_ID, manualOrder: 2 })
  })

  it('takes a spent place when the owner has already acted, and a waiting one when it has not', async () => {
    const acted = await runWithRound(actors, LAST_ID)
    await seat(acted)
    expect(placed(await round(acted.memory))).toEqual([
      [FIRST_ID, 'ACTED', 0],
      [CASTER_ID, 'ACTED', 1],
      [SUMMON_ID, 'ACTED', 2],
      [LAST_ID, 'ACTIVE', 3]
    ])

    const waiting = await runWithRound(actors, FIRST_ID)
    await seat(waiting)
    expect(placed(await round(waiting.memory))).toEqual([
      [FIRST_ID, 'ACTIVE', 0],
      [CASTER_ID, 'READY', 1],
      [SUMMON_ID, 'READY', 2],
      [LAST_ID, 'READY', 3]
    ])
  })

  it('shares its owner’s score and side in a side-roll round, keeping the sides contiguous', async () => {
    const sided = [
      { ...unowned(FIRST_ID), sideId: SIDE_FIRST },
      { ...caster, sideId: SIDE_CASTER },
      { ...unowned(LAST_ID), sideId: SIDE_CASTER }
    ]
    const harness = await runWithRound(sided, CASTER_ID, true)
    await insertReinforcementInitiative({
      ctx: harness.ctx,
      state: harness.state,
      actors: sided,
      actor: { ...follower, sideId: SIDE_CASTER },
      initiative: null,
      anchorActorId: CASTER_ID,
      occurredAt: OCCURRED_AT
    })

    const state = (await round(harness.memory))!
    expect(placed(state)).toEqual([
      [FIRST_ID, 'ACTED', 0],
      [CASTER_ID, 'ACTIVE', 1],
      [SUMMON_ID, 'READY', 2],
      [LAST_ID, 'READY', 3]
    ])
    expect(state.participants.find(({ actorId }) => actorId === SUMMON_ID)).toMatchObject({
      sideId: SIDE_CASTER,
      initiativeScore: 9
    })
    expect(state.sides.map(({ sideId, status }) => [sideId, status])).toEqual([
      [SIDE_FIRST, 'COMPLETED'],
      [SIDE_CASTER, 'ACTIVE']
    ])
  })

  it('refuses an owner that holds no place and writes nothing', async () => {
    const harness = await runWithRound(actors, CASTER_ID)
    const before = await round(harness.memory)
    await expect(
      insertReinforcementInitiative({
        ctx: harness.ctx,
        state: harness.state,
        actors,
        actor: follower,
        initiative: null,
        anchorActorId: SUMMON_ID,
        occurredAt: OCCURRED_AT
      })
    ).rejects.toThrow('not in the initiative order')
    expect(await round(harness.memory)).toEqual(before)
  })

  it('is taken out again, with the order behind it closed up, when the cast is undone', async () => {
    const harness = await runWithRound(actors, CASTER_ID)
    const before = await round(harness.memory)
    await insertRunActor(harness.ctx, (await seat(harness)).actor)
    await harness.memory.store.insert(
      'encounterActorTokenBindings',
      encounterActorTokenBindingSchema.parse({
        actorId: SUMMON_ID,
        encounterId: ENCOUNTER_ID,
        sceneId: SCENE_ID,
        tokenId: '00000000-0000-4000-8000-0000000b6199'
      })
    )
    const { initiative } = await removeConjuredActors(harness.ctx, {
      state: srdEncounterState({
        actors: [...actors, follower],
        currentActorId: CASTER_ID,
        automationMode: 'MANUAL'
      }),
      commandId: COMMAND_ID,
      actorIds: [SUMMON_ID],
      occurredAt: OCCURRED_AT
    })
    expect(placed(initiative)).toEqual(placed(before))
  })
})
