import type { OfferedRollModeDto } from '@artificer-toolkit/schema/shared/systemCoreCode'

/** The roll modes a pending d20 request offers, as the server projects them from its System. */
export const offeredRollModes: OfferedRollModeDto[] = [
  { code: 'NORMAL', label: 'Normal', keep: 'FIRST' },
  { code: 'ADVANTAGE', label: 'Advantage', keep: 'HIGHER' },
  { code: 'DISADVANTAGE', label: 'Disadvantage', keep: 'LOWER' }
]
