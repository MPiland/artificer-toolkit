import { describe, expect, it } from 'vitest'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { createDefaultEffect } from '#app/forms/rendering/authoringNodeDefaults'
import { mapGuidedSpellEffect } from '#forms/guided/guidedSimpleEffect.mapping'
import {
  createGuidedSpellDraft,
  type GuidedEffectIds
} from '#forms/guided/guidedSimpleEffect.types'
import { rehydrateGuidedSpell } from '#forms/guided/guidedSimpleEffect.rehydrate'

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
    draft.saveAbilityDefinitionId = '00000000-0000-0000-0011-000200000000'

    const effect = mapGuidedSpellEffect(draft, createDefaultEffect(1) as EffectAuthored, ids)

    expect(effect.invocation.triggerCode).toBe('SAVING_THROW')
    if (effect.invocation.triggerCode !== 'SAVING_THROW') return
    expect(effect.invocation.savingThrow).toMatchObject({
      id: 'save-1',
      dcMethod: 'SOURCE_SAVE_DC',
      abilityDefinitionId: '00000000-0000-0000-0011-000200000000'
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

  it('removes condition duration when changing to a different outcome', () => {
    const condition = createGuidedSpellDraft('CONDITION', { conditionTypeId: 'blinded' })
    condition.conditionDuration = 'MINUTE'
    const conditionEffect = mapGuidedSpellEffect(
      condition,
      createDefaultEffect(1) as EffectAuthored,
      ids
    )

    const damageEffect = mapGuidedSpellEffect(
      createGuidedSpellDraft('DAMAGE', { damageTypeId: 'fire' }),
      conditionEffect,
      ids
    )
    const path = damageEffect.paths[0]
    if (!path || path.selectionKind !== 'FIXED') throw new Error('Expected a fixed path.')

    expect(path.resultBlock).not.toHaveProperty('duration')
    expect(rehydrateGuidedSpell([damageEffect], ids)).not.toBeNull()
  })

  it('rejects mechanics that Guided cannot represent without flattening', () => {
    const draft = createGuidedSpellDraft('DAMAGE', { damageTypeId: 'fire' })
    const effect = mapGuidedSpellEffect(draft, createDefaultEffect(1) as EffectAuthored, ids)

    expect(rehydrateGuidedSpell([effect], ids)).not.toBeNull()
    expect(
      rehydrateGuidedSpell(
        [{ ...effect, paths: [...effect.paths, structuredClone(effect.paths[0]!)] }],
        ids
      )
    ).toBeNull()
    expect(
      rehydrateGuidedSpell(
        [
          {
            ...effect,
            paths: effect.paths.map((path) => ({ ...path, pathCode: 'ON_HIT' }))
          }
        ],
        ids
      )
    ).toBeNull()
    if (effect.invocation.range.rangeKind !== 'DISTANCE') {
      throw new Error('Expected a distance range.')
    }
    expect(
      rehydrateGuidedSpell(
        [
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
        ],
        ids
      )
    ).toBeNull()
    expect(rehydrateGuidedSpell([effect, structuredClone(effect)], ids)).toBeNull()
  })

  it('rejects incomplete Advanced mechanics instead of normalizing them', () => {
    const draft = createGuidedSpellDraft('DAMAGE', { damageTypeId: 'fire' })
    draft.saveAbilityDefinitionId = '00000000-0000-0000-0011-000200000000'
    const effect = mapGuidedSpellEffect(draft, createDefaultEffect(1) as EffectAuthored, ids)
    if (effect.invocation.triggerCode !== 'SAVING_THROW') {
      throw new Error('Expected a saving throw.')
    }

    expect(
      rehydrateGuidedSpell(
        [
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
        ],
        ids
      )
    ).toBeNull()
    expect(
      rehydrateGuidedSpell(
        [
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
        ],
        ids
      )
    ).toBeNull()
    expect(
      rehydrateGuidedSpell(
        [
          mapGuidedSpellEffect(
            createGuidedSpellDraft('DAMAGE', { damageTypeId: '' }),
            createDefaultEffect(1) as EffectAuthored,
            ids
          )
        ],
        ids
      )
    ).toBeNull()
  })
})
