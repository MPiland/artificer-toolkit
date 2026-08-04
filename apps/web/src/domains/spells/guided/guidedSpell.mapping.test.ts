import { describe, expect, it } from 'vitest'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { createDefaultEffect } from '#app/forms/rendering/authoringNodeDefaults'
import { mapGuidedSpellEffect } from '#forms/guided/guidedSimpleEffect.mapping'
import {
  createGuidedSpellDraft,
  type GuidedEffectIds
} from '#forms/guided/guidedSimpleEffect.types'
import { canUseGuidedSpellAuthoring } from '#forms/guided/guidedSimpleEffect.rehydrate'

const ids: GuidedEffectIds = {
  outcomeId: 'outcome-1',
  savingThrowId: 'save-1',
  durationId: 'duration-1'
}

describe('guided spell effect mapping', () => {
  it('creates one fixed-path outcome for each guided intent', () => {
    const base = createDefaultEffect(1) as EffectAuthored

    for (const intent of ['DAMAGE', 'CONDITION', 'HEALING', 'MOVEMENT'] as const) {
      const effect = mapGuidedSpellEffect(
        createGuidedSpellDraft(intent, {
          damageTypeId: 'fire',
          conditionTypeId: 'blinded'
        }),
        base,
        ids
      )

      expect(effect.paths).toHaveLength(1)
      const path = effect.paths[0]
      expect(path?.selectionKind).toBe('FIXED')
      if (!path || path.selectionKind !== 'FIXED') throw new Error('Expected a fixed path.')
      expect(path.resultBlock.outcomes).toHaveLength(1)
      expect(path.resultBlock.outcomes[0]?.effectKind).toBe(
        intent === 'HEALING' ? 'HEAL' : intent === 'MOVEMENT' ? 'FORCED_MOVEMENT' : intent
      )
    }
  })

  it('maps a creature target and source save without changing the action defaults', () => {
    const draft = createGuidedSpellDraft('DAMAGE', { damageTypeId: 'fire' })
    draft.target = 'CREATURE'
    draft.targetDistance = 90
    draft.saveAbility = 'DEXTERITY'

    const effect = mapGuidedSpellEffect(draft, createDefaultEffect(1) as EffectAuthored, ids)

    expect(effect.invocation.triggerCode).toBe('SAVING_THROW')
    if (effect.invocation.triggerCode !== 'SAVING_THROW') return
    expect(effect.invocation.savingThrow).toMatchObject({
      id: 'save-1',
      dcMethod: 'SOURCE_SAVE_DC',
      ability: 'DEXTERITY'
    })
    expect(effect.invocation.range).toMatchObject({
      rangeKind: 'DISTANCE',
      amount: 90,
      unit: 'FEET'
    })
    expect(effect.invocation.targeting).toEqual({
      selectionKind: 'CHOSEN_CREATURES',
      dispositionKind: 'ANY',
      maxTargets: 1
    })
  })

  it('rejects mechanics that Guided cannot represent without flattening', () => {
    const draft = createGuidedSpellDraft('DAMAGE', { damageTypeId: 'fire' })
    const effect = mapGuidedSpellEffect(draft, createDefaultEffect(1) as EffectAuthored, ids)

    expect(canUseGuidedSpellAuthoring([effect])).toBe(true)
    expect(
      canUseGuidedSpellAuthoring([
        { ...effect, paths: [...effect.paths, structuredClone(effect.paths[0]!)] }
      ])
    ).toBe(false)
    expect(
      canUseGuidedSpellAuthoring([
        {
          ...effect,
          paths: effect.paths.map((path) => ({ ...path, pathCode: 'ON_HIT' }))
        }
      ])
    ).toBe(false)
    if (effect.invocation.range.rangeKind !== 'DISTANCE') {
      throw new Error('Expected a distance range.')
    }
    expect(
      canUseGuidedSpellAuthoring([
        {
          ...effect,
          invocation: {
            ...effect.invocation,
            range: {
              ...effect.invocation.range,
              scaling: {
                scalingKind: 'BREAKPOINTS',
                scalingSource: 'SPELL_CAST_LEVEL',
                breakpoints: [
                  {
                    id: 'range-breakpoint-1',
                    level: 2,
                    order: 1,
                    value: { amount: 120, unit: 'FEET' }
                  }
                ]
              }
            }
          }
        }
      ])
    ).toBe(false)
    expect(canUseGuidedSpellAuthoring([effect, structuredClone(effect)])).toBe(false)
  })

  it('rejects incomplete Advanced mechanics instead of normalizing them', () => {
    const draft = createGuidedSpellDraft('DAMAGE', { damageTypeId: 'fire' })
    draft.saveAbility = 'DEXTERITY'
    const effect = mapGuidedSpellEffect(draft, createDefaultEffect(1) as EffectAuthored, ids)
    if (effect.invocation.triggerCode !== 'SAVING_THROW') {
      throw new Error('Expected a saving throw.')
    }

    expect(
      canUseGuidedSpellAuthoring([
        {
          ...effect,
          invocation: {
            ...effect.invocation,
            savingThrow: {
              id: effect.invocation.savingThrow.id,
              dcMethod: effect.invocation.savingThrow.dcMethod
            }
          }
        }
      ])
    ).toBe(false)
    expect(
      canUseGuidedSpellAuthoring([
        {
          ...effect,
          invocation: {
            ...effect.invocation,
            range: {
              id: effect.invocation.range.id,
              rangeKind: 'DISTANCE',
              unit: 'FEET'
            }
          }
        }
      ])
    ).toBe(false)
    expect(
      canUseGuidedSpellAuthoring([
        mapGuidedSpellEffect(
          createGuidedSpellDraft('DAMAGE', { damageTypeId: '' }),
          createDefaultEffect(1) as EffectAuthored,
          ids
        )
      ])
    ).toBe(false)
  })
})
