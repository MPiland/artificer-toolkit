import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput,
  ShareCampaignContentInput
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  contentSnapshotKindSchema,
  type ContentSnapshotCatalogueManifestDto,
  type ContentSnapshotKind,
  type ContentSnapshotManifestDto,
  type ContentSnapshotManifestInput
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, internal } from '../_generated/api'
import { readCharacterSourceRoots, readCharacterSources } from '../characters/sourceReads'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import type { ContentSnapshotScopeRef } from './marking'

// ADR 0036 S4: the manifest names exactly the scopes whose union is the Builder's visible set.

const manifest = makeFunctionReference<
  'query',
  ContentSnapshotManifestInput,
  ContentSnapshotManifestDto
>('contentSnapshots/manifest:manifest')
const catalogue = makeFunctionReference<
  'query',
  Record<string, never>,
  ContentSnapshotCatalogueManifestDto
>('contentSnapshots/manifest:catalogue')
const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const share = makeFunctionReference<'mutation', ShareCampaignContentInput, unknown>(
  'campaigns/contentShares:share'
)

async function setup() {
  const base = await readySheetFixture()
  const { t, owner, other } = base
  // A second official source whose catalogue a Campaign does not enable.
  const extraSourceId = crypto.randomUUID()
  await t.run(async (ctx) => {
    await ctx.db.insert('contentSources', {
      ...SRD_CONTENT_SOURCE,
      id: extraSourceId,
      code: 'extra-official'
    })
    await ctx.db.insert('rulesCatalogues', {
      ...SRD_RULES_CATALOGUE,
      id: crypto.randomUUID(),
      code: 'extra-official',
      contentSourceIds: [extraSourceId]
    })
  })
  // Homebrew in both users' own sources.
  const ownBackground = await publishDuplicate(owner.caller, 'Own background')
  const sharedBackground = await publishDuplicate(other.caller, 'Shared background')
  await publishDuplicate(other.caller, 'Unshared background')
  const campaign = await other.caller.mutation(createCampaign, {
    name: 'Manifest parity',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'MATURE',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await other.caller.mutation(share, {
    campaignId: campaign.id,
    subjectKind: 'BACKGROUND',
    subjectId: sharedBackground
  })

  async function assign() {
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
        characterId: base.character.id,
        assignedAt: campaign.createdAt
      })
    })
  }

  /** The Builder's own source set and visible root ids per kind. */
  function builderView() {
    return t.run(async (ctx) => {
      const access = await readCharacterSources(ctx, base.character, owner.userId)
      const roots: Partial<Record<ContentSnapshotKind, string[]>> = {}
      for (const kind of contentSnapshotKindSchema.options)
        roots[kind] = (await readCharacterSourceRoots(ctx, srdSystemRecord.id, access, kind)).map(
          (root) => root.id
        )
      return {
        sources: access.sources.map((source) => ({ id: source.id, kind: source.kind })),
        campaignId: access.campaign?.id ?? null,
        roots
      }
    })
  }

  /** The root ids each manifest scope's build reads. */
  async function scopeRoots(ref: ContentSnapshotScopeRef, kind: ContentSnapshotKind) {
    const ids: string[] = []
    let cursor: string | null = null
    for (let isDone = false; !isDone;) {
      const page:
        | { sources: string[]; continueCursor: string; isDone: boolean }
        | { pendingCompilation: true } = await t.query(
        internal.contentSnapshots.heads.readScopeKind,
        {
          ...ref,
          kind,
          paginationOpts: { numItems: 100, cursor }
        }
      )
      if ('pendingCompilation' in page) throw new Error('A root compilation is pending.')
      for (const json of page.sources)
        ids.push((JSON.parse(json) as { document: { id: string } }).document.id)
      cursor = page.continueCursor
      isDone = page.isDone
    }
    return ids
  }

  /** Asserts that the manifest names the Builder's scopes and their union is its visible set. */
  async function expectParity(result: ContentSnapshotManifestDto) {
    const view = await builderView()
    expect(result.sources.map(({ contentSourceId: id, kind }) => ({ id, kind }))).toEqual(
      view.sources
    )
    expect(result.campaign?.id ?? null).toBe(view.campaignId)
    const scopes: ContentSnapshotScopeRef[] = [
      ...result.sources.map(({ contentSourceId }) => ({
        scope: 'SOURCE' as const,
        scopeId: contentSourceId
      })),
      ...(result.campaign ? [{ scope: 'CAMPAIGN' as const, scopeId: result.campaign.id }] : [])
    ]
    for (const kind of contentSnapshotKindSchema.options) {
      const union = new Set<string>()
      for (const ref of scopes) for (const id of await scopeRoots(ref, kind)) union.add(id)
      expect([...union].sort(), kind).toEqual([...new Set(view.roots[kind])].sort())
    }
    return view
  }

  return {
    ...base,
    extraSourceId,
    ownBackground,
    sharedBackground,
    campaign,
    assign,
    expectParity
  }

  async function publishDuplicate(caller: typeof owner.caller, label: string): Promise<string> {
    const draft = await caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id
    })
    const saved = await caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label,
      payload: { ...draft.payload, label }
    })
    await caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'BACKGROUND',
      subjectId: draft.subjectId,
      expectedDraftUpdatedAt: saved.updatedAt!
    })
    return draft.subjectId
  }
}

describe('content snapshot manifest', () => {
  it('matches the Builder outside a Campaign, with and without a Character', async () => {
    const { t, owner, character, extraSourceId, ownBackground, sharedBackground, expectParity } =
      await setup()
    await t.run(async (ctx) => {
      const head = await ctx.db
        .query('contentSnapshotHeads')
        .withIndex('by_scope_scopeId', (q) =>
          q.eq('scope', 'SOURCE').eq('scopeId', SRD_CONTENT_SOURCE.id)
        )
        .unique()
      const fields = { revision: 7, builtRevision: 6, kinds: {}, buildScheduledAt: Date.now() }
      if (head) await ctx.db.patch(head._id, fields)
      else
        await ctx.db.insert('contentSnapshotHeads', {
          scope: 'SOURCE',
          scopeId: SRD_CONTENT_SOURCE.id,
          ...fields
        })
    })

    const withoutCharacter = await owner.caller.query(manifest, { systemId: srdSystemRecord.id })
    const withCharacter = await owner.caller.query(manifest, {
      systemId: srdSystemRecord.id,
      characterId: character.id
    })
    expect(withCharacter).toEqual(withoutCharacter)
    expect(withCharacter.campaign).toBeNull()
    const view = await expectParity(withCharacter)
    expect(view.sources.map((source) => source.id)).toContain(extraSourceId)
    expect(view.roots.BACKGROUND).toContain(ownBackground)
    expect(view.roots.BACKGROUND).not.toContain(sharedBackground)
    // The contract head only, with its freshness, and no build bookkeeping.
    expect(
      withCharacter.sources.find((source) => source.contentSourceId === SRD_CONTENT_SOURCE.id)
    ).toEqual({
      contentSourceId: SRD_CONTENT_SOURCE.id,
      kind: 'PLATFORM',
      head: {
        scope: 'SOURCE',
        scopeId: SRD_CONTENT_SOURCE.id,
        revision: 7,
        builtRevision: 6,
        kinds: {}
      }
    })
  }, 60_000)

  it('matches the Builder for an assigned Character: restricted catalogues, own Homebrew and shares', async () => {
    const {
      owner,
      character,
      campaign,
      extraSourceId,
      ownBackground,
      sharedBackground,
      assign,
      expectParity
    } = await setup()
    await assign()
    const result = await owner.caller.query(manifest, {
      systemId: srdSystemRecord.id,
      characterId: character.id
    })
    expect(result.campaign).toMatchObject({ id: campaign.id, contentMaturity: 'MATURE' })
    const view = await expectParity(result)
    expect(view.sources.map((source) => source.id)).not.toContain(extraSourceId)
    expect(view.sources.map((source) => source.kind)).toContain('USER')
    expect(view.roots.BACKGROUND).toEqual(expect.arrayContaining([ownBackground, sharedBackground]))

    // Without the Character, no Campaign applies: every catalogue, no shares.
    const outside = await owner.caller.query(manifest, { systemId: srdSystemRecord.id })
    expect(outside.campaign).toBeNull()
    expect(outside.sources.map((source) => source.contentSourceId)).toContain(extraSourceId)
  }, 60_000)

  it('names every PLATFORM source and only the caller’s own Homebrew for the lists', async () => {
    const { t, owner, other, extraSourceId } = await setup()
    const ownerView = await owner.caller.query(catalogue, {})
    const otherView = await other.caller.query(catalogue, {})
    const platformIds = ownerView.sources
      .filter((source) => source.kind === 'PLATFORM')
      .map((source) => source.contentSourceId)
    expect(ownerView.userId).toBe(owner.userId)
    expect(platformIds).toEqual(expect.arrayContaining([SRD_CONTENT_SOURCE.id, extraSourceId]))
    const userSources = await t.run((ctx) =>
      ctx.db.query('contentSources').withIndex('by_ownerUserId').take(50)
    )
    for (const [view, userId] of [
      [ownerView, owner.userId],
      [otherView, other.userId]
    ] as const) {
      const own = userSources.filter((source) => source.ownerUserId === userId)
      expect(own.length).toBeGreaterThan(0)
      expect(
        view.sources
          .filter((source) => source.kind === 'USER')
          .map((source) => source.contentSourceId)
      ).toEqual(own.map((source) => source.id))
      expect(view.sources.every((source) => source.systemId === srdSystemRecord.id)).toBe(true)
    }
    await expect(t.query(catalogue, {})).rejects.toThrow('Unauthenticated')
  }, 60_000)

  it("refuses another user's Character, a System mismatch and anonymous callers", async () => {
    const { t, owner, other, character } = await setup()
    await expect(
      other.caller.query(manifest, { systemId: srdSystemRecord.id, characterId: character.id })
    ).rejects.toThrow('Character content is unavailable')
    await expect(
      owner.caller.query(manifest, {
        systemId: crypto.randomUUID(),
        characterId: character.id
      })
    ).rejects.toThrow('Character content is unavailable')
    await expect(t.query(manifest, { systemId: srdSystemRecord.id })).rejects.toThrow(
      'Unauthenticated'
    )
  }, 60_000)
})
