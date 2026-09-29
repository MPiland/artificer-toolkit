import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput,
  leaveCampaignInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { CharacterPartyVisibilityDto } from '@artificer-toolkit/schema/api/healthDisplay'
import type {
  LiveSessionRoomAuthorizationInput,
  LiveSessionRoomAuthorizationResponse
} from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { LiveSessionControlInput } from '@artificer-toolkit/schema/api/liveSessions'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../_generated/api'
import { readCharacterRow } from '../characters/stateDocuments'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const read = makeFunctionReference<
  'query',
  LiveSessionRoomAuthorizationInput,
  LiveSessionRoomAuthorizationResponse
>('liveSessions/roomAuthorization:read')
const personalExecute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')
const leave = makeFunctionReference<'mutation', z.input<typeof leaveCampaignInputSchema>, unknown>(
  'campaigns/membershipDeparture:leave'
)

/** A Campaign with a GM and one player whose Character is assigned, and no live room yet. */
async function setup() {
  const base = await readyCharacterFixture()
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  const { owner: player, other: gm, t } = base
  const campaign = await gm.caller.mutation(createCampaign, {
    name: 'Live room authorization',
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
    await ctx.db.insert('campaignCharacterAssignments', {
      campaignId: campaign.id,
      userId: player.userId,
      characterId: character.id,
      assignedAt: campaign.createdAt
    })
  })
  const epoch = crypto.randomUUID()
  const holdRoom = () =>
    t.run(async (ctx) => {
      const now = new Date().toISOString()
      await ctx.db.insert('campaignLiveAuthorities', {
        campaignId: campaign.id,
        epoch,
        phase: 'DO_ACTIVE',
        activationFingerprint: 'a'.repeat(64),
        persistedSequence: 0,
        persistedStateChecksum: 'a'.repeat(64),
        createdAt: now,
        updatedAt: now
      })
    })
  async function setVisibility(visibility: CharacterPartyVisibilityDto) {
    const current = await t.run((ctx) => readCharacterRow(ctx, character.id))
    if (!current) throw new Error('Missing Character.')
    return player.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'SET_PARTY_VISIBILITY',
        commandId: crypto.randomUUID(),
        expectedVersion: current.play.streamVersion,
        visibility
      }
    })
  }
  /** The `INVALIDATE_INPUTS` notices scheduled so far, oldest first. */
  const invalidations = () =>
    t.run(async (ctx) =>
      (await ctx.db.system.query('_scheduled_functions').collect()).flatMap((job) => {
        const input = job.args[0] as LiveSessionControlInput
        return job.name === 'liveSessions/control:send' &&
          input.operation.type === 'INVALIDATE_INPUTS'
          ? [input]
          : []
      })
    )
  return { t, gm, player, campaign, character, epoch, holdRoom, setVisibility, invalidations }
}

describe('live room authorization (ADR 0035 Amendment 14)', () => {
  it('serves the room by its DO_ACTIVE epoch and sends only the sections that changed', async () => {
    const base = await setup()
    await base.holdRoom()
    const request = { campaignId: base.campaign.id, epoch: base.epoch }

    const full = await base.t.query(read, { ...request, known: null })
    expect(full.campaign).toEqual({
      ownerUserId: base.gm.userId,
      members: expect.arrayContaining([
        { membershipEpoch: expect.any(String), role: 'OWNER', userId: base.gm.userId },
        { membershipEpoch: base.campaign.createdAt, role: 'PLAYER', userId: base.player.userId }
      ]),
      assignments: [{ characterId: base.character.id, userId: base.player.userId }]
    })
    expect(full.characters).toEqual([
      {
        characterId: base.character.id,
        ownerUserId: base.player.userId,
        partyVisibility: { sheet: false, health: 'HIDDEN' }
      }
    ])
    expect(full.preferences).toHaveLength(2)
    expect(full.play).toEqual({ encounter: null })

    // Nothing changed: only the revisions, which is the small read that renews the room's lease.
    expect(await base.t.query(read, { ...request, known: full.revisions })).toEqual({
      revisions: full.revisions,
      characters: []
    })

    await base.setVisibility({ sheet: true, health: 'BAR' })
    const changed = await base.t.query(read, { ...request, known: full.revisions })
    expect(changed).toEqual({
      revisions: { ...full.revisions, characters: [expect.any(Object)] },
      characters: [
        {
          characterId: base.character.id,
          ownerUserId: base.player.userId,
          partyVisibility: { sheet: true, health: 'BAR' }
        }
      ]
    })

    await expect(
      base.t.query(read, { ...request, epoch: crypto.randomUUID(), known: null })
    ).rejects.toThrow('stale')
    await base.t.run(async (ctx) => {
      const authority = await ctx.db.query('campaignLiveAuthorities').first()
      if (authority) await ctx.db.patch(authority._id, { phase: 'DRAINING' })
    })
    await expect(base.t.query(read, { ...request, known: null })).rejects.toThrow('not active')
  })

  it('notifies the room once per transaction and Campaign, only while it holds DO_ACTIVE authority', async () => {
    const base = await setup()
    await base.setVisibility({ sheet: true, health: 'HIDDEN' })
    expect(await base.invalidations()).toEqual([])

    await base.holdRoom()
    await base.setVisibility({ sheet: true, health: 'DESCRIPTIVE' })
    const { autoRollDice } = await base.player.caller.query(api.account.rollPreferences, {})
    await base.player.caller.mutation(api.account.setAutoRollDice, { autoRollDice: !autoRollDice })
    const settings = await base.gm.caller.query(api.campaigns.playSettings.get, {
      campaignId: base.campaign.id
    })
    const { version, updatedAt: _updatedAt, ...fields } = settings
    await base.gm.caller.mutation(api.campaigns.playSettings.save, {
      ...fields,
      expectedVersion: version,
      quorum: 3
    })
    const campaign = await base.gm.caller.query(api.campaigns.queries.get, {
      id: base.campaign.id
    })
    await base.player.caller.mutation(leave, {
      campaignId: base.campaign.id,
      expectedCampaignVersion: campaign.version,
      expectedMembershipAccessStartedAt: base.campaign.createdAt,
      commandId: crypto.randomUUID()
    })

    const notices = await base.invalidations()
    expect(notices.slice(0, 3)).toEqual([
      {
        campaignId: base.campaign.id,
        operation: { type: 'INVALIDATE_INPUTS', scopes: ['CHARACTER'] }
      },
      {
        campaignId: base.campaign.id,
        operation: { type: 'INVALIDATE_INPUTS', scopes: ['PREFERENCES'] }
      },
      { campaignId: base.campaign.id, operation: { type: 'INVALIDATE_INPUTS', scopes: ['PLAY'] } }
    ])
    // The departure touches memberships, the assignment and shares in one transaction: one notice.
    expect(notices).toHaveLength(4)
    expect(notices[3]).toMatchObject({
      campaignId: base.campaign.id,
      operation: { type: 'INVALIDATE_INPUTS', scopes: expect.arrayContaining(['CAMPAIGN']) }
    })
  })
})
