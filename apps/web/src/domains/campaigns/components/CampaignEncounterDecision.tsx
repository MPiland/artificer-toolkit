import { convexQuery } from '@convex-dev/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  pendingEncounterRuleOccurrenceSummaryDtoSchema,
  type EncounterCommandInputDto,
  type EncounterGmProjectionDto,
  type EncounterPlayerProjectionDto,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import { CampaignTabletopDecisionDrawer } from '../vtt/CampaignTabletopDecisionDrawer'
import { getEncounterLatestEvidenceRoll } from '#app/data/campaigns/encounterActions'
import { queryKeys } from '#app/lib/queryKeys'

export function CampaignEncounterDecision({
  campaignId,
  canVoid,
  connected,
  encounter,
  onResolved,
  sendCommand
}: {
  campaignId: string
  canVoid: boolean
  connected: boolean
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto
  onResolved?: (result: EncounterCommandResultDto) => void
  sendCommand: (command: EncounterCommandInputDto) => Promise<EncounterCommandResultDto>
}) {
  const queryClient = useQueryClient()
  const pending = useQuery({
    ...convexQuery(convexApi.encounters.pendingReads.pendingRuleOccurrence, {
      encounterId: encounter.id
    }),
    select: (occurrence) =>
      occurrence === null ? null : pendingEncounterRuleOccurrenceSummaryDtoSchema.parse(occurrence)
  })
  const latestRoll = useQuery(getEncounterLatestEvidenceRoll(pending.data ? encounter.id : null))
  const resolve = useMutation({
    mutationFn: sendCommand,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.encounters.list(campaignId) })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.encounters.detail(encounter.id),
        exact: true
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.encounters.timeline(encounter.id) })
      onResolved?.(result)
    }
  })

  if (!pending.data) return null

  return (
    <CampaignTabletopDecisionDrawer
      canVoid={canVoid}
      connected={connected}
      encounter={encounter}
      latestRoll={latestRoll.data ?? null}
      pending={pending.data}
      skipped={null}
      submitting={resolve.isPending}
      onResolve={resolve.mutateAsync}
    />
  )
}
