import type { RollRuleCheckDto } from '@artificer-toolkit/schema/api/rolls'

type ConcentrationTrigger = Pick<
  Extract<RollRuleCheckDto, { kind: 'CONCENTRATION' }>,
  'damage' | 'sourceLabel' | 'dc'
>

/** "took 12 fire from Fire Bolt (DC 10)": the damage behind a Concentration check and its DC. */
export function concentrationTriggerText({ damage, sourceLabel, dc }: ConcentrationTrigger) {
  const amount = damage.typeLabel
    ? `${damage.amount} ${damage.typeLabel.toLowerCase()}`
    : `${damage.amount} damage`
  return `took ${amount}${sourceLabel ? ` from ${sourceLabel}` : ''} (DC ${dc})`
}

/** The prompt line naming who rolls a Concentration check and why. */
export function concentrationPromptText(actorLabel: string, trigger: ConcentrationTrigger) {
  return `Concentration check for ${actorLabel}: ${concentrationTriggerText(trigger)}`
}
