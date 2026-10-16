import { describe, expect, it } from 'vitest'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { counterspell } from '@artificer-toolkit/source-data/srd/spells/counterspell.js'

import { castReactionCheckRequirement } from '../encounterCastReactionCheck.js'

const effect = counterspell.effects?.[0]
if (!effect) throw new Error('Counterspell has no authored effect.')
const { invocation } = compileEffect(effect)
const reactionTrigger = 'reactionTrigger' in invocation ? invocation.reactionTrigger : undefined
const higherLevelCheck =
  reactionTrigger?.kind === 'SPELL_CAST' ? reactionTrigger.higherLevelCheck : null

describe('the check a counter owes for a higher-level cast', () => {
  it('reads the real SRD Counterspell as a spellcasting check against 10 plus the cast level', () => {
    expect(higherLevelCheck).toEqual({ ability: 'SPELLCASTING', baseDc: 10 })
    expect(
      castReactionCheckRequirement({
        higherLevelCheck: higherLevelCheck ?? undefined,
        counterLevel: 3,
        triggerLevel: 5
      })
    ).toEqual({ ability: 'SPELLCASTING', dc: 15 })
  })

  it('owes no check to a cast at or below the level the counter is cast at', () => {
    for (const [counterLevel, triggerLevel] of [
      [3, 3],
      [3, 1],
      [5, 5],
      [9, 4]
    ] as const)
      expect(
        castReactionCheckRequirement({
          higherLevelCheck: higherLevelCheck ?? undefined,
          counterLevel,
          triggerLevel
        })
      ).toBeNull()
  })

  it('owes no check when the reaction authors none, whatever the cast level', () => {
    expect(
      castReactionCheckRequirement({
        higherLevelCheck: undefined,
        counterLevel: 3,
        triggerLevel: 9
      })
    ).toBeNull()
  })

  it('takes the authored ability and base DC, not a fixed one', () => {
    expect(
      castReactionCheckRequirement({
        higherLevelCheck: { ability: 'WISDOM', baseDc: 8 },
        counterLevel: 1,
        triggerLevel: 4
      })
    ).toEqual({ ability: 'WISDOM', dc: 12 })
  })
})
