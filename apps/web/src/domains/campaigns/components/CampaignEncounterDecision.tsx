import { convexQuery } from '@convex-dev/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  encounterCommandInputDtoSchema,
  encounterCommandResultDtoSchema,
  pendingEncounterRuleOccurrenceSummaryDtoSchema,
  type EncounterGmProjectionDto,
  type EncounterPlayerProjectionDto,
  type EncounterCommandResultDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { CampaignTabletopDecisionDrawer } from '../vtt/CampaignTabletopDecisionDrawer'
import { queryKeys } from '#app/lib/queryKeys'

export function CampaignEncounterDecision({
  campaignId,
  connected,
  encounter,
  onResolved
}: {
  campaignId: string
  connected: boolean
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto
  onResolved?: (result: EncounterCommandResultDto) => void
}) {
  const convex = useConvex()
  const queryClient = useQueryClient()
  const pending = useQuery({
    ...convexQuery(convexApi.encounters.pendingReads.pendingRuleOccurrence, {
      encounterId: encounter.id
    }),
    select: (occurrence) =>
      occurrence === null ? null : pendingEncounterRuleOccurrenceSummaryDtoSchema.parse(occurrence)
  })
  const resolve = useMutation({
    mutationFn: async (command: ResolveRuleOccurrenceInputDto) =>
      encounterCommandResultDtoSchema.parse(
        await convex.action(convexApi.encounters.commandActions.execute, {
          command: encounterCommandInputDtoSchema.parse(command)
        })
      ),
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
