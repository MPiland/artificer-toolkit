import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignAssignmentResult,
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignChatEntryDto,
  CampaignConversationDto,
  getCampaignConversationInputSchema,
  sendCampaignChatEntryInputSchema
} from '@artificer-toolkit/schema/api/campaignCommunication'
import type {
  CampaignInventoryTransferResultDto,
  TransferCampaignInventoryInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import {
  decodeCampaignEventPage,
  encodeCampaignEvent,
  type CampaignEventPageTransportDto
} from '@artificer-toolkit/schema/api/campaignEventTransport'
import type { listCampaignEventsInputSchema } from '@artificer-toolkit/schema/api/campaignLiveState'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type {
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { editCharacterRecord } from '../../tests/fixtures/characterRecords'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api, components } from '../_generated/api'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const getCampaign = makeFunctionReference<'query', { id: string }, CampaignDetailDto>(
  'campaigns/queries:get'
)
const assign = makeFunctionReference<
  'mutation',
  { campaignId: string; characterId: string },
  CampaignAssignmentResult
>('campaigns/assignments:assign')
const unassign = makeFunctionReference<
  'mutation',
  { campaignId: string; characterId?: string },
  CampaignAssignmentResult
>('campaigns/assignments:unassign')
const transfer = makeFunctionReference<
  'mutation',
  { input: TransferCampaignInventoryInput },
  CampaignInventoryTransferResultDto
>('campaigns/inventoryTransfers:transfer')
const sheet = makeFunctionReference<
  'query',
  { campaignId: string; characterId: string },
  CharacterSheetResponseDto
>('campaigns/characterSheet:get')
const personalExecute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')
const openConversation = makeFunctionReference<
  'mutation',
  z.input<typeof getCampaignConversationInputSchema>,
  CampaignConversationDto
>('campaigns/conversations:open')
const send = makeFunctionReference<
  'mutation',
  z.input<typeof sendCampaignChatEntryInputSchema>,
  CampaignChatEntryDto
>('campaigns/chat:send')
const requestTransfer = makeFunctionReference<
  'mutation',
  { campaignId: string; recipientUserId: string },
  { ok: true }
>('campaigns/ownership:request')
const acceptTransfer = makeFunctionReference<'mutation', { campaignId: string }, CampaignDetailDto>(
  'campaigns/ownership:accept'
)
const listEvents = makeFunctionReference<
  'query',
  z.input<typeof listCampaignEventsInputSchema>,
  CampaignEventPageTransportDto
>('campaigns/events:list')

async function setup() {
  const base = await readySheetFixture()
  const { owner: player, other: gm, t } = base
  await t.run((ctx) => ctx.db.insert('accountEntitlements', { userId: gm.userId, tier: 'PRO_GM' }))
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.updateMany, {
      input: { model: 'session', update: { expiresAt: Date.now() + 24 * 60 * 60_000 } },
      paginationOpts: { cursor: null, numItems: 10 }
    })
  )
  await gm.caller.mutation(api.account.updateProfile, { username: 'GameMaster', bio: null })
  const campaign = await gm.caller.mutation(createCampaign, {
    name: 'The GM plays too',
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
  await player.caller.mutation(assign, { campaignId: campaign.id, characterId: base.character.id })
  const gmDraft = await base.createCharacter(undefined, gm.caller)
  const gmCharacter = await gm.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: gmDraft.draft.id,
    mode: 'create',
    character: gmDraft.character
  })
  return { ...base, player, gm, campaign, gmCharacterId: gmCharacter.character.id }
}

describe('the GM plays a Character like any other player (CAMPAIGN-7)', () => {
  it('assigns the GM’s own Character, which then trades, speaks and shares its Sheet as a player Character does', async () => {
    const { t, player, gm, campaign, character, gmCharacterId } = await setup()

    await expect(
      gm.caller.mutation(assign, { campaignId: campaign.id, characterId: gmCharacterId })
    ).resolves.toEqual({ ok: true })

    // Every member sees the GM's Character on the Campaign roster.
    for (const caller of [gm.caller, player.caller]) {
      const detail = await caller.query(getCampaign, { id: campaign.id })
      expect(
        detail.memberships.find((member) => member.userId === gm.userId)?.assignedCharacter?.id
      ).toBe(gmCharacterId)
    }

    // A player gives an item to the GM's Character, as to any other party member.
    const itemId = '70000000-0000-4000-8000-000000000901'
    await t.run((ctx) =>
      editCharacterRecord(ctx, character.id, (record) => ({
        ...record,
        state: {
          ...record.state,
          equipment: {
            ...record.state.equipment,
            inventory: [{ id: itemId, equipmentId: club.id, quantity: 1 }]
          }
        }
      }))
    )
    const [source, destination] = await t.run((ctx) =>
      Promise.all([readCharacterRow(ctx, character.id), readCharacterRow(ctx, gmCharacterId)])
    )
    await player.caller.mutation(transfer, {
      input: {
        kind: 'ITEM',
        campaignId: campaign.id,
        source: { kind: 'CHARACTER', characterId: character.id },
        destination: { kind: 'CHARACTER', characterId: gmCharacterId },
        itemId,
        amount: 1,
        expectedSourceVersion: source!.play.streamVersion,
        expectedDestinationVersion: destination!.play.streamVersion,
        idempotencyKey: crypto.randomUUID()
      }
    })
    const received = await t.run((ctx) => readCharacterRow(ctx, gmCharacterId))
    expect(readCharacterRecord(received!).state.equipment.inventory).toContainEqual(
      expect.objectContaining({ id: itemId, equipmentId: club.id })
    )

    // The GM speaks in character at the table; the players' private PARTY room stays closed.
    const spoken = await gm.caller.mutation(send, {
      campaignId: campaign.id,
      room: 'TABLE',
      mode: 'ROLEPLAY',
      assignedCharacterId: gmCharacterId,
      body: 'Bram raises his shield.',
      clientNonce: crypto.randomUUID()
    })
    expect(spoken).toMatchObject({ mode: 'ROLEPLAY', body: 'Bram raises his shield.' })
    await expect(
      gm.caller.mutation(openConversation, { campaignId: campaign.id, kind: 'PARTY' })
    ).rejects.toThrow()

    // Its Sheet is the GM's own, and players see it only once the GM turns Party can view on.
    const input = { campaignId: campaign.id, characterId: gmCharacterId }
    const own = await gm.caller.query(sheet, input)
    expect(own.meta.viewer).toBe('CHARACTER_OWNER')
    await expect(player.caller.query(sheet, input)).rejects.toThrow('Assigned Character not found.')
    await gm.caller.mutation(personalExecute, {
      id: gmCharacterId,
      command: {
        type: 'SET_PARTY_VISIBILITY',
        commandId: crypto.randomUUID(),
        expectedVersion: own.meta.streamVersion,
        visibility: { sheet: true, health: 'HIDDEN' }
      }
    })
    expect((await player.caller.query(sheet, input)).meta.viewer).toBe('PARTY_MEMBER')

    // Its history carries the notices addressed to its player, as a player's Character's does.
    const notice = campaignStoredEventSchema.parse({
      ...encodeCampaignEvent({
        campaignId: campaign.id,
        id: crypto.randomUUID(),
        type: 'FIXTURE_EVENT',
        visibility: 'SUBJECT',
        subjectCharacterId: gmCharacterId,
        payload: { fixture: true },
        createdAt: new Date().toISOString()
      }),
      actorUserId: null,
      visibleInHistory: true
    })
    await t.run((ctx) => ctx.db.insert('campaignEvents', notice))
    const history = decodeCampaignEventPage(await gm.caller.query(listEvents, input))
    expect(history.events.map((event) => event.id)).toContain(notice.id)

    // The GM removes their own Character the way a player does, without naming it.
    await gm.caller.mutation(unassign, { campaignId: campaign.id })
    const after = await gm.caller.query(getCampaign, { id: campaign.id })
    expect(after.memberships.find((member) => member.userId === gm.userId)?.assignedCharacter).toBe(
      null
    )
  }, 120_000)

  it('keeps the new GM’s Character in play when Campaign ownership changes hands', async () => {
    const { player, gm, campaign, character } = await setup()
    await gm.caller.mutation(requestTransfer, {
      campaignId: campaign.id,
      recipientUserId: player.userId
    })
    const detail = await player.caller.mutation(acceptTransfer, { campaignId: campaign.id })
    expect(detail.role).toBe('OWNER')
    expect(
      detail.memberships.find((member) => member.userId === player.userId)?.assignedCharacter?.id
    ).toBe(character.id)
    const own = await player.caller.query(sheet, {
      campaignId: campaign.id,
      characterId: character.id
    })
    expect(own.meta.viewer).toBe('CHARACTER_OWNER')
  }, 120_000)
})
