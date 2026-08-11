import { createFileRoute } from '@tanstack/react-router'
import { SocialListingFormPage } from '#domains/social/SocialListingFormPage'

export const Route = createFileRoute('/_authed/social/hosting/new')({
  component: SocialListingFormPage
})
