import { Alert, Button, Loader } from '@mantine/core'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { usePaginatedQuery } from 'convex/react'
import { CatchBoundary, useNavigate } from '@tanstack/react-router'
import { SocialEmptyState } from './SocialEmptyState'
import { SocialInviteDialog } from './SocialInviteDialog'
import { SocialListingRow } from './SocialListingRow'
import * as styles from './SocialHubViews.css'

export function SocialHostingView() {
  return (
    <CatchBoundary getResetKey={() => 'social-hosting'} errorComponent={SocialHostingError}>
      <SocialHostingList />
    </CatchBoundary>
  )
}

function SocialHostingError() {
  return <Alert color='red'>Could not load your listings.</Alert>
}

function SocialHostingList() {
  const navigate = useNavigate()
  const listings = usePaginatedQuery(
    convexApi.social.listings.listOwned,
    {},
    {
      initialNumItems: 8
    }
  )

  if (listings.status === 'LoadingFirstPage')
    return <Loader aria-label='Loading hosted listings' size='sm' />
  if (listings.status === 'Exhausted' && listings.results.length === 0) {
    return (
      <SocialEmptyState
        title='No hosted listings'
        body='Create a private invitation listing or publish a free table.'
      />
    )
  }

  return (
    <>
      <div className={styles.rows} aria-label='Hosted listings'>
        {listings.results.map((listing) => (
          <SocialListingRow
            key={listing.listingPublicId}
            listing={listing}
            showHost={false}
            actions={
              <>
                <Button
                  size='xs'
                  onClick={() =>
                    navigate({
                      params: { listingPublicId: listing.listingPublicId },
                      search: { section: 'listing' },
                      to: '/social/hosting/$listingPublicId/edit'
                    })
                  }
                >
                  Edit listing
                </Button>
                <Button
                  size='xs'
                  variant='default'
                  onClick={() =>
                    navigate({
                      params: { listingPublicId: listing.listingPublicId },
                      search: { section: 'applications' },
                      to: '/social/hosting/$listingPublicId/edit'
                    })
                  }
                >
                  Review applications
                </Button>
                <SocialInviteDialog listing={listing} />
              </>
            }
          />
        ))}
      </div>
      {listings.status === 'CanLoadMore' ? (
        <Button variant='subtle' onClick={() => listings.loadMore(8)}>
          Load more hosted listings
        </Button>
      ) : null}
      {listings.status === 'LoadingMore' ? (
        <Loader aria-label='Loading more hosted listings' size='sm' />
      ) : null}
    </>
  )
}
