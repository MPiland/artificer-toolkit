import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput,
  leaveCampaignInputSchema,
  campaignMembershipDepartureResultSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  liveRoomActorSourceSchema,
  liveRoomInputsResponseSchema,
  type LiveRoomInputsInput,
  type LiveRoomInputsResponse,
  type LiveRoomInputsScope
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { insertActiveLiveAuthority } from '../../tests/fixtures/liveSessionWorker'

const read = makeFunctionReference<'query', LiveRoomInputsInput, LiveRoomInputsResponse>(
  'liveSessions/roomInputs:read'
)
const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const leave = makeFunctionReference<
  'mutation',
  z.input<typeof leaveCampaignInputSchema>,
  z.output<typeof campaignMembershipDepartureResultSchema>
>('campaigns/membershipDeparture:leave')
const secret = 'private-room-inputs-test-secret-at-least-32-bytes'

afterEach(() => {
  vi.unstubAllEnvs()
})

async function setup() {
  const base = await setupCharacterRun()
  const epoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch,
      createdAt: new Date().toISOString()
    })
  )
  const request = (scope: LiveRoomInputsScope) => ({
    campaignId: base.campaign.id,
    epoch,
    scope
  })
  /** Every page of the Run, in the order the room reads them. */
  async function runPages() {
    const pages: Extract<LiveRoomInputsResponse, { kind: 'RUN' }>[] = []
    let cursor: Extract<LiveRoomInputsScope, { kind: 'RUN' }>['cursor'] = null
    do {
      const page: LiveRoomInputsResponse = await base.t.query(
        read,
        request({ kind: 'RUN', encounterId: base.run.id, cursor })
      )
      if (page.kind !== 'RUN') throw new Error('Expected a Run page.')
      pages.push(page)
      cursor = page.continueCursor
    } while (cursor)
    return pages
  }
  const characters = (
    cursor: Extract<LiveRoomInputsScope, { kind: 'CHARACTERS' }>['cursor'] = null
  ) => request({ kind: 'CHARACTERS', characterIds: [base.character.id], cursor })
  return { ...base, epoch, request, characters, runPages }
}

describe('live room inputs (ADR 0035 S2)', () => {
  it('pages the whole Run aggregate, with the Run itself on the first page only', async () => {
    const base = await setup()
    const pages = await base.runPages()
    const documents = pages.flatMap((page) => page.documents)

    expect(documents[0]).toMatchObject({ table: 'encounterRuns', id: expect.any(String) })
    expect(documents.filter((document) => document.table === 'encounterRuns')).toHaveLength(1)
    expect(new Set(pages.map((page) => page.encounterVersion)).size).toBe(1)
    // Empty tables cost no round trip: one page per non-empty table (the Run rides the first).
    expect(pages.length).toBeLessThanOrEqual(new Set(documents.map((row) => row.table)).size)

    const stored = await base.t.run(async (ctx) => ({
      actors: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
        .collect(),
      facts: await ctx.db
        .query('encounterActorProjectionFacts')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
        .collect()
    }))
    const idsOf = (table: string) =>
      documents
        .filter((document) => document.table === table)
        .map((document) => document.id)
        .sort()
    expect(idsOf('encounterRunActors')).toEqual(stored.actors.map((row) => row._id).sort())
    expect(idsOf('encounterActorProjectionFacts')).toEqual(
      stored.facts.map((row) => row._id).sort()
    )
    expect(stored.actors.length).toBeGreaterThan(1)
  })

  it('rejects a cursor past the table list', async () => {
    const base = await setup()
    await expect(
      base.t.query(
        read,
        base.request({
          kind: 'RUN',
          encounterId: base.run.id,
          cursor: { position: 999, paginationCursor: null }
        })
      )
    ).rejects.toThrow('cursor is invalid')
  })

  it('serves a Character as one part, with its inputs on the first page only', async () => {
    const base = await setup()
    const first = await base.t.query(read, base.characters())
    if (first.kind !== 'CHARACTERS') throw new Error('Expected a Characters page.')
    const [part] = first.parts
    if (part?.status !== 'ASSIGNED') throw new Error('Expected an assigned Character.')
    expect(part.characterId).toBe(base.character.id)
    expect(part.inputs).toMatchObject({
      owner: expect.objectContaining({ id: base.character.id }),
      campaign: { id: base.campaign.id }
    })
    expect(first.continueCursor).toBeNull()
    expect(part.revisions).toContainEqual(
      expect.objectContaining({ scope: 'CHARACTER', id: base.character.id })
    )
  })

  it('rejects a Characters cursor past the requested list', async () => {
    const base = await setup()
    await expect(
      base.t.query(read, base.characters({ position: 1, paginationCursor: null }))
    ).rejects.toThrow('cursor is invalid')
  })

  it('serves a route response as one call with every Run page joined', async () => {
    const base = await setup()
    vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
    const post = (body: LiveRoomInputsInput) =>
      base.owner.caller.fetch('/live-sessions/room-inputs', {
        method: 'POST',
        headers: { 'x-artificer-live-session-secret': secret },
        body: JSON.stringify(body)
      })
    const response = await post(
      base.request({ kind: 'RUN', encounterId: base.run.id, cursor: null })
    )
    expect(response.status).toBe(200)
    const batched = liveRoomInputsResponseSchema.parse(await response.json())
    if (batched.kind !== 'RUN') throw new Error('Expected a Run response.')
    const pages = await base.runPages()
    expect(pages.length).toBeGreaterThan(1)
    expect(batched.continueCursor).toBeNull()
    expect(batched.documents).toEqual(pages.flatMap((page) => page.documents))

    const characters = await post(base.characters())
    expect(characters.status).toBe(200)
    expect(liveRoomInputsResponseSchema.parse(await characters.json())).toMatchObject({
      kind: 'CHARACTERS',
      parts: [{ status: 'ASSIGNED', characterId: base.character.id }],
      continueCursor: null
    })
  })

  describe('a Character that left the Campaign', () => {
    async function departed() {
      const base = await setup()
      const { version, accessStartedAt } = await base.t.run(async (ctx) => {
        const campaign = await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
          .unique()
        const membership = await ctx.db
          .query('campaignMemberships')
          .withIndex('by_campaignId_userId', (q) =>
            q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
          )
          .unique()
        if (!campaign || !membership) throw new Error('Fixture Campaign is unavailable.')
        return { version: campaign.version, accessStartedAt: membership.accessStartedAt }
      })
      await base.player.caller.mutation(leave, {
        campaignId: base.campaign.id,
        expectedCampaignVersion: version,
        expectedMembershipAccessStartedAt: accessStartedAt,
        commandId: crypto.randomUUID()
      })
      return base
    }

    it('reads as UNASSIGNED while its Run actor holds the frozen state', async () => {
      const base = await departed()
      expect(await base.t.query(read, base.characters())).toEqual({
        kind: 'CHARACTERS',
        parts: [{ status: 'UNASSIGNED', characterId: base.character.id }],
        continueCursor: null
      })

      const actors = (await base.runPages())
        .flatMap((page) => page.documents)
        .filter((document) => document.table === 'encounterRunActors')
        .map((document) =>
          liveRoomActorSourceSchema.parse(JSON.parse(String(document.fields.stateJson)))
        )
      expect(actors).toContainEqual(
        expect.objectContaining({
          kind: 'CHARACTER',
          sourceId: base.character.id,
          frozenState: expect.any(Object)
        })
      )
    })
  })

  it('serves the Campaign play scope, the System and its vocabulary', async () => {
    const base = await setup()
    const play = await base.t.query(read, base.request({ kind: 'CAMPAIGN_PLAY' }))
    expect(play).toMatchObject({
      kind: 'CAMPAIGN_PLAY',
      campaign: {
        id: base.campaign.id,
        gameSystemId: srdSystemRecord.id,
        ownerUserId: base.owner.userId
      }
    })
    const system = await base.t.query(read, base.request({ kind: 'SYSTEM', part: 'SYSTEM' }))
    expect(system).toMatchObject({ kind: 'SYSTEM', system: { id: srdSystemRecord.id } })
    if (system.kind === 'SYSTEM') expect(system.vocabulary).toBeNull()
    const vocabulary = await base.t.query(
      read,
      base.request({ kind: 'SYSTEM', part: 'VOCABULARY' })
    )
    if (vocabulary.kind !== 'SYSTEM') throw new Error('Expected the System scope.')
    expect(vocabulary.system).toBeNull()
    expect(vocabulary.vocabulary).not.toBeNull()
  })

  it('serves a reusable definition, and null when it does not exist', async () => {
    const base = await setup()
    const missing = await base.t.query(
      read,
      base.request({ kind: 'DEFINITION', definitionId: crypto.randomUUID() })
    )
    expect(missing).toMatchObject({ kind: 'DEFINITION', definition: null })

    const definitionId = await base.t.run(async (ctx) => {
      const stored = await ctx.db.query('reusableDefinitions').first()
      return stored?.id
    })
    if (!definitionId) return
    const found = await base.t.query(read, base.request({ kind: 'DEFINITION', definitionId }))
    if (found.kind !== 'DEFINITION') throw new Error('Expected a definition.')
    expect(found.definition).toMatchObject({ id: definitionId })
  })

  describe('authorization', () => {
    it('refuses a stale epoch and a released epoch', async () => {
      const base = await setup()
      await expect(
        base.t.query(read, {
          ...base.request({ kind: 'CAMPAIGN_PLAY' }),
          epoch: crypto.randomUUID()
        })
      ).rejects.toThrow('stale')
      await base.t.run(async (ctx) => {
        const authority = await ctx.db.query('campaignLiveAuthorities').first()
        if (authority) await ctx.db.patch(authority._id, { phase: 'DRAINING' })
      })
      await expect(base.t.query(read, base.request({ kind: 'CAMPAIGN_PLAY' }))).rejects.toThrow(
        'not active'
      )
    })

    it('refuses data of another Campaign even under a valid epoch', async () => {
      const base = await setup()
      // The per-owner hosted-Campaign limit means the other Campaign belongs to the player.
      const other = await base.player.caller.mutation(createCampaign, {
        name: 'Another Campaign',
        format: 'ONGOING',
        toneTags: ['HEROIC'],
        contentMaturity: 'STANDARD',
        gameSystemId: srdSystemRecord.id,
        primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
      })
      const otherEpoch = crypto.randomUUID()
      await base.t.run((ctx) =>
        insertActiveLiveAuthority(ctx, {
          campaignId: other.id,
          epoch: otherEpoch,
          createdAt: new Date().toISOString()
        })
      )
      const asOther = (scope: LiveRoomInputsScope) => ({
        campaignId: other.id,
        epoch: otherEpoch,
        scope
      })
      await expect(
        base.t.query(read, asOther({ kind: 'RUN', encounterId: base.run.id, cursor: null }))
      ).rejects.toThrow('Encounter not found')
      // Another Campaign's Character is not assigned here, so it reads as UNASSIGNED, not as data.
      expect(
        await base.t.query(
          read,
          asOther({ kind: 'CHARACTERS', characterIds: [base.character.id], cursor: null })
        )
      ).toEqual({
        kind: 'CHARACTERS',
        parts: [{ status: 'UNASSIGNED', characterId: base.character.id }],
        continueCursor: null
      })
      // The first Campaign's epoch does not open the other Campaign.
      await expect(
        base.t.query(read, {
          campaignId: other.id,
          epoch: base.epoch,
          scope: { kind: 'CAMPAIGN_PLAY' }
        })
      ).rejects.toThrow()
    })

    it('refuses a Campaign that holds no live authority', async () => {
      const base = await setup()
      await base.t.run(async (ctx) => {
        const authority = await ctx.db.query('campaignLiveAuthorities').first()
        if (authority) await ctx.db.delete(authority._id)
      })
      await expect(base.t.query(read, base.request({ kind: 'CAMPAIGN_PLAY' }))).rejects.toThrow()
    })
  })
})
