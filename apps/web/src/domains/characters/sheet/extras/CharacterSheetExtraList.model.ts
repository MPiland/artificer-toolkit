import type { CharacterSheetExtrasSliceDto } from '@artificer-toolkit/schema/api/characterSheetSlices'

/** An extra the Sheet inspects in a panel; spell summons are tracked inline. */
export type PanelExtra = Exclude<
  CharacterSheetExtrasSliceDto['extras']['items'][number],
  { kind: 'SPELL_SUMMON' }
>

export function getExtraTarget(extra: PanelExtra) {
  return extra.kind === 'VEHICLE'
    ? { kind: 'VEHICLE' as const, vehicleInstanceId: extra.id }
    : { kind: 'COMPANION' as const, companionInstanceId: extra.id }
}
