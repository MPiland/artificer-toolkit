import {
  createConvexEncounterStoreReader,
  createConvexEncounterStore
} from '../lib/convexEncounterStore'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'
import { makeFunctionReference } from 'convex/server'
import type {
  SourceImportBatchResultDto,
  SourceImportDefinitionsInput
} from '@artificer-toolkit/schema/api/sourceImport'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { prepareActionEconomy } from '@artificer-toolkit/encounter-persistence/actionPreparationReads'
import { consumeNativeActionEconomy } from '@artificer-toolkit/encounter-persistence/actionEconomyPersistence'
import { readRunActor, writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import type { QueryCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { readMovementTargets } from '../../tests/fixtures/movementTargets'
import { encounterTurnReadTransaction } from './turnReadPorts'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { sourceImportBatches } from '../content/importBatches'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'

const importDefinitions = makeFunctionReference<
  'mutation',
  SourceImportDefinitionsInput,
  SourceImportBatchResultDto
>('content/import:importDefinitions')

/** Prepares the allowance as the Campaign owner reads it. */
async function prepareEconomy(
  ctx: QueryCtx,
  input: Omit<Parameters<typeof prepareActionEconomy>[1], 'campaign'> & { userId: string }
) {
  const { userId, ...economy } = input
  const { campaign } = await requireCampaignAuthority(ctx, input.state.campaignId, userId)
  return prepareActionEconomy(encounterTurnReadTransaction(ctx), { ...economy, campaign })
}

describe('native action economy', () => {
  it('consumes one real allowance, refuses a second use, and rolls back with its enclosing mutation', async () => {
    const base = await setupCharacterRun()
    for (const definitions of sourceImportBatches(SRD_RULE_STATE_DEFINITIONS))
      await base.t.mutation(importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions
      })
    await base.t.run(async (ctx) => {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      if (!run) throw new Error('Missing run.')
      const state = encounterRunStateSchema.parse(JSON.parse(run.stateJson))
      const active = encounterRunStateSchema.parse({
        ...state,
        status: 'ACTIVE',
        automationMode: 'ASSISTED',
        round: 1,
        currentActorId: base.actor.id
      })
      await ctx.db.patch(run._id, {
        status: 'ACTIVE',
        stateJson: JSON.stringify(active),
        stateChecksum: checksumCanonicalJson(active)
      })
    })
    const consume = async (abort = false) =>
      base.owner.caller.run(async (ctx) => {
        const run = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
          .unique()
        if (!run) throw new Error('Missing run.')
        const state = encounterRunStateSchema.parse(JSON.parse(run.stateJson))
        const actor = await readRunActor(
          { db: createConvexEncounterStoreReader(ctx) },
          state,
          base.actor.id
        )
        const target = (
          await readMovementTargets(ctx, {
            encounterId: state.id,
            expectedEncounterVersion: state.version,
            targetActorIds: [actor.id]
          })
        ).get(actor.id)
        if (!target) throw new Error('Missing allowance target.')
        const input = {
          actor: target.actor,
          state,
          userId: base.owner.userId,
          activation: { code: 'ACTION', amount: 1 },
          target
        }
        const prepared = await prepareEconomy(ctx, input)
        expect(await prepareEconomy(ctx, { ...input, actor })).toEqual(prepared)
        await expect(
          prepareEconomy(ctx, {
            ...input,
            actor: { ...actor, label: `${actor.label} (stale)` }
          })
        ).rejects.toThrow('Encounter action economy source is stale.')
        if (!prepared) throw new Error('Missing allowance.')
        const updated = await consumeNativeActionEconomy(
          { db: createConvexEncounterStore(ctx) },
          {
            actor,
            consumption: prepared,
            overridden: false
          }
        )
        expect({ ...updated, resources: actor.resources }).toEqual(actor)
        if (abort) throw new Error('abort')
        return updated
      })
    const before = await base.t.run((ctx) =>
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', base.actor.id)
        )
        .unique()
    )
    await expect(consume(true)).rejects.toThrow('abort')
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', base.run.id).eq('id', base.actor.id)
          )
          .unique()
      )
    ).toEqual(before)
    await consume()
    await expect(consume()).rejects.toThrow('allowance')
  })
  it('refuses a System-suppressed action without changing actor state', async () => {
    const base = await setupCharacterRun()
    for (const definitions of sourceImportBatches(SRD_RULE_STATE_DEFINITIONS))
      await base.t.mutation(importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions
      })
    const source = base.run.actors.find((actor) => actor.kind === 'CUSTOM')
    const condition = srdSystemRecord.conditionTypes.find((entry) => entry.code === 'INCAPACITATED')
    if (!source || !condition) throw new Error('Missing suppression fixture.')
    await base.t.run(async (ctx) => {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id).eq('id', source.id))
        .unique()
      if (!run || !row) throw new Error('Missing Run actor.')
      const state = encounterRunStateSchema.parse({
        ...JSON.parse(run.stateJson),
        status: 'ACTIVE',
        automationMode: 'ASSISTED',
        round: 1,
        currentActorId: source.id
      })
      const actor = encounterRunActorStateSchema.parse({
        ...(await readTestActor(ctx, row)),
        conditions: [condition.id]
      })
      await ctx.db.patch(run._id, {
        status: 'ACTIVE',
        stateJson: JSON.stringify(state),
        stateChecksum: checksumCanonicalJson(state)
      })
      await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, actor)
    })
    const read = () =>
      base.t.run((ctx) =>
        ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', base.run.id).eq('id', source.id)
          )
          .unique()
      )
    const before = await read()
    await expect(
      base.owner.caller.run(async (ctx) => {
        const row = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
          .unique()
        if (!row) throw new Error('Missing Run.')
        const state = encounterRunStateSchema.parse(JSON.parse(row.stateJson))
        const actor = await readRunActor(
          { db: createConvexEncounterStoreReader(ctx) },
          state,
          source.id
        )
        return prepareEconomy(ctx, {
          actor,
          state,
          userId: base.owner.userId,
          activation: { code: 'ACTION', amount: 1 }
        })
      })
    ).rejects.toThrow('allowance')
    expect(await read()).toEqual(before)
  })

  it('refuses an active relationship effect suppression without changing actor state', async () => {
    const base = await setupCharacterRun()
    for (const definitions of sourceImportBatches(SRD_RULE_STATE_DEFINITIONS))
      await base.t.mutation(importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions
      })
    const source = base.run.actors.find((actor) => actor.kind === 'CUSTOM')
    if (!source) throw new Error('Missing custom actor.')
    await base.t.run(async (ctx) => {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id).eq('id', source.id))
        .unique()
      if (!run || !row) throw new Error('Missing Run actor.')
      const state = encounterRunStateSchema.parse({
        ...JSON.parse(run.stateJson),
        status: 'ACTIVE',
        automationMode: 'ASSISTED',
        round: 1,
        currentActorId: source.id
      })
      const actor = await readTestActor(ctx, row)
      if (actor.kind === 'CHARACTER') throw new Error('Expected custom actor.')
      const definitionId = crypto.randomUUID()
      const entryId = crypto.randomUUID()
      await ctx.db.patch(run._id, {
        status: 'ACTIVE',
        stateJson: JSON.stringify(state),
        stateChecksum: checksumCanonicalJson(state)
      })
      await createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
        id: crypto.randomUUID(),
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId: base.run.id, targetActorId: source.id },
        definition: {
          schemaVersion: 2,
          linkedEffectId: null,
          originLevel: null,
          origin: {
            kind: 'ENCOUNTER',
            sourceAggregateId: base.run.id,
            sourceOccurrenceId: crypto.randomUUID(),
            rootCommandId: crypto.randomUUID(),
            sourceActorId: source.id
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
            nodes: [
              { id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }
            ],
            sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: 'entry' }],
            outputs: { result: { kind: 'LITERAL', value: true } }
          },
          adapterFacts: {},
          perceptionContributions: [],
          recurrence: {
            recurrenceStage: 'NONE',
            anchor: 'HOLDER',
            endTriggers: [],
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
              modules: [{ id: crypto.randomUUID(), order: 0, kind: 'SOURCE_FOLLOWS_TARGET' }],
              conditionIds: [],
              capabilitySuppressions: [
                {
                  contributionId: crypto.randomUUID(),
                  capabilityDefinitionIds: [SRD_ACTION_ALLOWANCE_DEFINITION_ID]
                }
              ]
            }
          ]
        } satisfies ActiveRuleEffectDefinitionDto,
        lifecycle: { schemaVersion: 1, remainingTicks: null }
      })
      expect(actor.conditions).toEqual([])
    })
    const before = await base.t.run((ctx) =>
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id).eq('id', source.id))
        .unique()
    )
    await expect(
      base.owner.caller.run(async (ctx) => {
        const run = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
          .unique()
        if (!run) throw new Error('Missing Run.')
        const state = encounterRunStateSchema.parse(JSON.parse(run.stateJson))
        const actor = await readRunActor(
          { db: createConvexEncounterStoreReader(ctx) },
          state,
          source.id
        )
        return prepareEconomy(ctx, {
          actor,
          state,
          userId: base.owner.userId,
          activation: { code: 'ACTION', amount: 1 }
        })
      })
    ).rejects.toThrow('allowance')
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', base.run.id).eq('id', source.id)
          )
          .unique()
      )
    ).toEqual(before)
  })
})
