import type { GRANT_KIND, NodeSubjectCode, SenseRangeKind } from '#core'
import type { ChargeAuthored, RangeAuthored, ScalingGrant } from '#authored'

/** A sense reaches a set distance or is unlimited; it has no long range and does not scale. */
export type SenseRangeAuthored =
  | Pick<Extract<RangeAuthored, { rangeKind: 'DISTANCE' }>, 'id' | 'rangeKind' | 'amount' | 'unit'>
  | { id: string; rangeKind: Exclude<SenseRangeKind, 'DISTANCE'> }

export type SenseGrantAuthored<N extends NodeSubjectCode = NodeSubjectCode> = ScalingGrant<
  { senseIds: string[] },
  N
> & {
  grantKind: typeof GRANT_KIND.SENSE_GRANT
  charges?: ChargeAuthored<true>
  range: SenseRangeAuthored
}
