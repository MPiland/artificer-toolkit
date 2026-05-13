import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { BackgroundDetailPage } from '#domains/backgrounds/pages/BackgroundDetailPage'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/')({
  component: BackgroundDetailRoute
})

function BackgroundDetailRoute() {
  const parentRoute = getRouteApi('/_authed/backgrounds/$backgroundPublicId/$backgroundSlug')
  const {
    backgroundId, draft, references, response, view
  } = parentRoute.useLoaderData()

  return <BackgroundDetailPage backgroundId={backgroundId} draft={draft} references={references} response={response} view={view} />
}
