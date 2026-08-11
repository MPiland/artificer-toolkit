import * as socialContracts from '@artificer-toolkit/schema/api/socialHub'
import { okResponseSchema, request, type SchemaInput, type TrpcClient } from './transport'

export function buildSocialHubApi(client: TrpcClient) {
  return {
    eligibility: {
      get: () =>
        request('socialHub.eligibility.get', socialContracts.socialEligibilityDtoSchema, () =>
          client.socialHub.eligibility.get.query()
        ),
      accept: (input: SchemaInput<typeof socialContracts.acceptSocialEligibilityInputSchema>) =>
        request('socialHub.eligibility.accept', socialContracts.socialEligibilityDtoSchema, () =>
          client.socialHub.eligibility.accept.mutate(input)
        )
    },
    preferences: {
      update: (input: socialContracts.UpdateSocialContentPreferenceInput) =>
        request('socialHub.preferences.update', socialContracts.socialEligibilityDtoSchema, () =>
          client.socialHub.preferences.update.mutate(input)
        )
    },
    profiles: {
      get: (profilePublicId: string) =>
        request('socialHub.profiles.get', socialContracts.socialProfileDtoSchema, () =>
          client.socialHub.profiles.get.query({ profilePublicId })
        )
    },
    discovery: {
      search: (input: socialContracts.SocialDiscoveryInput) =>
        request('socialHub.discovery.search', socialContracts.socialDiscoveryPageDtoSchema, () =>
          client.socialHub.discovery.search.query(input)
        )
    },
    listings: {
      get: (listingPublicId: string) =>
        request('socialHub.listings.get', socialContracts.socialListingDtoSchema, () =>
          client.socialHub.listings.get.query({ listingPublicId })
        ),
      getOwned: (listingPublicId: string) =>
        request('socialHub.listings.getOwned', socialContracts.socialListingDtoSchema, () =>
          client.socialHub.listings.getOwned.query({ listingPublicId })
        ),
      mine: () =>
        request('socialHub.listings.mine', socialContracts.socialListingDtoSchema.array(), () =>
          client.socialHub.listings.mine.query()
        ),
      create: (input: socialContracts.CreateSocialListingInput) =>
        request('socialHub.listings.create', socialContracts.socialListingDtoSchema, () =>
          client.socialHub.listings.create.mutate(input)
        ),
      update: (input: socialContracts.UpdateSocialListingInput) =>
        request('socialHub.listings.update', socialContracts.socialListingDtoSchema, () =>
          client.socialHub.listings.update.mutate(input)
        ),
      open: (input: SchemaInput<typeof socialContracts.socialListingVersionInputSchema>) =>
        request('socialHub.listings.open', socialContracts.socialListingDtoSchema, () =>
          client.socialHub.listings.open.mutate(input)
        ),
      close: (input: SchemaInput<typeof socialContracts.socialListingVersionInputSchema>) =>
        request('socialHub.listings.close', socialContracts.socialListingDtoSchema, () =>
          client.socialHub.listings.close.mutate(input)
        ),
      deleteDraft: async (
        input: SchemaInput<typeof socialContracts.socialListingVersionInputSchema>
      ) => {
        await request('socialHub.listings.deleteDraft', okResponseSchema, () =>
          client.socialHub.listings.deleteDraft.mutate(input)
        )
      }
    },
    applications: {
      mine: () =>
        request(
          'socialHub.applications.mine',
          socialContracts.socialApplicationDtoSchema.array(),
          () => client.socialHub.applications.mine.query()
        ),
      forListing: (listingPublicId: string) =>
        request(
          'socialHub.applications.forListing',
          socialContracts.socialApplicationDtoSchema.array(),
          () => client.socialHub.applications.forListing.query({ listingPublicId })
        ),
      submit: (input: socialContracts.SubmitSocialApplicationInput) =>
        request('socialHub.applications.submit', socialContracts.socialApplicationDtoSchema, () =>
          client.socialHub.applications.submit.mutate(input)
        ),
      withdraw: (input: SchemaInput<typeof socialContracts.socialApplicationVersionInputSchema>) =>
        request('socialHub.applications.withdraw', socialContracts.socialApplicationDtoSchema, () =>
          client.socialHub.applications.withdraw.mutate(input)
        ),
      decide: (input: SchemaInput<typeof socialContracts.decideSocialApplicationInputSchema>) =>
        request('socialHub.applications.decide', socialContracts.socialApplicationDtoSchema, () =>
          client.socialHub.applications.decide.mutate(input)
        )
    },
    blocks: {
      list: () =>
        request('socialHub.blocks.list', socialContracts.socialBlockDtoSchema.array(), () =>
          client.socialHub.blocks.list.query()
        ),
      create: (profilePublicId: string) =>
        request('socialHub.blocks.create', socialContracts.socialBlockDtoSchema, () =>
          client.socialHub.blocks.create.mutate({ profilePublicId })
        ),
      remove: async (profilePublicId: string) => {
        await request('socialHub.blocks.remove', okResponseSchema, () =>
          client.socialHub.blocks.remove.mutate({ profilePublicId })
        )
      }
    },
    reports: {
      create: (input: socialContracts.CreateSocialReportInput) =>
        request('socialHub.reports.create', socialContracts.socialReportReceiptDtoSchema, () =>
          client.socialHub.reports.create.mutate(input)
        )
    },
    moderation: {
      queue: () =>
        request(
          'socialHub.moderation.queue',
          socialContracts.socialModerationQueueItemDtoSchema.array(),
          () => client.socialHub.moderation.queue.query()
        ),
      openReport: (reportPublicId: string) =>
        request(
          'socialHub.moderation.openReport',
          socialContracts.socialModerationReportDtoSchema,
          () => client.socialHub.moderation.openReport.mutate({ reportPublicId })
        ),
      takeAction: (input: socialContracts.TakeSocialModerationActionInput) =>
        request(
          'socialHub.moderation.takeAction',
          socialContracts.socialModerationReportDtoSchema,
          () => client.socialHub.moderation.takeAction.mutate(input)
        )
    }
  }
}

export type SocialHubApi = ReturnType<typeof buildSocialHubApi>
