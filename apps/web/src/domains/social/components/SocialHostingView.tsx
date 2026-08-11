import { Alert, Button, Loader } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { SocialEmptyState } from './SocialEmptyState'
import { SocialInviteDialog } from './SocialInviteDialog'
import { SocialListingRow } from './SocialListingRow'
import * as styles from './SocialHubViews.css'

export function SocialHostingView() {
  const navigate = useNavigate()
  const listings = useQuery({
    queryKey: queryKeys.socialHub.listingsMine(),
    queryFn: () => api.socialHub.listings.mine()
  })

  if (listings.isPending) return <Loader aria-label='Loading hosted listings' size='sm' />
  if (listings.isError) return <Alert color='red'>Could not load your listings.</Alert>
  if (listings.data.length === 0) {
    return (
      <SocialEmptyState
        title='No hosted listings'
        body='Create a private invitation listing or publish a free table.'
      />
    )
  }

  return (
    <div className={styles.rows} aria-label='Hosted listings'>
      {listings.data.map((listing) => (
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
  )
}
