import { createFileRoute } from '@tanstack/react-router'
import { FeatDetailPage } from '#domains/feats'

export const Route = createFileRoute('/_authed/feats/$featId/')({
  component: FeatViewRoute
})

function FeatViewRoute() {
  const { user } = Route.useRouteContext()
  const { featId } = Route.useParams()

  return <FeatDetailPage featId={featId} mode='view' userId={user?.id ?? 'unknown-user'} />
}
