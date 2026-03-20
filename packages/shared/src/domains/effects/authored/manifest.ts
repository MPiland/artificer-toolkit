import type { CapabilityAuthored, ShapeAuthored } from '#authored'
import { EFFECT_KIND, MANIFEST_KIND } from '#core'

export type ManifestAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.MANIFEST
  manifestKind: keyof typeof MANIFEST_KIND
  label: string
  detail?: string
  shape?: ShapeAuthored
  creatureId?: string
  capabilities?: CapabilityAuthored[]
}
