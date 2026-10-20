import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput,
  archiveCampaignInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignSessionDto,
  CampaignSessionReferencePinDto,
  CampaignNotebookSectionDto,
  FinishCampaignSessionInput,
  createCampaignNotebookSectionInputSchema,
  deleteCampaignNotebookSectionInputSchema,
  createCampaignSessionInputSchema,
  createCampaignSessionReferencePinInputSchema,
  deleteCampaignSessionReferencePinInputSchema
} from '@artificer-toolkit/schema/api/campaignSessions'
import type {
  CampaignSessionReferenceListInput,
  CampaignSessionReferenceListPage
} from '@artificer-toolkit/schema/api/campaignSessionLists'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'

import { fixture } from '../../tests/fixtures/characters'
import { importedSubject, importSeededSubjects, versionWithCompilation } from '../../tests/fixtures/publication'
import { deleteAuthoredVersion, insertAuthoredVersion } from '../content/documents'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createSession = makeFunctionReference<
  'mutation',
  z.input<typeof createCampaignSessionInputSchema>,
  CampaignSessionDto
>('campaigns/sessions:create')
const createNotebook = makeFunctionReference<
  'mutation',
  z.input<typeof createCampaignNotebookSectionInputSchema>,
  CampaignNotebookSectionDto
>('campaigns/notebooks:create')
const create = makeFunctionReference<
  'mutation',
  z.input<typeof createCampaignSessionReferencePinInputSchema>,
  CampaignSessionReferencePinDto
>('campaigns/sessionReferences:create')
const removeNotebook = makeFunctionReference<
  'mutation',
  z.input<typeof deleteCampaignNotebookSectionInputSchema>,
  { ok: true }
>('campaigns/notebooks:remove')
const remove = makeFunctionReference<
  'mutation',
  z.input<typeof deleteCampaignSessionReferencePinInputSchema>,
  { ok: true }
>('campaigns/sessionReferences:remove')
const list = makeFunctionReference<
  'query',
  CampaignSessionReferenceListInput,
  CampaignSessionReferenceListPage
>('campaigns/sessionReferences:list')
const archive = makeFunctionReference<
  'mutation',
  z.input<typeof archiveCampaignInputSchema>,
  CampaignDetailDto
>('campaigns/archive:archive')
const finish = makeFunctionReference<'mutation', FinishCampaignSessionInput, CampaignSessionDto>(
  'campaigns/sessionFinish:finish'
)

async function setup(contentMaturity: 'STANDARD' | 'MATURE' = 'STANDARD') {
  const base = await fixture()
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({
        subjectKind: 'BACKGROUND',
        ...acolyte,
        document: acolyte
      })
    ]
  })
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Session references',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity,
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const membershipId = await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  const session = await base.owner.caller.mutation(createSession, {
    campaignId: campaign.id
  })
  return { ...base, campaign, session, membershipId }
}

function pageInput(
  campaignId: string,
  sessionId: string,
  cursor: string | null = null,
  numItems = 2
): CampaignSessionReferenceListInput {
  return { campaignId, sessionId, paginationOpts: { cursor, numItems } }
}

async function routeFor(t: Awaited<ReturnType<typeof fixture>>['t']) {
  const route = await t.run((ctx) =>
    ctx.db
      .query('authoredRouteIds')
      .withIndex('by_subjectId', (q) => q.eq('subjectId', acolyte.id))
      .unique()
  )
  if (!route) throw new Error('Missing Acolyte route fixture.')
  return route
}

describe('native Campaign session references', () => {
  it('deletes all pins for a removed notebook atomically without touching other targets', async () => {
    const { t, owner, other, campaign, session } = await setup()
    const note = await owner.caller.mutation(createNotebook, {
      campaignId: campaign.id,
      title: 'Remove with pins',
      content: ''
    })
    const retainedNote = await owner.caller.mutation(createNotebook, {
      campaignId: campaign.id,
      title: 'Keep this note',
      content: ''
    })
    const secondSession = await owner.caller.mutation(createSession, {
      campaignId: campaign.id
    })
    const removedIds: string[] = []
    for (let index = 0; index < 51; index++) {
      const pin = await owner.caller.mutation(create, {
        campaignId: campaign.id,
        sessionId: index % 2 ? session.id : secondSession.id,
        target: { kind: 'CAMPAIGN_NOTE', noteSectionId: note.id.toUpperCase() }
      })
      removedIds.push(pin.id)
    }
    const retained = await owner.caller.mutation(create, {
      campaignId: campaign.id,
      sessionId: session.id,
      target: { kind: 'CAMPAIGN_NOTE', noteSectionId: retainedNote.id }
    })
    const route = await routeFor(t)
    const authored = await owner.caller.mutation(create, {
      campaignId: campaign.id,
      sessionId: secondSession.id,
      target: {
        kind: 'AUTHORED_ROUTE',
        routeSubjectKind: 'BACKGROUND',
        publicId: route.publicId
      }
    })
    const readState = () =>
      t.run(async (ctx) => ({
        notes: await ctx.db.query('campaignNotebookSections').collect(),
        pins: await ctx.db.query('campaignSessionReferences').collect(),
        sessions: await ctx.db.query('campaignSessions').collect()
      }))
    const before = await readState()
    const input = {
      campaignId: campaign.id.toUpperCase(),
      sectionId: note.id.toUpperCase()
    }
    await expect(other.caller.mutation(removeNotebook, input)).rejects.toThrow(
      'Notebook section not found.'
    )
    expect(await readState()).toEqual(before)
    await expect(
      owner.caller.mutation(async (ctx) => {
        await ctx.runMutation(removeNotebook, input)
        const pins = await ctx.db.query('campaignSessionReferences').collect()
        expect(pins.some((pin) => removedIds.includes(pin.id))).toBe(false)
        throw new Error('Injected failure after notebook and pin deletion')
      })
    ).rejects.toThrow('Injected failure after notebook and pin deletion')
    expect(await readState()).toEqual(before)
    expect(await owner.caller.mutation(removeNotebook, input)).toEqual({
      ok: true
    })
    const after = await readState()
    expect(after.notes).toEqual(before.notes.filter((section) => section.id !== note.id))
    expect(after.pins).toEqual(before.pins.filter((pin) => !removedIds.includes(pin.id)))
    expect(after.pins.map((pin) => pin.id).sort()).toEqual([retained.id, authored.id].sort())
    expect(after.sessions).toEqual(before.sessions)
    await expect(owner.caller.mutation(removeNotebook, input)).rejects.toThrow(
      'Notebook section not found'
    )
    expect(await readState()).toEqual(after)
  }, 30_000)

  it('resolves notebook labels at read time, masks Standard text, and stores no label snapshot', async () => {
    const { t, owner, other, campaign, session } = await setup()
    const notebook = await owner.caller.mutation(createNotebook, {
      campaignId: campaign.id,
      title: 'Secret shitstorm',
      content: '<p>Secret shitstorm</p>',
      visibility: 'PRIVATE'
    })
    const pin = await owner.caller.mutation(create, {
      campaignId: campaign.id.toUpperCase(),
      sessionId: session.id.toUpperCase(),
      target: {
        kind: 'CAMPAIGN_NOTE',
        noteSectionId: notebook.id.toUpperCase()
      }
    })
    expect(pin).toMatchObject({
      campaignId: campaign.id,
      sessionId: session.id,
      target: { kind: 'CAMPAIGN_NOTE', noteSectionId: notebook.id },
      label: expect.not.stringContaining('shitstorm')
    })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('campaignSessionReferences')
          .withIndex('by_campaignId_sessionId_id', (q) =>
            q.eq('campaignId', campaign.id).eq('sessionId', session.id).eq('id', pin.id)
          )
          .unique()
      )
    ).toMatchObject({ target: pin.target })
    expect(
      JSON.stringify(await t.run((ctx) => ctx.db.query('campaignSessionReferences').take(5)))
    ).not.toContain('label')

    await owner.caller.mutation(createNotebook, {
      campaignId: campaign.id,
      title: 'Shared',
      content: '',
      visibility: 'SHARED'
    })
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignNotebookSections')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', notebook.id))
        .unique()
      if (!row) throw new Error('Missing notebook fixture.')
      await ctx.db.patch(row._id, {
        title: 'Fresh label',
        visibility: 'SHARED'
      })
    })
    expect(
      (await owner.caller.query(list, pageInput(campaign.id, session.id))).page[0]
    ).toMatchObject({
      id: pin.id,
      label: 'Fresh label'
    })
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignNotebookSections')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', notebook.id))
        .unique()
      if (row) await ctx.db.delete(row._id)
    })
    expect((await owner.caller.query(list, pageInput(campaign.id, session.id))).page).toEqual([])
    await expect(
      other.caller.query(list, pageInput(campaign.id, session.id))
    ).resolves.toMatchObject({ page: [] })
  }, 30_000)

  it('returns mature labels, skips invalid candidates without losing the cursor, and allows repeated targets', async () => {
    const { t, owner, campaign, session } = await setup('MATURE')
    const notebooks: CampaignNotebookSectionDto[] = []
    const pins: CampaignSessionReferencePinDto[] = []
    for (let index = 0; index < 9; index++) {
      const note = await owner.caller.mutation(createNotebook, {
        campaignId: campaign.id,
        title: `Mature ${index} shitstorm`,
        content: '',
        visibility: 'PRIVATE'
      })
      notebooks.push(note)
      const pin = await owner.caller.mutation(create, {
        campaignId: campaign.id,
        sessionId: session.id,
        target: { kind: 'CAMPAIGN_NOTE', noteSectionId: note.id }
      })
      pins.push(pin)
      await t.run(async (ctx) => {
        const stored = await ctx.db
          .query('campaignSessionReferences')
          .withIndex('by_campaignId_sessionId_id', (q) =>
            q.eq('campaignId', campaign.id).eq('sessionId', session.id).eq('id', pin.id)
          )
          .unique()
        if (!stored) throw new Error('Missing pin.')
        await ctx.db.patch(stored._id, {
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString()
        })
      })
    }
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignNotebookSections')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', campaign.id).eq('id', notebooks[0]!.id)
        )
        .unique()
      if (row) await ctx.db.delete(row._id)
    })
    const ids: string[] = []
    const first = await owner.caller.query(list, pageInput(campaign.id, session.id, null, 1))
    expect(first.page).toEqual([])
    expect(first.isDone).toBe(false)
    let cursor: string | null = first.continueCursor
    for (let index = 0; index < 8; index++) {
      const page: CampaignSessionReferenceListPage = await owner.caller.query(
        list,
        pageInput(campaign.id, session.id, cursor, 2)
      )
      ids.push(...page.page.map((row) => row.id))
      if (page.isDone) break
      cursor = page.continueCursor
    }
    expect(ids).toHaveLength(8)
    expect(ids).toEqual(pins.slice(1).map((pin) => pin.id))
    const firstPage = (await owner.caller.query(list, pageInput(campaign.id, session.id))).page
    expect(firstPage).toHaveLength(1)
    expect(firstPage[0]?.label).toContain('shitstorm')
    const duplicate = await owner.caller.mutation(create, {
      campaignId: campaign.id,
      sessionId: session.id,
      target: pins[1]!.target
    })
    expect(duplicate.id).not.toBe(pins[1]!.id)
    expect(duplicate.target).toEqual(pins[1]!.target)
  })

  it('supports authored routes with exact kind and current labels, but drops inaccessible or wrong-kind targets', async () => {
    const { t, owner, other, campaign, session } = await setup()
    const route = await routeFor(t)
    const pin = await owner.caller.mutation(create, {
      campaignId: campaign.id,
      sessionId: session.id,
      target: {
        kind: 'AUTHORED_ROUTE',
        routeSubjectKind: 'BACKGROUND',
        publicId: route.publicId
      }
    })
    expect(pin.label).toBeTruthy()
    await expect(
      owner.caller.mutation(create, {
        campaignId: campaign.id,
        sessionId: session.id,
        target: {
          kind: 'AUTHORED_ROUTE',
          routeSubjectKind: 'CLASS',
          publicId: route.publicId
        }
      })
    ).rejects.toThrow()
    const privateSourceId = crypto.randomUUID()
    const storedSource = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', route.subjectId))
        .unique()
      if (!root) throw new Error('Missing authored root fixture.')
      const source = await ctx.db.insert('contentSources', {
        ...SRD_CONTENT_SOURCE,
        id: privateSourceId,
        kind: 'USER',
        ownerUserId: owner.userId
      })
      const document = {
        ...acolyte,
        userId: owner.userId,
        label: 'Fresh owned label'
      }
      const checksum = checksumRuleDocument(document)
      const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      if (!version) throw new Error('Missing authored version fixture.')
      await deleteAuthoredVersion(ctx, version)
      const currentVersionId = await insertAuthoredVersion(
        ctx,
        {
          subjectKind: version.subjectKind,
          id: version.id,
          systemId: version.systemId,
          label: document.label,
          checksum,
          contentSourceId: privateSourceId,
          versionId: version.versionId,
          version: version.version,
          documentSchemaVersion: version.documentSchemaVersion
        },
        canonicalizeRuleDocument(document),
        version.compilation
      )
      await ctx.db.patch(root._id, {
        ownerUserId: owner.userId,
        contentSourceId: privateSourceId,
        label: document.label,
        checksum,
        currentVersionId
      })
      return source
    })
    expect((await owner.caller.query(list, pageInput(campaign.id, session.id))).page).toEqual([
      { ...pin, label: 'Fresh owned label' }
    ])
    await t.run((ctx) => ctx.db.patch(storedSource, { ownerUserId: other.userId }))
    expect((await owner.caller.query(list, pageInput(campaign.id, session.id))).page).toEqual([])
    await expect(
      owner.caller.mutation(create, {
        campaignId: campaign.id,
        sessionId: session.id,
        target: pin.target
      })
    ).rejects.toThrow('Reference target not found')
    await t.run((ctx) => ctx.db.patch(storedSource, { ownerUserId: owner.userId }))
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', route.subjectId))
        .unique()
      if (root) await ctx.db.delete(root._id)
    })
    expect((await owner.caller.query(list, pageInput(campaign.id, session.id))).page).toEqual([])
    await expect(
      owner.caller.mutation(remove, {
        campaignId: campaign.id,
        sessionId: session.id,
        pinId: pin.id
      })
    ).resolves.toEqual({ ok: true })
  })

  it('enforces member reads, GM-only writes, Session and Campaign scope, archive, and exact removal scope', async () => {
    const { t, owner, other, campaign, session, membershipId } = await setup()
    const notebook = await owner.caller.mutation(createNotebook, {
      campaignId: campaign.id,
      title: 'Shared',
      content: '',
      visibility: 'SHARED'
    })
    const pin = await owner.caller.mutation(create, {
      campaignId: campaign.id,
      sessionId: session.id,
      target: { kind: 'CAMPAIGN_NOTE', noteSectionId: notebook.id }
    })
    await expect(t.query(list, pageInput(campaign.id, session.id))).rejects.toThrow(
      'Unauthenticated'
    )
    await expect(
      t.mutation(remove, {
        campaignId: campaign.id,
        sessionId: session.id,
        pinId: pin.id
      })
    ).rejects.toThrow('Unauthenticated')
    expect(await other.caller.query(list, pageInput(campaign.id, crypto.randomUUID()))).toEqual({
      page: [],
      isDone: true,
      continueCursor: ''
    })
    await expect(
      other.caller.mutation(create, {
        campaignId: campaign.id,
        sessionId: session.id,
        target: { kind: 'CAMPAIGN_NOTE', noteSectionId: notebook.id }
      })
    ).rejects.toThrow('Campaign not found')
    const secondSession = await owner.caller.mutation(createSession, {
      campaignId: campaign.id
    })
    await expect(
      owner.caller.query(list, pageInput(campaign.id, secondSession.id))
    ).resolves.toMatchObject({ page: [] })
    await expect(
      owner.caller.mutation(remove, {
        campaignId: campaign.id,
        sessionId: secondSession.id,
        pinId: pin.id
      })
    ).rejects.toThrow()
    await expect(
      other.caller.mutation(remove, {
        campaignId: campaign.id,
        sessionId: session.id,
        pinId: pin.id
      })
    ).rejects.toThrow()
    await owner.caller.mutation(finish, {
      campaignId: campaign.id,
      sessionId: secondSession.id,
      expectedVersion: 0,
      commandId: crypto.randomUUID()
    })
    const finishedPin = await owner.caller.mutation(create, {
      campaignId: campaign.id,
      sessionId: secondSession.id,
      target: { kind: 'CAMPAIGN_NOTE', noteSectionId: notebook.id }
    })
    await owner.caller.mutation(remove, {
      campaignId: campaign.id,
      sessionId: secondSession.id,
      pinId: finishedPin.id
    })
    await t.run((ctx) =>
      ctx.db.insert('accountEntitlements', {
        userId: owner.userId,
        tier: 'PRO_GM'
      })
    )
    const foreignCampaign = await owner.caller.mutation(createCampaign, {
      name: 'Foreign campaign',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    const foreignSession = await owner.caller.mutation(createSession, {
      campaignId: foreignCampaign.id
    })
    await expect(
      owner.caller.query(list, pageInput(foreignCampaign.id, foreignSession.id))
    ).resolves.toMatchObject({ page: [] })
    await expect(
      owner.caller.mutation(create, {
        campaignId: foreignCampaign.id,
        sessionId: foreignSession.id,
        target: { kind: 'CAMPAIGN_NOTE', noteSectionId: notebook.id }
      })
    ).rejects.toThrow()
    await expect(
      owner.caller.mutation(remove, {
        campaignId: foreignCampaign.id,
        sessionId: foreignSession.id,
        pinId: pin.id
      })
    ).rejects.toThrow()
    await t.run((ctx) =>
      ctx.db.patch(membershipId, {
        status: 'LEFT',
        leftAt: new Date().toISOString()
      })
    )
    await expect(other.caller.query(list, pageInput(campaign.id, session.id))).rejects.toThrow()
    await owner.caller.mutation(remove, {
      campaignId: campaign.id,
      sessionId: session.id,
      pinId: pin.id
    })
    expect((await owner.caller.query(list, pageInput(campaign.id, session.id))).page).toEqual([])
    await owner.caller.mutation(archive, {
      campaignId: campaign.id,
      expectedVersion: campaign.version
    })
    expect((await owner.caller.query(list, pageInput(campaign.id, session.id))).page).toEqual([])
    await expect(
      owner.caller.mutation(remove, {
        campaignId: campaign.id,
        sessionId: session.id,
        pinId: pin.id
      })
    ).rejects.toThrow('read-only')
    await expect(
      owner.caller.mutation(create, {
        campaignId: campaign.id,
        sessionId: session.id,
        target: { kind: 'CAMPAIGN_NOTE', noteSectionId: notebook.id }
      })
    ).rejects.toThrow('read-only')
  })
})
