import { Badge, Group, Stack, Text, Title } from '@mantine/core'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  encounterPlayerProjectionDtoSchema,
  encounterProjectionListDtoSchema,
  type EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { getCampaignEncounters } from '#app/data/encounters/queries'
import { CampaignEncounterDecision } from '../CampaignEncounterDecision'
import * as styles from '../../campaignSessions.css'

export function CampaignSessionPlayerEncounters({
  campaign,
  sessionId,
  sessionOpen
}: {
  campaign: CampaignDetailDto
  sessionId: string
  sessionOpen: boolean
}) {
  const convex = useConvex()
  const encounters = useQuery(getCampaignEncounters(campaign.id, convex))
  const pendingPrepared = useQuery({
    ...convexQuery(convexApi.encounters.projectionReads.pendingPrepared, {
      campaignId: campaign.id
    }),
    select: encounterProjectionListDtoSchema.parse
  })
  const visibleById = new Map<string, EncounterPlayerProjectionDto>()
  for (const candidate of encounters.data ?? []) {
    const parsed = encounterPlayerProjectionDtoSchema.safeParse(candidate)
    if (parsed.success && parsed.data.sessionId === sessionId)
      visibleById.set(parsed.data.id, parsed.data)
  }
  const pendingPreparedIds = new Set<string>()
  for (const candidate of pendingPrepared.data ?? []) {
    const parsed = encounterPlayerProjectionDtoSchema.safeParse(candidate)
    if (
      !parsed.success ||
      parsed.data.sessionId !== sessionId ||
      parsed.data.status !== 'PREPARED' ||
      visibleById.get(parsed.data.id)?.status === 'ACTIVE'
    )
      continue
    visibleById.set(parsed.data.id, parsed.data)
    pendingPreparedIds.add(parsed.data.id)
  }
  const visible = [...visibleById.values()]

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
            {pendingPreparedIds.has(encounter.id) ? (
              <CampaignEncounterDecision
                campaignId={campaign.id}
                connected={campaign.status === 'ACTIVE' && sessionOpen}
                encounter={encounter}
              />
            ) : null}
          </Group>
        ))}
      </Stack>
      {!encounters.isPending && !encounters.error && visible.length === 0 ? (
        <Text c='dimmed'>No visible encounters.</Text>
      ) : null}
    </section>
  )
}
