/** System-neutral arcs around a token's facing; a FACING definition authors which offsets each covers. */
export const FACING_ARCS = ['FRONT', 'LEFT_SIDE', 'REAR', 'RIGHT_SIDE'] as const

export type FacingArc = (typeof FACING_ARCS)[number]

/** Clockwise offsets from a token's facing that one arc covers, as a FACING definition authors them. */
export interface FacingArcRange {
  readonly arc: FacingArc
  readonly fromDegrees: number
  readonly toDegrees: number
}

/** An arc as the table names it: "rear", "left side". */
export function facingArcLabel(arc: FacingArc): string {
  return arc.toLowerCase().replace('_', ' ')
}
