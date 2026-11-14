import { describe, expect, it } from 'vitest'
import { encounterEscapeEndedConditionIds } from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { movementDamageEndedEffects } from '@artificer-toolkit/rules-runtime/encounterSpatialDamageEnds'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import {
  ENCOUNTER_ID,
  creatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import { canonicalActiveEffectEndTriggers } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { hideousLaughter } from '@artificer-toolkit/source-data/srd/spells/hideous-laughter.js'

import { createActiveRuleEffectStore } from '../effectStore.js'
import { persistLiveMovementDamageEnd } from '../escapedEffectEndPersistence.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import type { EncounterCharacterWriteTransaction } from '../ports.js'
import type { EncounterDocument } from '../store.js'

/**
 * QUALITY-14.T2c: a `DAMAGE_END` step is re-derived from the holder's current rows, so the commit
 * refuses one for an effect a made repeat save already released earlier in the same move.
 */

const CASTER_ID = '00000000-0000-4000-8000-0000000f0201'
const HOLDER_ID = '00000000-0000-4000-8000-0000000f0202'
const ZONE_SOURCE_ID = '00000000-0000-4000-8000-0000000f0203'
const EFFECT_ID = '00000000-0000-4000-8000-0000000f0204'
const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000f0205'
const DAMAGE_TYPE_ID = '00000000-0000-4000-8000-0000000f0206'
const OCCURRED_AT = '2026-11-14T00:00:00.000Z'

type DamageEnd = Parameters<typeof persistLiveMovementDamageEnd>[1]

const actors = [CASTER_ID, HOLDER_ID, ZONE_SOURCE_ID].map((id) =>
  creatureActor({ id, kind: 'CUSTOM', snapshot: {} })
)
const owner = turnEffectOwner(actors[1]!, ENCOUNTER_ID)

/** One zone contact of the move that dealt the holder `amount` damage. */
const contact = (amount: number) =>
  [
    {
      applications: [
        {
          kind: 'DAMAGE',
          targetActorId: HOLDER_ID,
          damageTypeId: DAMAGE_TYPE_ID,
          resolvedAmount: amount
        }
      ],
      candidate: { candidate: { sourceActorId: ZONE_SOURCE_ID, targetActorId: HOLDER_ID } }
    }
  ] as unknown as DamageEnd['executions']

/** A Run whose holder carries Hideous Laughter authored (fixture data) to end on damage too. */
async function laughingRun() {
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
    actors.map((actor, index) => ({
      ...actor,
      _id: `actor${index}`,
      _creationTime: 2 + index,
      encounterId: ENCOUNTER_ID
    })) as unknown as EncounterDocument<'encounterRunActors'>[],
    { validate: false }
  )
  const ctx = { db: memory.store } as unknown as EncounterCharacterWriteTransaction
  const store = createActiveRuleEffectStore(ctx)
  const planned = plannedTimedCondition({
    encounterId: ENCOUNTER_ID,
    sourceActorId: CASTER_ID,
    holderActorId: HOLDER_ID,
    spell: hideousLaughter,
    lifetimeScope: 'ENCOUNTER'
  })
  const effect = await store.create({
    id: EFFECT_ID,
    owner,
    definition: {
      ...planned.definition,
      recurrence: {
        ...planned.definition.recurrence,
        endTriggers: canonicalActiveEffectEndTriggers([
          { event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }
        ])
      }
    },
    lifecycle: planned.lifecycle,
    occurredAt: OCCURRED_AT
  })
  const end = (executions: DamageEnd['executions']) =>
    persistLiveMovementDamageEnd(ctx, {
      state: { id: ENCOUNTER_ID, currentActorId: HOLDER_ID },
      actors,
      step: {
        kind: 'DAMAGE_END',
        damageEnd: { effectId: EFFECT_ID, holderActorId: HOLDER_ID },
        endedEffect: effect,
        removedConditionIds: encounterEscapeEndedConditionIds([effect], effect.id)
      },
      executions,
      occurrenceId: OCCURRENCE_ID,
      occurredAt: OCCURRED_AT
    })
  return { store, effect, end }
}

describe('a DAMAGE_END step for an effect that both ends on damage and offers a repeat save', () => {
  it('refuses the step once a made repeat save released the effect', async () => {
    const run = await laughingRun()
    expect(run.effect.definition.recurrence.repeatTriggers?.length).toBeGreaterThan(0)
    // While the holder carries it, the move's damage does end it: the step is only stale.
    expect(
      movementDamageEndedEffects({
        holderActorId: HOLDER_ID,
        held: await run.store.list(owner),
        executions: contact(1),
        occurrenceId: OCCURRENCE_ID,
        turnActorId: HOLDER_ID,
        dispositions: new Map(actors.map(({ id, disposition }) => [id, disposition]))
      }).map(({ id }) => id)
    ).toEqual([EFFECT_ID])
    await run.store.deleteCas({
      id: run.effect.id,
      owner,
      expectedVersion: run.effect.version,
      removal: 'ENDED'
    })

    await expect(run.end(contact(1))).rejects.toThrow(
      'Movement release differs from its holder effect.'
    )
  })

  it('refuses the step when the move dealt the holder no damage', async () => {
    const run = await laughingRun()

    await expect(run.end(contact(0))).rejects.toThrow(
      'Movement release differs from its holder effect.'
    )
    expect((await run.store.list(owner)).map(({ id }) => id)).toEqual([EFFECT_ID])
  })
})
