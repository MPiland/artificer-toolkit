import { createFileRoute } from '@tanstack/react-router'
import { SocialListingFormPage } from '#domains/social/SocialListingFormPage'
import { socialListingManagementSearchSchema } from '#domains/social/socialSearch'

export const Route = createFileRoute('/_authed/social/hosting/$listingPublicId/edit')({
  validateSearch: socialListingManagementSearchSchema,
  component: SocialListingEditRoute
})

function SocialListingEditRoute() {
  const { listingPublicId } = Route.useParams()
  const { invitePublicId, section } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <SocialListingFormPage
      listingPublicId={listingPublicId}
      invitePublicId={invitePublicId}
      section={section}
      onSectionChange={(nextSection) =>
        void navigate({ replace: true, search: { section: nextSection } })
      }
    />
  )
}
