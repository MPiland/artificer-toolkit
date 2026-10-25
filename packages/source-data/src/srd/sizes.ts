/** The SRD's size codes. The D&D 5e System's size list in rules-runtime owns their order and spaces. */
export const SIZE_CODE = {
  TINY: 'TINY',
  SMALL: 'SMALL',
  MEDIUM: 'MEDIUM',
  LARGE: 'LARGE',
  HUGE: 'HUGE',
  GARGANTUAN: 'GARGANTUAN'
} as const

export type SizeCode = (typeof SIZE_CODE)[keyof typeof SIZE_CODE]
