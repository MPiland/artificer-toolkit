import { expect, it } from 'vitest'
import { makeFunctionReference } from 'convex/server'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { verifyEncounterCharacterCommands } from '../../tests/developmentEncounterCharacter'
import { api, components, internal } from '../_generated/api'
import { inProcessDevelopmentClient } from '../../tests/fixtures/liveSessionWorker'

it('runs the actual-backend Character/Encounter assertions against local transactions', async () => {
  const { t, owner: player, other: owner, character } = await readySheetFixture()
  await t.run(async (ctx) => {
    for (const [index, userId] of [owner.userId, player.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
  })
  const campaign = await owner.caller.mutation(api.campaigns.create.create, {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const fixture = {
    ownerUserId: owner.userId,
    playerUserId: player.userId,
    campaignId: campaign.id
  }
  await t.mutation(
    makeFunctionReference<'mutation', typeof fixture, null>(
      'encounters/developmentCampaign:admitFixturePlayer'
    ),
    fixture
  )
  await player.caller.mutation(api.campaigns.assignments.assign, {
    campaignId: campaign.id,
    characterId: character.id
  })
  await verifyEncounterCharacterCommands({
    owner: inProcessDevelopmentClient(owner.caller),
    player: inProcessDevelopmentClient(player.caller),
    anonymous: inProcessDevelopmentClient(t),
    campaignId: campaign.id,
    characterId: character.id
  })
  const cleanup = { ...fixture, characterId: character.id }
  await t.mutation(
    makeFunctionReference<'mutation', typeof cleanup, null>(
      'encounters/developmentCampaign:removeFixtureCampaign'
    ),
    cleanup
  )
  await t.mutation(internal.characters.development.removePersonalFixtureCharacter, {
    userId: player.userId,
    characterId: character.id
  })
  expect(
    await t.run((ctx) =>
      Promise.all([
        ctx.db.query('campaigns').collect(),
        ctx.db.query('campaignMemberships').collect(),
        ctx.db.query('campaignCharacterAssignments').collect(),
        ctx.db.query('campaignCharacterStates').collect(),
        ctx.db.query('campaignSessions').collect(),
        ctx.db.query('campaignSessionAttendance').collect(),
        ctx.db.query('encounterRuns').collect(),
        ctx.db.query('encounterRunActors').collect(),
        ctx.db.query('encounterRunCommands').collect(),
        ctx.db.query('characterCommandReceipts').collect(),
        ctx.db.query('characters').collect()
      ])
    )
  ).toEqual(Array.from({ length: 11 }, () => []))
}, 30000)
