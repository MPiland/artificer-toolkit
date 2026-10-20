import { describe, expect, it } from 'vitest'
import { authoredDraftCommandInputSchema } from '@artificer-toolkit/schema/api/authoredDrafts'
import { light } from '@artificer-toolkit/source-data/srd/spells/light.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../_generated/api'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import {
  corruptPublishedVersionPayload,
  importedSubject,
  importSeededSubjects
} from '../../tests/fixtures/publication'
import { loadCharacterRuleContext } from './context'

describe('compact Campaign Spell selector access', () => {
  it('keeps unused shared mechanics unread, validates referenced mechanics, and rechecks current access', async () => {
    const { t, owner, other, createCharacter } = await readyCharacterFixture()
    const platform = { ...light, effects: [] }
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ subjectKind: 'SPELL', ...platform, document: platform })]
    })
    const shared = {
      ...platform,
      id: crypto.randomUUID(),
      label: 'Shared light',
      userId: other.userId,
      status: 'ACTIVE' as const,
      classIds: []
    }
    const privateSpell = { ...shared, id: crypto.randomUUID(), label: 'Private light' }
    for (const document of [shared, privateSpell]) {
      const draft = await other.caller.mutation(
        api.content.drafts.save,
        authoredDraftCommandInputSchema.parse({
          subjectKind: 'SPELL',
          subjectId: document.id,
          systemId: document.systemId,
          label: document.label,
          payload: JSON.parse(JSON.stringify(document))
        })
      )
      if (!draft.updatedAt) throw new Error('Missing Spell publication timestamp.')
      await other.caller.mutation(api.content.publication.publishDraft, {
        subjectKind: 'SPELL',
        subjectId: draft.subjectId,
        expectedDraftUpdatedAt: draft.updatedAt
      })
    }
    const { draft, character } = await createCharacter()
    await owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    const campaign = await other.caller.mutation(api.campaigns.create.create, {
      name: 'Compact Spell selectors',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    await t.run(async (ctx) => {
      await ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: owner.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
      await ctx.db.insert('campaignCharacterAssignments', {
        campaignId: campaign.id,
        userId: owner.userId,
        characterId: character.id,
        assignedAt: campaign.createdAt
      })
    })
    await other.caller.mutation(api.campaigns.contentShares.share, {
      campaignId: campaign.id,
      subjectKind: 'SPELL',
      subjectId: shared.id
    })
    character.intent.spellSelections = [
      {
        id: crypto.randomUUID(),
        source: { kind: 'FEATURE', featureId: crypto.randomUUID() },
        timing: { kind: 'IMMEDIATE' },
        spells: [platform.id]
      }
    ]
    const readContext = () =>
      t.run(async (ctx) => {
        const context = await loadCharacterRuleContext(ctx, character, owner.userId)
        return {
          spellIds: context.catalog.spells.map((spell) => spell.id).sort(),
          catalogueIds: context.spellCatalogueEntries.map((spell) => spell.id).sort(),
          documentIds: [...context.spellsById.keys()],
          sourceIdentities: Object.fromEntries(context.sourceIdentities)
        }
      })
    const initial = await readContext()
    expect(initial.spellIds).toEqual([platform.id, shared.id].sort())
    expect(initial.catalogueIds).toEqual(initial.spellIds)
    expect(initial.documentIds).toEqual([platform.id])
    expect(initial.sourceIdentities[privateSpell.id]).toBeUndefined()
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (query) => query.eq('id', shared.id))
        .unique()
      if (!root) throw new Error('Missing shared Spell root.')
      expect(root.catalogue).toMatchObject({
        checksum: root.checksum,
        nameKey: shared.label.toLowerCase(),
        publishedActive: true,
        spell: { selectionVersion: 1 }
      })
      expect(initial.sourceIdentities[shared.id]).toMatchObject({
        subjectId: shared.id,
        contentSourceId: root.contentSourceId,
        checksum: root.checksum,
        versionId: root.currentVersionPublicId
      })
      await corruptPublishedVersionPayload(ctx, shared.id)
    })
    expect(await readContext()).toEqual(initial)
    character.intent.spellSelections[0]!.spells.push(shared.id)
    await expect(readContext()).rejects.toThrow()
    character.intent.spellSelections[0]!.spells = [platform.id]

    const source = await t.run(async (ctx) => {
      const source = await ctx.db
        .query('contentSources')
        .withIndex('by_publicId', (query) =>
          query.eq('id', initial.sourceIdentities[shared.id]!.contentSourceId)
        )
        .unique()
      if (!source) throw new Error('Missing shared Spell source.')
      await ctx.db.delete(source._id)
      const { _id, _creationTime, ...document } = source
      return document
    })
    expect((await readContext()).spellIds).toEqual([platform.id])
    await t.run((ctx) => ctx.db.insert('contentSources', source))
    expect(await readContext()).toEqual(initial)
    await t.run(async (ctx) => {
      const share = await ctx.db
        .query('campaignContentShares')
        .withIndex('by_campaignId_subjectKind_subjectId', (query) =>
          query.eq('campaignId', campaign.id).eq('subjectKind', 'SPELL').eq('subjectId', shared.id)
        )
        .unique()
      if (!share) throw new Error('Missing shared Spell access.')
      await ctx.db.delete(share._id)
    })
    const revoked = await readContext()
    expect(revoked.spellIds).toEqual([platform.id])
    expect(revoked.catalogueIds).toEqual([platform.id])
    expect(revoked.sourceIdentities[shared.id]).toBeUndefined()
    expect(revoked.sourceIdentities[privateSpell.id]).toBeUndefined()
  })
})
