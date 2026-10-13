import type { LengthUnitCode } from '#core'
import { EFFECT_KIND } from '#core'

export type MoveManifestAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.MOVE_MANIFEST
  manifestId: string
  amount: number
  unit: LengthUnitCode
  upTo?: boolean
}
