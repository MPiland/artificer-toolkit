import { Alert } from '@mantine/core'

/** Tells the owner's player a summon of theirs has the turn, so its turn is not forgotten (SPELLS-35.5). */
export function CampaignTabletopSummonTurnPrompt({
  ownerLabel,
  summonLabel
}: {
  ownerLabel: string
  summonLabel: string
}) {
  return (
    <Alert color='orange' role='status' title={`${summonLabel}'s turn`} variant='light'>
      {summonLabel} acts now, commanded by {ownerLabel}. Open actions to use it, or end its turn.
    </Alert>
  )
}
