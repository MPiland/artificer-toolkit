import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import type { RulePackDocumentDto } from '@artificer-toolkit/schema/api/rules'

import { dnd5e2014CharacterModifierPolicyExpressions } from './characterModifierPolicy.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

type ModifierFixture = {
  domainKey: string
  modifierKind: string
  payload: Record<string, z.infer<ReturnType<typeof z.json>>>
  sourceId?: string
}

function modifierDocument(): RulePackDocumentDto {
  return {
    schemaVersion: 1,
    models: {
      modifiers: {
        contentType: 'application/vnd.gorules.decision',
        nodes: [
          {
            id: 'input',
            type: 'inputNode',
            name: 'Input',
            position: { x: 0, y: 0 },
            content: { schema: '' }
          },
          {
            id: 'calculations',
            type: 'expressionNode',
            name: 'Modifier calculations',
            position: { x: 100, y: 0 },
            content: {
              passThrough: false,
              inputField: null,
              outputPath: null,
              executionMode: 'single',
              expressions: dnd5e2014CharacterModifierPolicyExpressions
            }
          },
          {
            id: 'output',
            type: 'outputNode',
            name: 'Output',
            position: { x: 200, y: 0 },
            content: { schema: '' }
          }
        ],
        edges: [
          { id: 'input-calculations', sourceId: 'input', targetId: 'calculations' },
          { id: 'calculations-output', sourceId: 'calculations', targetId: 'output' }
        ]
      }
    },
    fixtures: []
  }
}

function evaluateModifiers(
  fixtures: ModifierFixture[],
  options: {
    abilities?: Record<string, number>
    totalLevel?: number
    classes?: Array<{ classId: string; level: number }>
  } = {}
) {
  const modifiers = fixtures.map((fixture) => ({
    domainKey: fixture.domainKey,
    modifierKind: fixture.modifierKind,
    grant: { payload: fixture.payload },
    source: { kind: 'SYSTEM' as const, systemId: fixture.sourceId ?? 'test' },
    scopeSpellIds: [] as string[]
  }))
  const groups = fixtures.reduce<
    Array<{
      domainKey: string
      valueDomainCode: string
      modifierKind: string
      contributions: Array<{
        acceptedModifierIndex: number
        sourceId: string
        grantId: string
        grant: { payload: Record<string, z.infer<ReturnType<typeof z.json>>> }
      }>
    }>
  >((result, fixture, acceptedModifierIndex) => {
    const [head] = fixture.domainKey.split('|')
    const [valueDomainCode, modifierKind] = (head ?? '').split(':')
    let group = result.find(({ domainKey }) => domainKey === fixture.domainKey)
    if (!group) {
      group = {
        domainKey: fixture.domainKey,
        valueDomainCode: valueDomainCode ?? 'UNKNOWN',
        modifierKind: modifierKind ?? 'BONUS',
        contributions: []
      }
      result.push(group)
    }
    group.contributions.push({
      acceptedModifierIndex,
      sourceId: fixture.sourceId ?? `source-${acceptedModifierIndex}`,
      grantId: `grant-${acceptedModifierIndex}`,
      grant: { payload: fixture.payload }
    })
    return result
  }, [])

  return evaluateZenRuleModel({
    document: modifierDocument(),
    modelKey: 'modifiers',
    context: {
      totalLevel: options.totalLevel ?? 5,
      grantFoldFacts: {
        base: {
          abilities: options.abilities ?? { STR: 10 },
          classes: options.classes ?? [],
          totalLevel: options.totalLevel ?? 5
        }
      },
      derivedBaseFacts: {
        abilities: Object.entries(options.abilities ?? { STR: 10 }).map(
          ([abilityId, baseScore]) => ({ abilityId, baseScore })
        )
      },
      grantFold: { modifiers, modifierGroups: groups }
    }
  })
}

describe('D&D 5e 2014 modifier policy', () => {
  it('evaluates a simple fixed modifier', async () => {
    const result = await evaluateModifiers([
      {
        domainKey: 'TEST:BONUS',
        modifierKind: 'BONUS',
        payload: { valueKind: 'FIXED', amount: 2 }
      }
    ])

    expect(result.result).toMatchObject({
      resolvedModifierGroups: [{ domainKey: 'TEST:BONUS', effective: 2 }]
    })
  })

  it('normalizes long and short ability aliases for scores and ability modifiers', async () => {
    const longBase = await evaluateModifiers(
      [
        {
          domainKey: 'ABILITY_SCORE:SET_VALUE|ability=STR',
          modifierKind: 'SET_VALUE',
          payload: { value: 12 },
          sourceId: 'set-first'
        },
        {
          domainKey: 'ABILITY_SCORE:SET_VALUE|ability=STR',
          modifierKind: 'SET_VALUE',
          payload: { value: 14 },
          sourceId: 'set-last'
        },
        {
          domainKey: 'ABILITY_SCORE:BONUS|ability=STRENGTH',
          modifierKind: 'BONUS',
          payload: { valueKind: 'FIXED', amount: 2 },
          sourceId: 'strength-bonus'
        },
        {
          domainKey: 'ATTACK_ROLL:ABILITY_MODIFIER_BONUS|attackDomain=SPELL',
          modifierKind: 'ABILITY_MODIFIER_BONUS',
          payload: { ability: 'STR', min: 0, max: 3 },
          sourceId: 'spell-ability'
        },
        {
          domainKey: 'DAMAGE:OPTIONAL_ABILITY_MODIFIER_BONUS',
          modifierKind: 'OPTIONAL_ABILITY_MODIFIER_BONUS',
          payload: { abilities: ['STR', 'DEX'] },
          sourceId: 'optional-ability'
        }
      ],
      { abilities: { STRENGTH: 8, DEX: 16 } }
    )
    const longBaseGroups = (
      longBase.result as { resolvedModifierGroups: Array<Record<string, unknown>> }
    ).resolvedModifierGroups
    expect(longBaseGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domainKey: 'ABILITY_SCORE:SET_VALUE|ability=STR',
          effective: 14
        }),
        expect.objectContaining({
          domainKey: 'ABILITY_SCORE:BONUS|ability=STRENGTH',
          effective: 2
        }),
        expect.objectContaining({
          domainKey: 'ATTACK_ROLL:ABILITY_MODIFIER_BONUS|attackDomain=SPELL',
          effective: 3
        }),
        expect.objectContaining({
          domainKey: 'DAMAGE:OPTIONAL_ABILITY_MODIFIER_BONUS',
          effective: 3
        })
      ])
    )

    const shortBase = await evaluateModifiers(
      [
        {
          domainKey: 'ATTACK_ROLL:ABILITY_MODIFIER_BONUS|attackDomain=SPELL',
          modifierKind: 'ABILITY_MODIFIER_BONUS',
          payload: { ability: 'STRENGTH' },
          sourceId: 'spell-ability'
        },
        {
          domainKey: 'DAMAGE:OPTIONAL_ABILITY_MODIFIER_BONUS',
          modifierKind: 'OPTIONAL_ABILITY_MODIFIER_BONUS',
          payload: { abilities: ['STRENGTH'] },
          sourceId: 'optional-ability'
        }
      ],
      { abilities: { STR: 18 } }
    )
    const shortBaseGroups = (
      shortBase.result as { resolvedModifierGroups: Array<Record<string, unknown>> }
    ).resolvedModifierGroups
    expect(shortBaseGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domainKey: 'ATTACK_ROLL:ABILITY_MODIFIER_BONUS|attackDomain=SPELL',
          effective: 4
        }),
        expect.objectContaining({
          domainKey: 'DAMAGE:OPTIONAL_ABILITY_MODIFIER_BONUS',
          effective: 4
        })
      ])
    )
  })

  it('resolves dynamic ability scores before ability modifiers and preserves an explicit zero set', async () => {
    const dynamic = await evaluateModifiers(
      [
        {
          domainKey: 'ABILITY_SCORE:BONUS|ability=STR',
          modifierKind: 'BONUS',
          payload: { valueKind: 'PROFICIENCY_BONUS', multiplier: 2 },
          sourceId: 'proficiency-score-bonus'
        },
        {
          domainKey: 'ATTACK_ROLL:ABILITY_MODIFIER_BONUS|attackDomain=SPELL',
          modifierKind: 'ABILITY_MODIFIER_BONUS',
          payload: { ability: 'STR' },
          sourceId: 'spell-ability'
        }
      ],
      { abilities: { STR: 10 }, totalLevel: 5 }
    )
    expect(dynamic.result).toMatchObject({
      resolvedModifierGroups: expect.arrayContaining([
        expect.objectContaining({ domainKey: 'ABILITY_SCORE:BONUS|ability=STR', effective: 6 }),
        expect.objectContaining({
          domainKey: 'ATTACK_ROLL:ABILITY_MODIFIER_BONUS|attackDomain=SPELL',
          effective: 3
        })
      ])
    })

    const zeroSet = await evaluateModifiers(
      [
        {
          domainKey: 'ABILITY_SCORE:SET_VALUE|ability=STR',
          modifierKind: 'SET_VALUE',
          payload: { value: 0 },
          sourceId: 'zero-score-set'
        },
        {
          domainKey: 'ATTACK_ROLL:ABILITY_MODIFIER_BONUS|attackDomain=SPELL',
          modifierKind: 'ABILITY_MODIFIER_BONUS',
          payload: { ability: 'STR' },
          sourceId: 'spell-ability'
        }
      ],
      { abilities: { STR: 18 } }
    )
    expect(zeroSet.result).toMatchObject({
      resolvedModifierGroups: expect.arrayContaining([
        expect.objectContaining({ domainKey: 'ABILITY_SCORE:SET_VALUE|ability=STR', effective: 0 }),
        expect.objectContaining({
          domainKey: 'ATTACK_ROLL:ABILITY_MODIFIER_BONUS|attackDomain=SPELL',
          effective: -5
        })
      ])
    })
  })

  it('does not treat an ability-modifier contribution as an ability-score scalar', async () => {
    const result = await evaluateModifiers(
      [
        {
          domainKey: 'ABILITY_SCORE:ABILITY_MODIFIER_BONUS|ability=STR',
          modifierKind: 'ABILITY_MODIFIER_BONUS',
          payload: { ability: 'STR' },
          sourceId: 'malformed-normalized-fact'
        }
      ],
      { abilities: { STR: 14 } }
    )

    expect(result.result).toMatchObject({
      resolvedModifierGroups: [
        {
          domainKey: 'ABILITY_SCORE:ABILITY_MODIFIER_BONUS|ability=STR',
          effective: 2
        }
      ]
    })
  })

  it('matches legacy scalar value kinds and multipliers', async () => {
    const result = await evaluateModifiers(
      [
        {
          domainKey: 'SCALAR:BONUS|kind=NO_VALUE_KIND',
          modifierKind: 'BONUS',
          payload: { amount: 3, multiplier: 10 }
        },
        {
          domainKey: 'SCALAR:BONUS|kind=FIXED',
          modifierKind: 'BONUS',
          payload: { valueKind: 'FIXED', amount: 4, value: 99, multiplier: 10 }
        },
        {
          domainKey: 'SCALAR:BONUS|kind=PROFICIENCY',
          modifierKind: 'BONUS',
          payload: { valueKind: 'PROFICIENCY_BONUS', multiplier: 2 }
        },
        {
          domainKey: 'SCALAR:BONUS|kind=CHARACTER_LEVEL',
          modifierKind: 'BONUS',
          payload: { valueKind: 'CHARACTER_LEVEL', multiplier: 0.5 }
        },
        {
          domainKey: 'SCALAR:BONUS|kind=CLASS_LEVEL',
          modifierKind: 'BONUS',
          payload: { valueKind: 'CLASS_LEVEL', classId: 'fighter', multiplier: 2 }
        },
        {
          domainKey: 'SCALAR:BONUS|kind=SKILL_BONUS',
          modifierKind: 'BONUS',
          payload: { valueKind: 'SKILL_BONUS', amount: 99 }
        },
        {
          domainKey: 'SCALAR:BONUS|kind=SPELL_SLOT_LEVEL',
          modifierKind: 'BONUS',
          payload: { valueKind: 'SPELL_SLOT_LEVEL', amount: 99 }
        }
      ],
      { totalLevel: 5, classes: [{ classId: 'fighter', level: 3 }] }
    )

    expect(result.result).toMatchObject({
      resolvedModifierGroups: expect.arrayContaining([
        expect.objectContaining({ domainKey: 'SCALAR:BONUS|kind=NO_VALUE_KIND', effective: 3 }),
        expect.objectContaining({ domainKey: 'SCALAR:BONUS|kind=FIXED', effective: 4 }),
        expect.objectContaining({ domainKey: 'SCALAR:BONUS|kind=PROFICIENCY', effective: 6 }),
        expect.objectContaining({ domainKey: 'SCALAR:BONUS|kind=CHARACTER_LEVEL', effective: 2.5 }),
        expect.objectContaining({ domainKey: 'SCALAR:BONUS|kind=CLASS_LEVEL', effective: 6 }),
        expect.objectContaining({ domainKey: 'SCALAR:BONUS|kind=SKILL_BONUS', effective: 0 }),
        expect.objectContaining({ domainKey: 'SCALAR:BONUS|kind=SPELL_SLOT_LEVEL', effective: 0 })
      ])
    })
  })

  it('uses last-wins SET_VALUE stacking and preserves suppression evidence', async () => {
    const result = await evaluateModifiers([
      {
        domainKey: 'TEST:SET_VALUE',
        modifierKind: 'SET_VALUE',
        payload: { value: 1 },
        sourceId: 'first'
      },
      {
        domainKey: 'TEST:SET_VALUE',
        modifierKind: 'SET_VALUE',
        payload: { value: 2 },
        sourceId: 'second'
      }
    ])

    expect(result.result).toMatchObject({
      resolvedModifierGroups: [
        {
          domainKey: 'TEST:SET_VALUE',
          effective: 2,
          contributions: [
            { value: 1, state: 'SUPPRESSED', reasonCode: 'SUPPRESSED_BY_STACKING' },
            { value: 2, state: 'APPLIED', reasonCode: 'STACKED' }
          ]
        }
      ]
    })
  })
})
