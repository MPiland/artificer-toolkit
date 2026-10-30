import { describe, expect, it } from 'vitest'
import { featureEffectDtoSchema } from '@artificer-toolkit/schema/effects/effect'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { monk } from '@artificer-toolkit/source-data/srd/classes/monk.js'
import { paladin } from '@artificer-toolkit/source-data/srd/classes/paladin.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

/**
 * SPELLS-31.T4f: Stillness of Mind and Cleansing Touch are authored from core options (a feature
 * END_EFFECTS action), so their closed-rule kinds are gone.
 */

const conditionDefinitionIds = srdSystemRecord.conditionTypes.map(({ id }) => id)
const conditionId = (code: string) => {
  const found = srdSystemRecord.conditionTypes.find((condition) => condition.code === code)
  if (!found) throw new Error(`SRD condition ${code} is missing.`)
  return found.id
}

const feature = (cls: typeof monk, label: string) => {
  const found = cls.features?.find((entry) => entry.label === label)
  if (!found) throw new Error(`The SRD authors ${label}.`)
  return found
}

type Authored = NonNullable<ReturnType<typeof feature>['effects']>[number]

const outcomesOf = (effect: Authored) =>
  effect.paths?.flatMap((path) =>
    path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []
  ) ?? []

/** The execution plan the System compiles for a Character action over the authored Effect. */
function compiledPlan(effect: Authored) {
  const action = {
    ...characterActionDescriptor(compileEffect({ ...effect, id: ACTION_EFFECT_ID }), 2, 5),
    conditionDefinitionIds
  }
  return dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
}

const stillness = feature(monk, 'Stillness of Mind')
const cleansing = feature(paladin, 'Cleansing Touch')

describe('the closed-rule kinds are deleted', () => {
  it.each(['CLASS_MONK_STILLNESS_OF_MIND', 'CLASS_PALADIN_CLEANSING_TOUCH'])('%s', (kind) => {
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain(kind)
  })
})

describe('Stillness of Mind is authorable from core options', () => {
  const [effect] = stillness.effects ?? []

  it('is one self END_EFFECTS action ending a charm or fright, with no closed rule', () => {
    if (!effect) throw new Error('Stillness of Mind authors an Effect.')
    expect(JSON.stringify(stillness.effects)).not.toContain('CLOSED_RULE')
    expect(stillness.effects).toHaveLength(1)
    expect(effect.invocation).toMatchObject({
      kind: 'ACTION',
      activation: { code: 'ACTION', amount: 1 },
      targeting: { selectionKind: 'SELF' }
    })
    expect(outcomesOf(effect)).toEqual([
      expect.objectContaining({
        effectKind: 'END_EFFECTS',
        scope: 'ONE_CHOSEN',
        selectors: [{ kind: 'CONDITION', conditionIds: ['CHARMED', 'FRIGHTENED'].map(conditionId) }]
      })
    ])
    expect(featureEffectDtoSchema.safeParse(effect).success).toBe(true)
    expect(compiledPlan(effect)?.kind).toBe('SINGLE_GRAPH')
  })
})

describe('Cleansing Touch is authorable from core options', () => {
  const [effect] = cleansing.effects ?? []

  it('is one touch END_EFFECTS action ending a spell, with no closed rule', () => {
    if (!effect) throw new Error('Cleansing Touch authors an Effect.')
    expect(JSON.stringify(cleansing.effects)).not.toContain('CLOSED_RULE')
    expect(cleansing.effects).toHaveLength(1)
    expect(effect.invocation).toMatchObject({
      kind: 'ACTION',
      activation: { code: 'ACTION', amount: 1 },
      range: { rangeKind: 'TOUCH' },
      targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
    })
    expect(outcomesOf(effect)).toEqual([
      expect.objectContaining({
        effectKind: 'END_EFFECTS',
        scope: 'ONE_CHOSEN',
        selectors: [{ kind: 'SPELL_LEVEL', limit: 'FIXED', level: 9 }]
      })
    ])
    expect(featureEffectDtoSchema.safeParse(effect).success).toBe(true)
    expect(compiledPlan(effect)?.kind).toBe('SINGLE_GRAPH')
  })

  it('spends one use of a Charisma-modifier charge (minimum one) that a long rest restores', () => {
    expect(effect?.invocation).toMatchObject({
      resourceUse: { chargeId: cleansing.charges?.id, cost: 1 }
    })
    expect(cleansing.charges).toMatchObject({
      limitKind: 'ABILITY_MODIFIER',
      ability: 'CHARISMA',
      min: 1,
      resetKind: 'LONG_REST'
    })
  })

  it('compiles a homebrew action written from core options alone to the same plan shape', () => {
    if (!effect) throw new Error('Cleansing Touch authors an Effect.')
    const homebrew = {
      id: testUuid(0x2270),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: 'ACTIVATED' as const,
        activation: { code: 'ACTION' as const, amount: 1 },
        range: { id: testUuid(0x2271), rangeKind: 'TOUCH' as const },
        targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const }
      },
      paths: [
        {
          id: testUuid(0x2272),
          order: 1,
          pathCode: 'ON_USE' as const,
          groupType: 'SINGLE' as const,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: testUuid(0x2273),
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: testUuid(0x2274),
                effectKind: 'END_EFFECTS' as const,
                scope: 'ONE_CHOSEN' as const,
                selectors: [{ kind: 'SPELL_LEVEL' as const, limit: 'FIXED' as const, level: 9 }]
              }
            ]
          }
        }
      ]
    }
    expect(featureEffectDtoSchema.safeParse(homebrew).success).toBe(true)
    const authored = compiledPlan(homebrew)
    const baseline = compiledPlan(effect)
    if (authored?.kind !== 'SINGLE_GRAPH' || baseline?.kind !== 'SINGLE_GRAPH')
      throw new Error('Expected single graphs.')
    expect(Object.keys(authored.published)).toEqual(Object.keys(baseline.published))
  })
})
