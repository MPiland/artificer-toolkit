import { describe, expect, it } from 'vitest'
import { createEquipmentRepository } from '../repositories/equipment.js'
import { createFeatGrantRepository } from '../repositories/feat-grant.js'
import { createModifierGrantRepository } from '../repositories/modifier-grant.js'
import { createProficiencyGrantRepository } from '../repositories/proficiency-grant.js'
import { createSenseGrantRepository } from '../repositories/sense-grant.js'
import { createSpellGrantRepository } from '../repositories/spell-grant.js'
import { hydrateFacetById, upsertFacet } from '../domains/shared/facets.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

describe('facet-backed owners round-trip', () => {
  it('round-trips equipment restrictions', async () => {
    const db = new InMemoryDb()
    const repository = createEquipmentRepository(db as never)

    await repository.upsert({
      kind: 'EQUIPMENT',
      id: 'equipment-facet-owner-1',
      label: 'Wardblade',
      description: 'Protected by restrictions.',
      cost: { amount: 20, currencyId: 'gp' },
      weight: { amount: 3, unit: 'POUNDS' },
      rarityId: 'common',
      userId: 'user-1',
      systemId: 'system-1',
      properties: ['MARTIAL'],
      category: 'WEAPON',
      abilities: [],
      restrictions: {
        id: 'equipment-facet-1',
        groups: [
          {
            id: 'equipment-facet-group-1',
            order: 1,
            contexts: [
              {
                id: 'equipment-facet-context-1',
                order: 1,
                subject: 'EQUIPMENT',
                authoringModeKind: 'ALL',
                conditions: [
                  {
                    id: 'equipment-facet-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'RANGE',
                    authoringModeKind: 'SELECTED',
                    rangeKind: ['DISTANCE'],
                    min: 30,
                    max: 60,
                    unit: 'FEET'
                  }
                ]
              }
            ]
          }
        ]
      }
    })

    await expect(repository.findById('equipment-facet-owner-1')).resolves.toEqual({
      kind: 'EQUIPMENT',
      id: 'equipment-facet-owner-1',
      label: 'Wardblade',
      description: 'Protected by restrictions.',
      attributes: undefined,
      quote: undefined,
      cost: { amount: 20, currencyId: 'gp' },
      weight: { amount: 3, unit: 'POUNDS' },
      effects: undefined,
      charges: undefined,
      capacity: undefined,
      modifiers: undefined,
      maxStack: undefined,
      rarityId: 'common',
      maxBonus: undefined,
      armorClass: undefined,
      contains: undefined,
      features: undefined,
      restrictions: {
        id: 'equipment-facet-1',
        groups: [
          {
            id: 'equipment-facet-group-1',
            order: 1,
            contexts: [
              {
                id: 'equipment-facet-context-1',
                order: 1,
                subject: 'EQUIPMENT',
                authoringModeKind: 'ALL',
                conditions: [
                  {
                    id: 'equipment-facet-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'RANGE',
                    authoringModeKind: 'SELECTED',
                    rangeKind: ['DISTANCE'],
                    min: 30,
                    max: 60,
                    unit: 'FEET'
                  }
                ]
              }
            ]
          }
        ]
      },
      userId: 'user-1',
      systemId: 'system-1',
      properties: ['MARTIAL'],
      category: 'WEAPON',
      abilities: [],
      speed: undefined
    })
  })

  it('round-trips feat, sense, proficiency, modifier, and spell grant facets', async () => {
    const db = new InMemoryDb()
    const featRepository = createFeatGrantRepository(db as never)
    const senseRepository = createSenseGrantRepository(db as never)
    const proficiencyRepository = createProficiencyGrantRepository(db as never)
    const modifierRepository = createModifierGrantRepository(db as never, 'system-1')
    const spellRepository = createSpellGrantRepository(db as never)

    await featRepository.upsert({
      id: 'feat-grant-facet-1',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      featIds: ['feat-a'],
      restrictions: {
        id: 'feat-grant-facet-1-restrictions',
        groups: [
          {
            id: 'feat-grant-facet-group-1',
            order: 1,
            contexts: [
              {
                id: 'feat-grant-facet-context-1',
                order: 1,
                subject: 'FEAT',
                authoringModeKind: 'ALL',
                conditions: [
                  {
                    id: 'feat-grant-facet-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'DAMAGE_TYPE',
                    authoringModeKind: 'SELECTED',
                    damageTypeIds: ['fire']
                  }
                ]
              }
            ]
          }
        ]
      }
    })

    await senseRepository.upsert({
      id: 'sense-grant-facet-1',
      grantKind: 'SENSE_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      senseIds: ['darkvision'],
      restrictions: {
        id: 'sense-grant-facet-1-restrictions',
        groups: [
          {
            id: 'sense-grant-facet-group-1',
            order: 1,
            contexts: [
              {
                id: 'sense-grant-facet-context-1',
                order: 1,
                subject: 'CHARACTER',
                conditions: [
                  {
                    id: 'sense-grant-facet-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'FEATURE_OBTAINED',
                    featureIds: ['feature-a']
                  }
                ]
              }
            ]
          }
        ]
      }
    })

    await proficiencyRepository.upsert({
      id: 'proficiency-grant-facet-1',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'SKILL',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      skillIds: ['arcana'],
      level: 'FULL',
      restrictions: {
        id: 'proficiency-grant-facet-1-restrictions',
        groups: [
          {
            id: 'proficiency-grant-facet-group-1',
            order: 1,
            contexts: [
              {
                id: 'proficiency-grant-facet-context-1',
                order: 1,
                subject: 'CLASS',
                authoringModeKind: 'ALL',
                conditions: [
                  {
                    id: 'proficiency-grant-facet-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'SPELLCASTING'
                  }
                ]
              }
            ]
          }
        ]
      }
    })

    await modifierRepository.upsert({
      id: 'modifier-grant-facet-1',
      grantKind: 'MODIFIER_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'ARMOR_CLASS',
      domain: {},
      modifierKind: 'SET_VALUE',
      scope: 'GLOBAL',
      payload: { amount: 18 },
      restrictions: {
        id: 'modifier-grant-facet-1-restrictions',
        groups: [
          {
            id: 'modifier-grant-facet-group-1',
            order: 1,
            contexts: [
              {
                id: 'modifier-grant-facet-context-1',
                order: 1,
                subject: 'CHARACTER',
                conditions: [
                  {
                    id: 'modifier-grant-facet-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'CHARACTER_LEVEL',
                    min: 7
                  }
                ]
              }
            ]
          }
        ]
      }
    })

    await spellRepository.upsert({
      id: 'spell-grant-facet-1',
      grantKind: 'SPELL_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      spellIds: ['spell-a'],
      restrictions: {
        id: 'spell-grant-facet-1-restrictions',
        groups: [
          {
            id: 'spell-grant-facet-group-1',
            order: 1,
            contexts: [
              {
                id: 'spell-grant-facet-context-1',
                order: 1,
                subject: 'SPELL',
                authoringModeKind: 'ALL',
                conditions: [
                  {
                    id: 'spell-grant-facet-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'CONCENTRATION'
                  }
                ]
              }
            ]
          }
        ]
      },
      filters: {
        id: 'spell-grant-filter-1',
        groups: [
          {
            id: 'spell-grant-filter-group-1',
            order: 1,
            contexts: [
              {
                id: 'spell-grant-filter-context-1',
                order: 1,
                subject: 'SPELL',
                authoringModeKind: 'ALL',
                conditions: [
                  {
                    id: 'spell-grant-filter-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'SPELL_LEVEL',
                    min: 1,
                    max: 3
                  },
                  {
                    id: 'spell-grant-filter-condition-2',
                    order: 2,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'DURATION',
                    authoringModeKind: 'SELECTED',
                    durationKind: ['MINUTE'],
                    min: 10,
                    max: 60
                  }
                ]
              }
            ]
          }
        ]
      }
    })

    await expect(featRepository.findById('feat-grant-facet-1')).resolves.toMatchObject({
      restrictions: {
        id: 'feat-grant-facet-1-restrictions'
      }
    })
    await expect(senseRepository.findById('sense-grant-facet-1')).resolves.toMatchObject({
      restrictions: {
        id: 'sense-grant-facet-1-restrictions'
      }
    })
    await expect(proficiencyRepository.findById('proficiency-grant-facet-1')).resolves.toMatchObject({
      restrictions: {
        id: 'proficiency-grant-facet-1-restrictions'
      }
    })
    await expect(modifierRepository.findById('modifier-grant-facet-1')).resolves.toMatchObject({
      restrictions: {
        id: 'modifier-grant-facet-1-restrictions'
      }
    })
    await expect(spellRepository.findById('spell-grant-facet-1')).resolves.toMatchObject({
      restrictions: {
        id: 'spell-grant-facet-1-restrictions'
      },
      filters: {
        id: 'spell-grant-filter-1',
        groups: [
          {
            contexts: [
              {
                conditions: [
                  {
                    predicateCode: 'SPELL_LEVEL',
                    min: 1,
                    max: 3
                  },
                  {
                    predicateCode: 'DURATION',
                    authoringModeKind: 'SELECTED',
                    durationKind: ['MINUTE'],
                    min: 10,
                    max: 60
                  }
                ]
              }
            ]
          }
        ]
      }
    })
  })

  it('round-trips size facets through the shared facet helper and charge-kind facets through owner repositories', async () => {
    const db = new InMemoryDb()
    const modifierRepository = createModifierGrantRepository(db as never, 'system-1')

    await upsertFacet(db as never, {
      id: 'size-facet-1',
      groups: [
        {
          id: 'size-group-1',
          order: 1,
          contexts: [
            {
              id: 'size-context-1',
              order: 1,
              subject: 'RACE',
              authoringModeKind: 'ALL',
              conditions: [
                {
                  id: 'size-condition-1',
                  order: 1,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'SIZE',
                  authoringModeKind: 'SELECTED',
                  sizes: ['MEDIUM', 'LARGE']
                }
              ]
            }
          ]
        }
      ]
    } as never)

    await modifierRepository.upsert({
      id: 'modifier-charge-kinds-1',
      grantKind: 'MODIFIER_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'SAVE_DC',
      domain: {},
      modifierKind: 'ADVANTAGE',
      scope: 'GLOBAL',
      restrictions: {
        id: 'modifier-charge-facet-1',
        groups: [
          {
            id: 'modifier-charge-group-1',
            order: 1,
            contexts: [
              {
                id: 'modifier-charge-context-1',
                order: 1,
                subject: 'RESOURCE',
                authoringModeKind: 'ALL',
                conditions: [
                  {
                    id: 'modifier-charge-limit-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'CHARGE_LIMIT_KIND',
                    authoringModeKind: 'SELECTED',
                    chargeLimitKind: ['FIXED_AMOUNT', 'CLASS_LEVEL']
                  },
                  {
                    id: 'modifier-charge-reset-condition-1',
                    order: 2,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'CHARGE_RESET_KIND',
                    authoringModeKind: 'SELECTED',
                    chargeResetKind: ['LONG_REST', 'SHORT_REST']
                  }
                ]
              }
            ]
          }
        ]
      }
    })

    await expect(hydrateFacetById(db as never, 'size-facet-1')).resolves.toMatchObject({
      id: 'size-facet-1',
      groups: [
        {
          contexts: [
            {
              subject: 'RACE',
              conditions: [
                {
                  predicateCode: 'SIZE',
                  authoringModeKind: 'SELECTED',
                  sizes: ['MEDIUM', 'LARGE']
                }
              ]
            }
          ]
        }
      ]
    })

    await expect(modifierRepository.findById('modifier-charge-kinds-1')).resolves.toMatchObject({
      restrictions: {
        id: 'modifier-charge-facet-1',
        groups: [
          {
            contexts: [
              {
                subject: 'RESOURCE',
                conditions: [
                  {
                    predicateCode: 'CHARGE_LIMIT_KIND',
                    authoringModeKind: 'SELECTED',
                    chargeLimitKind: ['FIXED_AMOUNT', 'CLASS_LEVEL']
                  },
                  {
                    predicateCode: 'CHARGE_RESET_KIND',
                    authoringModeKind: 'SELECTED',
                    chargeResetKind: ['LONG_REST', 'SHORT_REST']
                  }
                ]
              }
            ]
          }
        ]
      }
    })
  })

  it('round-trips subclass subtype facets through the shared facet helper', async () => {
    const db = new InMemoryDb()

    await upsertFacet(db as never, {
      id: 'subclass-subtype-facet-1',
      groups: [
        {
          id: 'subclass-subtype-group-1',
          order: 1,
          contexts: [
            {
              id: 'subclass-subtype-context-1',
              order: 1,
              subject: 'SUBCLASS',
              authoringModeKind: 'ALL',
              conditions: [
                {
                  id: 'subclass-subtype-condition-1',
                  order: 1,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'SUBCLASS_SUBTYPE',
                  authoringModeKind: 'SELECTED',
                  subtypeIds: ['land', 'sea']
                }
              ]
            }
          ]
        }
      ]
    } as never)

    await expect(hydrateFacetById(db as never, 'subclass-subtype-facet-1')).resolves.toMatchObject({
      id: 'subclass-subtype-facet-1',
      groups: [
        {
          contexts: [
            {
              subject: 'SUBCLASS',
              conditions: [
                {
                  predicateCode: 'SUBCLASS_SUBTYPE',
                  authoringModeKind: 'SELECTED',
                  subtypeIds: ['land', 'sea']
                }
              ]
            }
          ]
        }
      ]
    })
  })

  it('round-trips range and duration facets in ALL mode through the shared facet helper', async () => {
    const db = new InMemoryDb()

    await upsertFacet(db as never, {
      id: 'range-duration-all-facet-1',
      groups: [
        {
          id: 'range-duration-all-group-1',
          order: 1,
          contexts: [
            {
              id: 'range-duration-all-context-1',
              order: 1,
              subject: 'FEATURE',
              authoringModeKind: 'ALL',
              conditions: [
                {
                  id: 'range-duration-all-range-condition-1',
                  order: 1,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'RANGE',
                  authoringModeKind: 'ALL',
                  min: 30,
                  max: 120,
                  unit: 'FEET'
                },
                {
                  id: 'range-duration-all-duration-condition-1',
                  order: 2,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'DURATION',
                  authoringModeKind: 'ALL',
                  min: 1,
                  max: 10
                }
              ]
            }
          ]
        }
      ]
    } as never)

    await expect(hydrateFacetById(db as never, 'range-duration-all-facet-1')).resolves.toMatchObject({
      id: 'range-duration-all-facet-1',
      groups: [
        {
          contexts: [
            {
              subject: 'FEATURE',
              conditions: [
                {
                  predicateCode: 'RANGE',
                  authoringModeKind: 'ALL',
                  min: 30,
                  max: 120,
                  unit: 'FEET'
                },
                {
                  predicateCode: 'DURATION',
                  authoringModeKind: 'ALL',
                  min: 1,
                  max: 10
                }
              ]
            }
          ]
        }
      ]
    })
  })

  it('round-trips selected multi-kind range and duration facets through the shared facet helper', async () => {
    const db = new InMemoryDb()

    await upsertFacet(db as never, {
      id: 'range-duration-selected-facet-1',
      groups: [
        {
          id: 'range-duration-selected-group-1',
          order: 1,
          contexts: [
            {
              id: 'range-duration-selected-context-1',
              order: 1,
              subject: 'FEATURE',
              authoringModeKind: 'ALL',
              conditions: [
                {
                  id: 'range-duration-selected-range-condition-1',
                  order: 1,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'RANGE',
                  authoringModeKind: 'SELECTED',
                  rangeKind: ['SELF', 'TOUCH']
                },
                {
                  id: 'range-duration-selected-duration-condition-1',
                  order: 2,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'DURATION',
                  authoringModeKind: 'SELECTED',
                  durationKind: ['ROUND', 'MINUTE'],
                  min: 1,
                  max: 10
                }
              ]
            }
          ]
        }
      ]
    } as never)

    await expect(hydrateFacetById(db as never, 'range-duration-selected-facet-1')).resolves.toMatchObject({
      id: 'range-duration-selected-facet-1',
      groups: [
        {
          contexts: [
            {
              subject: 'FEATURE',
              conditions: [
                {
                  predicateCode: 'RANGE',
                  authoringModeKind: 'SELECTED',
                  rangeKind: ['SELF', 'TOUCH']
                },
                {
                  predicateCode: 'DURATION',
                  authoringModeKind: 'SELECTED',
                  durationKind: ['ROUND', 'MINUTE'],
                  min: 1,
                  max: 10
                }
              ]
            }
          ]
        }
      ]
    })
  })

  it('round-trips selected PROFICIENCY_GRANT relation targets through EXISTS facet selections', async () => {
    const db = new InMemoryDb()

    await upsertFacet(db as never, {
      id: 'proficiency-relation-facet-1',
      groups: [
        {
          id: 'proficiency-relation-group-1',
          order: 1,
          contexts: [
            {
              id: 'proficiency-relation-context-1',
              order: 1,
              subject: 'SUBCLASS',
              authoringModeKind: 'ALL',
              conditions: [
                {
                  id: 'proficiency-relation-condition-1',
                  order: 1,
                  kind: 'EXISTS',
                  constraint: 'INCLUDE',
                  relationCode: 'PROFICIENCY_GRANT',
                  authoringModeKind: 'SELECTED',
                  proficiencyKind: 'SKILL'
                }
              ]
            }
          ]
        }
      ]
    } as never)

    await expect(hydrateFacetById(db as never, 'proficiency-relation-facet-1')).resolves.toMatchObject({
      id: 'proficiency-relation-facet-1',
      groups: [
        {
          contexts: [
            {
              subject: 'SUBCLASS',
              conditions: [
                {
                  kind: 'EXISTS',
                  relationCode: 'PROFICIENCY_GRANT',
                  authoringModeKind: 'SELECTED',
                  proficiencyKind: 'SKILL'
                }
              ]
            }
          ]
        }
      ]
    })
  })

  it('hydrates selection and predicate item arrays using stored sort_order', async () => {
    const db = new InMemoryDb()

    await db.insertInto('facets').values({ id: 'ordered-facet-1' }).execute()
    await db.insertInto('facet_groups').values({
      id: 'ordered-group-1',
      facet_id: 'ordered-facet-1',
      sort_order: 1
    }).execute()
    await db.insertInto('facet_contexts').values({
      id: 'ordered-context-1',
      facet_group_id: 'ordered-group-1',
      node_subject_code: 'FEATURE',
      sort_order: 1
    }).execute()
    await db.insertInto('facet_bodies').values({
      id: 'ordered-body-1',
      node_subject_code: 'FEATURE'
    }).execute()
    await db.insertInto('facet_context_bodies').values({
      facet_context_id: 'ordered-context-1',
      facet_body_id: 'ordered-body-1'
    }).execute()
    await db.insertInto('facet_body_selections').values({
      facet_body_id: 'ordered-body-1',
      authoring_mode_kind: 'SELECTED'
    }).execute()
    await db.insertInto('facet_body_selection_items').values([
      {
        facet_body_id: 'ordered-body-1',
        feature_id: 'feature-b',
        sort_order: 2
      },
      {
        facet_body_id: 'ordered-body-1',
        feature_id: 'feature-a',
        sort_order: 1
      }
    ]).execute()
    await db.insertInto('facet_body_groups').values({
      id: 'ordered-body-group-1',
      facet_body_id: 'ordered-body-1',
      sort_order: 1
    }).execute()
    await db.insertInto('facet_conditions').values({
      id: 'ordered-condition-1',
      facet_body_group_id: 'ordered-body-group-1',
      kind: 'PREDICATE',
      constraint_code: 'INCLUDE',
      sort_order: 1,
      predicate_code: 'FEATURE_OBTAINED',
      relation_code: null,
      where_facet_body_id: null
    }).execute()
    await db.insertInto('facet_predicate_feature_items').values([
      {
        facet_condition_id: 'ordered-condition-1',
        feature_id: 'feature-d',
        sort_order: 2
      },
      {
        facet_condition_id: 'ordered-condition-1',
        feature_id: 'feature-c',
        sort_order: 1
      }
    ]).execute()

    await expect(hydrateFacetById(db as never, 'ordered-facet-1')).resolves.toMatchObject({
      id: 'ordered-facet-1',
      groups: [
        {
          contexts: [
            {
              subject: 'FEATURE',
              authoringModeKind: 'SELECTED',
              featureIds: ['feature-a', 'feature-b'],
              conditions: [
                {
                  predicateCode: 'FEATURE_OBTAINED',
                  featureIds: ['feature-c', 'feature-d']
                }
              ]
            }
          ]
        }
      ]
    })
  })
})
