import { describe, expect, it } from 'vitest'

import { effectDtoSchema, invocationDtoSchema } from '../effects/effect.js'
import { backgroundListResponseDtoSchema, spellResponseDtoSchema } from '../api/content.js'
import {
  resourceIdParamsDtoSchema,
  systemAuthoredDtoSchema,
  systemListResponseDtoSchema
} from '../index.js'
import { creatureAuthoredDtoSchema } from '../subjects/creature.js'
import { equipmentAuthoredDtoSchema } from '../subjects/equipment.js'
import { featAuthoredDtoSchema } from '../subjects/feat.js'
import { raceAuthoredDtoSchema } from '../subjects/race.js'
import { spellAuthoredDtoSchema } from '../subjects/spell.js'
import { systemVocabularySnapshotSchema } from '../projections/systemVocabulary.js'

function singleResultBlock(
  id: string,
  outcome: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    resultKind: 'SINGLE',
    outcomes: [outcome],
    ...extra
  }
}

function fixedPath(
  id: string,
  order: number,
  pathCode: string,
  resultBlock: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    order,
    pathCode,
    groupType: 'SINGLE',
    selectionKind: 'FIXED',
    resultBlock,
    ...extra
  }
}

describe('subject schema parsing', () => {
  it('parses a spell with effect-owned range/shape and structured scaling', () => {
    const parsed = spellAuthoredDtoSchema.parse({
      kind: 'SPELL',
      id: 'burning-hands',
      label: 'Burning Hands',
      description: 'Each creature in a 15-foot cone must make a Dexterity saving throw.',
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      level: 1,
      classIds: ['wizard', 'sorcerer'],
      magicSchoolId: 'evocation',
      effects: [
        {
          id: '00000000-0000-4000-8000-0000000000d1',
          order: 1,
          invocation: {
            triggerCode: 'SAVING_THROW',
            savingThrow: {
              id: 'burning-hands-save',
              dcMethod: 'SOURCE_SAVE_DC',
              abilityDefinitionId: '00000000-0000-0000-0011-000200000000'
            },
            activation: {
              code: 'ACTION',
              amount: 1
            },
            range: {
              id: 'burning-hands-effect-range',
              rangeKind: 'SELF'
            },
            targeting: {
              selectionKind: 'AREA_CONTENTS'
            },
            shape: {
              id: 'burning-hands-cone',
              shapeKind: 'CONE',
              length: {
                amount: 15,
                unit: 'FEET'
              }
            }
          },
          paths: [
            fixedPath(
              'burning-hands-damage',
              1,
              'ON_SAVE_FAIL',
              singleResultBlock('burning-hands-result', {
                id: 'burning-hands-damage-entry',
                effectKind: 'DAMAGE',
                damageTypeId: 'fire',
                valueKind: 'DICE',
                scalingKind: 'PER_LEVEL',
                scalingSource: 'SPELL_CAST_LEVEL',
                levels: [
                  {
                    id: 'burning-hands-level-1',
                    level: 1,
                    order: 1,
                    diceConfig: '3d6'
                  },
                  {
                    id: 'burning-hands-level-2',
                    level: 2,
                    order: 2,
                    diceConfig: '4d6'
                  }
                ]
              })
            )
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    }) as {
      effects?: Array<{
        invocation: {
          range: { rangeKind: string }
          targeting?: { selectionKind?: string }
        }
        paths?: Array<{ resultBlock?: { outcomes?: Array<Record<string, unknown>> } }>
      }>
    }

    expect(parsed.effects?.[0]?.invocation.range.rangeKind).toBe('SELF')
    expect(parsed.effects?.[0]?.invocation.targeting?.selectionKind).toBe('AREA_CONTENTS')
    expect(parsed.effects?.[0]?.paths?.[0]?.resultBlock?.outcomes?.[0]).toMatchObject({
      scalingKind: 'PER_LEVEL',
      scalingSource: 'SPELL_CAST_LEVEL'
    })
  })

  it('parses richer invocation targeting qualifiers for multi-target effects', () => {
    const parsed = effectDtoSchema.parse({
      id: '00000000-0000-4000-8000-0000000000d2',
      order: 1,
      invocation: {
        triggerCode: 'RANGED_SPELL_ATTACK',
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'mass-cure-wounds-range',
          rangeKind: 'DISTANCE',
          amount: 60,
          unit: 'FEET'
        },
        shape: {
          id: 'mass-cure-wounds-shape',
          shapeKind: 'SPHERE',
          radius: {
            amount: 30,
            unit: 'FEET'
          }
        },
        targeting: {
          selectionKind: 'CHOSEN_CREATURES',
          maxTargets: 6,
          excludedCreatureTypeIds: ['undead', 'construct']
        }
      },
      paths: [
        fixedPath(
          'mass-cure-wounds-heal',
          1,
          'ON_CAST',
          singleResultBlock('mass-cure-wounds-result', {
            id: 'mass-cure-wounds-heal-entry',
            effectKind: 'HEAL',
            valueKind: 'DICE',
            scalingKind: 'PER_LEVEL',
            scalingSource: 'SPELL_CAST_LEVEL',
            levels: [
              {
                id: 'mass-cure-wounds-level-5',
                level: 5,
                order: 1,
                diceConfig: '3d8'
              }
            ]
          })
        )
      ]
    }) as {
      invocation?: {
        targeting?: {
          selectionKind?: string
          maxTargets?: number
          excludedCreatureTypeIds?: string[]
        }
      }
    }

    expect(parsed.invocation?.targeting).toMatchObject({
      selectionKind: 'CHOSEN_CREATURES',
      maxTargets: 6,
      excludedCreatureTypeIds: ['undead', 'construct']
    })
  })

  it.each(['SINGLE_TARGET', 'CHOSEN_CREATURES', 'AREA_CONTENTS'] as const)(
    'parses the creature types a %s effect is restricted to',
    (selectionKind) => {
      const { targeting } = invocationDtoSchema.parse({
        triggerCode: 'RANGED_SPELL_ATTACK',
        activation: { code: 'ACTION', amount: 1 },
        range: { id: 'hold-person-range', rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' },
        targeting: {
          selectionKind,
          dispositionKind: 'ANY',
          allowedCreatureTypeIds: ['humanoid']
        }
      })
      expect(targeting).toMatchObject({ selectionKind, allowedCreatureTypeIds: ['humanoid'] })
    }
  )

  it('rejects legacy placeholder values once nested enums are tightened', () => {
    expect(() =>
      effectDtoSchema.parse({
        id: '00000000-0000-4000-8000-0000000000d3',
        order: 1,
        invocation: {
          triggerCode: 'SAVING_THROW',
          savingThrow: {
            id: 'dex-save',
            dcMethod: 'FIXED_DC',
            abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
            baseDc: 13
          },
          activation: {
            code: 'ACTION',
            amount: 1
          },
          range: {
            id: 'self-range',
            rangeKind: 'SELF'
          }
        },
        paths: [
          fixedPath(
            'bad-moment',
            1,
            'IMMEDIATE',
            singleResultBlock('bad-result', {
              id: 'bad-moment-entry',
              effectKind: 'DAMAGE',
              damageTypeId: 'fire',
              valueKind: 'DICE',
              scalingKind: 'NONE',
              diceConfig: '3d6'
            })
          )
        ]
      })
    ).toThrow()
  })

  it('parses system vocabulary payloads and transport wrappers', () => {
    const system = systemAuthoredDtoSchema.parse({
      id: 'dnd-5e-srd',
      label: 'D&D 5e SRD',
      description: 'Baseline SRD system data.',
      rulesetCode: 'dnd5e',
      rulesetVersion: '2014',
      alignments: [],
      challengeRatings: [],
      conditionTypes: [],
      creatureTypes: [],
      currencies: [],
      damageTypes: [],
      heritages: [],
      languages: [],
      lifestyles: [],
      magicSchools: [],
      passives: [],
      rarities: [],
      senses: [],
      skills: [],
      speeds: [],
      terrains: [],
      userId: 'master',
      schemaVersion: 4,
      abilities: []
    })

    const list = systemListResponseDtoSchema.parse([
      {
        id: system.id,
        label: system.label,
        description: system.description,
        rulesetCode: system.rulesetCode,
        rulesetVersion: system.rulesetVersion,
        rulesCatalogues: [],
        userId: system.userId
      }
    ]) as { label?: string }[]

    const params = resourceIdParamsDtoSchema.parse({ id: system.id })

    expect(list[0]?.label).toBe('D&D 5e SRD')
    expect(system.rulesetCode).toBe('dnd5e')
    expect(system.rulesetVersion).toBe('2014')
    expect(params.id).toBe(system.id)
  })

  it('refuses System documents and snapshots of every retired version', () => {
    const ability = {
      id: '00000000-0000-0000-0011-000300000000',
      code: 'CONSTITUTION',
      label: 'Constitution'
    }
    const v1 = {
      id: 'dnd-5e-srd',
      label: 'D&D 5e SRD',
      rulesetCode: 'dnd5e',
      rulesetVersion: '2014',
      alignments: [],
      challengeRatings: [],
      conditionTypes: [],
      creatureTypes: [],
      currencies: [],
      damageTypes: [],
      heritages: [],
      languages: [],
      lifestyles: [],
      magicSchools: [],
      passives: [],
      rarities: [],
      senses: [],
      skills: [],
      speeds: [],
      terrains: [],
      userId: 'master'
    }
    const v2 = { ...v1, schemaVersion: 2, abilities: [ability] }
    const v3 = {
      ...v2,
      schemaVersion: 3,
      initiativePolicy: { defaultDefinitionId: '00000000-0000-4000-8000-000000000002' }
    }
    expect(
      systemAuthoredDtoSchema.parse({ ...v1, schemaVersion: 4, abilities: [ability] })
    ).toMatchObject({
      schemaVersion: 4
    })
    for (const retired of [v1, v2, v3]) {
      expect(systemAuthoredDtoSchema.safeParse(retired).success).toBe(false)
    }
    expect(
      systemVocabularySnapshotSchema.safeParse({
        snapshotId: '00000000-0000-4000-8000-000000000001',
        systemId: v1.id,
        snapshotVersion: 1,
        schemaVersion: 1,
        checksum: 'a'.repeat(64),
        document: v1
      }).success
    ).toBe(false)
  })

  it('requires v4 check definitions to be UUID-backed and governed by a local ability', () => {
    const abilityId = '00000000-0000-0000-0011-000300000000'
    const v4 = {
      id: 'dnd-5e-srd',
      label: 'D&D 5e SRD',
      rulesetCode: 'dnd5e',
      rulesetVersion: '2014',
      alignments: [],
      abilities: [{ id: abilityId, code: 'CONSTITUTION', label: 'Constitution' }],
      challengeRatings: [],
      conditionTypes: [],
      creatureTypes: [],
      currencies: [],
      damageTypes: [],
      heritages: [],
      languages: [],
      lifestyles: [],
      magicSchools: [],
      passives: [],
      rarities: [],
      senses: [],
      skills: [
        {
          id: '00000000-0000-0000-000b-000100000000',
          code: 'ATHLETICS',
          label: 'Athletics',
          governingAbilityDefinitionId: abilityId
        }
      ],
      speeds: [],
      terrains: [],
      userId: 'master',
      schemaVersion: 4 as const
    }
    expect(systemAuthoredDtoSchema.parse(v4)).toMatchObject({ schemaVersion: 4 })
    expect(() =>
      systemAuthoredDtoSchema.parse({
        ...v4,
        skills: [
          {
            ...v4.skills[0],
            governingAbilityDefinitionId: '00000000-0000-0000-0011-000400000000'
          }
        ]
      })
    ).toThrow()
    expect(() =>
      systemAuthoredDtoSchema.parse({ ...v4, skills: [v4.skills[0], v4.skills[0]] })
    ).toThrow()
    expect(
      systemAuthoredDtoSchema.parse({
        ...v4,
        abilities: [],
        skills: [{ ...v4.skills[0], governingAbilityDefinitionId: null }]
      })
    ).toMatchObject({ schemaVersion: 4 })
  })

  it('requires a v4 passive to name a skill of the same System, or none', () => {
    const skillId = '00000000-0000-0000-000b-000100000000'
    const abilityId = '00000000-0000-0000-000a-000100000000'
    const v4 = {
      id: 'dnd-5e-srd',
      label: 'D&D 5e SRD',
      rulesetCode: 'dnd5e',
      rulesetVersion: '2014',
      alignments: [],
      abilities: [{ id: abilityId, code: 'STRENGTH', label: 'Strength' }],
      challengeRatings: [],
      conditionTypes: [],
      creatureTypes: [],
      currencies: [],
      damageTypes: [],
      heritages: [],
      languages: [],
      lifestyles: [],
      magicSchools: [],
      passives: [
        {
          id: '00000000-0000-0000-000d-000100000000',
          code: 'PASSIVE_ATHLETICS',
          label: 'Passive Athletics',
          skillDefinitionId: skillId,
          abilityDefinitionId: abilityId
        }
      ],
      rarities: [],
      senses: [],
      skills: [
        { id: skillId, code: 'ATHLETICS', label: 'Athletics', governingAbilityDefinitionId: null }
      ],
      speeds: [],
      terrains: [],
      userId: 'master',
      schemaVersion: 4 as const
    }
    expect(systemAuthoredDtoSchema.parse(v4)).toMatchObject({ schemaVersion: 4 })
    expect(() =>
      systemAuthoredDtoSchema.parse({
        ...v4,
        passives: [{ ...v4.passives[0], skillDefinitionId: '00000000-0000-0000-000b-000200000000' }]
      })
    ).toThrow()
    expect(
      systemAuthoredDtoSchema.parse({
        ...v4,
        passives: [{ ...v4.passives[0], skillDefinitionId: null }]
      })
    ).toMatchObject({ schemaVersion: 4 })
    expect(() =>
      systemAuthoredDtoSchema.parse({
        ...v4,
        passives: [
          { ...v4.passives[0], abilityDefinitionId: '00000000-0000-0000-000a-000200000000' }
        ]
      })
    ).toThrow()
  })

  it('parses feat prerequisites authored on CHARACTER facets', () => {
    const feat = featAuthoredDtoSchema.parse({
      id: 'feat-elven-accuracy',
      label: 'Elven Accuracy',
      description: 'You have uncanny aim.',
      prerequisites: {
        id: 'feat-prereq-1',
        groups: [
          {
            id: 'feat-prereq-group-1',
            order: 1,
            contexts: [
              {
                id: 'feat-prereq-context-1',
                order: 1,
                subject: 'CHARACTER',
                conditions: [
                  {
                    id: 'feat-prereq-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'HERITAGE',
                    authoringModeKind: 'SELECTED',
                    heritageIds: ['heritage-elven']
                  }
                ]
              }
            ]
          }
        ]
      },
      userId: 'master',
      systemId: 'system-1'
    })

    expect(feat.prerequisites?.groups[0]?.contexts[0]?.conditions?.[0]).toMatchObject({
      predicateCode: 'HERITAGE',
      heritageIds: ['heritage-elven']
    })
  })

  it('parses feat grants authored directly on feats', () => {
    const feat = featAuthoredDtoSchema.parse({
      id: 'feat-chain',
      label: 'Feat Chain',
      description: 'Unlocks a related feat.',
      details: [
        {
          id: 'feat-chain-detail',
          label: 'Detail',
          description: 'Feat prose.',
          order: 1
        }
      ],
      grants: {
        feats: [
          {
            id: 'feat-grant-1',
            order: 1,
            grantKind: 'FEAT_GRANT',
            selectionKind: 'GRANTED',
            scalingKind: 'NONE',
            authoringModeKind: 'SELECTED',
            featIds: ['grappler']
          }
        ]
      },
      userId: 'user-1',
      systemId: 'system-1'
    })

    expect(feat.grants?.feats?.[0]).toMatchObject({
      grantKind: 'FEAT_GRANT',
      featIds: ['grappler']
    })
    expect(feat.details?.[0]?.label).toBe('Detail')
    expect(() =>
      featAuthoredDtoSchema.parse({
        id: 'legacy-feat',
        label: 'Legacy Feat',
        description: 'Old shape.',
        detail: 'Old prose.',
        userId: 'user-1',
        systemId: 'system-1'
      })
    ).toThrow()
  })

  it('parses race heritage memberships', () => {
    const race = raceAuthoredDtoSchema.parse({
      id: 'race-half-elf',
      label: 'Half-Elf',
      description: 'Bridges two lineages.',
      heritageIds: ['heritage-human', 'heritage-elven'],
      userId: 'master',
      systemId: 'system-1',
      category: 'BASE',
      selectionMode: 'DIRECT',
      size: 'MEDIUM',
      speeds: [
        {
          speedId: 'walk',
          amount: 30,
          unit: 'FEET'
        }
      ]
    })

    expect(race).toMatchObject({
      category: 'BASE',
      heritageIds: ['heritage-human', 'heritage-elven']
    })
  })

  it('parses category-driven creatures with category-specific profile data', () => {
    const creature = creatureAuthoredDtoSchema.parse({
      id: 'river-hart',
      label: 'River Hart',
      description: 'A sure-footed beast trained for river crossings.',
      quote: 'It lowers its antlers when the water rises.',
      status: 'ACTIVE',
      category: 'BEAST',
      creatureTypeId: 'beast',
      size: 'LARGE',
      userId: 'user-1',
      systemId: 'system-1',
      abilityScores: {
        STRENGTH: 18,
        DEXTERITY: 14,
        CONSTITUTION: 15,
        INTELLIGENCE: 3,
        WISDOM: 12,
        CHARISMA: 7
      },
      naturalArmorBonus: 1,
      hitPoints: 32,
      speeds: [{ speedId: 'walk', amount: 50, unit: 'FEET' }],
      details: [],
      proficiencies: [],
      senses: [],
      damageVulnerabilities: [],
      damageResistances: [],
      damageImmunities: [],
      qualifiedDamageDefenses: [],
      conditionImmunities: [],
      features: [
        {
          id: 'gore',
          label: 'Gore',
          description: 'Melee weapon attack.',
          section: 'ACTION',
          order: 1
        }
      ],
      cost: { amount: 75, currencyId: 'gold' },
      carryingCapacity: { amount: 480, unit: 'POUNDS' },
      logisticsNotes: ['Can carry a rider and light travel gear.'],
      mountProfile: {
        mountType: 'CONTROLLED',
        riderCount: 1,
        notes: 'Trained for shallow river crossings.'
      }
    })

    expect(creature.category).toBe('BEAST')
    expect(creature.mountProfile?.riderCount).toBe(1)
    expect(creature.features[0]?.section).toBe('ACTION')
  })

  it('normalizes creature logistics-note editor rows to the canonical string array', () => {
    const creature = creatureAuthoredDtoSchema.parse({
      id: 'pack-hart',
      label: 'Pack Hart',
      category: 'BEAST',
      creatureTypeId: 'beast',
      size: 'LARGE',
      userId: 'user-1',
      systemId: 'system-1',
      abilityScores: {
        STRENGTH: 18,
        DEXTERITY: 14,
        CONSTITUTION: 15,
        INTELLIGENCE: 3,
        WISDOM: 12,
        CHARISMA: 7
      },
      naturalArmorBonus: 1,
      hitPoints: 32,
      speeds: [],
      features: [],
      details: [],
      proficiencies: [],
      senses: [],
      damageVulnerabilities: [],
      damageResistances: [],
      damageImmunities: [],
      qualifiedDamageDefenses: [],
      conditionImmunities: [],
      logisticsNotes: [{ value: 'Can carry a rider.' }, 'Requires a saddle.']
    })

    expect(creature.logisticsNotes).toEqual(['Can carry a rider.', 'Requires a saddle.'])
  })

  it.each([
    'speeds',
    'details',
    'features',
    'proficiencies',
    'senses',
    'damageVulnerabilities',
    'damageResistances',
    'damageImmunities',
    'qualifiedDamageDefenses',
    'conditionImmunities'
  ])('refuses a Creature without its %s array, which is empty when it has none', (key) => {
    const creature: Record<string, unknown> = {
      id: 'bare-hart',
      label: 'Bare Hart',
      category: 'BEAST',
      creatureTypeId: 'beast',
      size: 'LARGE',
      userId: 'user-1',
      systemId: 'system-1',
      abilityScores: {
        STRENGTH: 18,
        DEXTERITY: 14,
        CONSTITUTION: 15,
        INTELLIGENCE: 3,
        WISDOM: 12,
        CHARISMA: 7
      },
      naturalArmorBonus: 1,
      hitPoints: 32,
      speeds: [],
      features: [],
      details: [],
      proficiencies: [],
      senses: [],
      damageVulnerabilities: [],
      damageResistances: [],
      damageImmunities: [],
      qualifiedDamageDefenses: [],
      conditionImmunities: []
    }
    expect(creatureAuthoredDtoSchema.safeParse(creature).success).toBe(true)
    delete creature[key]
    expect(creatureAuthoredDtoSchema.safeParse(creature).success).toBe(false)
  })

  it('parses authored content list and single-resource transport wrappers', () => {
    const list = backgroundListResponseDtoSchema.parse({
      items: [
        {
          id: 'acolyte',
          publicId: 'acolyte',
          activeUpdatedAt: '2026-01-01T00:00:00.000Z',
          label: 'Acolyte',
          description: 'Temple-trained background.',
          status: 'ACTIVE',
          userId: 'master',
          systemId: 'dnd-5e-srd',
          provenance: {
            kind: 'MASTER',
            ownerUserId: null
          },
          permissions: {
            canView: true,
            canEdit: false,
            canCopy: true,
            canDelete: false
          }
        }
      ],
      drafts: [],
      meta: {
        total: 1
      },
      page: {
        nextCursor: null,
        previousCursor: null,
        totalCount: 1
      },
      summary: {
        activeCount: 1,
        masterCount: 1,
        ownedCount: 0
      }
    }) as { items: { id?: string }[] }

    const spell = spellResponseDtoSchema.parse({
      publicId: 'magic-missile',
      activeUpdatedAt: '2026-01-01T00:00:00.000Z',
      hasDraft: false,
      item: {
        kind: 'SPELL',
        id: 'magic-missile',
        label: 'Magic Missile',
        description: 'Force darts.',
        castingTime: {
          unit: 'ROUND',
          amount: 1
        },
        level: 1,
        classIds: ['wizard'],
        magicSchoolId: 'evocation',
        userId: 'master',
        systemId: 'dnd-5e-srd'
      },
      provenance: {
        kind: 'MASTER',
        ownerUserId: null
      },
      permissions: {
        canView: true,
        canEdit: false,
        canCopy: true,
        canDelete: false
      }
    }) as { item?: { id?: string }; permissions?: { canEdit?: boolean } }

    const draftOnlySpell = spellResponseDtoSchema.parse({
      publicId: 'draft-spell',
      activeUpdatedAt: null,
      hasDraft: true,
      item: null,
      draft: {
        subjectKind: 'SPELL',
        subjectId: 'draft-spell-id',
        publicId: 'draft-spell',
        userId: 'user-1',
        systemId: 'dnd-5e-srd',
        label: 'Broken Draft Spell',
        status: 'DRAFT',
        draftState: 'DRAFT_ONLY',
        baseActiveUpdatedAt: null,
        payload: {}
      },
      provenance: {
        kind: 'OWNED',
        ownerUserId: 'user-1'
      },
      permissions: {
        canView: true,
        canEdit: true,
        canCopy: false,
        canDelete: true
      },
      validationIssues: [
        {
          code: 'invalid_type',
          message: 'Required input is missing',
          path: ['castingTime', 'unit']
        }
      ]
    }) as {
      item?: unknown
      draft?: { label?: string }
      validationIssues?: Array<{ path: Array<string | number> }>
    }

    expect(list.items[0]?.id).toBe('acolyte')
    expect(spell?.permissions?.canEdit).toBe(false)
    expect(draftOnlySpell?.item).toBeNull()
    expect(draftOnlySpell?.draft?.label).toBe('Broken Draft Spell')
    expect(draftOnlySpell?.validationIssues?.[0]?.path).toEqual(['castingTime', 'unit'])
  })

  it('parses equipment attunement and limits equipment requirements to character facets', () => {
    const equipment = {
      kind: 'EQUIPMENT',
      id: 'equipment-attuned',
      label: 'Attuned Item',
      description: null,
      rarityId: 'rare',
      userId: 'user-1',
      systemId: 'system-1',
      weight: { amount: 1, unit: 'POUNDS' },
      properties: [],
      category: 'ADVENTURING_GEAR',
      requiresAttunement: true,
      restrictions: {
        id: 'equipment-requirements',
        groups: [
          {
            id: 'equipment-requirement-group',
            order: 1,
            contexts: [
              {
                id: 'equipment-requirement-context',
                order: 1,
                subject: 'CHARACTER'
              }
            ]
          }
        ]
      }
    } as const

    expect(equipmentAuthoredDtoSchema.parse(equipment)).toMatchObject({
      requiresAttunement: true,
      restrictions: {
        groups: [{ contexts: [{ subject: 'CHARACTER' }] }]
      }
    })
    expect(() =>
      equipmentAuthoredDtoSchema.parse({
        ...equipment,
        restrictions: {
          ...equipment.restrictions,
          groups: [
            {
              ...equipment.restrictions.groups[0],
              contexts: [
                {
                  ...equipment.restrictions.groups[0].contexts[0],
                  subject: 'EQUIPMENT'
                }
              ]
            }
          ]
        }
      })
    ).toThrow()
    expect(() =>
      equipmentAuthoredDtoSchema.parse({
        ...equipment,
        restrictions: {
          ...equipment.restrictions,
          groups: [
            {
              ...equipment.restrictions.groups[0],
              contexts: [
                {
                  ...equipment.restrictions.groups[0].contexts[0],
                  conditions: [
                    {
                      id: 'invalid-range-condition',
                      order: 1,
                      kind: 'PREDICATE',
                      constraint: 'INCLUDE',
                      predicateCode: 'RANGE',
                      rangeKind: ['DISTANCE']
                    }
                  ]
                }
              ]
            }
          ]
        }
      })
    ).toThrow(/not valid for CHARACTER/)
  })
})
