import type { EncounterEffectOfferChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'

export const EFFECT_OFFER_KIND_LABELS = {
  MOVE_HELD_EFFECT: 'Move effect'
} as const satisfies Record<EncounterEffectOfferChoiceDto['kind'], string>

/** Identifies one offer among the actor's choices: an effect can carry several. */
export function effectOfferKey({
  effectId,
  offerIndex
}: Pick<EncounterEffectOfferChoiceDto, 'effectId' | 'offerIndex'>): string {
  return `${effectId}:${offerIndex}`
}
