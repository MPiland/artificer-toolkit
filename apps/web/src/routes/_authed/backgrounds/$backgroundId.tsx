import { Outlet, createFileRoute } from '@tanstack/react-router'
import { getBackground, getBackgroundDraft } from '#app/data/backgrounds/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundId')({
  loader: async ({ context, params }) => {
    const client = createServerApi()
    const activeBackgroundQuery = getBackground(params.backgroundId, client)
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, activeBackgroundQuery),
      context.queryClient.ensureQueryData(getBackgroundDraft(params.backgroundId, client))
    ])

    return { draft, response }
  },
  component: BackgroundRoute
})

function BackgroundRoute() {
  return <Outlet />
}
