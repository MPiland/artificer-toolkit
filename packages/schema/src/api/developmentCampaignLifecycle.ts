import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { deleteCampaignInputSchema } from './campaignCore.js'

const fixtureIds = (maximum: number) =>
  z
    .array(postgresUuidSchema)
    .check(z.maxLength(maximum))
    .check(
      z.refine((ids) => new Set(ids).size === ids.length, 'Fixture identities must be unique.')
    )

export const developmentCampaignFixtureSchema = z
  .strictObject({
    ownerUserId: postgresUuidSchema,
    campaignId: postgresUuidSchema,
    gameSystemId: postgresUuidSchema,
    userIds: fixtureIds(4).check(z.minLength(1))
  })
  .check(
    z.refine(
      (input) => input.userIds.includes(input.ownerUserId),
      'The fixture owner must belong to its reserved account scope.'
    )
  )

// These bounds restrict this proof fixture; they do not impose product workload limits.
export const developmentCampaignDescendantsSchema = z.strictObject({
  sessionIds: fixtureIds(4),
  encounterIds: fixtureIds(4),
  sceneIds: fixtureIds(4),
  definitionSaveIds: fixtureIds(8),
  fogSaveIds: fixtureIds(8),
  conversationIds: fixtureIds(8),
  entryIds: fixtureIds(32),
  listingIds: fixtureIds(2),
  applicationIds: fixtureIds(32),
  cleanupJobIds: fixtureIds(8)
})
export const developmentCampaignInspectionSchema = z.strictObject({
  campaignStateJson: z.string(),
  personalStateJson: z.string(),
  descendants: developmentCampaignDescendantsSchema
})
export const developmentCampaignRemovedInputSchema = z.strictObject({
  fixture: developmentCampaignFixtureSchema,
  descendants: developmentCampaignDescendantsSchema
})
export const developmentCampaignRollbackInputSchema = z
  .strictObject({
    fixture: developmentCampaignFixtureSchema,
    deletion: deleteCampaignInputSchema
  })
  .check(
    z.refine(
      (input) => input.fixture.campaignId === input.deletion.campaignId,
      'The rollback operation must target this fixture Campaign.'
    )
  )

export type DevelopmentCampaignFixture = z.output<typeof developmentCampaignFixtureSchema>
export type DevelopmentCampaignDescendants = z.output<typeof developmentCampaignDescendantsSchema>
export type DevelopmentCampaignInspection = z.output<typeof developmentCampaignInspectionSchema>
export type DevelopmentCampaignRemovedInput = z.output<typeof developmentCampaignRemovedInputSchema>
export type DevelopmentCampaignRollbackInput = z.output<
  typeof developmentCampaignRollbackInputSchema
>
