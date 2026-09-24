import { createFileRoute } from '@tanstack/react-router'
import { getSystem, getSystemRuleCapability, getSystemSummary } from '#app/data/systems/queries'
import { SystemDetailPage } from '#domains/systems'

export const Route = createFileRoute('/_authed/systems/$systemId')({
  loader: async ({ context, params }): Promise<void> => {
    await Promise.all([
      context.queryClient.ensureQueryData(getSystem(params.systemId)),
      context.queryClient.ensureQueryData(getSystemSummary(params.systemId)),
      context.queryClient.ensureQueryData(getSystemRuleCapability(params.systemId))
    ])
  },
  component: SystemRoute
})

function SystemRoute() {
  const { systemId } = Route.useParams()
  return <SystemDetailPage systemId={systemId} />
}
