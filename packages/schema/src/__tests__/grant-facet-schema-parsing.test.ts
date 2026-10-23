import { describe, expect, it } from 'vitest'

import { featureDtoSchema } from '../features/feature.js'
import { facetDtoSchema } from '../shared/facet.js'
import { featGrantDtoSchema } from '../grants/feat.js'
import { modifierGrantDtoSchema } from '../grants/modifier.js'
import { proficiencyGrantDtoSchema } from '../grants/proficiency.js'
import { senseGrantDtoSchema } from '../grants/sense.js'
import { spellGrantDtoSchema } from '../grants/spell.js'

describe('grant and facet schema parsing', () => {
  it('refuses a damage resistance that names both a damage type and the triggering damage', () => {
    const resistance = {
      grantKind: 'MODIFIER_GRANT',
      id: 'resist-trigger',
      order: 1,
      selectionKind: 'GRANTED',
      scope: 'GLOBAL',
      valueDomainCode: 'DAMAGE_RESISTANCE',
      domain: {},
      modifierKind: 'ADD_OPTION'
    }
    expect(
      modifierGrantDtoSchema.parse({ ...resistance, payload: { damageTypeSource: 'TRIGGER' } })
    ).toMatchObject({ payload: { damageTypeSource: 'TRIGGER' } })
    expect(
      modifierGrantDtoSchema.safeParse({
        ...resistance,
        payload: { damageTypeId: 'fire', damageTypeSource: 'TRIGGER' }
      }).success
    ).toBe(false)
  })

  it('parses a damage immunity limited to authored content, filtered or not (REACTION-4.1)', () => {
    const immunity = {
      grantKind: 'MODIFIER_GRANT',
      id: 'immune-force',
      order: 1,
      selectionKind: 'GRANTED',
      scope: 'GLOBAL',
      valueDomainCode: 'DAMAGE_IMMUNITY',
      domain: {},
      modifierKind: 'ADD_OPTION'
    }
    expect(
      modifierGrantDtoSchema.parse({
        ...immunity,
        payload: { damageTypeId: 'force', sourceEffectIds: ['spell-1'] }
      })
    ).toMatchObject({ payload: { damageTypeId: 'force', sourceEffectIds: ['spell-1'] } })
    expect(
      modifierGrantDtoSchema.safeParse({ ...immunity, payload: { damageTypeId: 'force' } }).success
    ).toBe(true)
    expect(
      modifierGrantDtoSchema.safeParse({
        ...immunity,
        payload: { damageTypeId: 'force', sourceEffectIds: 'spell-1' }
      }).success
    ).toBe(false)
  })

  it('selects only the matching modifier domain and kind before validating its fields', () => {
    let scopeReads = 0
    const grant = {
      grantKind: 'MODIFIER_GRANT',
      id: 'remove-condition-immunity',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'CONDITION_IMMUNITY',
      domain: {},
      modifierKind: 'REMOVE_OPTION',
      get scope() {
        scopeReads += 1
        return 'GLOBAL'
      },
      payload: { conditionTypeId: 'condition-1' }
    }
    expect(modifierGrantDtoSchema.parse(grant)).toMatchObject({
      valueDomainCode: 'CONDITION_IMMUNITY',
      modifierKind: 'REMOVE_OPTION',
      payload: { conditionTypeId: 'condition-1' }
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

  it('parses a SET_VALUE grant of attacks per Attack action and nothing else for it', () => {
    const grant = {
      grantKind: 'MODIFIER_GRANT',
      id: 'extra-attack',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'ATTACKS_PER_ATTACK_ACTION',
      domain: {},
      scope: 'GLOBAL',
      modifierKind: 'SET_VALUE',
      payload: { amount: 2 }
    }
    expect(modifierGrantDtoSchema.parse(grant)).toMatchObject({
      valueDomainCode: 'ATTACKS_PER_ATTACK_ACTION',
      modifierKind: 'SET_VALUE',
      payload: { amount: 2 }
    })
    expect(
      modifierGrantDtoSchema.safeParse({
        ...grant,
        modifierKind: 'BONUS',
        payload: { valueKind: 'FIXED', amount: 1 }
      }).success
    ).toBe(false)
  })

  it('has no RANGE SET_VALUE modifier variant: only the range kind can be replaced', () => {
    const base = {
      grantKind: 'MODIFIER_GRANT',
      id: 'grant',
      order: 1,
      selectionKind: 'GRANTED',
      scope: 'GLOBAL',
      valueDomainCode: 'RANGE',
      domain: {}
    }
    for (const payload of [
      { amount: 30, unit: 'ft', rangeKind: 'DISTANCE' },
      { rangeKind: 'TOUCH' }
    ]) {
      const parsed = modifierGrantDtoSchema.safeParse({
        ...base,
        modifierKind: 'SET_VALUE',
        payload
      })
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues.map((issue) => issue.code)).not.toContain('custom')
    }
  })

  it('rejects modifiers that no System consumer applies yet, with a clear message', () => {
    const base = {
      grantKind: 'MODIFIER_GRANT',
      id: 'grant',
      order: 1,
      selectionKind: 'GRANTED',
      scope: 'GLOBAL'
    }
    const unsupported = [
      {
        ...base,
        valueDomainCode: 'ATTRIBUTE',
        domain: {},
        modifierKind: 'ADD_OPTION',
        payload: { attributeId: 'a' }
      },
      {
        ...base,
        valueDomainCode: 'MOVEMENT_MODE',
        domain: {},
        modifierKind: 'ADD_OPTION',
        payload: { movementModeId: 'm' }
      },
      {
        ...base,
        valueDomainCode: 'CONDITION',
        domain: {},
        modifierKind: 'REMOVE_OPTION',
        payload: { conditionTypeId: 'c' }
      },
      {
        ...base,
        valueDomainCode: 'HIT_POINTS_MAX',
        domain: {},
        modifierKind: 'SET_VALUE',
        payload: { amount: 30 }
      },
      {
        ...base,
        valueDomainCode: 'SENSE_RANGE',
        modifierKind: 'SET_VALUE',
        domain: { senseDefinitionId: '00000000-0000-0000-0000-000000000001' },
        payload: { amount: 60, unit: 'FEET' }
      },
      {
        ...base,
        valueDomainCode: 'DAMAGE',
        modifierKind: 'REPLACE_DAMAGE_TYPE',
        domain: { attackDomain: 'MELEE' },
        payload: { damageTypeId: 'fire' }
      },
      // Kinds with no consumer that the SRD does not use.
      ...(
        [
          ['SAVE_DC', 'SET_VALUE', {}, { amount: 15 }],
          ['PROFICIENCY_BONUS', 'BONUS', {}, { valueKind: 'FIXED', amount: 1 }],
          ['PROFICIENCY_BONUS', 'SET_VALUE', {}, { amount: 3 }],
          ['CHARGE_LIMIT', 'SET_VALUE', {}, { amount: 3 }],
          [
            'CHARGE_LIMIT',
            'MODIFY_CHARGE_LIMIT',
            {},
            { limitKind: 'FIXED_AMOUNT', scalingKind: 'NONE', amount: 2 }
          ],
          ['RANGE', 'REPLACE_RANGE_KIND', {}, { rangeKind: 'TOUCH' }],
          ['DURATION', 'SET_VALUE', {}, { durationKind: 'MINUTE', amount: 10 }],
          ['DURATION', 'REPLACE_DURATION_KIND', {}, { durationKind: 'HOUR' }],
          ['SHAPE', 'REPLACE_SHAPE_KIND', {}, { shapeKind: 'CONE' }],
          ['SPELL_SLOT_COUNT', 'BONUS', { spellLevel: 1 }, { valueKind: 'FIXED', amount: 1 }],
          ['SPELL_SLOT_COUNT', 'SET_VALUE', { spellLevel: 1 }, { amount: 2 }],
          ['SPELL_SLOT_LEVEL_MAX', 'SET_VALUE', {}, { amount: 5 }],
          ['SPELLS_KNOWN', 'BONUS', {}, { valueKind: 'FIXED', amount: 1 }],
          ['SPELLS_KNOWN', 'SET_VALUE', {}, { amount: 4 }],
          ['SPELLS_PREPARED', 'BONUS', {}, { valueKind: 'FIXED', amount: 1 }],
          ['SPELLS_PREPARED', 'SET_VALUE', {}, { amount: 4 }],
          ['ACTION_COUNT', 'BONUS', {}, { valueKind: 'FIXED', amount: 1 }],
          ['BONUS_ACTION_COUNT', 'BONUS', {}, { valueKind: 'FIXED', amount: 1 }],
          ['REACTION_COUNT', 'BONUS', {}, { valueKind: 'FIXED', amount: 1 }]
        ] as const
      ).map(([valueDomainCode, modifierKind, domain, payload]) => ({
        ...base,
        valueDomainCode,
        modifierKind,
        domain,
        payload
      }))
    ]
    // A rolled die is a d20-test modifier: it parses on attack rolls and saves, never on damage.
    const rolledDie = (valueDomainCode: string, domain: object, payload: object) =>
      modifierGrantDtoSchema.safeParse({
        ...base,
        valueDomainCode,
        modifierKind: 'ADD_BONUS_DIE',
        domain,
        payload
      }).success
    const d4 = { count: 1, faces: 4, sign: 'ADD' }
    expect(rolledDie('ATTACK_ROLL', { attackDomain: 'MELEE' }, d4)).toBe(true)
    expect(
      rolledDie('SAVING_THROW_MODIFIER', { ability: 'WISDOM' }, { ...d4, sign: 'SUBTRACT' })
    ).toBe(true)
    // A rolled die naming no ability covers every saving throw, death saves included (D156).
    expect(rolledDie('SAVING_THROW_MODIFIER', {}, d4)).toBe(true)
    expect(rolledDie('DAMAGE', { attackDomain: 'MELEE' }, d4)).toBe(false)
    expect(rolledDie('ATTACK_ROLL', { attackDomain: 'MELEE' }, { ...d4, faces: 20 })).toBe(false)
    expect(rolledDie('ATTACK_ROLL', { attackDomain: 'MELEE' }, { ...d4, count: 0 })).toBe(false)
    expect(rolledDie('ATTACK_ROLL', { attackDomain: 'MELEE' }, { dice: '1d4' })).toBe(false)
    // A d20 floor is an ability-check modifier with a face in 2..20; it parses nowhere else.
    const floor = (valueDomainCode: string, domain: object, amount: number) =>
      modifierGrantDtoSchema.safeParse({
        ...base,
        valueDomainCode,
        modifierKind: 'MINIMUM_ROLL',
        domain,
        payload: { amount }
      }).success
    expect(floor('ABILITY_CHECK', { ability: 'CHARISMA' }, 15)).toBe(true)
    expect(floor('ABILITY_CHECK', {}, 20)).toBe(true)
    expect(floor('ABILITY_CHECK', { ability: 'CHARISMA' }, 1)).toBe(false)
    expect(floor('ABILITY_CHECK', { ability: 'CHARISMA' }, 21)).toBe(false)
    expect(floor('SAVING_THROW_MODIFIER', { ability: 'WISDOM' }, 15)).toBe(false)
    for (const grant of unsupported) {
      const parsed = modifierGrantDtoSchema.safeParse(grant)
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues.map((issue) => issue.message).join(' ')).toContain(
        'not supported yet'
      )
    }
    const spellScoped = (valueDomainCode: string, attackDomain: string) => ({
      ...base,
      valueDomainCode,
      modifierKind: 'BONUS',
      domain: { attackDomain },
      payload: { valueKind: 'FIXED', amount: 1 },
      restrictions: {
        id: 'facet',
        groups: [
          {
            id: 'group',
            order: 0,
            contexts: [
              {
                id: 'context',
                order: 0,
                subject: 'SPELL',
                authoringModeKind: 'SELECTED',
                spellIds: ['eldritch-blast']
              }
            ]
          }
        ]
      }
    })
    expect(modifierGrantDtoSchema.safeParse(spellScoped('DAMAGE', 'SPELL')).success).toBe(true)
    expect(modifierGrantDtoSchema.safeParse(spellScoped('DAMAGE', 'MELEE')).success).toBe(false)
    expect(
      modifierGrantDtoSchema.safeParse({
        ...base,
        valueDomainCode: 'SPEED',
        modifierKind: 'SET_VALUE',
        domain: { speedId: 'fly' },
        payload: { amount: 60, unit: 'FEET' }
      }).success
    ).toBe(true)
    // SRD Shocking Grasp: the target can't take reactions (applied by a granted effect).
    expect(
      modifierGrantDtoSchema.safeParse({
        ...base,
        valueDomainCode: 'REACTION_COUNT',
        modifierKind: 'SET_VALUE',
        domain: {},
        payload: { amount: 0 }
      }).success
    ).toBe(true)
    // SRD Fighter Action Surge: the holder has two Actions for the turn (applied by a granted effect).
    expect(
      modifierGrantDtoSchema.safeParse({
        ...base,
        valueDomainCode: 'ACTION_COUNT',
        modifierKind: 'SET_VALUE',
        domain: {},
        payload: { amount: 2 }
      }).success
    ).toBe(true)
    // An armor class formula names the ability modifiers it adds (Unarmored Defense).
    const armorClassFormula = (payload: unknown) =>
      modifierGrantDtoSchema.safeParse({
        ...base,
        valueDomainCode: 'ARMOR_CLASS',
        modifierKind: 'SET_VALUE',
        domain: {},
        payload
      }).success
    expect(armorClassFormula({ amount: 10, abilities: ['DEXTERITY', 'CONSTITUTION'] })).toBe(true)
    expect(armorClassFormula({ amount: 13 })).toBe(false)
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
            authoringModeKind: 'SELECTED',
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
                  relationCode: 'CREATURE',
                  authoringModeKind: 'SELECTED',
                  creatureIds: ['war-horse'],
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
                            predicateCode: 'CREATURE_IS_MOUNT'
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
      groups: [
        {
          id: 'group-1',
          order: 1,
          contexts: [
            {
              id: 'context-1',
              order: 1,
              subject: 'SPELL',
              authoringModeKind: 'ALL',
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
      payload: { amount: 30, unit: 'FEET' }
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

  it('parses attack roll influence modifiers with their System influence code', () => {
    const parsed = modifierGrantDtoSchema.parse({
      grantKind: 'MODIFIER_GRANT',
      id: 'heavy-weapon-disadvantage',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'ATTACK_ROLL',
      domain: {
        attackDomain: 'MELEE'
      },
      modifierKind: 'ROLL_INFLUENCE',
      payload: { influence: 'DISADVANTAGE' },
      scope: 'SOURCE'
    })

    expect(parsed.valueDomainCode).toBe('ATTACK_ROLL')
    expect(parsed.modifierKind).toBe('ROLL_INFLUENCE')
    expect(parsed.payload).toEqual({ influence: 'DISADVANTAGE' })
  })

  it('refuses a roll influence modifier without an influence code', () => {
    expect(
      modifierGrantDtoSchema.safeParse({
        grantKind: 'MODIFIER_GRANT',
        id: 'heavy-weapon-disadvantage',
        order: 1,
        selectionKind: 'GRANTED',
        valueDomainCode: 'ATTACK_ROLL',
        domain: { attackDomain: 'MELEE' },
        modifierKind: 'ROLL_INFLUENCE',
        scope: 'SOURCE'
      }).success
    ).toBe(false)
  })

  it('parses ability-check and skill-check roll influences', () => {
    expect(
      modifierGrantDtoSchema.parse({
        grantKind: 'MODIFIER_GRANT',
        id: 'global-check-advantage',
        order: 1,
        selectionKind: 'GRANTED',
        valueDomainCode: 'ABILITY_CHECK',
        domain: {},
        modifierKind: 'ROLL_INFLUENCE',
        payload: { influence: 'ADVANTAGE' },
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
        modifierKind: 'ROLL_INFLUENCE',
        payload: { influence: 'DISADVANTAGE' },
        scope: 'GLOBAL'
      }).payload
    ).toEqual({ influence: 'DISADVANTAGE' })
  })

  it('parses a fixed penalty to ability checks, with or without an ability', () => {
    const penalty = (domain: object, payload: object) =>
      modifierGrantDtoSchema.safeParse({
        grantKind: 'MODIFIER_GRANT',
        id: 'check-penalty',
        order: 1,
        selectionKind: 'GRANTED',
        valueDomainCode: 'ABILITY_CHECK',
        domain,
        modifierKind: 'PENALTY',
        payload,
        scope: 'GLOBAL'
      }).success
    const fixed = { valueKind: 'FIXED', amount: 4 }
    expect(penalty({}, fixed)).toBe(true)
    expect(penalty({ ability: 'STRENGTH' }, fixed)).toBe(true)
    expect(penalty({}, { amount: 4 })).toBe(false)
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
      modifierKind: 'ROLL_INFLUENCE',
      payload: { influence: 'ADVANTAGE' },
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

  it('refuses an ALL-targeted grant that omits authoringModeKind', () => {
    expect(
      featGrantDtoSchema.safeParse({
        grantKind: 'FEAT_GRANT',
        id: 'implicit-all-bonus-feat',
        order: 1,
        selectionKind: 'GRANTED',
        scalingKind: 'NONE'
      }).success
    ).toBe(false)
  })

  it('refuses a per-level grant that carries a top-level target', () => {
    const perLevelGrant = {
      grantKind: 'FEAT_GRANT',
      id: 'per-level-feat',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'CHARACTER_LEVEL',
        levels: [
          { id: 'level-1', level: 1, order: 1, authoringModeKind: 'SELECTED', featIds: ['alert'] }
        ]
      }
    }

    expect(featGrantDtoSchema.safeParse(perLevelGrant).success).toBe(true)
    expect(
      featGrantDtoSchema.safeParse({ ...perLevelGrant, authoringModeKind: 'ALL' }).success
    ).toBe(false)
  })

  it('refuses a facet context that omits its authoringModeKind', () => {
    const facetWithContext = (context: Record<string, unknown>) => ({
      id: 'context-mode-facet',
      groups: [{ id: 'group-1', order: 1, contexts: [context] }]
    })
    const spellContext = { id: 'context-1', order: 1, subject: 'SPELL' }

    expect(
      facetDtoSchema.safeParse(facetWithContext({ ...spellContext, authoringModeKind: 'ALL' }))
        .success
    ).toBe(true)
    expect(facetDtoSchema.safeParse(facetWithContext(spellContext)).success).toBe(false)
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
          senseIds: ['darkvision'],
          range: { id: 'chosen-sense-range', rangeKind: 'UNLIMITED' }
        },
        granted: {
          grantKind: 'SENSE_GRANT',
          id: 'granted-sense',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          senseIds: ['darkvision'],
          range: { id: 'granted-sense-range', rangeKind: 'UNLIMITED' }
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
