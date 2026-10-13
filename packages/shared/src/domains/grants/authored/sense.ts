import type { GRANT_KIND, NodeSubjectCode, RangeKind } from '#core'
import type { ChargeAuthored, RangeAuthored, ScalingGrant } from '#authored'

/** A sense reaches a set distance or is unlimited; no other range kind has a meaning for a sense. */
export type SenseRangeAuthored =
  | Extract<RangeAuthored, { rangeKind: 'DISTANCE' }>
  | { id: string; rangeKind: Extract<RangeKind, 'UNLIMITED'> }

export type SenseGrantAuthored<N extends NodeSubjectCode = NodeSubjectCode> = ScalingGrant<
  { senseIds: string[] },
  N
> & {
  grantKind: typeof GRANT_KIND.SENSE_GRANT
  charges?: ChargeAuthored<true>
  range: SenseRangeAuthored
}
