import { describe, expect, it } from 'vitest'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SRD_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import {
  reactionBinding,
  reactionInput,
  reactionRecords,
  setupCreatureReactionRun
} from '../../tests/fixtures/movementReaction'
import {
  discoverNativeMovementReactions,
  loadNativeMovementReactionFacts,
  revalidateNativeMovementReaction
} from './movementReactionDiscovery'
import { loadMovementTargets } from './movementTargets'

describe('native movement reaction discovery', () => {
  it('refuses an extra persisted actor outside the complete Run membership', async () => {
    const base = await setupCreatureReactionRun()
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
        .first()
      if (!row) throw new Error('Missing reaction actor.')
      const actor = encounterRunActorStateSchema.parse({
        ...JSON.parse(row.stateJson),
        id: crypto.randomUUID()
      })
      await ctx.db.insert('encounterRunActors', {
        id: actor.id,
        encounterId: base.run.id,
        stateJson: JSON.stringify(actor),
        stateChecksum: checksumCanonicalJson(actor)
      })
    })
    await expect(
      base.owner.caller.run((ctx) =>
        loadNativeMovementReactionFacts(ctx, {
          encounterId: base.run.id,
          expectedEncounterVersion: base.run.version
        })
      )
    ).rejects.toThrow('actor state does not match the Run')
  })

  it('uses current Convex sources and preserves issued contact eligibility without writes', async () => {
    const base = await setupCreatureReactionRun()
    const input = reactionInput({
      encounterId: base.run.id,
      expectedEncounterVersion: base.run.version,
      reactorActorId: base.reactor.id,
      movingActorId: base.mover.id,
      occurrenceId: crypto.randomUUID()
    })
    const before = await reactionRecords(base.t, base.run.id)
    const discovered = await base.owner.caller.run((ctx) =>
      discoverNativeMovementReactions(ctx, input)
    )
    expect(discovered.firstBoundaryDistance).toBe(150)
    const entry = discovered.reactionTimeline[0]
    if (!entry || entry.kind !== 'CONTROLLER_CHOICE')
      throw new Error('Expected one controller movement reaction choice.')
    const option = entry.group.options[0]
    if (!option) throw new Error('Expected one native movement reaction option.')
    expect(option).toMatchObject({
      actionSourceKind: 'ENCOUNTER_FEATURE',
      candidate: {
        reactorActorId: base.reactor.id,
        movingActorId: base.mover.id,
        stage: 'BEFORE_LEAVE_REACH'
      },
      binding: reactionBinding,
      policy: { eligible: true, allowanceDefinitionId: SRD_REACTION_ALLOWANCE_DEFINITION_ID }
    })
    expect(input.perceptionContacts()).toMatchObject([
      {
        reactorActorId: base.reactor.id,
        movingActorId: base.mover.id,
        pathDistance: 150,
        stage: 'BEFORE_LEAVE_REACH'
      }
    ])
    await expect(
      base.owner.caller.run((ctx) =>
        revalidateNativeMovementReaction(ctx, {
          encounterId: base.run.id,
          expectedEncounterVersion: base.run.version,
          movementKind: input.movementKind,
          occurrenceId: input.occurrenceId,
          option,
          actorIdByTokenId: input.actorIdByTokenId,
          tokens: input.tokens,
          resolvePerception: input.resolvePerception
        })
      )
    ).resolves.toMatchObject({ action: { kind: 'ENCOUNTER_FEATURE', actorId: base.reactor.id } })
    expect(input.perceptionContacts()).toHaveLength(2)
    expect(await reactionRecords(base.t, base.run.id)).toEqual(before)

    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (query) =>
          query.eq('encounterId', base.run.id).eq('id', base.reactor.id)
        )
        .unique()
      if (!row) throw new Error('Missing reaction reactor.')
      const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
      const used = encounterRunActorStateSchema.parse({
        ...actor,
        resources: withEncounterRuleUsageUsed(actor, SRD_REACTION_ALLOWANCE_DEFINITION_ID, 1)
      })
      await ctx.db.patch(row._id, {
        stateJson: JSON.stringify(used),
        stateChecksum: checksumCanonicalJson(used)
      })
    })
    await expect(
      base.owner.caller.run((ctx) =>
        revalidateNativeMovementReaction(ctx, {
          encounterId: base.run.id,
          expectedEncounterVersion: base.run.version,
          movementKind: input.movementKind,
          occurrenceId: input.occurrenceId,
          option,
          actorIdByTokenId: input.actorIdByTokenId,
          tokens: input.tokens,
          resolvePerception: input.resolvePerception
        })
      )
    ).rejects.toThrow('no longer eligible')
    await expect(
      base.other.caller.run((ctx) => discoverNativeMovementReactions(ctx, input))
    ).rejects.toThrow()
    await expect(
      base.owner.caller.run((ctx) =>
        discoverNativeMovementReactions(ctx, {
          ...input,
          expectedEncounterVersion: input.expectedEncounterVersion + 1
        })
      )
    ).rejects.toThrow('version is stale')
  }, 30000)

  it('rejects an issued option after its current relationship changes', async () => {
    const base = await setupCreatureReactionRun()
    const input = reactionInput({
      encounterId: base.run.id,
      expectedEncounterVersion: base.run.version,
      reactorActorId: base.reactor.id,
      movingActorId: base.mover.id,
      occurrenceId: crypto.randomUUID()
    })
    const discovered = await base.owner.caller.run((ctx) =>
      discoverNativeMovementReactions(ctx, input)
    )
    const entry = discovered.reactionTimeline[0]
    if (!entry || entry.kind !== 'CONTROLLER_CHOICE') throw new Error('Missing reaction choice.')
    const option = entry.group.options[0]
    if (!option) throw new Error('Missing reaction option.')
    await base.t.run(async (ctx) => {
      // The GM makes the reactor friendly to the mover, so the pair is no longer hostile.
      const rows = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (query) => query.eq('encounterId', base.run.id))
        .collect()
      const actors = rows.map((row) => ({
        row,
        actor: encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
      }))
      const mover = actors.find(({ actor }) => actor.id === base.mover.id)
      const reactor = actors.find(({ actor }) => actor.id === base.reactor.id)
      if (!mover || !reactor) throw new Error('Missing reaction actors.')
      const row = reactor.row
      const changed = encounterRunActorStateSchema.parse({
        ...reactor.actor,
        disposition: mover.actor.disposition
      })
      await ctx.db.patch(row._id, {
        stateJson: JSON.stringify(changed),
        stateChecksum: checksumCanonicalJson(changed)
      })
    })
    await expect(
      base.owner.caller.run((ctx) =>
        revalidateNativeMovementReaction(ctx, {
          encounterId: base.run.id,
          expectedEncounterVersion: base.run.version,
          movementKind: input.movementKind,
          occurrenceId: input.occurrenceId,
          option,
          actorIdByTokenId: input.actorIdByTokenId,
          tokens: input.tokens,
          resolvePerception: input.resolvePerception
        })
      )
    ).rejects.toThrow('no longer eligible')
  }, 30000)

  it('loads compiled current Character reaction sources, including Sheet changes after Run creation', async () => {
    const base = await setupCharacterRun()
    const source = await base.owner.caller.run(
      async (ctx) =>
        (
          await loadMovementTargets(ctx, {
            encounterId: base.run.id,
            expectedEncounterVersion: base.run.version,
            targetActorIds: [base.actor.id],
            includeReactionSources: true
          })
        ).get(base.actor.id)?.characterReactionSource
    )
    if (!source) throw new Error('Expected current Character reaction source.')
    expect(source).toMatchObject({
      id: base.character.id,
      streamVersion: base.characterStreamVersion,
      actor: { id: base.actor.id }
    })
    const candidates = source.mechanics.rulePolicyInput.actionCandidates
    const entries = source.mechanics.compiledActionEntryPoints
    expect(candidates.length).toBeGreaterThan(0)
    expect(entries).toHaveLength(candidates.length)
    expect(entries.map(({ actionId, effectId }) => ({ actionId, effectId }))).toEqual(
      candidates.map(({ actionId, effectId }) => ({ actionId, effectId }))
    )
    expect(entries.every((entry) => entry.compilation.kind === 'COMPILED')).toBe(true)
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (query) => query.eq('id', base.character.id))
        .unique()
      if (!row) throw new Error('Missing fixture Character.')
      await ctx.db.patch(row._id, { streamVersion: row.streamVersion + 1 })
    })
    const current = await base.owner.caller.run(
      async (ctx) =>
        (
          await loadMovementTargets(ctx, {
            encounterId: base.run.id,
            expectedEncounterVersion: base.run.version,
            targetActorIds: [base.actor.id],
            includeReactionSources: true
          })
        ).get(base.actor.id)?.characterReactionSource
    )
    expect(current).toMatchObject({
      id: base.character.id,
      streamVersion: base.characterStreamVersion + 1,
      actor: { id: base.actor.id }
    })
  }, 30000)
})
