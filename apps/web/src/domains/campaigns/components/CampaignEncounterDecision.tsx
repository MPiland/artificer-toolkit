import { useMutation, useQuery } from '@tanstack/react-query'
import type {
  EncounterCommandInputDto,
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto,
  EncounterCommandResultDto,
  PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/api/encounters'
import { CampaignTabletopDecisionDrawer } from '../vtt/CampaignTabletopDecisionDrawer'
import { getEncounterLatestEvidenceRoll } from '#app/data/campaigns/encounterActions'

export function CampaignEncounterDecision({
  canVoid,
  connected,
  encounter,
  onResolved,
  pending,
  sendCommand
}: {
  canVoid: boolean
  connected: boolean
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto
  onResolved?: (result: EncounterCommandResultDto) => void
  /** The decision pending on `encounter`, read by the caller from the room or Convex. */
  pending: PendingEncounterRuleOccurrenceSummaryDto | null
  sendCommand: (command: EncounterCommandInputDto) => Promise<EncounterCommandResultDto>
}) {
  const latestRoll = useQuery(getEncounterLatestEvidenceRoll(pending ? encounter.id : null))
  const resolve = useMutation({
    mutationFn: sendCommand,
    onSuccess: (result) => onResolved?.(result)
  })

  if (!pending) return null

  return (
    <CampaignTabletopDecisionDrawer
      canVoid={canVoid}
      connected={connected}
      encounter={encounter}
      latestRoll={latestRoll.data ?? null}
      pending={pending}
      skipped={null}
      submitting={resolve.isPending}
      onResolve={resolve.mutateAsync}
    />
  )
}
