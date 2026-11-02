import { describe, expect, it } from 'vitest'

import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { BARDIC_INSPIRATION_CHARGE_ID } from '@artificer-toolkit/source-data/srd/classes/bard.js'
import { cuttingWordsReaction } from '@artificer-toolkit/source-data/srd/classes/college-of-lore.js'
import { counterspell } from '@artificer-toolkit/source-data/srd/spells/counterspell.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'

import { CharacterRuleActionUnsupportedCompilationError } from '../characterRuleActionSystemAdapter.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { absorbElementsSpell } from '../testing/absorbElementsSpell.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

const MODIFIER_GRANT_OPERATION_KEY = 'dnd5e.modifier-grant-proposal'
const CANCEL_TRIGGERING_EVENT_OPERATION_KEY = 'dnd5e.cancel-triggering-event-proposal'
const SUBTRACT_FROM_TRIGGERING_ROLL_OPERATION_KEY = 'dnd5e.subtract-from-triggering-roll-proposal'

/** Every operation key the compiled output names, wherever it nests. */
function operationKeys(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return []
  const own =
    'operation' in value &&
    typeof value.operation === 'object' &&
    value.operation !== null &&
    'key' in value.operation &&
    typeof value.operation.key === 'string'
      ? [value.operation.key]
      : []
  return [...own, ...Object.values(value).flatMap(operationKeys)]
}

function shieldEffect(): EffectAuthored {
  const effect = shield.effects?.[0]
  if (!effect) throw new Error('Shield has no authored effect.')
  return { ...effect, id: ACTION_EFFECT_ID }
}

function compile(effect: EffectAuthored) {
  return dnd5eCharacterRuleActionSystemAdapter.compile({
    action: characterActionDescriptor(compileEffect(effect))
  })
}

describe('a reaction authored with the ATTACKED_SELF trigger compiles through the dnd5e adapter', () => {
  it('carries the real SRD Shield trigger onto its compiled invocation', () => {
    const { invocation } = compileEffect(shieldEffect())
    expect(invocation).toMatchObject({
      activation: { code: 'REACTION', amount: 1 },
      reactionTrigger: { kind: 'ATTACKED_SELF' }
    })
  })

  it('compiles the real SRD Shield, a self reaction, to the modifier grant proposal', () => {
    expect(operationKeys(compile(shieldEffect()))).toContain(MODIFIER_GRANT_OPERATION_KEY)
  })

  it('refuses a REACTION activation that names no trigger as an unsupported action shape', () => {
    const effect = shieldEffect()
    const { reactionTrigger: _trigger, ...invocation } = effect.invocation as Record<
      string,
      unknown
    >
    expect(() => compile({ ...effect, invocation } as EffectAuthored)).toThrow(
      CharacterRuleActionUnsupportedCompilationError
    )
  })
})

describe('a reaction authored with the DAMAGE_TAKEN trigger compiles through the dnd5e adapter', () => {
  function absorbElementsEffect(): EffectAuthored {
    const effect = absorbElementsSpell(['FIRE', 'COLD']).effects?.[0]
    if (!effect) throw new Error('The fixture has no authored effect.')
    return { ...effect, id: ACTION_EFFECT_ID }
  }

  it('carries the chosen damage types onto the compiled invocation', () => {
    const { invocation } = compileEffect(absorbElementsEffect())
    expect(invocation).toMatchObject({
      activation: { code: 'REACTION', amount: 1 },
      reactionTrigger: {
        kind: 'DAMAGE_TAKEN',
        damageTypeIds: [expect.any(String), expect.any(String)]
      }
    })
  })

  it('compiles a user-authored Absorb Elements, cast with a slot, to the modifier grant proposal', () => {
    const cast = characterActionDescriptor(compileEffect(absorbElementsEffect()), 2)
    expect(
      operationKeys(dnd5eCharacterRuleActionSystemAdapter.compile({ action: cast }))
    ).toContain(MODIFIER_GRANT_OPERATION_KEY)
  })

  it('refuses the slot-scaled grant until a cast level has fixed its amount', () => {
    expect(() => compile(absorbElementsEffect())).toThrow(
      CharacterRuleActionUnsupportedCompilationError
    )
  })
})

describe('a reaction authored with the ATTACK_ROLL_BY_OTHER trigger compiles through the dnd5e adapter', () => {
  function cuttingWordsEffect(): EffectAuthored {
    return { ...cuttingWordsReaction, id: ACTION_EFFECT_ID }
  }

  it('carries the authored Cutting Words trigger, charge and restrictions onto its compiled invocation', () => {
    expect(compileEffect(cuttingWordsEffect()).invocation).toMatchObject({
      activation: { code: 'REACTION', amount: 1 },
      resourceUse: { chargeId: BARDIC_INSPIRATION_CHARGE_ID, cost: 1 },
      reactionTrigger: { kind: 'ATTACK_ROLL_BY_OTHER' },
      targeting: {
        targetRequirements: [
          { kind: 'SIGHT', direction: 'ACTOR_SEES_TARGET' },
          { kind: 'LACKS_CONDITION', conditionIds: [expect.any(String)] },
          { kind: 'NOT_IMMUNE_TO_CONDITION', conditionIds: [expect.any(String)] }
        ]
      }
    })
  })

  it('compiles the authored Cutting Words to the subtract-from-triggering-roll proposal', () => {
    expect(operationKeys(compile(cuttingWordsEffect()))).toContain(
      SUBTRACT_FROM_TRIGGERING_ROLL_OPERATION_KEY
    )
  })

  it('refuses the subtract outcome on a reaction to any other trigger', () => {
    const effect = cuttingWordsEffect()
    expect(() =>
      compile({
        ...effect,
        invocation: { ...effect.invocation, reactionTrigger: { kind: 'ATTACKED_SELF' } }
      } as EffectAuthored)
    ).toThrow(CharacterRuleActionUnsupportedCompilationError)
  })

  it('compiles a homebrew variant, a larger die, a shorter reach and fewer restrictions, the same way', () => {
    const homebrew = structuredClone(cuttingWordsEffect()) as unknown as {
      invocation: { range: { amount: number }; targeting: { targetRequirements: unknown[] } }
      paths: { resultBlock: { outcomes: { die: Record<string, unknown> }[] } }[]
    }
    homebrew.invocation.range.amount = 30
    homebrew.invocation.targeting.targetRequirements.splice(1)
    const outcome = homebrew.paths[0]!.resultBlock.outcomes[0]!
    outcome.die = { ...outcome.die, faces: 8, facesScaling: undefined }
    expect(operationKeys(compile(homebrew as unknown as EffectAuthored))).toContain(
      SUBTRACT_FROM_TRIGGERING_ROLL_OPERATION_KEY
    )
  })
})

describe('a reaction authored with the SPELL_CAST trigger compiles through the dnd5e adapter', () => {
  function counterspellEffect(): EffectAuthored {
    const effect = counterspell.effects?.[0]
    if (!effect) throw new Error('Counterspell has no authored effect.')
    return { ...effect, id: ACTION_EFFECT_ID }
  }

  it('carries the real SRD Counterspell trigger onto its compiled invocation', () => {
    expect(compileEffect(counterspellEffect()).invocation).toMatchObject({
      activation: { code: 'REACTION', amount: 1 },
      reactionTrigger: {
        kind: 'SPELL_CAST',
        higherLevelCheck: { ability: 'SPELLCASTING', baseDc: 10 }
      }
    })
  })

  it('compiles the real SRD Counterspell to the cancel-triggering-event proposal', () => {
    expect(operationKeys(compile(counterspellEffect()))).toContain(
      CANCEL_TRIGGERING_EVENT_OPERATION_KEY
    )
  })

  it('refuses the cancel outcome on a reaction to any other trigger', () => {
    const effect = counterspellEffect()
    expect(() =>
      compile({
        ...effect,
        invocation: { ...effect.invocation, reactionTrigger: { kind: 'ATTACKED_SELF' } }
      } as EffectAuthored)
    ).toThrow(CharacterRuleActionUnsupportedCompilationError)
  })
})
