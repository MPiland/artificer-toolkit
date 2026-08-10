import type { CharacterSheet } from '../core/CharacterSheet.types'

type Extra = CharacterSheet['extras']['items'][number]

export function getExtraTarget(extra: Extra) {
  return extra.kind === 'VEHICLE'
    ? { kind: 'VEHICLE' as const, vehicleInstanceId: extra.id }
    : { kind: 'COMPANION' as const, companionInstanceId: extra.id }
}
