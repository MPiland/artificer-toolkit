import { createFileRoute } from '@tanstack/react-router'
import { loadAuthoredCreateRouteData } from '#app/routes/-authoredCreateRouteLoader'
import { AuthoringLayout } from '#forms'
import { createAuthoredFormRouteContext } from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/vehicles/new')({
  context: () => createAuthoredFormRouteContext('vehicle', 'create'),
  loader: ({ context }) => loadAuthoredCreateRouteData(context.queryClient),
  component: AuthoringLayout
})
