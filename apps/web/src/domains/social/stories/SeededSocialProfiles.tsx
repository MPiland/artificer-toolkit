import type { ReactNode } from 'react'
import { usePaginatedQuery } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { SocialApplicationDto } from '@artificer-toolkit/schema/api/socialHub'
import {
  STORY_CAMPAIGN,
  STORY_SOCIAL
} from '../../../../../apis/tests/developmentReviewDataScenarios'

type SeededProfile = SocialApplicationDto['applicant']

/**
 * Renders `children` with the story profiles the reader can reach. Their ids are random, so the
 * peer is found as the applicant to the reader's story listing and the blocked profile in the
 * reader's block list (D221).
 */
export function SeededSocialProfiles({
  children
}: {
  children: (profiles: { peer: SeededProfile; blocked: SeededProfile }) => ReactNode
}) {
  const listings = usePaginatedQuery(api.social.listings.listOwned, {}, { initialNumItems: 8 })
  const listing = listings.results.find(({ title }) => title === STORY_CAMPAIGN.name)
  const applications = usePaginatedQuery(
    api.social.admissionLists.listListingApplications,
    listing ? { listingPublicId: listing.listingPublicId, group: 'PENDING' } : 'skip',
    { initialNumItems: 8 }
  )
  const blocks = usePaginatedQuery(api.social.blockLists.list, {}, { initialNumItems: 8 })
  const peer = applications.results.find(
    ({ message }) => message === STORY_SOCIAL.applicationMessage
  )?.applicant
  const blocked = blocks.results[0]?.profile
  return peer && blocked ? children({ peer, blocked }) : null
}
