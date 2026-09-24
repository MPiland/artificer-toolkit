import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  CreateCampaignInput,
  CampaignDetailDto,
  assignCampaignCharacterInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignSessionDto,
  createCampaignSessionNoteSectionInputSchema
} from '@artificer-toolkit/schema/api/campaignSessions'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, internal, components } from '../_generated/api'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createSession = makeFunctionReference<
  'mutation',
  { campaignId: string; title: string },
  CampaignSessionDto
>('campaigns/sessions:create')
const createNote = makeFunctionReference<
  'mutation',
  z.input<typeof createCampaignSessionNoteSectionInputSchema>,
  unknown
>('campaigns/sessionNotes:create')
const assign = makeFunctionReference<
  'mutation',
  z.input<typeof assignCampaignCharacterInputSchema>,
  unknown
>('campaigns/assignments:assign')
const removeFixtureState = makeFunctionReference<
  'mutation',
  { ownerUserId: string; playerUserId: string; campaignId: string; characterId: string },
  null
>('campaigns/developmentSessionControl:removeFixtureState')

async function setup(admit = true) {
  const base = await readyCharacterFixture({
    resources: {
      id: crypto.randomUUID(),
      label: 'P15 daily charge',
      order: 0,
      availableAtLevel: 1,
      charges: {
        id: crypto.randomUUID(),
        resetKind: 'DAILY',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 1
      }
    }
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.owner.userId, base.other.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_${String(index + 1).padStart(12, '0')}@example.invalid` }
        }
      })
    }
  })
  const campaign = await base.other.caller.mutation(createCampaign, {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  if (admit) {
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: base.owner.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    )
    await base.owner.caller.mutation(assign, {
      campaignId: campaign.id,
      characterId: character.id
    })
  }
  return { ...base, character, campaign }
}

describe('P15 Session fixture cleanup', () => {
  it('cleans archived Session and Clock recovery state before Campaign and personal Character cleanup', async () => {
    const base = await setup()
    const first = await base.other.caller.mutation(createSession, {
      campaignId: base.campaign.id,
      title: 'P15 first'
    })
    await base.other.caller.mutation(createSession, {
      campaignId: base.campaign.id,
      title: 'P15 second'
    })
    await base.other.caller.mutation(createNote, {
      campaignId: base.campaign.id,
      sessionId: first.id,
      title: 'Agenda',
      content: 'Fixture note',
      visibility: 'SHARED',
      kind: 'SHARED_NOTE'
    })
    await base.owner.caller.mutation(api.campaigns.sessionRsvps.set, {
      campaignId: base.campaign.id,
      sessionId: first.id,
      response: 'YES'
    })
    await base.other.caller.mutation(api.campaigns.sessionAttendance.set, {
      campaignId: base.campaign.id,
      sessionId: first.id,
      characterId: base.character.id,
      present: true,
      expectedVersion: first.version
    })
    const sheet = await base.owner.caller.query(api.campaigns.characterSheet.get, {
      campaignId: base.campaign.id,
      characterId: base.character.id
    })
    const resource = sheet.resources.items.find((item) => item.label === 'P15 daily charge')!
    const used = await base.owner.caller.mutation(api.campaigns.characterSheet.execute, {
      campaignId: base.campaign.id,
      characterId: base.character.id,
      command: {
        type: 'USE_RESOURCE',
        commandId: crypto.randomUUID(),
        expectedVersion: sheet.meta.streamVersion,
        resourceGrantId: resource.id,
        amount: 1
      }
    })
    await base.other.caller.mutation(api.campaigns.clock.initialize, {
      campaignId: base.campaign.id,
      commandId: crypto.randomUUID(),
      expectedVersion: 0,
      day: 1,
      minuteOfDay: 1439,
      dawnMinute: 360,
      duskMinute: 1080
    })
    await base.other.caller.mutation(api.campaigns.clock.start, {
      campaignId: base.campaign.id,
      commandId: crypto.randomUUID(),
      expectedVersion: 0
    })
    await base.other.caller.mutation(api.campaigns.clock.advance, {
      campaignId: base.campaign.id,
      commandId: crypto.randomUUID(),
      expectedVersion: 1,
      minutes: 1
    })
    const recovered = await base.owner.caller.query(api.campaigns.characterSheet.get, {
      campaignId: base.campaign.id,
      characterId: base.character.id
    })
    expect(recovered.resources.items.find((item) => item.id === resource.id)?.used).toBe(0)
    expect(recovered.meta.streamVersion).toBe(used.streamVersion + 1)
    const receiptsBefore = await base.t.run((ctx) =>
      ctx.db.query('characterCommandReceipts').collect()
    )
    expect(receiptsBefore.some((receipt) => receipt.actorId === base.other.userId)).toBe(true)
    const currentCampaign = await base.other.caller.query(api.campaigns.queries.get, {
      id: base.campaign.id
    })
    await base.other.caller.mutation(api.campaigns.archive.archive, {
      campaignId: base.campaign.id,
      expectedVersion: currentCampaign.version
    })
    await base.t.mutation(removeFixtureState, {
      ownerUserId: base.other.userId,
      playerUserId: base.owner.userId,
      campaignId: base.campaign.id,
      characterId: base.character.id
    })
    const rows = await base.t.run(async (ctx) => ({
      campaign: await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique(),
      character: await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
        .unique(),
      sessions: await ctx.db
        .query('campaignSessions')
        .withIndex('by_campaignId_sessionNumber', (q) => q.eq('campaignId', base.campaign.id))
        .collect(),
      clocks: await ctx.db
        .query('campaignClocks')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
        .collect(),
      notes: await ctx.db
        .query('campaignSessionNotes')
        .withIndex('by_campaignId_sessionId_id', (q) => q.eq('campaignId', base.campaign.id))
        .collect()
    }))
    expect(rows.campaign).not.toBeNull()
    expect(rows.character).not.toBeNull()
    expect(rows.sessions).toHaveLength(0)
    expect(rows.clocks).toHaveLength(0)
    expect(rows.notes).toHaveLength(0)
    const receiptsAfter = await base.t.run((ctx) =>
      ctx.db.query('characterCommandReceipts').collect()
    )
    expect(receiptsAfter).toEqual(
      receiptsBefore.filter((receipt) => receipt.actorId === base.owner.userId)
    )
    await base.t.mutation(
      makeFunctionReference<
        'mutation',
        {
          ownerUserId: string
          playerUserId: string
          campaignId: string
          characterId: string
        },
        null
      >('encounters/developmentCampaign:removeFixtureCampaign'),
      {
        ownerUserId: base.other.userId,
        playerUserId: base.owner.userId,
        campaignId: base.campaign.id,
        characterId: base.character.id
      }
    )
    await base.t.mutation(internal.characters.development.removePersonalFixtureCharacter, {
      userId: base.owner.userId,
      characterId: base.character.id
    })
    const cleared = await base.t.run(async (ctx) => ({
      characters: await ctx.db.query('characters').collect(),
      campaigns: await ctx.db.query('campaigns').collect(),
      receipts: await ctx.db.query('characterCommandReceipts').collect(),
      recoveries: await ctx.db.query('campaignClockRecoveries').collect(),
      events: await ctx.db.query('campaignEvents').collect(),
      commands: await ctx.db.query('campaignCommands').collect()
    }))
    expect(cleared).toEqual({
      characters: [],
      campaigns: [],
      receipts: [],
      recoveries: [],
      events: [],
      commands: []
    })
  })

  it('rejects a foreign Session note before deleting anything', async () => {
    const base = await setup()
    const session = await base.other.caller.mutation(createSession, {
      campaignId: base.campaign.id,
      title: 'P15 foreign author'
    })
    await base.t.run((ctx) =>
      ctx.db.insert('campaignSessionNotes', {
        id: crypto.randomUUID(),
        campaignId: base.campaign.id,
        sessionId: session.id,
        authorUserId: crypto.randomUUID(),
        updatedBy: base.owner.userId,
        title: 'bad',
        content: 'bad',
        visibility: 'SHARED',
        kind: 'SHARED_NOTE',
        sortOrder: 0,
        version: 0,
        createdAt: session.createdAt,
        updatedAt: session.createdAt
      })
    )
    await expect(
      base.t.mutation(removeFixtureState, {
        ownerUserId: base.other.userId,
        playerUserId: base.owner.userId,
        campaignId: base.campaign.id,
        characterId: base.character.id
      })
    ).rejects.toThrow('Fixture child ownership mismatch.')
    await expect(
      base.t.run((ctx) =>
        ctx.db
          .query('campaignSessions')
          .withIndex('by_campaignId_sessionNumber', (q) => q.eq('campaignId', base.campaign.id))
          .collect()
      )
    ).resolves.toHaveLength(1)
  })

  it('cleans a Campaign after admission has not completed', async () => {
    const base = await setup(false)
    const { campaign } = base
    await base.t.mutation(removeFixtureState, {
      ownerUserId: base.other.userId,
      playerUserId: base.owner.userId,
      campaignId: campaign.id,
      characterId: base.character.id
    })
    await expect(
      base.t.run((ctx) =>
        ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
          .unique()
      )
    ).resolves.not.toBeNull()
  })

  it('rejects an unlinked GM Character receipt without deleting Campaign state', async () => {
    const base = await setup()
    const sheet = await base.other.caller.query(api.campaigns.characterSheet.get, {
      campaignId: base.campaign.id,
      characterId: base.character.id
    })
    const resource = sheet.resources.items.find((item) => item.label === 'P15 daily charge')!
    await base.other.caller.mutation(api.campaigns.characterSheet.execute, {
      campaignId: base.campaign.id,
      characterId: base.character.id,
      command: {
        type: 'USE_RESOURCE',
        commandId: crypto.randomUUID(),
        expectedVersion: sheet.meta.streamVersion,
        resourceGrantId: resource.id,
        amount: 1
      }
    })
    const session = await base.other.caller.mutation(createSession, {
      campaignId: base.campaign.id,
      title: 'P15 receipt guard'
    })
    const before = await base.t.run((ctx) => ctx.db.query('characterCommandReceipts').collect())
    await expect(
      base.t.mutation(removeFixtureState, {
        ownerUserId: base.other.userId,
        playerUserId: base.owner.userId,
        campaignId: base.campaign.id,
        characterId: base.character.id
      })
    ).rejects.toThrow('Fixture Character receipt ownership mismatch.')
    expect(await base.t.run((ctx) => ctx.db.query('characterCommandReceipts').collect())).toEqual(
      before
    )
    expect(
      await base.other.caller.query(api.campaigns.sessions.get, {
        campaignId: base.campaign.id,
        sessionNumber: session.sessionNumber
      })
    ).toEqual(session)
  })
})
