import { describe, expect, it } from 'vitest'
import { encounterEscapeEndedConditionIds } from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { incomingDamageGrantRecords } from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import { movementDamageEnds } from '@artificer-toolkit/rules-runtime/encounterSpatialDamageEnds'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import {
  ENCOUNTER_ID,
  creatureActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import { canonicalActiveEffectEndTriggers } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { hideousLaughter } from '@artificer-toolkit/source-data/srd/spells/hideous-laughter.js'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { createActiveRuleEffectStore } from '../effectStore.js'
import {
  persistLiveMovementDamageEnd,
  persistLiveMovementDamageGrant
} from '../escapedEffectEndPersistence.js'
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
const COMMAND_ID = '00000000-0000-4000-8000-0000000f0207'
const GOLEM_ID = '00000000-0000-4000-8000-0000000f0208'
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

/** A Run holding the given actors, with no effects yet. */
function runOf(runActors: readonly EncounterRunActorState[]) {
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
    runActors.map((actor, index) => ({
      ...actor,
      _id: `actor${index}`,
      _creationTime: 2 + index,
      encounterId: ENCOUNTER_ID
    })) as unknown as EncounterDocument<'encounterRunActors'>[],
    { validate: false }
  )
  return { db: memory.store } as unknown as EncounterCharacterWriteTransaction
}

/** A Run whose holder carries Hideous Laughter authored (fixture data) to end on damage too. */
async function laughingRun() {
  const ctx = runOf(actors)
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
          { event: 'DAMAGE_TAKEN' as const, by: 'ANYONE' as const, damageTypeIds: null }
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
      commandId: COMMAND_ID,
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
      movementDamageEnds({
        holder: actors[1]!,
        held: await run.store.list(owner),
        executions: contact(1),
        encounter: { id: ENCOUNTER_ID, currentActorId: HOLDER_ID },
        occurrenceId: OCCURRENCE_ID,
        commandId: COMMAND_ID,
        dispositions: new Map(actors.map(({ id, disposition }) => [id, disposition]))
      }).endedEffects.map(({ id }) => id)
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

/**
 * QUALITY-14.T2d2: a `DAMAGE_GRANT` step is re-derived from the holder's current rows and the move's
 * applied contacts, so the commit creates only a grant the move's damage owes.
 */
describe('a DAMAGE_GRANT step for an SRD Flesh Golem (Aversion of Fire)', () => {
  const FIRE = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'FIRE')!.id
  const golem = srdCreatureActor({
    id: GOLEM_ID,
    creature: srdByLabel(SRD.creatures, 'Flesh Golem')
  })
  const golemActors = [...actors, golem]
  const golemOwner = turnEffectOwner(golem, ENCOUNTER_ID)
  const state = { id: ENCOUNTER_ID, currentActorId: GOLEM_ID }
  /** One zone contact of the move that dealt the Golem 3 damage of the given type. */
  const golemContact = (damageTypeId: string) =>
    [
      {
        applications: [
          { kind: 'DAMAGE', targetActorId: GOLEM_ID, damageTypeId, resolvedAmount: 3 }
        ],
        candidate: { candidate: { sourceActorId: ZONE_SOURCE_ID, targetActorId: GOLEM_ID } }
      }
    ] as unknown as DamageEnd['executions']
  /** The step the room plans for the grant the move's fire damage owes. */
  const plannedGrant = () => {
    const [grant] = movementDamageEnds({
      holder: golem,
      held: [],
      executions: golemContact(FIRE),
      encounter: state,
      occurrenceId: OCCURRENCE_ID,
      commandId: COMMAND_ID,
      dispositions: new Map(golemActors.map(({ id, disposition }) => [id, disposition]))
    }).grants
    if (!grant) throw new Error('The fire damage must owe the Golem its grant.')
    const [createdEffect] = incomingDamageGrantRecords({
      grants: [grant],
      owner: golemOwner,
      current: [],
      occurredAt: OCCURRED_AT
    })
    return {
      kind: 'DAMAGE_GRANT' as const,
      damageGrant: { effectId: grant.id, holderActorId: GOLEM_ID },
      createdEffect: createdEffect!
    }
  }
  const golemRun = () => {
    const ctx = runOf(golemActors)
    const grant = (damageTypeId: string) =>
      persistLiveMovementDamageGrant(ctx, {
        state,
        actors: golemActors,
        step: plannedGrant(),
        executions: golemContact(damageTypeId),
        occurrenceId: OCCURRENCE_ID,
        commandId: COMMAND_ID,
        occurredAt: OCCURRED_AT
      })
    return { store: createActiveRuleEffectStore(ctx), grant }
  }

  it('creates the grant the move’s fire damage owes, as the room planned it', async () => {
    const run = golemRun()

    await run.grant(FIRE)
    expect(await run.store.list(golemOwner)).toEqual([plannedGrant().createdEffect])
  })

  it('refuses a forged grant the move’s damage does not owe', async () => {
    const run = golemRun()

    await expect(run.grant(DAMAGE_TYPE_ID)).rejects.toThrow('Movement damage grant is not owed.')
    expect(await run.store.list(golemOwner)).toEqual([])
  })
})
