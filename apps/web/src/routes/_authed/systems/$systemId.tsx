import { createFileRoute } from '@tanstack/react-router'
import { getSystem } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import { SystemDetailPage } from '#domains/systems'

export const Route = createFileRoute('/_authed/systems/$systemId')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(
    getSystem(params.systemId, createServerApi())
  ),
  component: SystemDetailPage
})
