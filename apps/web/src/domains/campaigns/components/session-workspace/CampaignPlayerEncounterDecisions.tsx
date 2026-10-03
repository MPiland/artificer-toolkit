import { Badge, Group, Stack, Text, Title } from '@mantine/core'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  encounterPlayerProjectionDtoSchema,
  type EncounterPlayerProjectionDto,
  type EncounterSummaryDto,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/api/encounters'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { getCampaignEncounters } from '#app/data/encounters/queries'
import { encounterPreparedPendingListDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { CampaignEncounterDecision } from '../CampaignEncounterDecision'
import { useCampaignLiveSession } from '../../vtt/useCampaignLiveSession'
import * as styles from '../../campaignSessions.css'

export function CampaignPlayerEncounterDecisions({ campaign }: { campaign: CampaignDetailDto }) {
  const encounters = useQuery(getCampaignEncounters(campaign.id))
  const live = useCampaignLiveSession({
    campaignId: campaign.id,
    enabled: campaign.status === 'ACTIVE',
    encounterSession: { timeline: false }
  })
  const room = live.encounterSession
  const storedPendingPrepared = useQuery({
    ...convexQuery(
      convexApi.encounters.projectionReads.pendingPrepared,
      room ? 'skip' : { campaignId: campaign.id }
    ),
    select: encounterPreparedPendingListDtoSchema.parse
  })
  const pendingPrepared = room ? room.preparedPending : storedPendingPrepared.data
  const visibleById = new Map<
    string,
    Pick<EncounterSummaryDto, 'id' | 'name' | 'round' | 'status'>
  >((encounters.data ?? []).map((summary) => [summary.id, summary]))
  const pendingPreparedById = new Map<
    string,
    { encounter: EncounterPlayerProjectionDto; pending: PendingEncounterRuleOccurrenceSummaryDto }
  >()
  for (const candidate of pendingPrepared ?? []) {
    const parsed = encounterPlayerProjectionDtoSchema.safeParse(candidate.encounter)
    if (
      !parsed.success ||
      parsed.data.status !== 'PREPARED' ||
      visibleById.get(parsed.data.id)?.status === 'ACTIVE'
    )
      continue
    visibleById.set(parsed.data.id, parsed.data)
    pendingPreparedById.set(parsed.data.id, { encounter: parsed.data, pending: candidate.pending })
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
        {visible.map((encounter) => {
          const pendingProjection = pendingPreparedById.get(encounter.id)
          return (
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
              {pendingProjection ? (
                <CampaignEncounterDecision
                  canVoid={false}
                  connected={live.commandReady}
                  encounter={pendingProjection.encounter}
                  pending={pendingProjection.pending}
                  sendCommand={live.sendEncounterCommand}
                />
              ) : null}
            </Group>
          )
        })}
      </Stack>
      {!encounters.isPending && !encounters.error && visible.length === 0 ? (
        <Text c='dimmed'>No visible encounters.</Text>
      ) : null}
    </section>
  )
}
