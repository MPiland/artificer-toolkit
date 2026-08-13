import { Badge, Group, Stack, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { encounterPlayerProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import type { CampaignDetailDto } from '#app/lib/api'
import { getCampaignEncounters } from '#app/data/encounters/queries'
import * as styles from '../../campaignSessions.css'

export function CampaignSessionPlayerEncounters({
  campaign,
  sessionId
}: {
  campaign: CampaignDetailDto
  sessionId: string
}) {
  const encounters = useQuery(getCampaignEncounters(campaign.id))
  const visible = (encounters.data ?? []).flatMap((candidate) => {
    const parsed = encounterPlayerProjectionDtoSchema.safeParse(candidate)
    return parsed.success && parsed.data.sessionId === sessionId ? [parsed.data] : []
  })

  return (
    <section className={styles.sessionEncounterPanel} aria-labelledby='session-player-encounters'>
      <Title id='session-player-encounters' order={2}>
        Encounters
      </Title>
      {encounters.isPending ? <Text c='dimmed'>Loading encounters…</Text> : null}
      {encounters.error ? <Text c='red'>Encounters couldn’t be loaded.</Text> : null}
      <Stack gap='xs'>
        {visible.map((encounter) => (
          <Group justify='space-between' key={encounter.id}>
            <div>
              <Text fw={700}>{encounter.name}</Text>
              <Text c='dimmed' size='sm'>
                Round {Math.max(1, encounter.round)}
              </Text>
            </div>
            <Badge variant='light'>
              {encounter.status === 'ACTIVE' ? 'In progress' : encounter.status.toLowerCase()}
            </Badge>
          </Group>
        ))}
      </Stack>
      {!encounters.isPending && !encounters.error && visible.length === 0 ? (
        <Text c='dimmed'>No visible encounters.</Text>
      ) : null}
    </section>
  )
}
