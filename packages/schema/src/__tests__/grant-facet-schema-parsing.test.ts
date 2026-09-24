import { describe, expect, it } from 'vitest'

import { featureDtoSchema } from '../features/feature.js'
import { facetDtoSchema } from '../shared/facet.js'
import { featGrantDtoSchema } from '../grants/feat.js'
import { modifierGrantDtoSchema } from '../grants/modifier.js'
import { proficiencyGrantDtoSchema } from '../grants/proficiency.js'
import { senseGrantDtoSchema } from '../grants/sense.js'
import { spellGrantDtoSchema } from '../grants/spell.js'

describe('grant and facet schema parsing', () => {
  it('selects only the matching modifier domain and kind before validating its fields', () => {
    let scopeReads = 0
    const grant = {
      grantKind: 'MODIFIER_GRANT',
      id: 'remove-attribute',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'ATTRIBUTE',
      modifierKind: 'REMOVE_OPTION',
      get scope() {
        scopeReads += 1
        return 'GLOBAL'
      },
      payload: { attributeId: 'attribute-1' }
    }
    expect(modifierGrantDtoSchema.parse(grant)).toMatchObject({
      valueDomainCode: 'ATTRIBUTE',
      modifierKind: 'REMOVE_OPTION',
      payload: { attributeId: 'attribute-1' }
    })
    expect(scopeReads).toBeLessThanOrEqual(2)
    for (const invalid of [
      { ...grant, valueDomainCode: 'UNKNOWN' },
      { ...grant, modifierKind: 'UNKNOWN' },
      {
        ...grant,
        modifierKind: 'BONUS',
        payload: { valueKind: 'FIXED', amount: 1 }
      },
      { ...grant, payload: { damageTypeId: 'damage-1' } },
      { ...grant, payload: undefined }
    ])
      expect(modifierGrantDtoSchema.safeParse(invalid).success).toBe(false)
  })

  it('parses features with nested grant groups and options', () => {
    const parsed = featureDtoSchema.parse({
      id: 'fighting-style',
      label: 'Fighting Style',
      description: 'Choose a style.',
      section: 'TRAIT',
      details: [
        {
          id: 'fighting-style-detail',
          label: 'Detail',
          description: 'Choose one of the following options.',
          order: 1
        }
      ],
      order: 1,
      grants: {
        feats: [
          {
            grantKind: 'FEAT_GRANT',
            id: 'style-choice',
            order: 1,
            selectionKind: 'CHOSEN',
            scalingKind: 'NONE',
            count: 1,
            selectionDuplicatePolicy: 'UNIQUE',
            featIds: ['archery']
          }
        ]
      },
      options: [
        {
          id: 'archery-option',
          label: 'Archery',
          description: 'Gain a ranged accuracy bonus.',
          order: 1
        }
      ]
    })

    expect(parsed.grants?.feats?.[0]?.grantKind).toBe('FEAT_GRANT')
    expect(parsed.section).toBe('TRAIT')
    expect(parsed.details?.[0]?.label).toBe('Detail')
    expect(parsed.options?.[0]?.label).toBe('Archery')
  })

  it('rejects legacy singular feature detail fields', () => {
    expect(() =>
      featureDtoSchema.parse({
        id: 'legacy-feature',
        label: 'Legacy Feature',
        description: 'Old shape.',
        detail: 'Old prose.',
        order: 1
      })
    ).toThrow()
  })

  it('parses recursive facet restrictions with predicate and exists conditions', () => {
    const parsed = facetDtoSchema.parse({
      id: 'fighter-style-restriction',
      groups: [
        {
          id: 'group-1',
          order: 1,
          contexts: [
            {
              id: 'context-1',
              order: 1,
              subject: 'CHARACTER',
              conditions: [
                {
                  id: 'condition-1',
                  order: 1,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'CLASS_LEVEL',
                  classIds: ['fighter'],
                  min: 1
                },
                {
                  id: 'condition-2',
                  order: 2,
                  kind: 'EXISTS',
                  constraint: 'INCLUDE',
                  relationCode: 'FEATURE',
                  authoringModeKind: 'SELECTED',
                  featureIds: ['fighting-style'],
                  where: {
                    authoringModeKind: 'ALL',
                    groups: [
                      {
                        id: 'body-group-1',
                        order: 1,
                        conditions: [
                          {
                            id: 'nested-condition-1',
                            order: 1,
                            kind: 'PREDICATE',
                            constraint: 'INCLUDE',
                            predicateCode: 'FEATURE_OBTAINED',
                            featureIds: ['fighting-style']
                          }
                        ]
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      ]
    })

    expect(parsed.groups).toHaveLength(1)
  })

  it('parses explicit ALL facet authoring mode', () => {
    const parsed = facetDtoSchema.parse({
      id: 'explicit-all-facet',
      authoringModeKind: 'ALL',
      groups: [
        {
          id: 'group-1',
          order: 1,
          contexts: [
            {
              id: 'context-1',
              order: 1,
              subject: 'SPELL',
              conditions: [
                {
                  id: 'condition-1',
                  order: 1,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'SPELL_LEVEL',
                  min: 1
                }
              ]
            }
          ]
        }
      ]
    })

    expect(parsed.groups).toHaveLength(1)
  })

  it('parses correlated modifier grants for parameterized domains', () => {
    const parsed = modifierGrantDtoSchema.parse({
      grantKind: 'MODIFIER_GRANT',
      id: 'spell-attack-bonus',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'ATTACK_ROLL',
      domain: {
        attackDomain: 'SPELL'
      },
      modifierKind: 'ABILITY_MODIFIER_BONUS',
      scope: 'GLOBAL',
      payload: {
        ability: 'INTELLIGENCE',
        multiplier: 1
      }
    })

    expect(parsed.valueDomainCode).toBe('ATTACK_ROLL')
    expect((parsed as { domain: { attackDomain: string } }).domain.attackDomain).toBe('SPELL')
  })

  it('requires a UUID-backed sense definition for SENSE_RANGE without a legacy code alias', () => {
    const base = {
      grantKind: 'MODIFIER_GRANT',
      id: 'darkvision-range',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'SENSE_RANGE',
      modifierKind: 'BONUS',
      scope: 'GLOBAL',
      payload: { valueKind: 'FIXED', amount: 30 }
    }

    expect(
      modifierGrantDtoSchema.parse({
        ...base,
        domain: { senseDefinitionId: '00000000-0000-0000-000a-000100000000' }
      }).domain
    ).toEqual({ senseDefinitionId: '00000000-0000-0000-000a-000100000000' })
    expect(() =>
      modifierGrantDtoSchema.parse({ ...base, domain: { senseCode: 'DARKVISION' } })
    ).toThrow()
    expect(() =>
      modifierGrantDtoSchema.parse({ ...base, domain: { senseDefinitionId: 'darkvision' } })
    ).toThrow()
  })

  it('rejects chosen modifier grants without a target-binding model', () => {
    expect(() =>
      modifierGrantDtoSchema.parse({
        grantKind: 'MODIFIER_GRANT',
        id: 'chosen-ability-score-increase',
        order: 1,
        selectionKind: 'CHOSEN',
        count: 2,
        selectionDuplicatePolicy: 'UNIQUE',
        valueDomainCode: 'ABILITY_SCORE',
        domain: { ability: 'STRENGTH' },
        modifierKind: 'BONUS',
        scope: 'GLOBAL',
        payload: { valueKind: 'FIXED', amount: 1 }
      })
    ).toThrow()
  })

  it('parses attack roll advantage modifiers without payloads', () => {
    const parsed = modifierGrantDtoSchema.parse({
      grantKind: 'MODIFIER_GRANT',
      id: 'heavy-weapon-disadvantage',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'ATTACK_ROLL',
      domain: {
        attackDomain: 'MELEE'
      },
      modifierKind: 'DISADVANTAGE',
      scope: 'SOURCE'
    })

    expect(parsed.valueDomainCode).toBe('ATTACK_ROLL')
    expect(parsed.modifierKind).toBe('DISADVANTAGE')
  })

  it('parses ability-check and skill-check roll modes without payloads', () => {
    expect(
      modifierGrantDtoSchema.parse({
        grantKind: 'MODIFIER_GRANT',
        id: 'global-check-advantage',
        order: 1,
        selectionKind: 'GRANTED',
        valueDomainCode: 'ABILITY_CHECK',
        domain: {},
        modifierKind: 'ADVANTAGE',
        scope: 'GLOBAL'
      }).valueDomainCode
    ).toBe('ABILITY_CHECK')

    expect(
      modifierGrantDtoSchema.parse({
        grantKind: 'MODIFIER_GRANT',
        id: 'athletics-disadvantage',
        order: 1,
        selectionKind: 'GRANTED',
        valueDomainCode: 'SKILL_MODIFIER',
        domain: { skillId: 'skill-athletics' },
        modifierKind: 'DISADVANTAGE',
        scope: 'GLOBAL'
      }).modifierKind
    ).toBe('DISADVANTAGE')
  })

  it('scopes saving throw modifiers to a reusable rule definition', () => {
    const grant = {
      grantKind: 'MODIFIER_GRANT',
      id: 'concentration-save-advantage',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'SAVING_THROW_MODIFIER',
      domain: {
        ability: 'CONSTITUTION',
        ruleDefinitionId: '00000000-0000-4000-8000-0000000000c3'
      },
      modifierKind: 'ADVANTAGE',
      scope: 'GLOBAL'
    } as const

    expect(
      modifierGrantDtoSchema.parse({
        ...grant,
        domain: { ...grant.domain, ruleDefinitionId: grant.domain.ruleDefinitionId.toUpperCase() }
      }).domain
    ).toEqual(grant.domain)
    expect(
      modifierGrantDtoSchema.safeParse({
        ...grant,
        domain: { ...grant.domain, ruleDefinitionId: 'concentration' }
      }).success
    ).toBe(false)
  })

  it('parses explicit ALL grant authoring mode', () => {
    const parsed = featGrantDtoSchema.parse({
      grantKind: 'FEAT_GRANT',
      id: 'explicit-all-bonus-feat',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL'
    })

    expect(parsed.id).toBe('explicit-all-bonus-feat')
  })

  it('rejects selected grant targets that omit their required ids', () => {
    expect(() =>
      featGrantDtoSchema.parse({
        grantKind: 'FEAT_GRANT',
        id: 'bad-selected-feat-grant',
        order: 1,
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED'
      })
    ).toThrow()
  })

  it('parses explicit ALL proficiency authoring mode', () => {
    const parsed = proficiencyGrantDtoSchema.parse({
      grantKind: 'PROFICIENCY_GRANT',
      id: 'all-skill-proficiency',
      order: 1,
      proficiencyKind: 'SKILL',
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      level: 'FULL',
      authoringModeKind: 'ALL'
    })

    expect(parsed.id).toBe('all-skill-proficiency')
  })

  it('rejects selected proficiency targets that omit their required payload ids', () => {
    expect(() =>
      proficiencyGrantDtoSchema.parse({
        grantKind: 'PROFICIENCY_GRANT',
        id: 'bad-selected-proficiency',
        order: 1,
        proficiencyKind: 'SKILL',
        selectionKind: 'GRANTED',
        level: 'FULL',
        authoringModeKind: 'SELECTED'
      })
    ).toThrow()
  })

  it('rejects modifier payloads that do not match the selected domain', () => {
    expect(() =>
      modifierGrantDtoSchema.parse({
        grantKind: 'MODIFIER_GRANT',
        id: 'bad-modifier',
        order: 1,
        selectionKind: 'GRANTED',
        valueDomainCode: 'ATTACK_ROLL',
        domain: {
          ability: 'INTELLIGENCE'
        },
        modifierKind: 'BONUS',
        scope: 'GLOBAL',
        payload: {
          valueKind: 'FIXED',
          amount: 2
        }
      })
    ).toThrow()
  })

  it('requires duplicate policy only for chosen grant targets', () => {
    const cases = [
      {
        schema: proficiencyGrantDtoSchema,
        chosen: {
          grantKind: 'PROFICIENCY_GRANT',
          id: 'chosen-proficiency',
          order: 1,
          proficiencyKind: 'SKILL',
          selectionKind: 'CHOSEN',
          scalingKind: 'NONE',
          count: 2,
          level: 'FULL',
          authoringModeKind: 'SELECTED',
          skillIds: ['acrobatics', 'arcana']
        },
        granted: {
          grantKind: 'PROFICIENCY_GRANT',
          id: 'granted-proficiency',
          order: 1,
          proficiencyKind: 'SKILL',
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          level: 'FULL',
          authoringModeKind: 'SELECTED',
          skillIds: ['acrobatics']
        }
      },
      {
        schema: spellGrantDtoSchema,
        chosen: {
          grantKind: 'SPELL_GRANT',
          id: 'chosen-spell',
          order: 1,
          selectionKind: 'CHOSEN',
          scalingKind: 'NONE',
          count: 1,
          authoringModeKind: 'SELECTED',
          spellIds: ['fire-bolt']
        },
        granted: {
          grantKind: 'SPELL_GRANT',
          id: 'granted-spell',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          spellIds: ['fire-bolt']
        }
      },
      {
        schema: featGrantDtoSchema,
        chosen: {
          grantKind: 'FEAT_GRANT',
          id: 'chosen-feat',
          order: 1,
          selectionKind: 'CHOSEN',
          scalingKind: 'NONE',
          count: 1,
          authoringModeKind: 'SELECTED',
          featIds: ['archery']
        },
        granted: {
          grantKind: 'FEAT_GRANT',
          id: 'granted-feat',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          featIds: ['archery']
        }
      },
      {
        schema: senseGrantDtoSchema,
        chosen: {
          grantKind: 'SENSE_GRANT',
          id: 'chosen-sense',
          order: 1,
          selectionKind: 'CHOSEN',
          scalingKind: 'NONE',
          count: 1,
          authoringModeKind: 'SELECTED',
          senseIds: ['darkvision']
        },
        granted: {
          grantKind: 'SENSE_GRANT',
          id: 'granted-sense',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          senseIds: ['darkvision']
        }
      }
    ] as const

    for (const { schema, chosen, granted } of cases) {
      expect(schema.safeParse(chosen).success).toBe(false)

      const uniqueParse = schema.safeParse({
        ...chosen,
        selectionDuplicatePolicy: 'UNIQUE'
      })
      expect(uniqueParse.success).toBe(true)
      expect(uniqueParse.success ? uniqueParse.data.selectionDuplicatePolicy : undefined).toBe(
        'UNIQUE'
      )

      const repeatableParse = schema.safeParse({
        ...chosen,
        selectionDuplicatePolicy: 'REPEATABLE'
      })
      expect(repeatableParse.success).toBe(true)
      expect(
        repeatableParse.success ? repeatableParse.data.selectionDuplicatePolicy : undefined
      ).toBe('REPEATABLE')

      expect(
        schema.safeParse({
          ...granted,
          selectionDuplicatePolicy: 'UNIQUE'
        }).success
      ).toBe(false)
    }
  })

  it('keeps duplicate policy on chosen per-level grant progression entries', () => {
    const parsed = spellGrantDtoSchema.parse({
      grantKind: 'SPELL_GRANT',
      id: 'per-level-spell',
      order: 1,
      selectionKind: 'CHOSEN',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'CHARACTER_LEVEL',
        levels: [
          {
            id: 'per-level-spell-1',
            level: 3,
            order: 1,
            authoringModeKind: 'SELECTED',
            count: 1,
            selectionDuplicatePolicy: 'UNIQUE',
            spellIds: ['misty-step']
          }
        ]
      }
    })

    expect(
      (parsed as { progression?: { levels: Array<{ selectionDuplicatePolicy?: string }> } })
        .progression?.levels[0]?.selectionDuplicatePolicy
    ).toBe('UNIQUE')
    expect(
      spellGrantDtoSchema.safeParse({
        ...parsed,
        selectionDuplicatePolicy: 'UNIQUE'
      }).success
    ).toBe(false)
  })

  it('rejects invalid facet predicate payloads once predicate correlation is enforced', () => {
    for (const predicateCode of ['WHILE_SOURCE_EQUIPPED', undefined, 'UNKNOWN']) {
      const result = facetDtoSchema.safeParse({
        id: 'predicate-facet',
        groups: [
          {
            id: 'group-1',
            order: 1,
            contexts: [
              {
                id: 'context-1',
                order: 1,
                subject: 'CHARACTER',
                conditions: [
                  {
                    id: 'condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode
                  }
                ]
              }
            ]
          }
        ]
      })
      expect(result.success).toBe(predicateCode === 'WHILE_SOURCE_EQUIPPED')
    }

    expect(() =>
      facetDtoSchema.parse({
        id: 'bad-facet',
        groups: [
          {
            id: 'group-1',
            order: 1,
            contexts: [
              {
                id: 'context-1',
                order: 1,
                subject: 'CHARACTER',
                conditions: [
                  {
                    id: 'condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'SPELL_LEVEL'
                  }
                ]
              }
            ]
          }
        ]
      })
    ).toThrow()
  })
})
