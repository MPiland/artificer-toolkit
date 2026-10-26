import { createFileRoute } from '@tanstack/react-router'
import { loadAuthoredCreateRouteData } from '#app/routes/-authoredCreateRouteLoader'
import { AuthoringLayout } from '#forms'
import { createAuthoredFormRouteContext } from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/equipment/new')({
  context: () => createAuthoredFormRouteContext('equipment', 'create'),
  loaderDeps: ({ search }) => ({ systemId: search.system }),
  loader: ({ context, deps }) => loadAuthoredCreateRouteData(context.queryClient, deps.systemId),
  component: AuthoringLayout
})
