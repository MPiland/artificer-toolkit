import { createFileRoute } from '@tanstack/react-router'
import { BackgroundDetailPage } from '#domains/backgrounds'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundId/')({
  component: BackgroundViewRoute
})

function BackgroundViewRoute() {
  const { user } = Route.useRouteContext()
  const { backgroundId } = Route.useParams()

  return <BackgroundDetailPage backgroundId={backgroundId} mode='view' userId={user?.id ?? 'unknown-user'} />
}
