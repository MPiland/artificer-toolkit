import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import { gmRulingEffect } from '@artificer-toolkit/source-data/srd/classes/mechanics.js'

export const castModifierLabel = 'Fixture Heightened'

/** A Class Feature with one charge whose spend, on a cast, gives one named target disadvantage on its first save. */
export function createCastModifierFeatures() {
  const chargeId = crypto.randomUUID()
  return [
    {
      id: crypto.randomUUID(),
      label: castModifierLabel,
      description: 'Spend the charge to give one target disadvantage on its first save.',
      availableAtLevel: 1,
      order: 90,
      charges: {
        id: chargeId,
        limitKind: 'FIXED_AMOUNT' as const,
        scalingKind: 'NONE' as const,
        resetKind: 'MANUAL' as const,
        amount: 1
      },
      effects: [
        gmRulingEffect({
          ids: {
            effect: crypto.randomUUID(),
            range: crypto.randomUUID(),
            path: crypto.randomUUID(),
            result: crypto.randomUUID(),
            outcome: crypto.randomUUID()
          },
          label: castModifierLabel,
          instructions: 'The chosen target has disadvantage on its first save against the spell.',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          castModifier: {
            chargeId,
            cost: 1,
            targets: { outcome: 'SAVE_DISADVANTAGE', base: 1, minimum: 1 }
          }
        })
      ]
    }
  ]
}
