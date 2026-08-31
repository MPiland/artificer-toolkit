import { createFileRoute } from '@tanstack/react-router'
import { getSystem, getSystemList, getSystemRuleCapability } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import { SystemDetailPage } from '#domains/systems'

export const Route = createFileRoute('/_authed/systems/$systemId')({
  loader: async ({ context, params }): Promise<void> => {
    const client = createServerApi()
    await Promise.all([
      context.queryClient.ensureQueryData(getSystem(params.systemId, client)),
      context.queryClient.ensureQueryData(getSystemList(client)),
      context.queryClient.ensureQueryData(getSystemRuleCapability(params.systemId, client))
    ])
  },
  component: SystemRoute
})

function SystemRoute() {
  const { systemId } = Route.useParams()
  return <SystemDetailPage systemId={systemId} />
}
