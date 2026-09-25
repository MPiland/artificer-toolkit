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
import { queryKeys } from '#app/lib/queryKeys'

export function CampaignEncounterDecision({
  campaignId,
  connected,
  encounter,
  onResolved,
  sendCommand
}: {
  campaignId: string
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
  const resolve = useMutation({
    mutationFn: sendCommand,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.encounters.list(campaignId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.encounters.timeline(encounter.id) })
      onResolved?.(result)
    }
  })

  if (!pending.data) return null

  return (
    <CampaignTabletopDecisionDrawer
      connected={connected}
      encounter={encounter}
      pending={pending.data}
      submitting={resolve.isPending}
      onResolve={resolve.mutateAsync}
    />
  )
}
