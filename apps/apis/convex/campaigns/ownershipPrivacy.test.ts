import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  acceptCampaignOwnershipTransferInputSchema,
  assignCampaignCharacterInputSchema,
  campaignAssignmentResultSchema,
  campaignDetailDtoSchema,
  campaignOwnershipTransferRequestResultSchema,
  requestCampaignOwnershipTransferInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignChatEntryDto,
  CampaignChatPageDto,
  CampaignConversationDto,
  ExecuteCampaignRollInput,
  SendCampaignChatEntryInput,
  getCampaignConversationInputSchema,
  listCampaignChatEntriesInputSchema
} from '@artificer-toolkit/schema/api/campaignCommunication'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api } from '../_generated/api'
import * as admissionClosure from '../social/admissionClosure'

const request = makeFunctionReference<
  'mutation',
  z.input<typeof requestCampaignOwnershipTransferInputSchema>,
  z.output<typeof campaignOwnershipTransferRequestResultSchema>
>('campaigns/ownership:request')
const assign = makeFunctionReference<
  'mutation',
  z.input<typeof assignCampaignCharacterInputSchema>,
  z.output<typeof campaignAssignmentResultSchema>
>('campaigns/assignments:assign')
const accept = makeFunctionReference<
  'mutation',
  z.input<typeof acceptCampaignOwnershipTransferInputSchema>,
  z.output<typeof campaignDetailDtoSchema>
>('campaigns/ownership:accept')
const open = makeFunctionReference<
  'mutation',
  z.input<typeof getCampaignConversationInputSchema>,
  CampaignConversationDto
>('campaigns/conversations:open')
const list = makeFunctionReference<
  'query',
  z.input<typeof listCampaignChatEntriesInputSchema>,
  CampaignChatPageDto
>('campaigns/chat:list')
const send = makeFunctionReference<'mutation', SendCampaignChatEntryInput, CampaignChatEntryDto>(
  'campaigns/chat:send'
)
const roll = makeFunctionReference<'mutation', ExecuteCampaignRollInput, CampaignChatEntryDto>(
  'campaigns/rolls:execute'
)

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('excludes pre-transfer PARTY traffic at the same millisecond and retains subsequent chat and rolls', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'))
  const { owner: gm, other: player, t, character } = await readySheetFixture()
  await gm.caller.mutation(api.account.updateProfile, { username: 'FormerOwner', bio: null })
  await player.caller.mutation(api.account.updateProfile, { username: 'NextOwner', bio: null })
  const campaign = await gm.caller.mutation(api.campaigns.create.create, {
    name: 'Ownership privacy',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: player.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  })
  const old = await player.caller.mutation(send, {
    campaignId: campaign.id,
    room: 'PARTY',
    mode: 'OOC',
    body: 'Before transfer',
    clientNonce: crypto.randomUUID()
  })
  await gm.caller.mutation(request, { campaignId: campaign.id, recipientUserId: player.userId })
  const detail = await player.caller.mutation(accept, { campaignId: campaign.id })
  expect(detail.role).toBe('OWNER')
  expect(await t.run((ctx) => ctx.db.query('campaignCharacterAssignments').collect())).toEqual([])
  await expect(
    player.caller.query(list, { campaignId: campaign.id, room: 'PARTY' })
  ).rejects.toThrow('Conversation not found')
  await gm.caller.mutation(open, { campaignId: campaign.id, kind: 'PARTY' })
  expect((await gm.caller.query(list, { campaignId: campaign.id, room: 'PARTY' })).entries).toEqual(
    []
  )
  const fresh = await gm.caller.mutation(send, {
    campaignId: campaign.id,
    room: 'PARTY',
    mode: 'OOC',
    body: 'After transfer',
    clientNonce: crypto.randomUUID()
  })
  expect(Date.parse(fresh.createdAt)).toBeGreaterThan(Date.parse(old.createdAt))
  expect(
    (await gm.caller.query(list, { campaignId: campaign.id, room: 'PARTY' })).entries.map(
      (entry) => entry.id
    )
  ).toEqual([fresh.id])
  await gm.caller.mutation(assign, {
    campaignId: campaign.id,
    characterId: character.id
  })
  const result = await player.caller.mutation(roll, {
    campaignId: campaign.id,
    destination: 'TABLE',
    clientNonce: crypto.randomUUID(),
    roll: {
      characterId: null,
      expression: '1d20',
      source: { kind: 'MANUAL', label: 'After transfer' }
    }
  })
  expect(Date.parse(result.createdAt)).toBeGreaterThan(Date.parse(old.createdAt))
  await gm.caller.mutation(open, { campaignId: campaign.id, kind: 'TABLE' })
  expect(
    (await gm.caller.query(list, { campaignId: campaign.id, room: 'TABLE' })).entries.map(
      (entry) => entry.id
    )
  ).toEqual([result.id])
})

it('detaches the incoming owner Character atomically and rolls the detachment back on a later failure', async () => {
  const { owner: player, other: gm, t, character } = await readySheetFixture()
  const campaign = await gm.caller.mutation(api.campaigns.create.create, {
    name: 'Ownership detachment',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await t.run((ctx) =>
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
  await player.caller.mutation(assign, {
    campaignId: campaign.id,
    characterId: character.id
  })
  await gm.caller.mutation(request, { campaignId: campaign.id, recipientUserId: player.userId })
  const snapshot = () =>
    t.run(async (ctx) => ({
      assignments: await ctx.db.query('campaignCharacterAssignments').collect(),
      overlays: await ctx.db.query('campaignCharacterStates').collect(),
      characters: await ctx.db.query('characters').collect(),
      plays: await ctx.db.query('characterPlayStates').collect(),
      memberships: await ctx.db.query('campaignMemberships').collect(),
      campaigns: await ctx.db.query('campaigns').collect(),
      offers: await ctx.db.query('campaignOwnershipTransfers').collect(),
      shares: await ctx.db.query('campaignContentShares').collect(),
      events: await ctx.db.query('campaignEvents').collect()
    }))
  const before = await snapshot()
  expect(before.assignments).toHaveLength(1)
  expect(before.overlays).toHaveLength(1)
  const fault = vi
    .spyOn(admissionClosure, 'closeCampaignAdmission')
    .mockRejectedValueOnce(new Error('Late transfer failure'))
  await expect(player.caller.mutation(accept, { campaignId: campaign.id })).rejects.toThrow(
    'Late transfer failure'
  )
  fault.mockRestore()
  expect(await snapshot()).toEqual(before)
  await expect(player.caller.mutation(accept, { campaignId: campaign.id })).resolves.toMatchObject({
    role: 'OWNER'
  })
  const after = await snapshot()
  expect(after.assignments).toEqual([])
  expect(after.overlays).toEqual([])
  expect(after.characters).toEqual(before.characters)
  expect(after.shares).toEqual(before.shares)
})
