import { describe, expect, it } from 'vitest'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { loadMovementTargets } from './movementTargets'
import {
  availableNativeMovementPassageChoice,
  prepareNativeMovementPassageContest
} from './movementPassagePreparation'
import { prepareNativeActionEconomy } from './actionEconomy'
import { fixture, movement } from '../../tests/fixtures/movementPassageFixture'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encounterCreatureRuleFactsSnapshotSchema } from '@artificer-toolkit/schema/api/encounterActorRules'

describe('native movement passage preparation', () => {
  it('issues deterministic Overrun and Tumble contests from current Character and Creature facts without writes', async () => {
    const base = await fixture()
    await base.owner.caller.run(async (ctx) => {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      if (!run) throw new Error('Missing Run.')
      const state = encounterRunStateSchema.parse(JSON.parse(run.stateJson))
      const targets = await loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        targetActorIds: [base.actor.id, base.blockerId]
      })
      const before = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', state.id))
        .collect()
      const choice = await availableNativeMovementPassageChoice(ctx, {
        state,
        movement: movement({
          encounterId: state.id,
          sourceActorId: base.actor.id,
          blockerActorId: base.blockerId
        }),
        sourceActorId: base.actor.id,
        userId: base.owner.userId,
        targets
      })
      expect(choice?.options.map((option) => option.ruleKind).sort()).toEqual([
        'OVERRUN',
        'OVERRUN',
        'TUMBLE',
        'TUMBLE'
      ])
      const prepared = await Promise.all(
        choice!.options.map((option) =>
          prepareNativeMovementPassageContest(ctx, {
            state,
            choice: choice!,
            optionId: option.optionId,
            userId: base.owner.userId,
            targets
          })
        )
      )
      expect(prepared.map((value) => value.actionKind)).toEqual(
        choice!.options.map((option) => option.ruleKind)
      )
      expect(
        await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', state.id))
          .collect()
      ).toEqual(before)
    })
  })

  it('refuses stale definitions, Custom or incomplete targets, exhausted economy, and mismatched projected targets', async () => {
    const base = await fixture()
    await base.owner.caller.run(async (ctx) => {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      if (!run) throw new Error('Missing Run.')
      const state = encounterRunStateSchema.parse(JSON.parse(run.stateJson))
      const movementInput = movement({
        encounterId: state.id,
        sourceActorId: base.actor.id,
        blockerActorId: base.blockerId
      })
      const targets = await loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        targetActorIds: [base.actor.id, base.blockerId]
      })
      const choice = await availableNativeMovementPassageChoice(ctx, {
        state,
        movement: movementInput,
        sourceActorId: base.actor.id,
        userId: base.owner.userId,
        targets
      })
      if (!choice) throw new Error('Missing passage choice.')
      const staleDefinitionId = choice.options[0]!.definitionId
      const staleSnapshot = {
        ...state.optionalCombatSnapshot,
        definitions: state.optionalCombatSnapshot.definitions.map((definition) =>
          definition.definitionId === staleDefinitionId
            ? { ...definition, definitionVersion: definition.definitionVersion + 1 }
            : definition
        )
      }
      const stale = encounterRunStateSchema.parse({
        ...state,
        optionalCombatSnapshot: staleSnapshot,
        optionalCombatSnapshotChecksum: checksumCanonicalJson(staleSnapshot)
      })
      await expect(
        prepareNativeMovementPassageContest(ctx, {
          state: stale,
          choice,
          optionId: choice.options[0]!.optionId,
          userId: base.owner.userId,
          targets
        })
      ).rejects.toThrow('definition is stale')
      await expect(
        prepareNativeActionEconomy(ctx, {
          actor: targets.get(base.actor.id)!.actor,
          state,
          userId: base.owner.userId,
          activation: { code: 'ACTION', amount: 1 },
          target: targets.get(base.blockerId)!
        })
      ).rejects.toThrow('source is stale')
    })
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', base.blockerId)
        )
        .unique()
      if (!row) throw new Error('Missing blocker row.')
      const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
      const custom = encounterRunActorStateSchema.parse({
        ...actor,
        kind: 'CUSTOM',
        sourceId: null,
        sourceRevision: null
      })
      await ctx.db.patch(row._id, {
        stateJson: JSON.stringify(custom),
        stateChecksum: checksumCanonicalJson(custom)
      })
    })
    await base.owner.caller.run(async (ctx) => {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      if (!run) throw new Error('Missing Run.')
      const state = encounterRunStateSchema.parse(JSON.parse(run.stateJson))
      const targets = await loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        targetActorIds: [base.actor.id, base.blockerId]
      })
      await expect(
        availableNativeMovementPassageChoice(ctx, {
          state,
          movement: movement({
            encounterId: state.id,
            sourceActorId: base.actor.id,
            blockerActorId: base.blockerId
          }),
          sourceActorId: base.actor.id,
          userId: base.owner.userId,
          targets
        })
      ).resolves.toBeNull()
    })
  })

  it('refuses a Creature missing check facts and an actor with both passage allowances exhausted', async () => {
    const missing = await fixture()
    await missing.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', missing.run.id).eq('id', missing.blockerId)
        )
        .unique()
      if (!row) throw new Error('Missing blocker row.')
      const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
      if (
        typeof actor.snapshot !== 'object' ||
        actor.snapshot === null ||
        Array.isArray(actor.snapshot)
      )
        throw new Error('Missing Creature snapshot.')
      const ruleFacts = encounterCreatureRuleFactsSnapshotSchema.parse(actor.snapshot.ruleFacts)
      const incomplete = encounterRunActorStateSchema.parse({
        ...actor,
        snapshot: { ...actor.snapshot, ruleFacts: { ...ruleFacts, checkTotals: {} } }
      })
      await ctx.db.patch(row._id, {
        stateJson: JSON.stringify(incomplete),
        stateChecksum: checksumCanonicalJson(incomplete)
      })
    })
    await missing.owner.caller.run(async (ctx) => {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', missing.run.id))
        .unique()
      if (!run) throw new Error('Missing Run.')
      const state = encounterRunStateSchema.parse(JSON.parse(run.stateJson))
      const targets = await loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        targetActorIds: [missing.actor.id, missing.blockerId]
      })
      await expect(
        availableNativeMovementPassageChoice(ctx, {
          state,
          movement: movement({
            encounterId: state.id,
            sourceActorId: missing.actor.id,
            blockerActorId: missing.blockerId
          }),
          sourceActorId: missing.actor.id,
          userId: missing.owner.userId,
          targets
        })
      ).resolves.toBeNull()
    })
    const exhausted = await fixture()
    await exhausted.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', exhausted.run.id).eq('id', exhausted.actor.id)
        )
        .unique()
      if (!row) throw new Error('Missing source row.')
      const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
      const actionUsed = withEncounterRuleUsageUsed(actor, SRD_ACTION_ALLOWANCE_DEFINITION_ID, 1)
      const complete = encounterRunActorStateSchema.parse({
        ...actor,
        resources: withEncounterRuleUsageUsed(
          { ...actor, resources: actionUsed },
          SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
          1
        )
      })
      await ctx.db.patch(row._id, {
        stateJson: JSON.stringify(complete),
        stateChecksum: checksumCanonicalJson(complete)
      })
    })
    await exhausted.owner.caller.run(async (ctx) => {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', exhausted.run.id))
        .unique()
      if (!run) throw new Error('Missing Run.')
      const state = encounterRunStateSchema.parse(JSON.parse(run.stateJson))
      const targets = await loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        targetActorIds: [exhausted.actor.id, exhausted.blockerId]
      })
      await expect(
        availableNativeMovementPassageChoice(ctx, {
          state,
          movement: movement({
            encounterId: state.id,
            sourceActorId: exhausted.actor.id,
            blockerActorId: exhausted.blockerId
          }),
          sourceActorId: exhausted.actor.id,
          userId: exhausted.owner.userId,
          targets
        })
      ).resolves.toBeNull()
    })
  })
})
