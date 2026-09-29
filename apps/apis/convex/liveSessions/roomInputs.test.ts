import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  LiveRoomInputsInput,
  LiveRoomInputsResponse,
  LiveRoomInputsScope
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
  return { ...base, epoch, request, runPages }
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
          cursor: { tableIndex: 999, paginationCursor: null }
        })
      )
    ).rejects.toThrow('cursor is invalid')
  })

  it('serves the Character inputs on the first page only', async () => {
    const base = await setup()
    const first = await base.t.query(
      read,
      base.request({ kind: 'CHARACTER', characterId: base.character.id, cursor: null })
    )
    if (first.kind !== 'CHARACTER') throw new Error('Expected a Character page.')
    expect(first.inputs).toMatchObject({
      character: expect.any(Object),
      campaign: { id: base.campaign.id }
    })
    expect(first.continueCursor).toBeNull()
    expect(first.revisions).toContainEqual(
      expect.objectContaining({ scope: 'CHARACTER', id: base.character.id })
    )

    const later = await base.t.query(
      read,
      base.request({
        kind: 'CHARACTER',
        characterId: base.character.id,
        cursor: { tableIndex: 0, paginationCursor: null }
      })
    )
    if (later.kind !== 'CHARACTER') throw new Error('Expected a Character page.')
    expect(later.inputs).toBeNull()
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
      await expect(
        base.t.query(
          read,
          asOther({ kind: 'CHARACTER', characterId: base.character.id, cursor: null })
        )
      ).rejects.toThrow()
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
