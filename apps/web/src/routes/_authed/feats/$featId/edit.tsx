import { createFileRoute } from '@tanstack/react-router'
import { FeatDetailPage } from '#domains/feats'

export const Route = createFileRoute('/_authed/feats/$featId/edit')({
  component: EditFeatRoute
})

function EditFeatRoute() {
  const { user } = Route.useRouteContext()
  const { featId } = Route.useParams()

  return <FeatDetailPage featId={featId} mode='edit' userId={user?.id ?? 'unknown-user'} />
}
