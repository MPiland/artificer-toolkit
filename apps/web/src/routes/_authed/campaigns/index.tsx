import { createFileRoute } from '@tanstack/react-router'
import { getCampaignList } from '#app/data/campaigns/queries'
import { createServerApi } from '#app/lib/api'
import { CampaignListPage } from '#domains/campaigns'

export const Route = createFileRoute('/_authed/campaigns/')({
  loader: async ({ context }): Promise<void> => {
    await context.queryClient.ensureQueryData(getCampaignList(createServerApi()))
  },
  component: CampaignListPage
})
