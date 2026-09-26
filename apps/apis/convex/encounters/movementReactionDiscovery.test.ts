import { describe, expect, it } from 'vitest'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { loadNativeMovementReactionFacts } from './movementReactionDiscovery'
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
