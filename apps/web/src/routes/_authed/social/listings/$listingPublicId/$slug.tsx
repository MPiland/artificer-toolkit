import { createFileRoute } from '@tanstack/react-router'
import { SocialListingDetailPage } from '#domains/social/SocialListingDetailPage'

export const Route = createFileRoute('/_authed/social/listings/$listingPublicId/$slug')({
  component: SocialListingDetailRoute
})

function SocialListingDetailRoute() {
  const { listingPublicId } = Route.useParams()
  return <SocialListingDetailPage listingPublicId={listingPublicId} />
}
