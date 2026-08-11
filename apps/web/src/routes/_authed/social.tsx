import { createFileRoute } from '@tanstack/react-router'
import { SocialEligibility } from '#domains/social/SocialEligibility'

export const Route = createFileRoute('/_authed/social')({
  component: SocialEligibility
})
