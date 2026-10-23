import { describe, expect, it } from 'vitest'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import {
  ENCOUNTER_ID,
  creatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterCheckActionPendingContextDto } from '@artificer-toolkit/schema/shared/ruleExecutionCheckAction'

import { readCandidateStep } from '../checkActionResponsePersistence.js'
import { createActiveRuleEffectStore } from '../effectStore.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import type { EncounterPersistenceTransaction } from '../ports.js'
import type { EncounterDocument } from '../store.js'

const uuid = (n: number) => `00000000-0000-4000-8000-0000000f${n.toString(16).padStart(4, '0')}`
const ACTOR_ID = uuid(1)
const OCCURRENCE_ID = uuid(2)
const FIRST_ID = uuid(3)
const SECOND_ID = uuid(4)
const OTHER_ID = uuid(5)

const entries = [
  { effectId: FIRST_ID, dc: 13 },
  { effectId: SECOND_ID, dc: 15 }
]

/** The check a spell froze, waiting on the candidate at `cursor`. */
function contextAt(cursor: number): EncounterCheckActionPendingContextDto {
  return {
    kind: 'ENCOUNTER_CHECK_ACTION',
    schemaVersion: 1,
    commandId: uuid(6),
    commandFingerprint: 'a'.repeat(64),
    source: { kind: 'SPELL_CAST', castOccurrenceId: uuid(7) },
    actionLabel: 'Dispel Magic',
    actorId: ACTOR_ID,
    targetActorId: uuid(8),
    check: { checkDefinitionId: uuid(9), dc: entries[cursor]!.dc, label: 'Spellcasting check' },
    d20: {
      rollMode: 'NORMAL',
      keep: 'FIRST',
      contributors: [],
      contributorChecksum: 'b'.repeat(64),
      modifier: 4
    },
    consumedGrants: [],
    candidates: { entries, cursor },
    commandJson: '{}',
    phase: { kind: 'CHECK' }
  }
}

/** Active effect records the memory store holds, to end. */
async function effectRecords() {
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
      { _id: 'actor', _creationTime: 2, encounterId: ENCOUNTER_ID, id: ACTOR_ID }
    ] as unknown as EncounterDocument<'encounterRunActors'>[],
    { validate: false }
  )
  const store = createActiveRuleEffectStore({
    db: memory.store
  } as unknown as EncounterPersistenceTransaction)
  const holder = creatureActor({ id: ACTOR_ID, kind: 'CUSTOM', snapshot: {} })
  const create = (id: string) =>
    store.create({
      id,
      owner: turnEffectOwner(holder, ENCOUNTER_ID),
      definition: plannedModifierGrant({
        encounterId: ENCOUNTER_ID,
        sourceActorId: ACTOR_ID,
        holderActorId: ACTOR_ID,
        lifecycle: {},
        rounds: 10
      }).definition,
      lifecycle: { schemaVersion: 1, remainingTicks: 10 }
    })
  return { first: await create(FIRST_ID), other: await create(OTHER_ID) }
}

const next = (cursor: number) => ({
  occurrenceId: OCCURRENCE_ID,
  applicationContext: contextAt(cursor)
})

describe('readCandidateStep', () => {
  it('is null for a one-check action', () => {
    const { candidates: _candidates, ...oneCheck } = contextAt(0)
    expect(readCandidateStep(undefined, oneCheck, OCCURRENCE_ID, { outcome: 'FAILURE' })).toBeNull()
  })

  it('refuses a candidate step on a one-check action and a one-check settlement on a spell', async () => {
    const { first } = await effectRecords()
    const { candidates: _candidates, ...oneCheck } = contextAt(0)
    const output = { outcome: 'SUCCESS' as const, candidateEffectId: FIRST_ID }
    expect(() =>
      readCandidateStep({ endedEffects: [first], next: null }, oneCheck, OCCURRENCE_ID, output)
    ).toThrow('does not match')
    expect(() => readCandidateStep(undefined, contextAt(0), OCCURRENCE_ID, output)).toThrow(
      'does not match'
    )
  })

  it('ends the waiting effect on a success and asks for the next candidate on the same frozen check', async () => {
    const { first } = await effectRecords()
    const step = readCandidateStep(
      { endedEffects: [first], next: next(1) },
      contextAt(0),
      OCCURRENCE_ID,
      { outcome: 'SUCCESS', candidateEffectId: FIRST_ID }
    )
    expect(step).toEqual({
      endedEffects: [first],
      next: { kind: 'PENDING', snapshot: next(1) }
    })
  })

  it('ends nothing on a failure and completes after the last candidate', () => {
    expect(
      readCandidateStep({ endedEffects: [], next: null }, contextAt(1), OCCURRENCE_ID, {
        outcome: 'FAILURE',
        candidateEffectId: SECOND_ID
      })
    ).toEqual({ endedEffects: [], next: { kind: 'COMPLETE' } })
  })

  it('refuses a result for another candidate than the one waiting', async () => {
    const { first } = await effectRecords()
    expect(() =>
      readCandidateStep({ endedEffects: [first], next: null }, contextAt(1), OCCURRENCE_ID, {
        outcome: 'SUCCESS',
        candidateEffectId: FIRST_ID
      })
    ).toThrow('does not match')
  })

  it('refuses a success that ends nothing, a failure that ends something, and a success that spares the candidate', async () => {
    const { first, other } = await effectRecords()
    const at = (outcome: 'SUCCESS' | 'FAILURE', endedEffects: (typeof first)[]) =>
      readCandidateStep({ endedEffects, next: null }, contextAt(0), OCCURRENCE_ID, {
        outcome,
        candidateEffectId: FIRST_ID
      })
    expect(() => at('SUCCESS', [])).toThrow('does not match')
    expect(() => at('FAILURE', [first])).toThrow('does not match')
    expect(() => at('SUCCESS', [other])).toThrow('does not match')
  })

  it('refuses a next step that does not move the cursor forward or changes the frozen check', () => {
    const failed = { outcome: 'FAILURE' as const, candidateEffectId: FIRST_ID }
    const step = (snapshot: ReturnType<typeof next>) =>
      readCandidateStep({ endedEffects: [], next: snapshot }, contextAt(0), OCCURRENCE_ID, failed)
    expect(() => step(next(0))).toThrow('does not match')
    expect(() =>
      step({ ...next(1), applicationContext: { ...contextAt(1), actionLabel: 'Other' } })
    ).toThrow('does not match')
    expect(() => step({ ...next(1), occurrenceId: uuid(10) })).toThrow('does not match')
    expect(() =>
      step({
        ...next(1),
        applicationContext: { ...contextAt(1), check: { ...contextAt(1).check, dc: 99 } }
      })
    ).toThrow('does not match')
  })
})
