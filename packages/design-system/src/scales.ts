/** Unit-agnostic spacing scale in rem units. */
export const spacingScale = {
  1: 0.25,
  2: 0.5,
  3: 0.75,
  4: 1,
  5: 1.25,
  6: 1.5,
  7: 1.75,
  8: 2,
  9: 2.25,
  10: 2.5,
  12: 3,
  13: 4,
  14: 6
} as const

/** Unit-agnostic radii scale in px-equivalent numeric values. */
export const radiusScale = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  pill: 9999
} as const

/** Font sizes use rem units; line heights are unitless. */
export const typographyScale = {
  display: { fontSize: 4, lineHeight: 1.12, fontWeight: 800, letterSpacing: 0 },
  title: { fontSize: 2, lineHeight: 1.2, fontWeight: 750, letterSpacing: 0 },
  heading: { fontSize: 1.5, lineHeight: 1.2, fontWeight: 750, letterSpacing: 0 },
  body: { fontSize: 1, lineHeight: 1.5, fontWeight: 400, letterSpacing: 0 },
  bodySm: { fontSize: 0.875, lineHeight: 1.45, fontWeight: 400, letterSpacing: 0 },
  label: { fontSize: 0.75, lineHeight: 1.45, fontWeight: 700, letterSpacing: 0 },
  caption: { fontSize: 0.8125, lineHeight: 1.4, fontWeight: 400, letterSpacing: 0 }
} as const

/** Unit-agnostic font-weight scale. */
export const fontWeightScale = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  heavy: 800
} as const

/** Breakpoints as unitless pixel widths. */
export const breakpoints = {
  tablet: 992,
  tabletPortrait: 900,
  mobile: 760
} as const

/** Unit-agnostic duration scale in milliseconds. */
export const motionScale = {
  fast: 120,
  base: 180,
  slow: 320
} as const

export type SpacingKeys = keyof typeof spacingScale
export type RadiusKeys = keyof typeof radiusScale
export type BreakpointKeys = keyof typeof breakpoints
export type MotionKeys = keyof typeof motionScale
export type FontWeightKeys = keyof typeof fontWeightScale
