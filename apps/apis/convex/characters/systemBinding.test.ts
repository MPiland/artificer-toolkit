import { describe, expect, it } from 'vitest'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_RULES_CATALOGUE,
  SRD_CONTENT_SOURCE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { api } from '../_generated/api'
import { input } from '../../tests/fixtures/characters'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'

describe('native Character System-only binding', () => {
  it('reads checksummed legacy active and draft fields without exposing or rewriting them', async () => {
    const base = await readyCharacterFixture()
    const first = await base.createCharacter()
    const initialCommit = await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: first.draft.id,
      mode: 'create',
      character: first.character
    })
    const active = await base.t.run((ctx) =>
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', first.character.id))
        .unique()
    )
    if (!active) throw new Error('Missing active Character fixture.')
    const legacyId = crypto.randomUUID()
    const legacyActive = { ...initialCommit.character, primaryRulesCatalogueId: legacyId }
    await base.t.run((ctx) =>
      ctx.db.patch(active._id, {
        primaryRulesCatalogueId: legacyId,
        documentJson: canonicalizeRuleDocument(legacyActive),
        checksum: checksumRuleDocument(legacyActive)
      })
    )
    const activeBefore = await base.t.run((ctx) => ctx.db.get(active._id))
    const readActive = await base.owner.caller.query(api.characters.builder.activeCharacter, {
      id: first.character.id
    })
    expect(readActive).not.toHaveProperty('primaryRulesCatalogueId')
    expect(await base.t.run((ctx) => ctx.db.get(active._id))).toEqual(activeBefore)

    const draft = await base.owner.caller.mutation(api.characters.drafts.create, {
      ...input(),
      id: first.character.id
    })
    const legacyDraftPayload = {
      ...draft.payload,
      character: { ...draft.payload.character, primaryRulesCatalogueId: legacyId }
    }
    await base.t.run(async (ctx) => {
      const stored = await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', first.character.id))
        .unique()
      if (!stored) throw new Error('Missing draft Character payload fixture.')
      const payload = await ctx.db
        .query('characterDraftPayloads')
        .withIndex('by_characterId_id', (q) =>
          q.eq('characterId', stored.characterId).eq('id', stored.payloadId)
        )
        .unique()
      if (
        !payload?.payloadJson ||
        payload.characterId !== stored.characterId ||
        payload.checksum !== stored.checksum
      )
        throw new Error('Stored Character draft payload mismatch.')
      const checksum = checksumRuleDocument(legacyDraftPayload)
      await ctx.db.patch(payload._id, {
        payloadJson: canonicalizeRuleDocument(legacyDraftPayload),
        checksum
      })
      await ctx.db.patch(stored._id, { checksum })
    })
    const draftBefore = await base.t.run((ctx) =>
      ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', first.character.id))
        .unique()
    )
    const readDraft = await base.owner.caller.query(api.characters.drafts.get, {
      id: first.character.id
    })
    expect(readDraft?.payload.character).not.toHaveProperty('primaryRulesCatalogueId')
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('characterDrafts')
          .withIndex('by_characterId', (q) => q.eq('characterId', first.character.id))
          .unique()
      )
    ).toEqual(draftBefore)
    if (!readDraft) throw new Error('Missing readable legacy draft.')
    const saved = await base.owner.caller.mutation(api.characters.drafts.save, {
      expectedDraftId: draft.id,
      characterId: first.character.id,
      mode: 'edit',
      character: { ...readDraft.payload.character, label: 'Saved without retired binding' }
    })
    expect(saved.payload.character).not.toHaveProperty('primaryRulesCatalogueId')
    await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: saved.id,
      mode: 'edit',
      character: saved.payload.character
    })
    const committed = await base.t.run((ctx) =>
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', first.character.id))
        .unique()
    )
    if (!committed) throw new Error('Missing committed legacy Character fixture.')
    expect(committed).not.toHaveProperty('primaryRulesCatalogueId')
    expect(JSON.parse(committed.documentJson)).not.toHaveProperty('primaryRulesCatalogueId')
  })

  it('creates, saves, and commits without a catalogue when the System has multiple catalogues', async () => {
    const base = await readyCharacterFixture()
    await base.t.run(async (ctx) => {
      const source = { ...SRD_CONTENT_SOURCE, id: crypto.randomUUID(), code: 'second-platform' }
      await ctx.db.insert('contentSources', source)
      await ctx.db.insert('rulesCatalogues', {
        ...SRD_RULES_CATALOGUE,
        id: crypto.randomUUID(),
        code: 'second-catalogue',
        contentSourceIds: [source.id]
      })
    })
    const draft = await base.owner.caller.mutation(api.characters.drafts.create, input())
    expect(draft.payload.character).not.toHaveProperty('primaryRulesCatalogueId')
    const saved = await base.owner.caller.mutation(api.characters.drafts.save, {
      expectedDraftId: draft.id,
      characterId: draft.characterId,
      mode: 'create',
      character: { ...draft.payload.character, label: 'Saved without catalogue' }
    })
    expect(saved.payload.character).not.toHaveProperty('primaryRulesCatalogueId')
    const committed = await base.createCharacter({
      id: crypto.randomUUID(),
      systemId: draft.payload.character.systemId
    })
    const result = await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: committed.draft.id,
      mode: 'create',
      character: committed.character
    })
    expect(result.character).not.toHaveProperty('primaryRulesCatalogueId')
    const stored = await base.t.run((ctx) =>
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', committed.character.id))
        .unique()
    )
    expect(stored).not.toHaveProperty('primaryRulesCatalogueId')
    if (!stored) throw new Error('Missing committed Character fixture.')
    expect(characterAuthoredDtoSchema.parse(JSON.parse(stored.documentJson))).not.toHaveProperty(
      'primaryRulesCatalogueId'
    )
    await expect(
      base.owner.caller.mutation(api.characters.drafts.create, {
        ...input(),
        systemId: crypto.randomUUID()
      })
    ).rejects.toThrow('Game System is unavailable')
  })
})
