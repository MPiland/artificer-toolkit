import type { GRANT_KIND, NodeSubjectCode } from '#core'
import type { ChargeAuthored, ScalingGrant } from '#authored'

export type SenseGrantAuthored<N extends NodeSubjectCode = NodeSubjectCode> = ScalingGrant<{ senseIds: string[] }, N> & {
  grantKind: typeof GRANT_KIND.SENSE_GRANT
  charges?: ChargeAuthored
}
