import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { BackgroundDetailPage } from '#domains/backgrounds/pages/BackgroundDetailPage'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundId/')({
  component: BackgroundDetailRoute
})

function BackgroundDetailRoute() {
  const parentRoute = getRouteApi('/_authed/backgrounds/$backgroundId')
  const { draft, response } = parentRoute.useLoaderData()
  const { backgroundId } = parentRoute.useParams()

  return <BackgroundDetailPage backgroundId={backgroundId} draft={draft} response={response} />
}
