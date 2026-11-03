import { describe, expect, it } from 'vitest'
import { api } from '../_generated/api'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { readCharacterRow } from './stateDocuments'

describe('owner-only permanent Character delete', () => {
  it('refuses a signed-out caller and a different user, leaving the Character intact', async () => {
    const base = await readySheetFixture()
    await expect(
      base.t.mutation(api.characters.deletion.remove, { id: base.character.id })
    ).rejects.toThrow()
    await expect(
      base.other.caller.mutation(api.characters.deletion.remove, { id: base.character.id })
    ).rejects.toThrow('Character is unavailable.')
    expect(await base.t.run((ctx) => readCharacterRow(ctx, base.character.id))).not.toBeNull()
  })

  it('deletes only the named Character and no shared content', async () => {
    const base = await readySheetFixture()
    const { draft, character } = await base.createCharacter()
    await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    const sharedBefore = await base.t.run(async (ctx) => ({
      sources: await ctx.db.query('contentSources').collect(),
      definitions: await ctx.db.query('contentDefinitions').collect()
    }))

    await base.owner.caller.mutation(api.characters.deletion.remove, { id: base.character.id })

    expect(await base.t.run((ctx) => readCharacterRow(ctx, base.character.id))).toBeNull()
    expect(await base.t.run((ctx) => readCharacterRow(ctx, character.id))).not.toBeNull()
    expect(
      await base.t.run(async (ctx) => ({
        sources: await ctx.db.query('contentSources').collect(),
        definitions: await ctx.db.query('contentDefinitions').collect()
      }))
    ).toEqual(sharedBefore)
    await expect(
      base.owner.caller.mutation(api.characters.deletion.remove, { id: base.character.id })
    ).rejects.toThrow('Character is unavailable.')
  })

  it('journey: deleting a Campaign Character with a running Encounter releases it and removes its actor', async () => {
    const base = await setupCharacterRun()
    const actorsOf = () =>
      base.t.run(async (ctx) =>
        (await ctx.db.query('encounterRunActors').collect()).filter(
          (actor) => actor.id === base.actor.id
        )
      )
    expect(await actorsOf()).toHaveLength(1)

    await expect(
      base.owner.caller.mutation(api.characters.deletion.remove, { id: base.character.id })
    ).rejects.toThrow()
    await expect(
      base.t.mutation(api.characters.deletion.remove, { id: base.character.id })
    ).rejects.toThrow()
    expect(await actorsOf()).toHaveLength(1)

    await base.player.caller.mutation(api.characters.deletion.remove, { id: base.character.id })

    expect(await base.t.run((ctx) => readCharacterRow(ctx, base.character.id))).toBeNull()
    expect(await actorsOf()).toHaveLength(0)
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('campaignCharacterAssignments')
          .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
          .unique()
      )
    ).toBeNull()
  })
})
