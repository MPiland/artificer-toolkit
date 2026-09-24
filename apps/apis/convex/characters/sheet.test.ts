import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CharacterSheetReadInput,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { api } from '../_generated/api'
import { input } from '../../tests/fixtures/characters'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'

const getSheet = makeFunctionReference<
  'query',
  CharacterSheetReadInput,
  CharacterSheetResponseDto | null
>('characters/sheet:get')

describe('native personal Character Sheet reads', () => {
  it('reads committed state by UUID/alias, ignores working drafts, and isolates owners without writes', async () => {
    const { t, owner, other, createCharacter } = await readyCharacterFixture()
    const { draft, character } = await createCharacter()
    expect(await owner.caller.query(getSheet, { id: character.id })).toBeNull()
    const committed = await owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    const stored = await t.run((ctx) =>
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', character.id))
        .unique()
    )
    const sheet = await owner.caller.query(getSheet, { id: character.id.toUpperCase() })
    expect(sheet).toMatchObject({
      publicId: committed.publicId,
      meta: {
        characterId: character.id,
        streamVersion: 1,
        hasBuilderDraft: false,
        viewer: 'CHARACTER_OWNER'
      },
      identity: { label: 'Aria' },
      overview: { currentHitPoints: 11, maxHitPoints: 11 }
    })
    expect(await owner.caller.query(getSheet, { id: committed.publicId })).toEqual(sheet)
    expect(await other.caller.query(getSheet, { id: character.id })).toBeNull()
    expect(await other.caller.query(getSheet, { id: committed.publicId })).toBeNull()
    expect(await owner.caller.query(getSheet, { id: crypto.randomUUID() })).toBeNull()
    await expect(t.query(getSheet, { id: character.id })).rejects.toThrow()

    const reopened = await owner.caller.mutation(api.characters.drafts.create, {
      ...input(),
      id: character.id
    })
    await owner.caller.mutation(api.characters.drafts.save, {
      expectedDraftId: reopened.id,
      characterId: character.id,
      mode: 'edit',
      character: {
        ...reopened.payload.character,
        label: 'Uncommitted draft',
        state: {
          ...reopened.payload.character.state,
          hitpoints: { ...reopened.payload.character.state.hitpoints, current: 999 }
        }
      }
    })
    const afterDraft = await owner.caller.query(getSheet, { id: character.id })
    expect(afterDraft).toEqual({ ...sheet, meta: { ...sheet!.meta, hasBuilderDraft: true } })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', character.id))
          .unique()
      )
    ).toEqual(stored)
  })

  it('fails closed when acquired Equipment no longer matches its committed scope', async () => {
    const { t, owner, createCharacter } = await readyCharacterFixture()
    const { draft, character } = await createCharacter()
    await owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    await t.run(async (ctx) => {
      const stored = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', character.id))
        .unique()
      if (!stored) throw new Error('Missing committed Character fixture.')
      const changed = characterAuthoredDtoSchema.parse(JSON.parse(stored.documentJson))
      changed.state.equipment.inventory[0]!.equipmentId = crypto.randomUUID()
      const encoded: unknown = JSON.parse(JSON.stringify(changed))
      await ctx.db.patch(stored._id, {
        documentJson: canonicalizeRuleDocument(encoded),
        checksum: checksumRuleDocument(encoded)
      })
    })
    await expect(owner.caller.query(getSheet, { id: character.id })).rejects.toThrow(
      'Acquired Equipment scope mismatch'
    )
  })
})
