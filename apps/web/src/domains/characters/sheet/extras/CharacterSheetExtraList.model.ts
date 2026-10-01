import type { CharacterSheetExtrasSliceDto } from '@artificer-toolkit/schema/api/characterSheetSlices'

type Extra = CharacterSheetExtrasSliceDto['extras']['items'][number]

export function getExtraTarget(extra: Extra) {
  return extra.kind === 'VEHICLE'
    ? { kind: 'VEHICLE' as const, vehicleInstanceId: extra.id }
    : { kind: 'COMPANION' as const, companionInstanceId: extra.id }
}
