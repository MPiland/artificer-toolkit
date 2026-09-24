import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  campaignEventPageDtoSchema,
  type CampaignConditionDto,
  type SaveCampaignConditionInput,
  type CampaignEventDto,
  type listCampaignEventsInputSchema
} from '@artificer-toolkit/schema/api/campaignLiveState'
import {
  decodeCampaignEventPage,
  encodeCampaignEvent,
  type CampaignEventPageTransportDto
} from '@artificer-toolkit/schema/api/campaignEventTransport'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_CONDITION_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api } from '../_generated/api'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const list = makeFunctionReference<
  'query',
  z.input<typeof listCampaignEventsInputSchema>,
  CampaignEventPageTransportDto
>('campaigns/events:list')
const saveCondition = makeFunctionReference<
  'mutation',
  SaveCampaignConditionInput,
  CampaignConditionDto
>('campaigns/gmWrites:saveCondition')

async function setup() {
  const { owner: player, other: gm, ...base } = await readySheetFixture()
  const campaign = await gm.caller.mutation(createCampaign, {
    name: 'Campaign audit',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  // Admission and assignment are fixtures, not native admission producers under test.
  const memberId = await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: player.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  const assignmentId = await base.t.run((ctx) =>
    ctx.db.insert('campaignCharacterAssignments', {
      campaignId: campaign.id,
      userId: player.userId,
      characterId: base.character.id,
      assignedAt: campaign.createdAt
    })
  )
  const input = { campaignId: campaign.id, characterId: base.character.id }
  // TABLE/COPY/other-subject history is fixture-only; no native producers are claimed here.
  async function seedEvent(overrides: Partial<CampaignEventDto> = {}) {
    const event: CampaignEventDto = {
      campaignId: campaign.id,
      id: crypto.randomUUID(),
      type: 'FIXTURE_EVENT',
      visibility: 'TABLE',
      subjectCharacterId: null,
      payload: { fixture: true },
      createdAt: '2026-01-01T12:00:00.000Z',
      ...overrides
    }
    const stored = campaignStoredEventSchema.parse({
      ...encodeCampaignEvent(event),
      actorUserId: null,
      visibleInHistory: event.type !== 'CAMPAIGN_COPIED'
    })
    await base.t.run((ctx) => ctx.db.insert('campaignEvents', stored))
    return event.id
  }
  return { ...base, gm, player, campaign, input, memberId, assignmentId, seedEvent }
}

describe('native Campaign audit history', () => {
  it('round-trips nested JSON and rejects malformed stored payload JSON', async () => {
    const { t, gm, input, seedEvent } = await setup()
    const payload = {
      nested: [{ count: 2, enabled: true, absent: null }, ['text', 3]],
      label: 'Fixture'
    }
    const id = await seedEvent({ payload })
    const wire = await gm.caller.query(list, input)
    expect(wire.events[0]).not.toHaveProperty('payload')
    expect(JSON.parse(wire.events[0]!.payloadJson)).toEqual(payload)
    expect(decodeCampaignEventPage(wire).events[0]?.payload).toEqual(payload)
    await t.run(async (ctx) => {
      const event = await ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', input.campaignId).eq('id', id))
        .unique()
      if (!event) throw new Error('Missing event fixture.')
      await ctx.db.patch(event._id, { payloadJson: '{malformed' })
    })
    await expect(gm.caller.query(list, input)).rejects.toThrow()
  })

  it('projects real GM audit with legacy owner/player visibility and no internal or private fields', async () => {
    const { gm, player, input, seedEvent, t } = await setup()
    const visible = await gm.caller.mutation(saveCondition, {
      ...input,
      conditionTypeId: SRD_CONDITION_TYPES[0].id,
      visibility: 'VISIBLE',
      expectedVersion: 0,
      notes: 'PRIVATE-VISIBLE-NOTE'
    })
    const secret = await gm.caller.mutation(saveCondition, {
      ...input,
      conditionTypeId: SRD_CONDITION_TYPES[1].id,
      visibility: 'SECRET',
      expectedVersion: 0,
      notes: 'PRIVATE-SECRET-NOTE'
    })
    const table = await seedEvent()
    const otherSubject = await seedEvent({
      visibility: 'SUBJECT',
      subjectCharacterId: crypto.randomUUID()
    })
    const otherOwner = await seedEvent({
      visibility: 'OWNER',
      subjectCharacterId: crypto.randomUUID()
    })
    const copy = await seedEvent({ type: 'CAMPAIGN_COPIED' })
    const ownerWire = await gm.caller.query(list, input)
    const subjectWire = await player.caller.query(list, input)
    for (const wire of [ownerWire, subjectWire]) {
      expect(JSON.stringify(wire)).not.toMatch(
        /PRIVATE-|actorUserId|visibleInHistory|_creationTime|_id/
      )
      for (const event of wire.events) {
        expect(event).not.toHaveProperty('payload')
        expect(() => JSON.parse(event.payloadJson)).not.toThrow()
      }
    }
    const owner = decodeCampaignEventPage(ownerWire)
    const subject = decodeCampaignEventPage(subjectWire)
    expect(owner.events.map((event) => event.id)).toContain(table)
    expect(owner.events.map((event) => event.id)).toContain(otherOwner)
    expect(subject.events.map((event) => event.id)).toContain(table)
    expect(subject.events.map((event) => event.id)).not.toContain(otherOwner)
    expect(owner.events).toHaveLength(3)
    expect(subject.events).toHaveLength(2)
    expect(
      owner.events.find((event) => event.type === 'CAMPAIGN_CONDITION_SAVED')?.payload
    ).toEqual({
      action: 'SAVED',
      conditionId: secret.id,
      conditionTypeId: secret.conditionTypeId,
      version: 0
    })
    expect(
      subject.events.find((event) => event.type === 'CAMPAIGN_CONDITION_SAVED')?.payload
    ).toEqual({
      action: 'SAVED',
      conditionId: visible.id,
      conditionTypeId: visible.conditionTypeId,
      version: 0
    })
    for (const page of [owner, subject]) {
      expect(campaignEventPageDtoSchema.parse(page)).toEqual(page)
      expect(page.nextCursor).toBeNull()
      expect(page.events.map((event) => event.id)).not.toContain(copy)
      expect(page.events.map((event) => event.id)).not.toContain(otherSubject)
      expect(JSON.stringify(page)).not.toMatch(
        /PRIVATE-|actorUserId|visibleInHistory|_creationTime|_id/
      )
    }
    const rows = await t.run((ctx) =>
      ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', input.campaignId))
        .take(20)
    )
    expect(
      rows
        .filter((event) => event.type === 'CAMPAIGN_CONDITION_SAVED')
        .every((event) => event.actorUserId === gm.userId)
    ).toBe(true)
  })

  it('filters before bounded pagination, orders timestamp ties by UUID, and rejects invisible or foreign cursors', async () => {
    const { gm, player, input, seedEvent } = await setup()
    const low = '10000000-0000-4000-8000-000000000001'
    const mid = '20000000-0000-4000-8000-000000000001'
    const high = '30000000-0000-4000-8000-000000000001'
    const old = await seedEvent({ createdAt: '2025-12-31T12:00:00.000Z' })
    await seedEvent({ id: low })
    await seedEvent({ id: mid, visibility: 'SUBJECT', subjectCharacterId: input.characterId })
    await seedEvent({ id: high })
    const secret = await seedEvent({ visibility: 'OWNER', createdAt: '2026-02-01T12:00:00.000Z' })
    const foreign = await seedEvent({ campaignId: crypto.randomUUID() })
    const otherSubject = await seedEvent({
      visibility: 'SUBJECT',
      subjectCharacterId: crypto.randomUUID()
    })
    const copy = await seedEvent({ type: 'CAMPAIGN_COPIED', createdAt: '2026-03-01T12:00:00.000Z' })
    // More invisible newer rows than a page can hold must not starve visible rows.
    for (let index = 0; index < 6; index++) {
      await seedEvent({
        visibility: 'SUBJECT',
        subjectCharacterId: crypto.randomUUID(),
        createdAt: '2026-04-01T12:00:00.000Z'
      })
    }
    const first = await player.caller.query(list, { ...input, limit: 2 })
    expect(first.events.map((event) => event.id)).toEqual([high, mid])
    expect(first.nextCursor).toBe(mid)
    const second = await player.caller.query(list, {
      ...input,
      limit: 2,
      cursor: first.nextCursor!
    })
    expect(second.events.map((event) => event.id)).toEqual([low, old])
    expect(second.nextCursor).toBeNull()
    expect(await player.caller.query(list, { ...input, cursor: old })).toEqual({
      events: [],
      nextCursor: null
    })
    const owner = await gm.caller.query(list, { ...input, limit: 2 })
    expect(owner.events.map((event) => event.id)).toEqual([secret, high])
    expect(owner.nextCursor).toBe(high)
    expect(
      (await gm.caller.query(list, { ...input, cursor: high })).events.map((event) => event.id)
    ).toEqual([low, old])
    for (const cursor of [secret, foreign, otherSubject, copy, crypto.randomUUID()]) {
      expect(await player.caller.query(list, { ...input, cursor })).toEqual({
        events: [],
        nextCursor: null
      })
    }
    for (const cursor of [mid, foreign, otherSubject, copy]) {
      expect(await gm.caller.query(list, { ...input, cursor })).toEqual({
        events: [],
        nextCursor: null
      })
    }
    for (const limit of [0, 101])
      await expect(player.caller.query(list, { ...input, limit })).rejects.toThrow()
    await expect(player.caller.query(list, { ...input, cursor: 'not-a-uuid' })).rejects.toThrow()
  })

  it('defaults to 50 records and rechecks exact authority for cursors while permitting archived reads', async () => {
    const { t, gm, player, campaign, input, memberId, assignmentId, seedEvent, readState } =
      await setup()
    const ids: string[] = []
    for (let index = 0; index < 51; index++) ids.push(await seedEvent())
    ids.sort((left, right) => right.localeCompare(left))
    const first = await player.caller.query(list, input)
    expect(first.events.map((event) => event.id)).toEqual(ids.slice(0, 50))
    expect(first.nextCursor).toBe(ids[49])
    const request = { ...input, cursor: first.nextCursor! }
    expect((await player.caller.query(list, request)).events.map((event) => event.id)).toEqual(
      ids.slice(50)
    )
    await gm.caller.mutation(api.campaigns.archive.archive, {
      campaignId: campaign.id,
      expectedVersion: 0
    })
    expect(await player.caller.query(list, input)).toEqual(first)
    expect(await gm.caller.query(list, input)).toEqual(first)
    await expect(t.query(list, request)).rejects.toThrow('Unauthenticated')
    await expect(
      gm.caller.query(list, { ...request, campaignId: crypto.randomUUID() })
    ).rejects.toThrow('Campaign not found')
    await expect(
      player.caller.query(list, { ...request, characterId: crypto.randomUUID() })
    ).rejects.toThrow('Assigned Character not found')
    await t.run((ctx) => ctx.db.patch(memberId, { status: 'LEFT', leftAt: campaign.createdAt }))
    await expect(player.caller.query(list, request)).rejects.toThrow('Campaign not found')
    await expect(gm.caller.query(list, request)).rejects.toThrow('Assigned Character not found')
    await t.run((ctx) => ctx.db.patch(memberId, { status: 'ACTIVE', leftAt: null }))
    const before = await readState()
    if (!before.character) throw new Error('Missing Character fixture.')
    await t.run((ctx) => ctx.db.patch(before.character!._id, { userId: gm.userId }))
    await expect(player.caller.query(list, request)).rejects.toThrow('assignment mismatch')
    await expect(gm.caller.query(list, request)).rejects.toThrow('assignment mismatch')
    await t.run((ctx) => ctx.db.patch(before.character!._id, { userId: player.userId }))
    await t.run((ctx) => ctx.db.delete(assignmentId))
    await expect(player.caller.query(list, request)).rejects.toThrow('Assigned Character not found')
    await expect(gm.caller.query(list, request)).rejects.toThrow('Assigned Character not found')
  })
})
