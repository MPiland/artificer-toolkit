import { describe, expect, it } from 'vitest'
import { onEndGrantEffectId } from '@artificer-toolkit/rules-runtime/encounterEffectOnEnd'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import {
  ENCOUNTER_ID,
  creatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { haste } from '@artificer-toolkit/source-data/srd/spells/haste.js'
import { huntersMark } from '@artificer-toolkit/source-data/srd/spells/hunters-mark.js'

import { createActiveRuleEffectStore, readActiveEffectsByActorId } from '../effectStore.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import type { EncounterPersistenceTransaction } from '../ports.js'
import type { EncounterDocument } from '../store.js'

/**
 * SPELLS-4.T2d2: the store operations a move of a held effect (D160) and its undo run, against the
 * real effect store: the same record under the new holder, nothing left behind at the old one.
 */

const SOURCE_ID = '00000000-0000-4000-8000-0000000f0101'
const FROM_ID = '00000000-0000-4000-8000-0000000f0102'
const TO_ID = '00000000-0000-4000-8000-0000000f0103'
const SLOT_ID = '00000000-0000-4000-8000-0000000f0104'
const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000f0105'
const EFFECT_ID = '00000000-0000-4000-8000-0000000f0106'

const actorOf = (id: string) => creatureActor({ id, kind: 'CUSTOM', snapshot: {} })
const owners = {
  from: turnEffectOwner(actorOf(FROM_ID), ENCOUNTER_ID),
  to: turnEffectOwner(actorOf(TO_ID), ENCOUNTER_ID)
}

/** A Run whose concentrating source marked `FROM_ID` with `spell`'s effect for ten rounds. */
async function markedRun(spell: { effects?: Parameters<typeof plannedModifierGrant>[0]['effect'][] }) {
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
    [SOURCE_ID, FROM_ID, TO_ID].map((id, index) => ({
      _id: `actor${index}`,
      _creationTime: 2 + index,
      encounterId: ENCOUNTER_ID,
      id
    })) as unknown as EncounterDocument<'encounterRunActors'>[],
    { validate: false }
  )
  const ctx = { db: memory.store } as unknown as EncounterPersistenceTransaction
  const store = createActiveRuleEffectStore(ctx)
  await store.createMaintainedState({
    id: SLOT_ID,
    encounterId: ENCOUNTER_ID,
    ownerActorId: SOURCE_ID,
    descriptor: {
      schemaVersion: 2,
      maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
      definitionChecksum: 'a'.repeat(64),
      provenance: { kind: 'ACTION', sourceActionId: 'cast', sourceOccurrenceId: OCCURRENCE_ID },
      sourceActorId: SOURCE_ID,
      replacementPolicy: 'REPLACE_SAME_DEFINITION',
      emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
    }
  })
  const planned = plannedModifierGrant({
    encounterId: ENCOUNTER_ID,
    sourceActorId: SOURCE_ID,
    holderActorId: FROM_ID,
    lifecycle: {},
    effect: spell.effects?.[0],
    rounds: 10
  })
  const before = await store.create({
    id: EFFECT_ID,
    owner: owners.from,
    definition: planned.definition,
    lifecycle: { schemaVersion: 1, remainingTicks: 7 },
    maintainedEffectStateId: SLOT_ID
  })
  return { ctx, store, before }
}

/** The move the command makes: delete at the old holder as REMOVED, create the same record at the new. */
async function move(run: Awaited<ReturnType<typeof markedRun>>) {
  const { store, before } = run
  await store.deleteCas({
    id: before.id,
    owner: owners.from,
    expectedVersion: before.version,
    removal: 'REMOVED'
  })
  return store.create({
    id: before.id,
    owner: owners.to,
    definition: before.definition,
    lifecycle: before.lifecycle,
    maintainedEffectStateId: before.maintainedEffectStateId
  })
}

describe('a held effect moved to another holder', () => {
  it('keeps its id, definition, remaining duration and maintained state at the new holder', async () => {
    const run = await markedRun(huntersMark)
    const moved = await move(run)

    expect(moved).toMatchObject({
      id: EFFECT_ID,
      definition: run.before.definition,
      maintainedEffectStateId: SLOT_ID
    })
    expect(moved.lifecycle.remainingTicks).toBe(7)
    expect(await run.store.list(owners.from)).toEqual([])
    expect((await run.store.list(owners.to)).map(({ id }) => id)).toEqual([EFFECT_ID])
  })

  it('leaves no follow-on grant behind at the old holder, which a removal never makes', async () => {
    const run = await markedRun(haste)
    await move(run)

    expect(await run.store.list(owners.from)).toEqual([])
    expect((await run.store.list(owners.to)).map(({ id }) => id)).toEqual([EFFECT_ID])
    expect(
      (await run.store.list(owners.to)).some(({ id }) => id === onEndGrantEffectId(EFFECT_ID))
    ).toBe(false)
  })

  it('is read by holder for the offers its source is made', async () => {
    const run = await markedRun(huntersMark)
    await move(run)
    const byHolder = await readActiveEffectsByActorId(run.ctx, ENCOUNTER_ID, [
      actorOf(FROM_ID),
      actorOf(TO_ID)
    ])
    expect(byHolder.get(FROM_ID)).toEqual([])
    expect(byHolder.get(TO_ID)?.map(({ id }) => id)).toEqual([EFFECT_ID])
  })

  it('is undone by recreating the exact record at the old holder', async () => {
    const run = await markedRun(huntersMark)
    const moved = await move(run)
    await run.store.deleteCas({
      id: moved.id,
      owner: owners.to,
      expectedVersion: moved.version,
      removal: 'REMOVED'
    })
    await run.store.create({
      id: run.before.id,
      owner: owners.from,
      definition: run.before.definition,
      lifecycle: run.before.lifecycle,
      maintainedEffectStateId: run.before.maintainedEffectStateId,
      restoredFrom: run.before
    })

    expect(await run.store.list(owners.to)).toEqual([])
    expect(await run.store.list(owners.from)).toEqual([run.before])
  })

  it('refuses the undo once the moved effect changed', async () => {
    const run = await markedRun(huntersMark)
    const moved = await move(run)
    await expect(
      run.store.deleteCas({
        id: moved.id,
        owner: owners.to,
        expectedVersion: moved.version + 1,
        removal: 'REMOVED'
      })
    ).rejects.toThrow('changed before deletion')
  })
})
