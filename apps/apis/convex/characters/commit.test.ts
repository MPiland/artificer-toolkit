import { describe, expect, it } from 'vitest'
import { writeCharacterRecord } from '../../tests/fixtures/characterRecords'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { api } from '../_generated/api'
import { readCharacterRecord, readCharacterRow } from './stateDocuments'
import { input } from '../../tests/fixtures/characters'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'

describe('native Character commit', () => {
  it('materializes a ready first create from server sources and consumes the draft', async () => {
    const { t, owner, other, createCharacter, baseClass } = await readyCharacterFixture()
    const { draft, character } = await createCharacter()
    expect(
      (await owner.caller.query(api.accountEntitlements.get, {})).usage.personalCharacters
    ).toBe(1)
    const forged = {
      ...character,
      userId: other.userId,
      status: 'ACTIVE' as const,
      state: {
        ...character.state,
        hitpoints: { ...character.state.hitpoints, current: 600, temp: 2 },
        currency: [
          {
            id: crypto.randomUUID(),
            currencies: [
              {
                kind: 'RULESET' as const,
                currencyId: baseClass.startingGold.currencyId,
                amount: 999
              }
            ]
          }
        ],
        equipment: {
          ...character.state.equipment,
          inventory: [{ id: crypto.randomUUID(), equipmentId: club.id, quantity: 9 }]
        }
      }
    }
    const result = await owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character: forged
    })
    expect(result.streamVersion).toBe(1)
    expect(result.publicId).toBe(draft.publicId)
    expect(Object.keys(result).sort()).toEqual(['character', 'publicId', 'streamVersion'])
    expect(result.character.userId).toBe(owner.userId)
    expect(result.character).not.toHaveProperty('primaryRulesCatalogueId')
    expect(result.character.intent.startingEquipment?.class?.applied).toBe(true)
    expect(result.character.intent.startingEquipment?.background?.applied).toBe(true)
    const stored = await t.run((ctx) => readCharacterRow(ctx, character.id))
    if (!stored) throw new Error('Missing committed row')
    expect(stored.play.streamVersion).toBe(1)
    expect(stored).not.toHaveProperty('primaryRulesCatalogueId')
    // The stored document holds structure only; the play state lives in its own record.
    expect(JSON.parse(stored.documentJson).state).not.toHaveProperty('hitpoints')
    const materialized = readCharacterRecord(stored)
    expect(materialized.status).toBe('ACTIVE')
    expect(materialized.state.hitpoints.current).toBe(11)
    expect(materialized.state.hitpoints.temp).toBe(0)
    expect(materialized.state.equipment.inventory).toHaveLength(1)
    expect(materialized.state.equipment.inventory[0]).toMatchObject({
      equipmentId: club.id,
      quantity: 2
    })
    expect(materialized.state.currency[0]?.currencies).toEqual([
      { kind: 'RULESET', currencyId: baseClass.startingGold.currencyId, amount: 115 }
    ])
    expect(await owner.caller.query(api.characters.drafts.get, { id: character.id })).toBeNull()
    expect(
      (await owner.caller.query(api.accountEntitlements.get, {})).usage.personalCharacters
    ).toBe(1)
    await expect(
      owner.caller.mutation(api.characters.commit.commit, {
        expectedDraftId: draft.id,
        mode: 'create',
        character: forged
      })
    ).rejects.toThrow()
    expect(await t.run((ctx) => readCharacterRow(ctx, character.id))).toEqual(stored)
    expect(await t.run((ctx) => ctx.db.query('characters').collect())).toHaveLength(1)
    expect(await t.run((ctx) => ctx.db.query('characterPlayStates').collect())).toHaveLength(1)
  })

  it('preserves authoritative Sheet state during active edits and never regrants', async () => {
    const { t, owner, createCharacter, baseClass } = await readyCharacterFixture()
    const first = await createCharacter()
    await owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: first.draft.id,
      mode: 'create',
      character: first.character
    })
    const active = await t.run((ctx) => readCharacterRow(ctx, first.character.id))
    if (!active) throw new Error('Missing active row')
    const authoritative = readCharacterRecord(active)
    authoritative.state.hitpoints.current = 600
    authoritative.state.hitpoints.temp = 2
    const inventory = authoritative.state.equipment.inventory[0]
    const currency = authoritative.state.currency[0]?.currencies[0]
    if (!inventory || !currency) throw new Error('Missing materialized starting state')
    inventory.quantity = 9
    currency.amount = 7
    await t.run((ctx) =>
      writeCharacterRecord(ctx, active, {
        document: authoritative,
        portraitAssetId: 'f79f6425-a523-4e9e-8603-a3db03c176f1',
        portraitRevision: 4,
        updatedAt: new Date(Date.parse(active.updatedAt) + 1000).toISOString()
      })
    )
    await t.run((ctx) => ctx.db.patch(active.play._id, { updatedAt: active.play.updatedAt }))
    const advanced = await t.run((ctx) => readCharacterRow(ctx, first.character.id))
    if (!advanced) throw new Error('Missing advanced active row')
    const edit = await owner.caller.mutation(api.characters.drafts.create, {
      ...input(),
      id: first.character.id
    })
    expect(
      (await owner.caller.query(api.accountEntitlements.get, {})).usage.personalCharacters
    ).toBe(1)
    const submitted = {
      ...first.character,
      label: 'Edited',
      intent: {
        ...first.character.intent,
        startingEquipment: {
          ...first.character.intent.startingEquipment!,
          class: {
            ...first.character.intent.startingEquipment!.class!,
            tookGold: false,
            applied: false
          }
        }
      }
    }
    const result = await owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: edit.id,
      mode: 'edit',
      character: submitted
    })
    // The edit changed no play state, so the play stream did not advance.
    expect(result.streamVersion).toBe(advanced.play.streamVersion)
    const row = await t.run((ctx) => readCharacterRow(ctx, first.character.id))
    if (!row) throw new Error('Missing committed row')
    expect(row.play.streamVersion).toBe(advanced.play.streamVersion)
    expect(row.play.updatedAt).toBe(advanced.play.updatedAt)
    const document = readCharacterRecord(row)
    expect(document.state).toEqual(authoritative.state)
    expect(document.state.hitpoints.current).toBe(600)
    expect(document.state.hitpoints.temp).toBe(2)
    expect(document.state.equipment.inventory).toHaveLength(1)
    expect(document.state.equipment.inventory[0]).toMatchObject({
      equipmentId: club.id,
      quantity: 9
    })
    expect(document.state.currency[0]?.currencies).toEqual([
      { kind: 'RULESET', currencyId: baseClass.startingGold.currencyId, amount: 7 }
    ])
    expect(row.createdAt).toBe(advanced.createdAt)
    expect(row.updatedAt > advanced.updatedAt).toBe(true)
    expect(row.portraitAssetId).toBe(advanced.portraitAssetId)
    expect(row.portraitRevision).toBe(advanced.portraitRevision)
    const discarded = await owner.caller.mutation(api.characters.drafts.create, {
      ...input(),
      id: first.character.id
    })
    await owner.caller.mutation(api.characters.drafts.discard, {
      id: first.character.id,
      expectedDraftId: discarded.id
    })
    expect(
      (await owner.caller.query(api.accountEntitlements.get, {})).usage.personalCharacters
    ).toBe(1)
  }, 20_000)

  it('rejects stale baselines and stale draft generations without writes', async () => {
    const { t, owner, createCharacter } = await readyCharacterFixture()
    const first = await createCharacter()
    await owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: first.draft.id,
      mode: 'create',
      character: first.character
    })
    const edit = await owner.caller.mutation(api.characters.drafts.create, {
      ...input(),
      id: first.character.id
    })
    const active = await t.run((ctx) =>
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', first.character.id))
        .unique()
    )
    if (!active) throw new Error('Missing active row')
    // The structure clock lives on the build record.
    const build = await t.run((ctx) =>
      ctx.db
        .query('characterBuildStates')
        .withIndex('by_characterId', (q) => q.eq('characterId', first.character.id))
        .unique()
    )
    if (!build) throw new Error('Missing build row')
    await t.run((ctx) =>
      ctx.db.patch(build._id, {
        updatedAt: new Date(Date.parse(build.updatedAt) + 1000).toISOString()
      })
    )
    const unchanged = await t.run((ctx) => ctx.db.get(active._id))
    if (!unchanged) throw new Error('Missing unchanged active row')
    const unchangedBuild = await t.run((ctx) => ctx.db.get(build._id))
    await expect(
      owner.caller.mutation(api.characters.commit.commit, {
        expectedDraftId: edit.id,
        mode: 'edit',
        character: first.character
      })
    ).rejects.toThrow('changed')
    expect(await owner.caller.query(api.characters.drafts.get, { id: first.character.id })).toEqual(
      edit
    )
    expect(await t.run((ctx) => ctx.db.get(active._id))).toEqual(unchanged)
    expect(await t.run((ctx) => ctx.db.get(build._id))).toEqual(unchangedBuild)
    await owner.caller.mutation(api.characters.drafts.discard, {
      id: first.character.id,
      expectedDraftId: edit.id
    })
    await owner.caller.mutation(api.characters.drafts.create, {
      ...input(),
      id: first.character.id
    })
    await expect(
      owner.caller.mutation(api.characters.commit.commit, {
        expectedDraftId: edit.id,
        mode: 'edit',
        character: first.character
      })
    ).rejects.toThrow('generation')
  })

  it('refuses unauthenticated, foreign, wrong-mode, and incomplete commits', async () => {
    const { t, owner, other, createCharacter } = await readyCharacterFixture()
    const { draft, character } = await createCharacter()
    await expect(
      t.mutation(api.characters.commit.commit, {
        expectedDraftId: draft.id,
        mode: 'create',
        character
      })
    ).rejects.toThrow('Unauthenticated')
    await expect(
      other.caller.mutation(api.characters.commit.commit, {
        expectedDraftId: draft.id,
        mode: 'create',
        character
      })
    ).rejects.toThrow('current user')
    await expect(
      owner.caller.mutation(api.characters.commit.commit, {
        expectedDraftId: draft.id,
        mode: 'edit',
        character
      })
    ).rejects.toThrow('mode')
    await expect(
      owner.caller.mutation(api.characters.commit.commit, {
        expectedDraftId: draft.id,
        mode: 'create',
        character: { ...character, intent: { ...character.intent, classes: [] } }
      })
    ).rejects.toThrow()
    expect(await owner.caller.query(api.characters.drafts.get, { id: character.id })).toEqual(draft)
  })

  it('rejects missing current-root equipment before consuming the draft', async () => {
    const { t, owner, createCharacter } = await readyCharacterFixture()
    const { draft, character } = await createCharacter()
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', club.id))
        .unique()
      if (!root) throw new Error('Missing club root')
      await ctx.db.delete(root._id)
    })
    await expect(
      owner.caller.mutation(api.characters.commit.commit, {
        expectedDraftId: draft.id,
        mode: 'create',
        character
      })
    ).rejects.toThrow()
    expect(await owner.caller.query(api.characters.drafts.get, { id: character.id })).toEqual(draft)
    expect(await t.run((ctx) => ctx.db.query('characters').collect())).toEqual([])
  })

  it('allows duplicate labels and serializes concurrent commits to one materialization', async () => {
    const { t, owner, createCharacter } = await readyCharacterFixture()
    const first = await createCharacter()
    const second = await createCharacter()
    expect(
      (
        await owner.caller.mutation(api.characters.commit.commit, {
          expectedDraftId: first.draft.id,
          mode: 'create',
          character: first.character
        })
      ).character.label
    ).toBe('Aria')
    expect(
      (
        await owner.caller.mutation(api.characters.commit.commit, {
          expectedDraftId: second.draft.id,
          mode: 'create',
          character: second.character
        })
      ).character.label
    ).toBe('Aria')
    const concurrent = await createCharacter()
    const results = await Promise.allSettled([
      owner.caller.mutation(api.characters.commit.commit, {
        expectedDraftId: concurrent.draft.id,
        mode: 'create',
        character: concurrent.character
      }),
      owner.caller.mutation(api.characters.commit.commit, {
        expectedDraftId: concurrent.draft.id,
        mode: 'create',
        character: concurrent.character
      })
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const row = await t.run((ctx) => readCharacterRow(ctx, concurrent.character.id))
    if (!row) throw new Error('Missing concurrent committed row')
    expect(row.play.streamVersion).toBe(1)
    expect(readCharacterRecord(row).state.equipment.inventory[0]).toMatchObject({
      equipmentId: club.id,
      quantity: 2
    })
  })
})
