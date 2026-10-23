import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import {
  insertRunActor,
  readRunActors,
  readRunState
} from '@artificer-toolkit/encounter-persistence/documents'
import { loadActionRelationshipFacts } from '@artificer-toolkit/encounter-persistence/actionPreparationReads'
import { encounterTurnReadTransaction } from './turnReadPorts'

function relationshipEffect(input: {
  encounterId: string
  sourceActorId: string
  actionEffectId: string
  influence: 'ADVANTAGE'
}): ActiveRuleEffectDefinitionDto {
  const definitionId = crypto.randomUUID()
  const entryId = crypto.randomUUID()
  return {
    schemaVersion: 2,
    linkedEffectId: null,
    originLevel: null,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: input.encounterId,
      sourceOccurrenceId: crypto.randomUUID(),
      rootCommandId: crypto.randomUUID(),
      sourceActorId: input.sourceActorId
    },
    authoredEffectId: definitionId,
    compiledEntryId: entryId,
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId,
        gameSystemId: srdSystemRecord.id,
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
      sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
      lifetimeScope: 'ENCOUNTER',
      expiration: { kind: 'INDEFINITE' }
    },
    stateContributions: [
      {
        kind: 'ACTOR_RELATIONSHIP',
        relationshipOutcomeId: crypto.randomUUID(),
        sealedReachFeet: 5,
        modules: [
          {
            id: crypto.randomUUID(),
            order: 0,
            kind: 'SOURCE_ACTION_TARGET_RESTRICTION',
            actionEffectIds: [input.actionEffectId]
          },
          {
            id: crypto.randomUUID(),
            order: 1,
            kind: 'SOURCE_ATTACK_ROLL_INFLUENCE',
            actionEffectIds: [input.actionEffectId],
            influence: input.influence
          }
        ],
        conditionIds: [],
        capabilitySuppressions: []
      }
    ]
  }
}

describe('native action relationship facts', () => {
  it('loads every actor effect owner, enforces target restriction, and preserves effect checksums', async () => {
    const fixture = await setupCharacterRun()
    const source = fixture.run.actors.find((actor) => actor.kind === 'CUSTOM')
    if (!source) throw new Error('Fixture source actor is unavailable.')
    const actionEffectId = crypto.randomUUID()
    const targetId = crypto.randomUUID()
    const effectId = crypto.randomUUID()

    await fixture.owner.caller.run(async (ctx) => {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (query) => query.eq('id', fixture.run.id))
        .unique()
      const sourceRow = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (query) =>
          query.eq('encounterId', fixture.run.id).eq('id', source.id)
        )
        .unique()
      if (!run || !sourceRow) throw new Error('Fixture Encounter is unavailable.')
      const state = encounterRunStateSchema.parse(JSON.parse(run.stateJson))
      const target = encounterRunActorStateSchema.parse({
        ...(await readTestActor(ctx, sourceRow)),
        id: targetId,
        stableTieKey: crypto.randomUUID()
      })
      const nextState = encounterRunStateSchema.parse({
        ...state,
        actorIds: [...state.actorIds, target.id]
      })
      await ctx.db.patch(run._id, {
        stateJson: JSON.stringify(nextState),
        stateChecksum: checksumCanonicalJson(nextState)
      })
      await insertRunActor({ db: createConvexEncounterStore(ctx) }, target)
      const effects = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
      await effects.create({
        id: effectId,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId: fixture.run.id, targetActorId: target.id },
        definition: relationshipEffect({
          encounterId: fixture.run.id,
          sourceActorId: source.id,
          actionEffectId,
          influence: 'ADVANTAGE'
        }),
        lifecycle: { schemaVersion: 1, remainingTicks: null }
      })
      await effects.create({
        id: crypto.randomUUID(),
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId: fixture.run.id, targetActorId: target.id },
        definition: relationshipEffect({
          encounterId: fixture.run.id,
          sourceActorId: fixture.actor.id,
          actionEffectId,
          influence: 'ADVANTAGE'
        }),
        lifecycle: { schemaVersion: 1, remainingTicks: null }
      })
    })

    const load = (targetActorId: string) =>
      fixture.owner.caller.run(async (ctx) => {
        const run = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (query) => query.eq('id', fixture.run.id))
          .unique()
        if (!run) throw new Error('Fixture Encounter is unavailable.')
        const state = readRunState(run)
        const tx = encounterTurnReadTransaction(ctx)
        return loadActionRelationshipFacts(tx, {
          state,
          actors: await readRunActors(tx, state),
          sourceActorId: source.id,
          targetActorId,
          actionEffectId
        })
      })

    await expect(load(fixture.actor.id)).rejects.toThrow('target is restricted')
    await expect(load(targetId)).resolves.toEqual([
      expect.objectContaining({
        source: expect.objectContaining({ kind: 'ACTIVE_EFFECT', id: effectId }),
        sourceId: `ACTIVE_EFFECT:${effectId}`,
        influence: 'ADVANTAGE'
      })
    ])

    await fixture.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterActiveRuleEffects')
        .withIndex('by_encounterId_targetActorId_id', (query) =>
          query.eq('encounterId', fixture.run.id).eq('targetActorId', targetId).eq('id', effectId)
        )
        .unique()
      if (!row) throw new Error('Fixture active effect is unavailable.')
      await ctx.db.patch(row._id, { definitionChecksum: 'b'.repeat(64) })
    })
    await expect(load(targetId)).rejects.toThrow('checksum')
  }, 30_000)
})
