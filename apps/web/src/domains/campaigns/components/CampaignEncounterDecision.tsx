import { useMutation } from '@tanstack/react-query'
import type { EncounterReadDto } from '@artificer-toolkit/schema/api/encounterRead'
import type {
  EncounterCommandInputDto,
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto,
  EncounterCommandResultDto,
  PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/api/encounters'
import { CampaignTabletopDecisionDrawer } from '../vtt/CampaignTabletopDecisionDrawer'
import type { LiveSessionEncounterReadReply } from '../vtt/liveSessionClient'
import type { HeldEncounterSession } from '../vtt/useCampaignLiveSession'
import { useLatestEvidenceRoll } from '../vtt/useLatestEvidenceRoll'

export function CampaignEncounterDecision({
  canVoid,
  connected,
  encounter,
  onResolved,
  pending,
  readEncounter,
  room,
  sendCommand
}: {
  canVoid: boolean
  connected: boolean
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto
  onResolved?: (result: EncounterCommandResultDto) => void
  /** The decision pending on `encounter`, read by the caller from the room or Convex. */
  pending: PendingEncounterRuleOccurrenceSummaryDto | null
  readEncounter: (read: EncounterReadDto) => Promise<LiveSessionEncounterReadReply>
  /** The room's Encounter session while it holds the Run; the evidence roll is read from it then. */
  room: HeldEncounterSession | null
  sendCommand: (command: EncounterCommandInputDto) => Promise<EncounterCommandResultDto>
}) {
  const latestRoll = useLatestEvidenceRoll({
    encounterId: pending ? encounter.id : null,
    readEncounter,
    room
  })
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
      latestRoll={latestRoll}
      pending={pending}
      skipped={null}
      submitting={resolve.isPending}
      onResolve={resolve.mutateAsync}
    />
  )
}
