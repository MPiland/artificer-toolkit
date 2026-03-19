import type { RangeAuthored } from '#authored'
import { EFFECT_KIND } from '#core'

export type TeleportTargetKind = 'SELF' | 'TARGET' | 'CHOSEN_CREATURES'
export type TeleportDestinationKind = 'SELF' | 'VISIBLE' | 'SPECIFIED_POINT' | 'LINKED_LOCATION' | 'SPECIAL'

export type TeleportAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.TELEPORT
  targetKind: TeleportTargetKind
  destinationKind: TeleportDestinationKind
  distance?: RangeAuthored
  detail?: string
}
