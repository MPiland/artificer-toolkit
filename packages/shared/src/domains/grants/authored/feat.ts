import type { GRANT_KIND } from '#core'
import type { ChargeAuthored, ScalingGrant } from '#authored'

export type FeatGrantAuthored
  = ScalingGrant<{ featIds: string[] }> & {
    grantKind: typeof GRANT_KIND.FEAT_GRANT
    charges?: ChargeAuthored
  }
