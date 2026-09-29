import { Group, Text, Title } from '@mantine/core'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import * as sharedStyles from '../campaigns.css'

/** Shows nothing while loading or when the host's plan is unlimited. */
export function CampaignContentUsage({ campaignId }: { campaignId: string }) {
  const usage = useQuery(convexQuery(convexApi.campaigns.queries.contentUsage, { id: campaignId }))
  if (usage.isError) return <Text c='red'>Campaign usage is unavailable.</Text>
  if (!usage.data) return null
  const { entries, scenes } = usage.data
  return (
    <section className={sharedStyles.panel} aria-labelledby='campaign-usage-title'>
      <Title order={2} id='campaign-usage-title'>
        Campaign usage
      </Title>
      <Group gap='xl'>
        <Text>{`Entries ${entries.used} / ${entries.limit}`}</Text>
        <Text>{`Scenes ${scenes.used} / ${scenes.limit}`}</Text>
      </Group>
    </section>
  )
}
