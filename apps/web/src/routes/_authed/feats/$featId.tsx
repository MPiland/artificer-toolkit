import { Outlet, createFileRoute } from '@tanstack/react-router'
import { getFeat, getFeatDraft } from '#app/data/feats/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/feats/$featId')({
  loader: async ({ context, params }) => {
    const client = createServerApi()
    const activeFeatQuery = getFeat(params.featId, client)
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, activeFeatQuery),
      context.queryClient.ensureQueryData(getFeatDraft(params.featId, client))
    ])

    return { draft, response }
  },
  component: FeatRoute
})

function FeatRoute() {
  return <Outlet />
}
