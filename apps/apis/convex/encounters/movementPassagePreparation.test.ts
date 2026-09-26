import { describe, expect, it } from 'vitest'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { loadMovementTargets } from './movementTargets'
import { availableNativeMovementPassageChoice } from './movementPassagePreparation'
import { fixture, movement } from '../../tests/fixtures/movementPassageFixture'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encounterCreatureRuleFactsSnapshotSchema } from '@artificer-toolkit/schema/api/encounterActorRules'

describe('native movement passage preparation', () => {
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
