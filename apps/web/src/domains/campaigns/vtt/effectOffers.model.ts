import type { EncounterEffectOfferChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'

export type MoveEffectOfferChoice = Extract<
  EncounterEffectOfferChoiceDto,
  { kind: 'MOVE_HELD_EFFECT' }
>

/** A repeat offer is taken as an ordinary action against the holder (D166). */
export type RepeatEffectOfferChoice = Extract<
  EncounterEffectOfferChoiceDto,
  { kind: 'REPEAT_SOURCE_PATH' }
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
