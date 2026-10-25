import { createFileRoute } from '@tanstack/react-router'
import { loadAuthoredCreateRouteData } from '#app/routes/-authoredCreateRouteLoader'
import { AuthoringLayout } from '#forms'
import { createAuthoredFormRouteContext } from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/feats/new')({
  context: () => createAuthoredFormRouteContext('feat', 'create'),
  loaderDeps: ({ search }) => ({ systemId: search.system }),
  loader: ({ context, deps }) => loadAuthoredCreateRouteData(context.queryClient, deps.systemId),
  component: AuthoringLayout
})
