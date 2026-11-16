import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { usePaginatedQuery } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { SocialListingDto } from '@artificer-toolkit/schema/api/socialHub'
import { STORY_SOCIAL } from '../../../../../apis/tests/developmentReviewDataScenarios'
import { seededListingTestId } from './seededListing'

function SeededListingFrame({
  listing,
  children
}: {
  listing: SocialListingDto
  children: ReactNode
}) {
  return (
    <div data-testid={seededListingTestId} data-listing={JSON.stringify(listing)}>
      {children}
    </div>
  )
}

/**
 * Renders `children` with the listing the story account hosts under `title`. Its id is random, so it
 * is found by title in the account's own listings (D221). The frame carries the listing as read, so
 * a play function can assert against what the deployment holds.
 */
export function SeededHostedListing({
  title,
  children
}: {
  title: string
  children: (listing: SocialListingDto) => ReactNode
}) {
  const listings = usePaginatedQuery(api.social.listings.listOwned, {}, { initialNumItems: 8 })
  const listing = listings.results.find((owned) => owned.title === title)
  return listing ? (
    <SeededListingFrame listing={listing}>{children(listing)}</SeededListingFrame>
  ) : null
}

/**
 * Renders `children` with the listing the story account has applied to, as a discovery reader sees
 * it. The account's application is found by its seeded message, then the listing is read by id.
 */
export function SeededAppliedListing({
  children
}: {
  children: (listing: SocialListingDto) => ReactNode
}) {
  const applications = usePaginatedQuery(
    api.social.admissionLists.listOwnApplications,
    { group: 'PENDING' },
    { initialNumItems: 8 }
  )
  const listingPublicId = applications.results.find(
    ({ message }) => message === STORY_SOCIAL.applicationMessage
  )?.listingPublicId
  const { data: listing } = useQuery(
    convexQuery(api.social.discovery.getListing, listingPublicId ? { listingPublicId } : 'skip')
  )
  return listing ? (
    <SeededListingFrame listing={listing}>{children(listing)}</SeededListingFrame>
  ) : null
}
