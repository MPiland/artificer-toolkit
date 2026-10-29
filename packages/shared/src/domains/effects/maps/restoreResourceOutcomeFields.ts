import { EFFECT_KIND } from '#core'
import type { OutcomeNodeMapApi } from './path.js'

/** The fields only a RESTORE_RESOURCE outcome has; its `chargeId` is a common outcome field. */
export function registerRestoreResourceOutcomeFields(
  map: OutcomeNodeMapApi['map'],
  nodes: OutcomeNodeMapApi['nodes'],
  cond: OutcomeNodeMapApi['cond']
) {
  const isRestore = cond.local().field(['effectKind']).eq(EFFECT_KIND.RESTORE_RESOURCE)
  map
    .set(
      'restoreFloor',
      nodes.number(['floor'], 'Restore To At Least', {
        constraints: { minimum: 1 },
        requiredIf: true,
        showIf: isRestore
      })
    )
    .set(
      'restoreWhenAtOrBelow',
      nodes.number(['whenAtOrBelow'], 'When Remaining Is At Most', {
        constraints: { minimum: 0 },
        requiredIf: true,
        showIf: isRestore
      })
    )
}
