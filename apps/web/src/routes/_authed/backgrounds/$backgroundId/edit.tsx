import { createFileRoute } from '@tanstack/react-router'
import { BackgroundEditPage } from '#domains/backgrounds'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundId/edit')({
  component: EditBackgroundRoute
})

function EditBackgroundRoute() {
  const { user } = Route.useRouteContext()
  const { backgroundId } = Route.useParams()

  return <BackgroundEditPage backgroundId={backgroundId} mode='edit' userId={user?.id ?? 'unknown-user'} />
}
