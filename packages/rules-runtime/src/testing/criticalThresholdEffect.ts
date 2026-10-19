import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { criticalHitThresholdGrants } from '@artificer-toolkit/source-data/srd/classes/mechanics.js'
import { divineFavor } from '@artificer-toolkit/source-data/srd/spells/divine-favor.js'

/** Divine Favor's authored effect, whose grant adds a 1d4 radiant die to melee and ranged hits. */
export const DIVINE_FAVOR_EFFECT = divineFavor.effects?.[0] as EffectAuthored

/**
 * Divine Favor's effect with `threshold` also granted for melee, ranged and unarmed attacks: a
 * holder that crits on a lowered natural roll and has an added damage die to double.
 */
export function criticalThresholdEffect(threshold: number): EffectAuthored {
  const path = DIVINE_FAVOR_EFFECT.paths.find(
    (candidate): candidate is Extract<typeof candidate, { resultBlock: unknown }> =>
      'resultBlock' in candidate
  )
  const outcome = path?.resultBlock.outcomes.find(
    (candidate): candidate is Extract<typeof candidate, { effectKind: 'APPLY_GRANT' }> =>
      candidate.effectKind === 'APPLY_GRANT'
  )
  if (!path || !outcome) throw new Error('Divine Favor has no grant path.')
  return {
    ...DIVINE_FAVOR_EFFECT,
    paths: [
      {
        ...path,
        resultBlock: {
          ...path.resultBlock,
          outcomes: [
            {
              ...outcome,
              grants: {
                modifiers: [
                  ...(outcome.grants.modifiers ?? []),
                  ...criticalHitThresholdGrants(
                    (entry) => `00000000-0000-4000-8000-0000000000f${entry}`,
                    threshold
                  )
                ]
              }
            }
          ]
        }
      }
    ]
  }
}
