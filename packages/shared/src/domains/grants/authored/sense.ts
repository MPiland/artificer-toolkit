import type { GRANT_KIND } from '#core'
import type { ChargeAuthored, ScalingGrant } from '#authored'

export type SenseGrantAuthored = ScalingGrant<{ senseIds: string[] }> & {
  grantKind: typeof GRANT_KIND.SENSE_GRANT
  charges?: ChargeAuthored
}
