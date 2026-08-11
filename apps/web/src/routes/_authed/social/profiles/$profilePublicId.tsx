import { createFileRoute } from '@tanstack/react-router'
import { SocialProfilePage } from '#domains/social/SocialProfilePage'

export const Route = createFileRoute('/_authed/social/profiles/$profilePublicId')({
  component: SocialProfileRoute
})

function SocialProfileRoute() {
  const { profilePublicId } = Route.useParams()
  return <SocialProfilePage profilePublicId={profilePublicId} />
}
