import type { EncounterEffectOfferChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'

/** The offers this surface lists: picking a new holder. A repeat offer is taken as an action (D166). */
export type MoveEffectOfferChoice = Extract<
  EncounterEffectOfferChoiceDto,
  { kind: 'MOVE_HELD_EFFECT' }
>

export const isMoveEffectOffer = (
  offer: EncounterEffectOfferChoiceDto
): offer is MoveEffectOfferChoice => offer.kind === 'MOVE_HELD_EFFECT'

export const EFFECT_OFFER_KIND_LABELS = {
  MOVE_HELD_EFFECT: 'Move effect'
} as const satisfies Record<MoveEffectOfferChoice['kind'], string>

/** Identifies one offer among the actor's choices: an effect can carry several. */
export function effectOfferKey({
  effectId,
  offerIndex
}: Pick<EncounterEffectOfferChoiceDto, 'effectId' | 'offerIndex'>): string {
  return `${effectId}:${offerIndex}`
}
