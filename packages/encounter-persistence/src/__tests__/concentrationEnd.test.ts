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
import { knight } from '@artificer-toolkit/source-data/srd/creatures/knight.js'
import { endHolderStateGrants, readHolderEndState } from '../concentrationEnd.js'
import { persistEncounterConcentrationChildren } from '../concentrationChildrenPersistence.js'
import { endConcentrationAfterEdit } from '../concentrationEditEnd.js'
import { persistLiveMovementConcentrationEnd } from '../liveMovementConcentrationPersistence.js'
import {
  concentrationEndOccurrenceId,
  grantEndNoticeId
} from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { createActiveRuleEffectStore } from '../effectStore.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import type { EncounterCharacterWriteTransaction } from '../ports.js'
import type { EncounterDocument } from '../store.js'

const ACTOR_ID = '00000000-0000-4000-8000-0000000c0001'
const USER_ID = '00000000-0000-4000-8000-0000000c0002'
const SLOT_ID = '00000000-0000-4000-8000-0000000c0003'
const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000c0004'
const SCENE_ID = '00000000-0000-4000-8000-0000000c000a'
const DEPENDENT_ZONE_ID = '00000000-0000-4000-8000-0000000c000b'
const INDEPENDENT_ZONE_ID = '00000000-0000-4000-8000-0000000c000c'
const OWNED_TABLES = [
  'encounterMaintainedEffectStates',
  'encounterActiveRuleEffects',
  'encounterRuleOccurrences',
  'encounterRuleReceipts'
] as const

type Holder = ReturnType<typeof creatureActor>

/**
 * A memory store holding the Run, the holder and the holder's Concentration slot. A GM-held actor's
 * chat entries post only when the GM's rolls are public.
 */
async function holderFixture(
  actor: Holder,
  gmRollVisibility: 'PUBLIC' | 'PRIVATE' = 'PRIVATE',
  others: readonly Holder[] = []
) {
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
      ...[actor, ...others].map(({ id }, index) => ({
        _id: `actor-${index}`,
        _creationTime: 2,
        encounterId: ENCOUNTER_ID,
        id
      }))
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
      readGmRollVisibility: async () => gmRollVisibility,
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
      provenance: { kind: 'ACTION', sourceActionId: 'cast', sourceOccurrenceId: OCCURRENCE_ID },
      sourceActorId: actor.id,
      replacementPolicy: 'REPLACE_SAME_DEFINITION',
      emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
    }
  })
  return { memory, ctx, postRulesChatMessage }
}

/** Stores a ten-round modifier grant on the holder, ended by the given lifecycle. */
function storeGrant(
  ctx: Awaited<ReturnType<typeof holderFixture>>['ctx'],
  actor: Holder,
  lifecycle: Parameters<typeof plannedModifierGrant>[0]['lifecycle'],
  sourceLabel?: string
) {
  return createActiveRuleEffectStore(ctx).create({
    id: crypto.randomUUID(),
    owner: turnEffectOwner(actor, ENCOUNTER_ID),
    definition: plannedModifierGrant({
      encounterId: ENCOUNTER_ID,
      sourceActorId: actor.id,
      holderActorId: actor.id,
      lifecycle,
      rounds: 10,
      sourceLabel
    }).definition,
    lifecycle: { schemaVersion: 1, remainingTicks: 10 }
  })
}

/** Persistence re-derives each Concentration end's reason from the committed state (D95). */
describe('readHolderEndState', () => {
  async function reasonFor(actor: Holder) {
    const { ctx } = await holderFixture(actor)
    const { reason } = await readHolderEndState(ctx, {
      state: srdEncounterState({ actors: [actor], currentActorId: null }),
      actor,
      userId: USER_ID
    })
    return reason
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
          damagedActorIds: new Set([actor.id]),
          concentrationEnds: [
            {
              ownerActorId: actor.id,
              maintainedStateId: SLOT_ID,
              reason,
              cleanup: {
                maintainedStateId: SLOT_ID,
                removedDependentEffectIds: [],
                removedZoneIds: [],
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

  /**
   * Persists a commit for the holder and returns the grants it still stores. The plan names the
   * grant as ended unless `sendGrant` is false, and the holder as damaged unless `damaged` is false.
   */
  async function endGrants(
    actorInput: Parameters<typeof creatureActor>[0],
    lifecycle: Parameters<typeof plannedModifierGrant>[0]['lifecycle'],
    { sendGrant = true, damaged = true }: { sendGrant?: boolean; damaged?: boolean } = {}
  ) {
    const actor = creatureActor(actorInput)
    const { memory, ctx, postRulesChatMessage } = await holderFixture(actor, 'PUBLIC')
    const grant = await storeGrant(ctx, actor, lifecycle, 'Rage')
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
          endedGrants: sendGrant ? [grant] : [],
          damagedActorIds: new Set(damaged ? [actor.id] : [])
        },
        { currentCharacterStreamVersion: vi.fn(), applyCleanup: vi.fn() }
      )
    return {
      persist,
      grant,
      postRulesChatMessage,
      held: () => memory.documents('encounterActiveRuleEffects')
    }
  }

  it('deletes a grant that ends on incapacitation when its holder is incapacitated', async () => {
    const { persist, held } = await endGrants(paralyzed, {
      endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_INCAPACITATED' }]
    })
    expect(held()).toHaveLength(1)
    await persist()
    expect(held()).toEqual([])
  })

  it('tells the table which grant the commit ended, once per grant', async () => {
    const { persist, grant, postRulesChatMessage } = await endGrants(paralyzed, {
      endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_INCAPACITATED' }]
    })
    await persist()
    expect(postRulesChatMessage).toHaveBeenCalledWith(expect.anything(), {
      authorUserId: USER_ID,
      clientNonce: grantEndNoticeId(OCCURRENCE_ID, grant.id),
      body: 'Rage ends for Bandit.'
    })
  })

  const holding = (label: string): Parameters<typeof creatureActor>[0] => ({
    id: ACTOR_ID,
    kind: 'CUSTOM',
    snapshot: {},
    conditions: [srdCondition(label)]
  })
  const endsOnUnconscious = { endOnConditionIds: [srdCondition('Unconscious')] }

  it('deletes a grant that names a condition when its holder has it', async () => {
    const { persist, held } = await endGrants(holding('Unconscious'), endsOnUnconscious)
    await persist()
    expect(held()).toEqual([])
  })

  it('refuses to end a grant that names a condition its holder lacks, even when incapacitated', async () => {
    const { persist, held } = await endGrants(holding('Stunned'), endsOnUnconscious)
    await expect(persist()).rejects.toThrow('Live Session grant end is unexpected.')
    expect(held()).toHaveLength(1)
  })

  it.each([
    [
      'a holder that can act',
      ableToAct,
      {
        endTriggers: [
          { event: 'LIFECYCLE' as const, timing: 'END' as const, code: 'ON_INCAPACITATED' as const }
        ]
      }
    ],
    ['a grant that does not end on incapacitation', paralyzed, {}]
  ])('refuses to end the grant of %s', async (_name, actorInput, lifecycle) => {
    const { persist, held } = await endGrants(actorInput, lifecycle)
    await expect(persist()).rejects.toThrow('Live Session grant end is unexpected.')
    expect(held()).toHaveLength(1)
  })

  it('refuses a commit that omits a grant its damaged holder state ends', async () => {
    const { persist, held } = await endGrants(
      paralyzed,
      { endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_INCAPACITATED' }] },
      { sendGrant: false }
    )
    await expect(persist()).rejects.toThrow('Live Session grant end is missing.')
    expect(held()).toHaveLength(1)
  })

  it('leaves the grants of a holder the commit did not damage alone', async () => {
    const { persist, held } = await endGrants(
      paralyzed,
      { endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_INCAPACITATED' }] },
      { sendGrant: false, damaged: false }
    )
    await persist()
    expect(held()).toHaveLength(1)
  })

  it('keeps a condition-bound grant on a defeated holder, whose conditions are not read', async () => {
    const { persist, held } = await endGrants(
      {
        id: ACTOR_ID,
        kind: 'CUSTOM',
        snapshot: {},
        currentHitPoints: 0,
        defeated: true,
        conditions: [srdCondition('Unconscious')]
      },
      endsOnUnconscious,
      { sendGrant: false }
    )
    await persist()
    expect(held()).toHaveLength(1)
  })
})

/** The real Knight's Leadership, which ends for every holder when the Knight can't act. */
describe('persistEncounterConcentrationChildren ends a source grants on every holder (Knight Leadership)', () => {
  const ALLY_IDS = ['00000000-0000-4000-8000-0000000c0011', '00000000-0000-4000-8000-0000000c0012']
  const leadership = knight.features?.find(({ label }) => label.startsWith('Leadership'))
    ?.effects?.[0]
  if (!leadership) throw new Error('The Knight must author Leadership.')

  const incapacitated: Parameters<typeof creatureActor>[0] = {
    id: ACTOR_ID,
    kind: 'CUSTOM',
    snapshot: {},
    conditions: [srdCondition('Paralyzed')]
  }
  const defeated: Parameters<typeof creatureActor>[0] = {
    id: ACTOR_ID,
    kind: 'CUSTOM',
    snapshot: {},
    currentHitPoints: 0,
    defeated: true
  }
  const ableToAct: Parameters<typeof creatureActor>[0] = {
    id: ACTOR_ID,
    kind: 'CUSTOM',
    snapshot: {}
  }

  /** Persists a commit for the Knight, who holds no grant, with a Leadership die on each ally. */
  async function endLeadership(
    knightInput: Parameters<typeof creatureActor>[0],
    {
      sendGrants = 'ALL',
      damaged = true
    }: { sendGrants?: 'ALL' | 'FIRST' | 'NONE'; damaged?: boolean } = {}
  ) {
    const source = creatureActor(knightInput)
    const allies = ALLY_IDS.map((id) => creatureActor({ id, kind: 'CUSTOM', snapshot: {} }))
    const { memory, ctx, postRulesChatMessage } = await holderFixture(source, 'PUBLIC', allies)
    const grants: Awaited<ReturnType<typeof storeGrant>>[] = []
    for (const ally of allies)
      grants.push(
        await createActiveRuleEffectStore(ctx).create({
          id: crypto.randomUUID(),
          owner: turnEffectOwner(ally, ENCOUNTER_ID),
          definition: plannedModifierGrant({
            encounterId: ENCOUNTER_ID,
            sourceActorId: source.id,
            holderActorId: ally.id,
            lifecycle: {},
            effect: leadership,
            rounds: 10,
            sourceLabel: 'Knight'
          }).definition,
          lifecycle: { schemaVersion: 1, remainingTicks: 10 }
        })
      )
    const persist = () =>
      persistEncounterConcentrationChildren(
        ctx as Parameters<typeof persistEncounterConcentrationChildren>[0],
        {
          state: srdEncounterState({ actors: [source, ...allies], currentActorId: null }),
          actors: [source, ...allies],
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
          endedGrants:
            sendGrants === 'ALL' ? grants : sendGrants === 'FIRST' ? grants.slice(0, 1) : [],
          damagedActorIds: new Set(damaged ? [source.id] : [])
        },
        { currentCharacterStreamVersion: vi.fn(), applyCleanup: vi.fn() }
      )
    return {
      persist,
      postRulesChatMessage,
      held: () => memory.documents('encounterActiveRuleEffects')
    }
  }

  it.each([
    ['incapacitated mid-encounter', incapacitated],
    ['defeated', defeated]
  ])('removes the die from every holder when the Knight is %s', async (_name, knightInput) => {
    const { persist, held, postRulesChatMessage } = await endLeadership(knightInput)
    expect(held()).toHaveLength(2)
    await persist()
    expect(held()).toEqual([])
    expect(postRulesChatMessage).toHaveBeenCalledTimes(2)
  })

  it('refuses to end the dice while the Knight can still act', async () => {
    const { persist, held } = await endLeadership(ableToAct)
    await expect(persist()).rejects.toThrow('Live Session grant end is unexpected.')
    expect(held()).toHaveLength(2)
  })

  it('refuses a commit that omits every die its damaged Knight state ends', async () => {
    const { persist, held } = await endLeadership(incapacitated, { sendGrants: 'NONE' })
    await expect(persist()).rejects.toThrow('Live Session grant end is missing.')
    expect(held()).toHaveLength(2)
  })

  it('refuses a commit that sends one holder die but omits another', async () => {
    const { persist, held } = await endLeadership(incapacitated, { sendGrants: 'FIRST' })
    await expect(persist()).rejects.toThrow('Live Session grant end is missing.')
    expect(held()).toHaveLength(2)
  })

  it('leaves the dice alone when the commit did not reach the Knight', async () => {
    const { persist, held } = await endLeadership(incapacitated, {
      sendGrants: 'NONE',
      damaged: false
    })
    await persist()
    expect(held()).toHaveLength(2)
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
                  removedZoneIds: [],
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
                removedZoneIds: [],
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

  it('removes the zones that depend on the ended Concentration in the same commit, keeping others (D135)', async () => {
    const actor = creatureActor(defeated)
    const { memory, ctx } = await holderFixture(actor)
    const zone = (id: string, maintainedEffectStateId: string | null, ordinal: number) => ({
      _id: id,
      _creationTime: ordinal,
      id,
      encounterId: ENCOUNTER_ID,
      sceneId: SCENE_ID,
      createdOrdinal: ordinal,
      version: 1,
      maintainedEffectStateId
    })
    memory.load(
      'encounterSpatialRuleEffects',
      [zone(DEPENDENT_ZONE_ID, SLOT_ID, 1), zone(INDEPENDENT_ZONE_ID, null, 2)] as never,
      { validate: false }
    )
    await endConcentrationAfterEdit(
      ctx as unknown as Parameters<typeof endConcentrationAfterEdit>[0],
      {
        state: srdEncounterState({ actors: [actor], currentActorId: null }),
        actors: [actor],
        holder: actor,
        editCommandId: COMMAND_ID,
        userId: USER_ID,
        occurredAt: '2026-10-08T00:00:00.000Z'
      }
    )

    expect(memory.documents('encounterMaintainedEffectStates')).toEqual([])
    expect(memory.documents('encounterSpatialRuleEffects').map(({ id }) => id)).toEqual([
      INDEPENDENT_ZONE_ID
    ])
    expect(JSON.parse(memory.documents('encounterRuleReceipts')[0]!.resultJson)).toMatchObject({
      applicationOutputs: { cleanup: { removedZoneIds: [DEPENDENT_ZONE_ID] } }
    })
  })

  it('tells the table which grant the edit ended, once per grant', async () => {
    const actor = creatureActor({
      id: ACTOR_ID,
      kind: 'CUSTOM',
      snapshot: {},
      conditions: [srdCondition('Paralyzed')]
    })
    const { memory, ctx, postRulesChatMessage } = await holderFixture(actor, 'PUBLIC')
    const grant = await storeGrant(
      ctx,
      actor,
      { endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_INCAPACITATED' }] },
      'Rage'
    )
    await endConcentrationAfterEdit(
      ctx as unknown as Parameters<typeof endConcentrationAfterEdit>[0],
      {
        state: srdEncounterState({ actors: [actor], currentActorId: null }),
        actors: [actor],
        holder: actor,
        editCommandId: COMMAND_ID,
        userId: USER_ID,
        occurredAt: '2026-10-08T00:00:00.000Z'
      }
    )

    expect(memory.documents('encounterActiveRuleEffects')).toEqual([])
    expect(postRulesChatMessage).toHaveBeenCalledWith(expect.anything(), {
      authorUserId: USER_ID,
      clientNonce: grantEndNoticeId(COMMAND_ID, grant.id),
      body: 'Rage ends for Bandit.'
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

describe('endHolderStateGrants', () => {
  const MOVEMENT_ID = '00000000-0000-4000-8000-0000000c0009'

  async function endFor(conditions: ReturnType<typeof srdCondition>[]) {
    const actor = creatureActor({ id: ACTOR_ID, kind: 'CUSTOM', snapshot: {}, conditions })
    const { memory, ctx, postRulesChatMessage } = await holderFixture(actor, 'PUBLIC')
    const grant = await storeGrant(
      ctx,
      actor,
      { endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_INCAPACITATED' }] },
      'Rage'
    )
    await endHolderStateGrants(ctx as unknown as Parameters<typeof endHolderStateGrants>[0], {
      state: srdEncounterState({ actors: [actor], currentActorId: null }),
      actor,
      occurrenceId: MOVEMENT_ID,
      userId: USER_ID
    })
    return { memory, grant, postRulesChatMessage }
  }

  it('ends the grant an incapacitated holder state ends and tells the table', async () => {
    const { memory, grant, postRulesChatMessage } = await endFor([srdCondition('Paralyzed')])

    expect(memory.documents('encounterActiveRuleEffects')).toEqual([])
    expect(postRulesChatMessage).toHaveBeenCalledWith(expect.anything(), {
      authorUserId: USER_ID,
      clientNonce: grantEndNoticeId(MOVEMENT_ID, grant.id),
      body: 'Rage ends for Bandit.'
    })
  })

  it('keeps the grants of a holder that can still act', async () => {
    const { memory, postRulesChatMessage } = await endFor([])

    expect(memory.documents('encounterActiveRuleEffects')).toHaveLength(1)
    expect(postRulesChatMessage).not.toHaveBeenCalled()
  })
})
