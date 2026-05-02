import { createFileRoute } from '@tanstack/react-router'
import { FeatEditPage } from '#domains/feats'

export const Route = createFileRoute('/_authed/feats/$featId/edit')({
  component: EditFeatRoute
})

function EditFeatRoute() {
  const { user } = Route.useRouteContext()
  const { featId } = Route.useParams()

  return <FeatEditPage featId={featId} mode='edit' userId={user?.id ?? 'unknown-user'} />
}
