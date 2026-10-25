/** System-neutral arcs around a token's facing; a FACING definition authors which offsets each covers. */
export const FACING_ARCS = ['FRONT', 'LEFT_SIDE', 'REAR', 'RIGHT_SIDE'] as const

export type FacingArc = (typeof FACING_ARCS)[number]
