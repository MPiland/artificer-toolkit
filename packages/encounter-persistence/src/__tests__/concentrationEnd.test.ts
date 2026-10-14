import { describe, expect, it, vi } from 'vitest'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import {
  ENCOUNTER_ID,
  creatureActor,
  srdCondition,
  srdDefinitions,
  srdEncounterState
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readConcentrationEndReason } from '../concentrationEnd.js'
import { persistEncounterConcentrationChildren } from '../concentrationChildrenPersistence.js'
import { endConcentrationAfterEdit } from '../concentrationEditEnd.js'
import { persistLiveMovementConcentrationEnd } from '../liveMovementConcentrationPersistence.js'
import { concentrationEndOccurrenceId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { createActiveRuleEffectStore } from '../effectStore.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import type { EncounterCharacterWriteTransaction } from '../ports.js'
import type { EncounterDocument } from '../store.js'

const ACTOR_ID = '00000000-0000-4000-8000-0000000c0001'
const USER_ID = '00000000-0000-4000-8000-0000000c0002'
const SLOT_ID = '00000000-0000-4000-8000-0000000c0003'
const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000c0004'
const OWNED_TABLES = [
  'encounterMaintainedEffectStates',
  'encounterActiveRuleEffects',
  'encounterRuleOccurrences',
  'encounterRuleReceipts'
] as const

type Holder = ReturnType<typeof creatureActor>

/** A memory store holding the Run, the holder and the holder's Concentration slot. */
async function holderFixture(actor: Holder) {
  const memory = createMemoryEncounterStore()
  memory.load(
    'encounterRuns',
    [
      { _id: 'run', _creationTime: 1, id: ENCOUNTER_ID }
    ] as unknown as EncounterDocument<'encounterRuns'>[],
    { validate: false }
  )
  memory.load(
    'encounterRunActors',
    [
      { _id: 'actor', _creationTime: 2, encounterId: ENCOUNTER_ID, id: actor.id }
    ] as unknown as EncounterDocument<'encounterRunActors'>[],
    { validate: false }
  )
  const postRulesChatMessage = vi.fn()
  const ctx = {
    db: memory.store,
    ports: {
      requireCampaignAuthority: async () => ({ campaign: { ownerUserId: USER_ID } }),
      readCurrentDefinition: async (definitionId: string) =>
        srdDefinitions.requireCurrent(definitionId),
      readGmRollVisibility: async () => 'PRIVATE',
      postRulesChatMessage
    }
  } as unknown as EncounterCharacterWriteTransaction & {
    ports: Pick<Parameters<typeof persistEncounterConcentrationChildren>[0]['ports'], never>
  }
  await createActiveRuleEffectStore(ctx).createMaintainedState({
    id: SLOT_ID,
    encounterId: ENCOUNTER_ID,
    ownerActorId: actor.id,
    descriptor: {
      schemaVersion: 2,
      maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
      definitionChecksum: 'a'.repeat(64),
      sourceActionId: 'cast',
      sourceOccurrenceId: OCCURRENCE_ID,
      sourceActorId: actor.id,
      replacementPolicy: 'REPLACE_SAME_DEFINITION',
      emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
    }
  })
  return { memory, ctx, postRulesChatMessage }
}

/** Persistence re-derives each Concentration end's reason from the committed state (D95). */
describe('readConcentrationEndReason', () => {
  async function reasonFor(actor: Holder) {
    const { ctx } = await holderFixture(actor)
    return readConcentrationEndReason(ctx, {
      state: srdEncounterState({ actors: [actor], currentActorId: null }),
      actor,
      userId: USER_ID
    })
  }

  it('is DEFEATED for a defeated Creature or custom actor', async () => {
    expect(
      await reasonFor(
        creatureActor({
          id: ACTOR_ID,
          kind: 'CUSTOM',
          snapshot: {},
          currentHitPoints: 0,
          defeated: true
        })
      )
    ).toBe('DEFEATED')
  })

  it('is INCAPACITATED when a condition suppresses the actor-action capability', async () => {
    expect(
      await reasonFor(
        creatureActor({
          id: ACTOR_ID,
          kind: 'CUSTOM',
          snapshot: {},
          conditions: [srdCondition('Paralyzed')]
        })
      )
    ).toBe('INCAPACITATED')
  })

  it('is null for an actor that can act, even at Speed 0', async () => {
    expect(
      await reasonFor(
        creatureActor({
          id: ACTOR_ID,
          kind: 'CUSTOM',
          snapshot: {},
          conditions: [srdCondition('Grappled'), srdCondition('Restrained')]
        })
      )
    ).toBeNull()
  })
})

describe('persistEncounterConcentrationChildren refuses a forged Concentration end', () => {
  const cases: Array<[string, Parameters<typeof creatureActor>[0], 'DEFEATED' | 'INCAPACITATED']> =
    [
      ['a holder that can act', { id: ACTOR_ID, kind: 'CUSTOM', snapshot: {} }, 'INCAPACITATED'],
      [
        'a holder that is only Grappled and Restrained',
        {
          id: ACTOR_ID,
          kind: 'CUSTOM',
          snapshot: {},
          conditions: [srdCondition('Grappled'), srdCondition('Restrained')]
        },
        'INCAPACITATED'
      ],
      [
        'a defeated holder claimed as incapacitated',
        { id: ACTOR_ID, kind: 'CUSTOM', snapshot: {}, currentHitPoints: 0, defeated: true },
        'INCAPACITATED'
      ],
      [
        'an incapacitated holder claimed as defeated',
        { id: ACTOR_ID, kind: 'CUSTOM', snapshot: {}, conditions: [srdCondition('Paralyzed')] },
        'DEFEATED'
      ]
    ]

  it.each(cases)('%s', async (_name, actorInput, reason) => {
    const actor = creatureActor(actorInput)
    const { memory, ctx, postRulesChatMessage } = await holderFixture(actor)
    const snapshot = () => OWNED_TABLES.map((table) => structuredClone(memory.documents(table)))
    const before = snapshot()
    const applyCleanup = vi.fn()

    await expect(
      persistEncounterConcentrationChildren(
        ctx as Parameters<typeof persistEncounterConcentrationChildren>[0],
        {
          state: srdEncounterState({ actors: [actor], currentActorId: null }),
          actors: [actor],
          parentOccurrenceId: OCCURRENCE_ID,
          parentCommandFingerprint: 'b'.repeat(64),
          finalizedDamageEnvelopeChecksum: 'c'.repeat(64),
          remaining: [],
          correlationId: OCCURRENCE_ID,
          userId: USER_ID,
          authorizedCharacterIds: new Set(),
          occurredAt: '2026-10-08T00:00:00.000Z',
          concentration: [],
          pendingConcentration: null,
          endedGrants: [],
          concentrationEnds: [
            {
              ownerActorId: actor.id,
              maintainedStateId: SLOT_ID,
              reason,
              cleanup: {
                maintainedStateId: SLOT_ID,
                removedDependentEffectIds: [],
                characterOwnerTransitions: []
              }
            }
          ]
        },
        { currentCharacterStreamVersion: vi.fn(), applyCleanup }
      )
    ).rejects.toThrow('Live Session concentration end is unexpected.')

    expect(applyCleanup).not.toHaveBeenCalled()
    expect(postRulesChatMessage).not.toHaveBeenCalled()
    expect(snapshot()).toEqual(before)
    expect(memory.documents('encounterMaintainedEffectStates')).toHaveLength(1)
    expect(memory.documents('encounterRuleReceipts')).toEqual([])
  })
})

/** D95: the incapacitation that ends Concentration also ends the grants that end on it (Rage). */
describe('persistEncounterConcentrationChildren ends grants on incapacitation', () => {
  const paralyzed: Parameters<typeof creatureActor>[0] = {
    id: ACTOR_ID,
    kind: 'CUSTOM',
    snapshot: {},
    conditions: [srdCondition('Paralyzed')]
  }
  const ableToAct: Parameters<typeof creatureActor>[0] = {
    id: ACTOR_ID,
    kind: 'CUSTOM',
    snapshot: {},
    conditions: [srdCondition('Grappled')]
  }

  /** Persists `endedGrants` for the holder and returns the grants it still stores. */
  async function endGrants(
    actorInput: Parameters<typeof creatureActor>[0],
    lifecycle: Parameters<typeof plannedModifierGrant>[0]['lifecycle']
  ) {
    const actor = creatureActor(actorInput)
    const { memory, ctx } = await holderFixture(actor)
    const store = createActiveRuleEffectStore(ctx)
    const grant = await store.create({
      id: crypto.randomUUID(),
      owner: turnEffectOwner(actor, ENCOUNTER_ID),
      definition: plannedModifierGrant({
        encounterId: ENCOUNTER_ID,
        sourceActorId: actor.id,
        holderActorId: actor.id,
        lifecycle,
        rounds: 10
      }).definition,
      lifecycle: { schemaVersion: 1, remainingTicks: 10 }
    })
    const persist = () =>
      persistEncounterConcentrationChildren(
        ctx as Parameters<typeof persistEncounterConcentrationChildren>[0],
        {
          state: srdEncounterState({ actors: [actor], currentActorId: null }),
          actors: [actor],
          parentOccurrenceId: OCCURRENCE_ID,
          parentCommandFingerprint: 'b'.repeat(64),
          finalizedDamageEnvelopeChecksum: 'c'.repeat(64),
          remaining: [],
          correlationId: OCCURRENCE_ID,
          userId: USER_ID,
          authorizedCharacterIds: new Set(),
          occurredAt: '2026-10-08T00:00:00.000Z',
          concentration: [],
          pendingConcentration: null,
          concentrationEnds: [],
          endedGrants: [grant]
        },
        { currentCharacterStreamVersion: vi.fn(), applyCleanup: vi.fn() }
      )
    return { persist, held: () => memory.documents('encounterActiveRuleEffects') }
  }

  it('deletes a grant that ends on incapacitation when its holder is incapacitated', async () => {
    const { persist, held } = await endGrants(paralyzed, { endOnEvents: ['ON_INCAPACITATED'] })
    expect(held()).toHaveLength(1)
    await persist()
    expect(held()).toEqual([])
  })

  it.each([
    ['a holder that can act', ableToAct, { endOnEvents: ['ON_INCAPACITATED' as const] }],
    ['a grant that does not end on incapacitation', paralyzed, {}]
  ])('refuses to end the grant of %s', async (_name, actorInput, lifecycle) => {
    const { persist, held } = await endGrants(actorInput, lifecycle)
    await expect(persist()).rejects.toThrow('Live Session grant end is unexpected.')
    expect(held()).toHaveLength(1)
  })
})

describe('persistLiveMovementConcentrationEnd refuses a forged movement end', () => {
  const COMMAND_ID = '00000000-0000-4000-8000-0000000c0005'
  const defeated: Parameters<typeof creatureActor>[0] = {
    id: ACTOR_ID,
    kind: 'CUSTOM',
    snapshot: {},
    currentHitPoints: 0,
    defeated: true
  }
  const cases: Array<
    [string, Parameters<typeof creatureActor>[0], { reason?: 'INCAPACITATED'; occurrence?: string }]
  > = [
    ['a holder that can act', { id: ACTOR_ID, kind: 'CUSTOM', snapshot: {} }, {}],
    ['a defeated holder claimed as incapacitated', defeated, { reason: 'INCAPACITATED' }],
    ['an end with a forged occurrence id', defeated, { occurrence: COMMAND_ID }]
  ]

  it.each(cases)('%s', async (_name, actorInput, forged) => {
    const actor = creatureActor(actorInput)
    const { memory, ctx, postRulesChatMessage } = await holderFixture(actor)
    const snapshot = () => OWNED_TABLES.map((table) => structuredClone(memory.documents(table)))
    const before = snapshot()
    const applyCleanup = vi.fn()
    const occurrenceId = forged.occurrence ?? concentrationEndOccurrenceId(OCCURRENCE_ID, SLOT_ID)

    await expect(
      persistLiveMovementConcentrationEnd(
        ctx as unknown as Parameters<typeof persistLiveMovementConcentrationEnd>[0],
        {
          state: srdEncounterState({ actors: [actor], currentActorId: null }),
          actors: [actor],
          parentOccurrenceId: OCCURRENCE_ID,
          sourceCommandId: COMMAND_ID,
          userId: USER_ID,
          authorizedCharacterIds: new Set(),
          occurredAt: '2026-10-08T00:00:00.000Z',
          execution: {
            sourceCommandId: COMMAND_ID,
            result: {
              occurrenceId,
              applicationOutputs: {
                kind: 'CONCENTRATION_END',
                schemaVersion: 1,
                occurrenceId,
                parentOccurrenceId: OCCURRENCE_ID,
                ownerActorId: actor.id,
                maintainedStateId: SLOT_ID,
                reason: forged.reason ?? 'DEFEATED',
                cleanup: {
                  maintainedStateId: SLOT_ID,
                  removedDependentEffectIds: [],
                  characterOwnerTransitions: []
                }
              }
            },
            ownerTransitions: []
          }
        },
        { currentCharacterStreamVersion: vi.fn(), applyCleanup, readTargetState: vi.fn() }
      )
    ).rejects.toThrow('Live Session movement Concentration end is unexpected.')

    expect(applyCleanup).not.toHaveBeenCalled()
    expect(postRulesChatMessage).not.toHaveBeenCalled()
    expect(snapshot()).toEqual(before)
  })
})

/**
 * The timeline schema cannot know which conditions the System derives onto a holder (D63), so it
 * lets an end's owner `before` differ from the receipt only by conditions. Persistence is what
 * binds that `before` to the committed state, so a forged extra condition is refused here.
 */
describe('persistLiveMovementConcentrationEnd binds the owner projection to stored state', () => {
  const COMMAND_ID = '00000000-0000-4000-8000-0000000c0005'
  const DERIVED_CONDITION_ID = '00000000-0000-4000-8000-0000000c0006'
  const FORGED_CONDITION_ID = '00000000-0000-4000-8000-0000000c0007'
  const stored = {
    currentHitPoints: 0,
    temporaryHitPoints: 0,
    maximumHitPoints: 0,
    conditionIds: [DERIVED_CONDITION_ID],
    deathSaves: null
  }

  async function persistWithBefore(conditionIds: string[]) {
    const actor = creatureActor({
      id: ACTOR_ID,
      kind: 'CUSTOM',
      snapshot: {},
      currentHitPoints: 0,
      defeated: true
    })
    const { memory, ctx, postRulesChatMessage } = await holderFixture(actor)
    const snapshot = () => OWNED_TABLES.map((table) => structuredClone(memory.documents(table)))
    const before = snapshot()
    const applyCleanup = vi.fn(async () => [actor])
    const occurrenceId = concentrationEndOccurrenceId(OCCURRENCE_ID, SLOT_ID)
    const persisted = persistLiveMovementConcentrationEnd(
      ctx as unknown as Parameters<typeof persistLiveMovementConcentrationEnd>[0],
      {
        state: srdEncounterState({ actors: [actor], currentActorId: null }),
        actors: [actor],
        parentOccurrenceId: OCCURRENCE_ID,
        sourceCommandId: COMMAND_ID,
        userId: USER_ID,
        authorizedCharacterIds: new Set(),
        occurredAt: '2026-10-08T00:00:00.000Z',
        execution: {
          sourceCommandId: COMMAND_ID,
          result: {
            occurrenceId,
            applicationOutputs: {
              kind: 'CONCENTRATION_END',
              schemaVersion: 1,
              occurrenceId,
              parentOccurrenceId: OCCURRENCE_ID,
              ownerActorId: actor.id,
              maintainedStateId: SLOT_ID,
              reason: 'DEFEATED',
              cleanup: {
                maintainedStateId: SLOT_ID,
                removedDependentEffectIds: [],
                characterOwnerTransitions: []
              }
            }
          },
          ownerTransitions: [
            {
              targetActorId: actor.id,
              characterId: null,
              before: { ...stored, scalarValues: {}, conditionIds, deathSaves: null },
              after: { ...stored, scalarValues: {}, conditionIds, deathSaves: null }
            }
          ]
        }
      },
      {
        currentCharacterStreamVersion: vi.fn(),
        applyCleanup,
        readTargetState: vi.fn(async () => stored)
      }
    )
    return { persisted, applyCleanup, postRulesChatMessage, snapshot, before }
  }

  it('accepts an owner projection that matches the stored derived conditions', async () => {
    const { persisted, applyCleanup } = await persistWithBefore([DERIVED_CONDITION_ID])

    await expect(persisted).resolves.toHaveLength(1)
    expect(applyCleanup).toHaveBeenCalledOnce()
  })

  it('refuses an owner projection that adds a condition the holder never had', async () => {
    const { persisted, applyCleanup, postRulesChatMessage, snapshot, before } =
      await persistWithBefore([DERIVED_CONDITION_ID, FORGED_CONDITION_ID])

    await expect(persisted).rejects.toThrow(
      'Live Session movement Concentration owner projection changed.'
    )
    expect(applyCleanup).not.toHaveBeenCalled()
    expect(postRulesChatMessage).not.toHaveBeenCalled()
    expect(snapshot()).toEqual(before)
  })
})

/**
 * An edit path (GM actor edit, Sheet edit) derives the end from the committed state itself, so
 * there is no stated reason to forge: a state that still allows action produces no write at all.
 */
describe('endConcentrationAfterEdit', () => {
  const COMMAND_ID = '00000000-0000-4000-8000-0000000c0008'
  const defeated: Parameters<typeof creatureActor>[0] = {
    id: ACTOR_ID,
    kind: 'CUSTOM',
    snapshot: {},
    currentHitPoints: 0,
    defeated: true
  }

  async function endAfterEdit(
    actorInput: Parameters<typeof creatureActor>[0],
    automationMode?: 'MANUAL'
  ) {
    const actor = creatureActor(actorInput)
    const { memory, ctx, postRulesChatMessage } = await holderFixture(actor)
    await endConcentrationAfterEdit(
      ctx as unknown as Parameters<typeof endConcentrationAfterEdit>[0],
      {
        state: srdEncounterState({ actors: [actor], currentActorId: null, automationMode }),
        actors: [actor],
        holder: actor,
        editCommandId: COMMAND_ID,
        userId: USER_ID,
        occurredAt: '2026-10-08T00:00:00.000Z'
      }
    )
    return { memory, postRulesChatMessage }
  }

  const noEndCases: Array<[string, Parameters<typeof creatureActor>[0], 'MANUAL' | undefined]> = [
    ['a holder that can act', { id: ACTOR_ID, kind: 'CUSTOM', snapshot: {} }, undefined],
    [
      'a holder at Speed 0 only',
      {
        id: ACTOR_ID,
        kind: 'CUSTOM',
        snapshot: {},
        conditions: [srdCondition('Grappled'), srdCondition('Restrained')]
      },
      undefined
    ],
    ['a defeated holder in a MANUAL Run', defeated, 'MANUAL']
  ]

  it.each(noEndCases)('ends nothing for %s', async (_name, actorInput, automationMode) => {
    const { memory, postRulesChatMessage } = await endAfterEdit(actorInput, automationMode)

    expect(memory.documents('encounterMaintainedEffectStates')).toHaveLength(1)
    expect(memory.documents('encounterRuleReceipts')).toEqual([])
    expect(memory.documents('encounterRuleOccurrences')).toEqual([])
    expect(postRulesChatMessage).not.toHaveBeenCalled()
  })

  it('ends a defeated holder: slot gone and one CONCENTRATION_END child of the edit command', async () => {
    const { memory } = await endAfterEdit(defeated)

    expect(memory.documents('encounterMaintainedEffectStates')).toEqual([])
    const receipts = memory.documents('encounterRuleReceipts')
    expect(receipts).toHaveLength(1)
    expect(receipts[0]).toMatchObject({ commandType: 'CONCENTRATION_END' })
    expect(JSON.parse(receipts[0]!.resultJson)).toMatchObject({
      applicationOutputs: {
        kind: 'CONCENTRATION_END',
        parentOccurrenceId: COMMAND_ID,
        ownerActorId: ACTOR_ID,
        maintainedStateId: SLOT_ID,
        reason: 'DEFEATED'
      }
    })
  })

  it('ends an incapacitated holder with the derived reason', async () => {
    const { memory } = await endAfterEdit({
      id: ACTOR_ID,
      kind: 'CUSTOM',
      snapshot: {},
      conditions: [srdCondition('Paralyzed')]
    })

    expect(JSON.parse(memory.documents('encounterRuleReceipts')[0]!.resultJson)).toMatchObject({
      applicationOutputs: { reason: 'INCAPACITATED' }
    })
  })
})
