import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignListInput,
  CampaignListPage,
  CampaignLookupInput
} from '@artificer-toolkit/schema/api/campaignList'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, components, internal } from '../_generated/api'
import { fixture } from '../../tests/fixtures/characters'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const get = makeFunctionReference<'query', CampaignLookupInput, CampaignDetailDto>(
  'campaigns/queries:get'
)
const list = makeFunctionReference<'query', CampaignListInput, CampaignListPage>(
  'campaigns/queries:list'
)
const input: CreateCampaignInput = {
  name: 'Read boundary',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

describe('native Campaign read boundaries', () => {
  it('exposes only assigned Character identity and rejects foreign or duplicate assignments', async () => {
    const { t, owner: player, other: gm, createCharacter } = await readyCharacterFixture()
    const campaign = await gm.caller.mutation(create, input)
    const { draft, character } = await createCharacter()
    const committed = await player.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
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
    const result = await gm.caller.query(get, { id: campaign.id })
    expect(result.assignedCharacter).toBeNull()
    expect(result.memberships[1]!.assignedCharacter).toEqual({
      id: character.id,
      publicId: committed.publicId,
      label: character.label,
      systemId: character.systemId
    })
    expect((await player.caller.query(get, { id: campaign.id })).assignedCharacter).toEqual(
      result.memberships[1]!.assignedCharacter
    )
    const duplicate = await t.run((ctx) =>
      ctx.db.insert('campaignCharacterAssignments', {
        campaignId: crypto.randomUUID(),
        userId: player.userId,
        characterId: character.id,
        assignedAt: campaign.createdAt
      })
    )
    await expect(gm.caller.query(get, { id: campaign.id })).rejects.toThrow()
    await t.run(async (ctx) => {
      await ctx.db.delete(duplicate)
      const record = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', character.id))
        .unique()
      if (!record) throw new Error('Missing Character fixture.')
      await ctx.db.patch(record._id, { userId: gm.userId })
    })
    await expect(gm.caller.query(get, { id: campaign.id })).rejects.toThrow('assignment mismatch')
  })

  it('reads the existing maximum roster after a tier downgrade and never silently truncates overflow', async () => {
    const { t, owner } = await fixture()
    const campaign = await owner.caller.mutation(create, input)
    for (let index = 0; index < 12; index++) {
      await t.run(async (ctx) => {
        const user = await ctx.runMutation(components.betterAuth.adapter.create, {
          input: {
            model: 'user',
            data: {
              name: `Player ${index}`,
              email: `player-${index}@example.invalid`,
              emailVerified: true,
              username: `player${index}`,
              displayUsername: `Player${index}`,
              createdAt: Date.now(),
              updatedAt: Date.now()
            }
          },
          onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
        })
        const profile = await ctx.db
          .query('userProfiles')
          .withIndex('by_authUserId', (q) => q.eq('authUserId', user._id))
          .unique()
        if (!profile) throw new Error('Missing member profile fixture.')
        await ctx.db.insert('campaignMemberships', {
          campaignId: campaign.id,
          userId: profile.userId,
          role: 'PLAYER',
          status: 'ACTIVE',
          accessStartedAt: campaign.createdAt,
          joinedAt: campaign.createdAt,
          leftAt: null
        })
      })
    }
    const result = await owner.caller.query(get, { id: campaign.id })
    expect(result).toMatchObject({ memberCount: 13, playerCount: 12 })
    expect(result.memberships).toHaveLength(13)
    expect(result.memberships[0]!.role).toBe('OWNER')
    await t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: crypto.randomUUID(),
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    )
    await expect(owner.caller.query(get, { id: campaign.id })).rejects.toThrow('capacity exceeded')
    await expect(
      owner.caller.query(list, { paginationOpts: { cursor: null, numItems: 8 } })
    ).rejects.toThrow('capacity exceeded')
  })
})
