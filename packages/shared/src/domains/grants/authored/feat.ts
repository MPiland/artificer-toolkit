import type { GRANT_KIND, NodeSubjectCode } from '#core'
import type { ChargeAuthored, ScalingGrant } from '#authored'

export type FeatGrantAuthored<N extends NodeSubjectCode = NodeSubjectCode>
  = ScalingGrant<{ featIds: string[] }, N> & {
    grantKind: typeof GRANT_KIND.FEAT_GRANT
    charges?: ChargeAuthored
  }
