import { describe, expect, it, vi } from 'vitest'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import {
  ENCOUNTER_ID,
  creatureActor,
  srdCondition,
  srdDefinitions,
  srdEncounterState
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readConcentrationEndReason } from '../concentrationEnd.js'
import { persistEncounterConcentrationChildren } from '../concentrationChildrenPersistence.js'
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
