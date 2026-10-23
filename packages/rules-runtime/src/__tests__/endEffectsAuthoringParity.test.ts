import { describe, expect, it } from 'vitest'
import { featureEffectDtoSchema } from '@artificer-toolkit/schema/effects/effect'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { creatureTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

const conditionDefinitionIds = srdSystemRecord.conditionTypes.map(({ id }) => id)
const conditionId = (code: string) => {
  const found = srdSystemRecord.conditionTypes.find((condition) => condition.code === code)
  if (!found) throw new Error(`SRD condition ${code} is missing.`)
  return found.id
}

const srdSpell = (label: string) => {
  const spell = srdBaselineContent.subjects.spells.find((entry) => entry.label === label)
  if (!spell?.effects?.[0]) throw new Error(`SRD spell ${label} is missing.`)
  return spell.effects[0]
}

/** The execution plan the System compiles for a Character action over the authored Effect. */
function compiledPlan(effect: ReturnType<typeof srdSpell>) {
  const action = {
    ...characterActionDescriptor(compileEffect({ ...effect, id: ACTION_EFFECT_ID }), 2, 5),
    conditionDefinitionIds
  }
  return dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
}

const outcomeOf = (effect: ReturnType<typeof srdSpell>) =>
  effect.paths.flatMap((path) => (path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []))

describe('Lesser Restoration is authorable from core options (D174, SPELLS-4.T2f)', () => {
  const srd = srdSpell('Lesser Restoration')

  it('is one END_EFFECTS outcome naming the four conditions the caster may end, with no closed rule', () => {
    expect(JSON.stringify(srd)).not.toContain('CLOSED_RULE')
    expect(outcomeOf(srd)).toEqual([
      expect.objectContaining({
        effectKind: 'END_EFFECTS',
        scope: 'ONE_CHOSEN',
        selectors: [
          {
            kind: 'CONDITION',
            conditionIds: ['BLINDED', 'DEAFENED', 'PARALYZED', 'POISONED'].map(conditionId)
          }
        ]
      })
    ])
    expect(compiledPlan(srd)?.kind).toBe('SINGLE_GRAPH')
  })

  it('compiles a homebrew action written from core options alone to the same plan shape', () => {
    const homebrew = {
      id: testUuid(0x2250),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: 'ACTIVATED' as const,
        activation: { code: 'ACTION' as const, amount: 1 },
        range: { id: testUuid(0x2251), rangeKind: 'TOUCH' as const },
        targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const }
      },
      paths: [
        {
          id: testUuid(0x2252),
          order: 1,
          pathCode: 'ON_USE' as const,
          groupType: 'SINGLE' as const,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: testUuid(0x2253),
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: testUuid(0x2254),
                effectKind: 'END_EFFECTS' as const,
                scope: 'ALL' as const,
                selectors: [{ kind: 'CONDITION' as const, conditionIds: [conditionId('CHARMED')] }]
              }
            ]
          }
        }
      ]
    }
    expect(featureEffectDtoSchema.safeParse(homebrew).success).toBe(true)
    const authored = compiledPlan(homebrew)
    const baseline = compiledPlan(srd)
    expect(authored?.kind).toBe('SINGLE_GRAPH')
    if (authored?.kind !== 'SINGLE_GRAPH' || baseline?.kind !== 'SINGLE_GRAPH')
      throw new Error('Expected single graphs.')
    expect(Object.keys(authored.published)).toEqual(Object.keys(baseline.published))
  })

  it('refuses an end-effects outcome that names no selector', () => {
    const [outcome] = outcomeOf(srd)
    expect(
      featureEffectDtoSchema.safeParse({
        ...srd,
        paths: [
          {
            ...srd.paths[0],
            resultBlock: {
              ...(srd.paths[0]?.selectionKind === 'FIXED' ? srd.paths[0].resultBlock : {}),
              outcomes: [{ ...outcome, selectors: [] }]
            }
          }
        ]
      }).success
    ).toBe(false)
  })
})

describe('a spell-level END_EFFECTS outcome is authorable from core options (D182, SPELLS-4.T2f1a)', () => {
  const homebrew = (selector: {
    kind: 'SPELL_LEVEL'
    limit: 'SLOT_LEVEL' | 'FIXED'
    level?: number
  }) => ({
    id: testUuid(0x2260),
    order: 1,
    invocation: {
      kind: 'ACTION' as const,
      triggerCode: 'ACTIVATED' as const,
      activation: { code: 'ACTION' as const, amount: 1 },
      range: { id: testUuid(0x2261), rangeKind: 'TOUCH' as const },
      targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const }
    },
    paths: [
      {
        id: testUuid(0x2262),
        order: 1,
        pathCode: 'ON_USE' as const,
        groupType: 'SINGLE' as const,
        originKind: 'SOURCE' as const,
        selectionKind: 'FIXED' as const,
        resultBlock: {
          id: testUuid(0x2263),
          resultKind: 'SINGLE' as const,
          outcomes: [
            {
              id: testUuid(0x2264),
              effectKind: 'END_EFFECTS' as const,
              scope: 'ALL' as const,
              selectors: [selector]
            }
          ]
        }
      }
    ]
  })

  it('compiles a slot-level and a fixed-level selector, with no closed rule', () => {
    for (const selector of [
      { kind: 'SPELL_LEVEL', limit: 'SLOT_LEVEL' },
      { kind: 'SPELL_LEVEL', limit: 'FIXED', level: 3 }
    ] as const) {
      const effect = homebrew(selector)
      expect(featureEffectDtoSchema.safeParse(effect).success).toBe(true)
      expect(JSON.stringify(effect)).not.toContain('CLOSED_RULE')
      expect(compiledPlan(effect)?.kind).toBe('SINGLE_GRAPH')
    }
  })

  it('refuses a fixed limit without a level, and a level without a fixed limit', () => {
    for (const selector of [
      { kind: 'SPELL_LEVEL', limit: 'FIXED' },
      { kind: 'SPELL_LEVEL', limit: 'SLOT_LEVEL', level: 3 },
      { kind: 'SPELL_LEVEL', limit: 'FIXED', level: 10 }
    ] as const)
      expect(featureEffectDtoSchema.safeParse(homebrew(selector)).success).toBe(false)
  })
})

describe('an END_EFFECTS origin creature-type selector is authorable from core options (SPELLS-4.T2j2a)', () => {
  const srd = srdSpell('Lesser Restoration')
  const [outcome] = outcomeOf(srd)
  const selecting = (originCreatureTypeIds: string[]) => ({
    ...srd,
    paths: [
      {
        ...srd.paths[0],
        resultBlock: {
          ...(srd.paths[0]?.selectionKind === 'FIXED' ? srd.paths[0].resultBlock : {}),
          outcomes: [{ ...outcome, originCreatureTypeIds }]
        }
      }
    ]
  })

  it('keeps the selector as authored and compiles the same plan shape', () => {
    const homebrew = selecting(['FEY', 'FIEND'].map(creatureTypeId))
    const parsed = featureEffectDtoSchema.safeParse(homebrew)
    expect(parsed.success).toBe(true)
    expect(JSON.stringify(parsed.data)).toContain(creatureTypeId('FIEND'))
    const authored = compiledPlan(homebrew as typeof srd)
    const baseline = compiledPlan(srd)
    expect(authored?.kind).toBe('SINGLE_GRAPH')
    if (authored?.kind !== 'SINGLE_GRAPH' || baseline?.kind !== 'SINGLE_GRAPH')
      throw new Error('Expected single graphs.')
    expect(Object.keys(authored.published)).toEqual(Object.keys(baseline.published))
  })
})
