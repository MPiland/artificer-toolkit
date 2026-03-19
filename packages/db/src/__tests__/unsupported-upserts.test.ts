import { describe, expect, it } from 'vitest'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared'
import { upsertEffect } from '../domains/effects/upserts/effect.js'
import { upsertFeature } from '../domains/features/upserts/feature.js'
import { upsertOption } from '../domains/features/upserts/option.js'
import { upsertBackground } from '../domains/subjects/upserts/background.js'
import { upsertClass } from '../domains/subjects/upserts/class.js'
import { upsertEquipment } from '../domains/subjects/upserts/equipment.js'
import { upsertFeat } from '../domains/subjects/upserts/feat.js'
import { upsertRace } from '../domains/subjects/upserts/race.js'
import { upsertSpell } from '../domains/subjects/upserts/spell.js'
import { upsertFeatGrant } from '../domains/grants/upserts/feat.js'
import { upsertModifierGrant } from '../domains/grants/upserts/modifier.js'
import { upsertProficiencyGrant } from '../domains/grants/upserts/proficiency.js'
import { upsertSenseGrant } from '../domains/grants/upserts/sense.js'
import { upsertSpellGrant } from '../domains/grants/upserts/spell.js'
import { upsertCharge } from '../domains/shared/upserts/charge.js'
import { upsertStartingEquipment } from '../domains/shared/upserts/starting_equipment.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

describe('unsupported authored branches fail loudly', () => {
  it('rejects unsupported effect outcome kinds until DB persistence is expanded', async () => {
    await expect(upsertEffect(new InMemoryDb() as never, {
      id: 'effect-unsupported-heal',
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SPELL_ATTACK,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: 'range-unsupported-heal',
          rangeKind: RANGE_KIND.TOUCH
        }
      },
      branches: [
        {
          id: 'BRANCH-unsupported-heal',
          branch: BRANCH.ON_HIT,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.HEAL,
          valueKind: 'DICE',
          diceConfig: '1d8'
        }
      ]
    } as never)).rejects.toThrow('DB persistence currently supports only DAMAGE and CONDITION branches')
  })

  it('rejects feature restrictions that use invalid proficiency-grant relation target selections', async () => {
    await expect(upsertFeature(new InMemoryDb() as never, {
      id: 'feature-invalid-relation-target',
      label: 'Unsupported',
      description: 'Unsupported',
      order: 1,
      restrictions: {
        id: 'facet-invalid-relation-target',
        groups: [
          {
            id: 'facet-group-1',
            order: 1,
            contexts: [
              {
                id: 'facet-context-1',
                order: 1,
                subject: 'SUBCLASS',
                authoringModeKind: 'ALL',
                conditions: [
                  {
                    id: 'facet-condition-1',
                    order: 1,
                    kind: 'EXISTS',
                    constraint: 'INCLUDE',
                    relationCode: 'PROFICIENCY_GRANT',
                    authoringModeKind: 'SELECTED',
                    proficiencyKind: 'LUCK'
                  }
                ]
              }
            ]
          }
        ]
      }
    } as never, 'system-1')).rejects.toThrow('invalid proficiency kind')
  })

  it('rejects feature restrictions that use DURATION in ALL mode without a minimum bound', async () => {
    await expect(upsertFeature(new InMemoryDb() as never, {
      id: 'feature-invalid-duration-all',
      label: 'Invalid Duration',
      description: 'Invalid',
      order: 1,
      restrictions: {
        id: 'facet-invalid-duration-all',
        groups: [
          {
            id: 'facet-group-1',
            order: 1,
            contexts: [
              {
                id: 'facet-context-1',
                order: 1,
                subject: 'FEATURE',
                authoringModeKind: 'ALL',
                conditions: [
                  {
                    id: 'facet-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'DURATION',
                    authoringModeKind: 'ALL',
                    max: 10
                  }
                ]
              }
            ]
          }
        ]
      }
    } as never, 'system-1')).rejects.toThrow('requires min for timed duration')
  })

  it('rejects feature restrictions that use RANGE in ALL mode without a unit', async () => {
    await expect(upsertFeature(new InMemoryDb() as never, {
      id: 'feature-invalid-range-all',
      label: 'Invalid Range',
      description: 'Invalid',
      order: 1,
      restrictions: {
        id: 'facet-invalid-range-all',
        groups: [
          {
            id: 'facet-group-1',
            order: 1,
            contexts: [
              {
                id: 'facet-context-1',
                order: 1,
                subject: 'FEATURE',
                authoringModeKind: 'ALL',
                conditions: [
                  {
                    id: 'facet-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'RANGE',
                    authoringModeKind: 'ALL',
                    min: 30
                  }
                ]
              }
            ]
          }
        ]
      }
    } as never, 'system-1')).rejects.toThrow('requires unit for DISTANCE range')
  })

  it('rejects feature restrictions that use invalid charge limit kinds', async () => {
    await expect(upsertFeature(new InMemoryDb() as never, {
      id: 'feature-invalid-charge-limit',
      label: 'Invalid Charge Limit',
      description: 'Invalid',
      order: 1,
      restrictions: {
        id: 'facet-invalid-charge-limit',
        groups: [
          {
            id: 'facet-group-1',
            order: 1,
            contexts: [
              {
                id: 'facet-context-1',
                order: 1,
                subject: 'FEATURE',
                authoringModeKind: 'ALL',
                conditions: [
                  {
                    id: 'facet-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'CHARGE_LIMIT_KIND',
                    authoringModeKind: 'SELECTED',
                    chargeLimitKind: ['EVENTUALLY']
                  }
                ]
              }
            ]
          }
        ]
      }
    } as never, 'system-1')).rejects.toThrow('invalid charge limit kind')
  })

  it('rejects feature restrictions that use invalid charge reset kinds', async () => {
    await expect(upsertFeature(new InMemoryDb() as never, {
      id: 'feature-invalid-charge-reset',
      label: 'Invalid Charge Reset',
      description: 'Invalid',
      order: 1,
      restrictions: {
        id: 'facet-invalid-charge-reset',
        groups: [
          {
            id: 'facet-group-1',
            order: 1,
            contexts: [
              {
                id: 'facet-context-1',
                order: 1,
                subject: 'FEATURE',
                authoringModeKind: 'ALL',
                conditions: [
                  {
                    id: 'facet-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'CHARGE_RESET_KIND',
                    authoringModeKind: 'SELECTED',
                    chargeResetKind: ['EVENTUALLY']
                  }
                ]
              }
            ]
          }
        ]
      }
    } as never, 'system-1')).rejects.toThrow('invalid charge reset kind')
  })

  it('rejects chosen modifier grants without a count', async () => {
    await expect(upsertModifierGrant({} as never, {
      id: 'modifier-grant-missing-count',
      grantKind: 'MODIFIER_GRANT',
      order: 1,
      selectionKind: 'CHOSEN',
      valueDomainCode: 'SAVE_DC',
      domain: {},
      modifierKind: 'ADVANTAGE',
      scope: 'GLOBAL'
    } as never, 'system-1')).rejects.toThrow('missing count')
  })

  it('rejects granted modifier grants with count payload', async () => {
    await expect(upsertModifierGrant({} as never, {
      id: 'modifier-grant-granted-count',
      grantKind: 'MODIFIER_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      count: 1,
      valueDomainCode: 'SAVE_DC',
      domain: {},
      modifierKind: 'ADVANTAGE',
      scope: 'GLOBAL'
    } as never, 'system-1')).rejects.toThrow('cannot persist count for GRANTED')
  })

  it('rejects parameterized modifier grants without their domain payload', async () => {
    await expect(upsertModifierGrant({} as never, {
      id: 'modifier-grant-missing-domain',
      grantKind: 'MODIFIER_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'SKILL_BONUS',
      domain: {},
      modifierKind: 'BONUS',
      scope: 'GLOBAL',
      payload: {
        valueKind: 'FIXED',
        amount: 1
      }
    } as never, 'system-1')).rejects.toThrow('missing domain skillId')
  })

  it('rejects modifier grants with invalid payload ability codes', async () => {
    await expect(upsertModifierGrant({} as never, {
      id: 'modifier-grant-bad-ability',
      grantKind: 'MODIFIER_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'ATTACK_ROLL_BONUS',
      domain: { attackDomain: 'MELEE' },
      modifierKind: 'BONUS',
      scope: 'GLOBAL',
      payload: {
        valueKind: 'ABILITY_MODIFIER',
        ability: 'LUCK'
      }
    } as never, 'system-1')).rejects.toThrow('invalid payload ability')
  })

  it('rejects modifier grants without system ownership', async () => {
    await expect(upsertModifierGrant({} as never, {
      id: 'modifier-grant-no-system',
      grantKind: 'MODIFIER_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'SAVE_DC',
      domain: {},
      modifierKind: 'ADVANTAGE',
      scope: 'GLOBAL'
    } as never)).rejects.toThrow('requires a systemId')
  })

  it('rejects equipment restrictions that mix DISTANCE with other selected range kinds', async () => {
    await expect(upsertEquipment(new InMemoryDb() as never, {
      kind: 'EQUIPMENT',
      id: 'equipment-unsupported-restrictions',
      label: 'Unsupported',
      description: null,
      cost: { amount: 1, currencyId: 'gp' },
      weight: { amount: 1, unit: 'POUNDS' },
      rarityId: 'common',
      restrictions: {
        id: 'equipment-facet-unsupported',
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
                    rangeKind: ['DISTANCE', 'TOUCH'],
                    min: 30,
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
      properties: [],
      category: 'WEAPON',
      abilities: []
    } as never, 'system-1')).rejects.toThrow('cannot mix DISTANCE')
  })

  it('rejects feat grant restrictions that mix DISTANCE with other selected range kinds', async () => {
    await expect(upsertFeatGrant(new InMemoryDb() as never, {
      id: 'feat-grant-unsupported',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      restrictions: {
        id: 'feat-grant-facet-unsupported',
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
                    predicateCode: 'RANGE',
                    authoringModeKind: 'SELECTED',
                    rangeKind: ['DISTANCE', 'TOUCH'],
                    min: 30,
                    unit: 'FEET'
                  }
                ]
              }
            ]
          }
        ]
      }
    } as never)).rejects.toThrow('cannot mix DISTANCE')
  })

  it('rejects sense grant restrictions that mix DISTANCE with other selected range kinds', async () => {
    await expect(upsertSenseGrant(new InMemoryDb() as never, {
      id: 'sense-grant-unsupported',
      grantKind: 'SENSE_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      restrictions: {
        id: 'sense-grant-facet-unsupported',
        groups: [
          {
            id: 'sense-grant-facet-group-1',
            order: 1,
            contexts: [
              {
                id: 'sense-grant-facet-context-1',
                order: 1,
                subject: 'FEATURE',
                authoringModeKind: 'ALL',
                conditions: [
                  {
                    id: 'sense-grant-facet-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'RANGE',
                    authoringModeKind: 'SELECTED',
                    rangeKind: ['DISTANCE', 'TOUCH'],
                    min: 30,
                    unit: 'FEET'
                  }
                ]
              }
            ]
          }
        ]
      }
    } as never)).rejects.toThrow('cannot mix DISTANCE')
  })

  it('rejects proficiency grant restrictions that mix DISTANCE with other selected range kinds', async () => {
    await expect(upsertProficiencyGrant(new InMemoryDb() as never, {
      id: 'proficiency-grant-unsupported',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'SKILL',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      skillIds: ['skill-1'],
      level: 'FULL',
      restrictions: {
        id: 'proficiency-grant-facet-unsupported',
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
                    predicateCode: 'RANGE',
                    authoringModeKind: 'SELECTED',
                    rangeKind: ['DISTANCE', 'TOUCH'],
                    min: 30,
                    unit: 'FEET'
                  }
                ]
              }
            ]
          }
        ]
      }
    } as never)).rejects.toThrow('cannot mix DISTANCE')
  })

  it('rejects chosen proficiency grants without a count', async () => {
    await expect(upsertProficiencyGrant({} as never, {
      id: 'proficiency-grant-missing-count',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'SKILL',
      order: 1,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      skillIds: ['skill-1'],
      level: 'FULL'
    } as never)).rejects.toThrow('missing count')
  })

  it('rejects half proficiency grants without rounding', async () => {
    await expect(upsertProficiencyGrant({} as never, {
      id: 'proficiency-grant-missing-rounding',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'SKILL',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      skillIds: ['skill-1'],
      level: 'HALF'
    } as never)).rejects.toThrow('missing rounding')
  })

  it('rejects granted proficiency grants with count payload', async () => {
    await expect(upsertProficiencyGrant({} as never, {
      id: 'proficiency-grant-granted-count',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'SKILL',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      skillIds: ['skill-1'],
      level: 'FULL',
      count: 1
    } as never)).rejects.toThrow('cannot persist count for GRANTED')
  })

  it('rejects non-half proficiency grants with rounding payload', async () => {
    await expect(upsertProficiencyGrant({} as never, {
      id: 'proficiency-grant-non-half-rounding',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'SKILL',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      skillIds: ['skill-1'],
      level: 'FULL',
      rounding: 'UP'
    } as never)).rejects.toThrow('cannot persist rounding for FULL level')
  })

  it('rejects spell grant filters that mix INSTANTANEOUS with timed duration kinds', async () => {
    await expect(upsertSpellGrant(new InMemoryDb() as never, {
      id: 'spell-grant-unsupported-filter',
      grantKind: 'SPELL_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      filters: {
        id: 'spell-grant-filter-unsupported',
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
                    predicateCode: 'DURATION',
                    authoringModeKind: 'SELECTED',
                    durationKind: ['INSTANTANEOUS', 'MINUTE'],
                    min: 1
                  }
                ]
              }
            ]
          }
        ]
      }
    } as never)).rejects.toThrow('cannot mix INSTANTANEOUS')
  })

  it('rejects spell grants with invalid attribute codes', async () => {
    await expect(upsertSpellGrant({} as never, {
      id: 'spell-grant-invalid-attributes',
      grantKind: 'SPELL_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      attributes: ['SOMETIMES']
    } as never)).rejects.toThrow('invalid attribute')
  })

  it('rejects spell grants with charges but without LIMITED_USE', async () => {
    await expect(upsertSpellGrant({} as never, {
      id: 'spell-grant-charges-without-limited-use',
      grantKind: 'SPELL_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      attributes: ['CAST_AT_WILL'],
      charges: {
        id: 'charge-1',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 1
      }
    } as never)).rejects.toThrow('cannot persist charges without LIMITED_USE')
  })

  it('rejects spell grants with castAtLevel but without CAST_AT_LEVEL', async () => {
    await expect(upsertSpellGrant({} as never, {
      id: 'spell-grant-cast-level-without-attribute',
      grantKind: 'SPELL_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      attributes: ['CAST_AT_WILL'],
      castAtLevel: 3
    } as never)).rejects.toThrow('cannot persist castAtLevel without CAST_AT_LEVEL')
  })

  it('rejects class-level feat progression without a class id', async () => {
    await expect(upsertFeatGrant({} as never, {
      id: 'feat-grant-missing-class',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'CLASS_LEVEL',
        levels: []
      }
    } as never)).rejects.toThrow('missing classId')
  })

  it('rejects class-level sense progression without a class id', async () => {
    await expect(upsertSenseGrant({} as never, {
      id: 'sense-grant-missing-class',
      grantKind: 'SENSE_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'CLASS_LEVEL',
        levels: []
      }
    } as never)).rejects.toThrow('missing classId')
  })

  it('rejects class-level spell progression without a class id', async () => {
    await expect(upsertSpellGrant({} as never, {
      id: 'spell-grant-missing-class',
      grantKind: 'SPELL_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'CLASS_LEVEL',
        levels: []
      }
    } as never)).rejects.toThrow('missing classId')
  })

  it('rejects chosen feat grants without a count', async () => {
    await expect(upsertFeatGrant({} as never, {
      id: 'feat-grant-missing-count',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL'
    } as never)).rejects.toThrow('missing count')
  })

  it('rejects granted feat grants with count payload', async () => {
    await expect(upsertFeatGrant({} as never, {
      id: 'feat-grant-granted-count',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      count: 1
    } as never)).rejects.toThrow('cannot persist count for GRANTED')
  })

  it('rejects chosen sense grants without a count', async () => {
    await expect(upsertSenseGrant({} as never, {
      id: 'sense-grant-missing-count',
      grantKind: 'SENSE_GRANT',
      order: 1,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL'
    } as never)).rejects.toThrow('missing count')
  })

  it('rejects granted sense grants with count payload', async () => {
    await expect(upsertSenseGrant({} as never, {
      id: 'sense-grant-granted-count',
      grantKind: 'SENSE_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      count: 1
    } as never)).rejects.toThrow('cannot persist count for GRANTED')
  })

  it('rejects chosen spell grants without a count', async () => {
    await expect(upsertSpellGrant({} as never, {
      id: 'spell-grant-missing-count',
      grantKind: 'SPELL_GRANT',
      order: 1,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL'
    } as never)).rejects.toThrow('missing count')
  })

  it('rejects granted spell grants with count payload', async () => {
    await expect(upsertSpellGrant({} as never, {
      id: 'spell-grant-granted-count',
      grantKind: 'SPELL_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      count: 1
    } as never)).rejects.toThrow('cannot persist count for GRANTED')
  })

  it('rejects selected feat grants without feat ids', async () => {
    await expect(upsertFeatGrant({} as never, {
      id: 'feat-grant-missing-ids',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED'
    } as never)).rejects.toThrow('missing featIds')
  })

  it('rejects all-mode feat grants with feat ids payload', async () => {
    await expect(upsertFeatGrant({} as never, {
      id: 'feat-grant-all-feat-ids',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      featIds: ['feat-1']
    } as never)).rejects.toThrow('cannot persist featIds when authoringModeKind is ALL')
  })

  it('rejects selected sense grants without sense ids', async () => {
    await expect(upsertSenseGrant({} as never, {
      id: 'sense-grant-missing-ids',
      grantKind: 'SENSE_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED'
    } as never)).rejects.toThrow('missing senseIds')
  })

  it('rejects all-mode sense grants with sense ids payload', async () => {
    await expect(upsertSenseGrant({} as never, {
      id: 'sense-grant-all-sense-ids',
      grantKind: 'SENSE_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      senseIds: ['sense-1']
    } as never)).rejects.toThrow('cannot persist senseIds when authoringModeKind is ALL')
  })

  it('rejects selected spell grants without spell ids', async () => {
    await expect(upsertSpellGrant({} as never, {
      id: 'spell-grant-missing-ids',
      grantKind: 'SPELL_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED'
    } as never)).rejects.toThrow('missing spellIds')
  })

  it('rejects all-mode spell grants with spell ids payload', async () => {
    await expect(upsertSpellGrant({} as never, {
      id: 'spell-grant-all-spell-ids',
      grantKind: 'SPELL_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      spellIds: ['spell-1']
    } as never)).rejects.toThrow('cannot persist spellIds when authoringModeKind is ALL')
  })

  it('rejects all-mode feat progression levels with feat ids payload', async () => {
    await expect(upsertFeatGrant({} as never, {
      id: 'feat-grant-all-level-feat-ids',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'CHARACTER_LEVEL',
        levels: [{
          id: 'level-1',
          level: 1,
          order: 1,
          authoringModeKind: 'ALL',
          featIds: ['feat-1']
        }]
      }
    } as never)).rejects.toThrow('cannot persist featIds when authoringModeKind is ALL')
  })

  it('rejects all-mode sense progression levels with sense ids payload', async () => {
    await expect(upsertSenseGrant({} as never, {
      id: 'sense-grant-all-level-sense-ids',
      grantKind: 'SENSE_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'CHARACTER_LEVEL',
        levels: [{
          id: 'level-1',
          level: 1,
          order: 1,
          authoringModeKind: 'ALL',
          senseIds: ['sense-1']
        }]
      }
    } as never)).rejects.toThrow('cannot persist senseIds when authoringModeKind is ALL')
  })

  it('rejects all-mode spell progression levels with spell ids payload', async () => {
    await expect(upsertSpellGrant({} as never, {
      id: 'spell-grant-all-level-spell-ids',
      grantKind: 'SPELL_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'CHARACTER_LEVEL',
        levels: [{
          id: 'level-1',
          level: 1,
          order: 1,
          authoringModeKind: 'ALL',
          spellIds: ['spell-1']
        }]
      }
    } as never)).rejects.toThrow('cannot persist spellIds when authoringModeKind is ALL')
  })

  it('rejects selected proficiency grants without skill ids', async () => {
    await expect(upsertProficiencyGrant({} as never, {
      id: 'proficiency-grant-missing-skill-ids',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'SKILL',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      level: 'FULL'
    } as never)).rejects.toThrow('missing skillIds')
  })

  it('rejects proficiency grants with invalid ability codes', async () => {
    await expect(upsertProficiencyGrant({} as never, {
      id: 'proficiency-grant-bad-ability',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'SAVE_ABILITY',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      abilities: ['LUCK'],
      level: 'FULL'
    } as never)).rejects.toThrow('invalid ability code')
  })

  it('rejects proficiency grants with invalid equipment property codes', async () => {
    await expect(upsertProficiencyGrant({} as never, {
      id: 'proficiency-grant-bad-property',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'EQUIPMENT_PROPERTY',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      properties: ['SHINY'],
      level: 'FULL'
    } as never)).rejects.toThrow('invalid property code')
  })

  it('rejects all-mode equipment-property proficiency grants with properties payload', async () => {
    await expect(upsertProficiencyGrant({} as never, {
      id: 'proficiency-grant-all-equipment-property-properties',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'EQUIPMENT_PROPERTY',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      properties: ['LIGHT'],
      level: 'FULL'
    } as never)).rejects.toThrow('cannot persist properties when authoringModeKind is ALL')
  })

  it('rejects selected starting equipment items without equipment ids', async () => {
    await expect(upsertStartingEquipment({} as never, {
      id: 'starting-equipment-missing-ids',
      sets: [
        {
          id: 'set-1',
          order: 1,
          groups: [
            {
              id: 'group-1',
              order: 1,
              options: [
                {
                  id: 'option-1',
                  order: 1,
                  items: [
                    {
                      id: 'item-1',
                      order: 1,
                      startingEquipmentKind: 'EQUIPMENT',
                      authoringModeKind: 'SELECTED',
                      selectionKind: 'GRANTED',
                      quantity: 1
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    } as never)).rejects.toThrow('missing equipmentIds')
  })

  it('rejects granted starting equipment items with count payload', async () => {
    await expect(upsertStartingEquipment({} as never, {
      id: 'starting-equipment-granted-count',
      sets: [
        {
          id: 'set-1',
          order: 1,
          groups: [
            {
              id: 'group-1',
              order: 1,
              options: [
                {
                  id: 'option-1',
                  order: 1,
                  items: [
                    {
                      id: 'item-1',
                      order: 1,
                      startingEquipmentKind: 'EQUIPMENT',
                      authoringModeKind: 'ALL',
                      selectionKind: 'GRANTED',
                      quantity: 1,
                      count: 1
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    } as never)).rejects.toThrow('cannot persist count for GRANTED')
  })

  it('rejects chosen starting equipment items with quantity payload', async () => {
    await expect(upsertStartingEquipment({} as never, {
      id: 'starting-equipment-chosen-quantity',
      sets: [
        {
          id: 'set-1',
          order: 1,
          groups: [
            {
              id: 'group-1',
              order: 1,
              options: [
                {
                  id: 'option-1',
                  order: 1,
                  items: [
                    {
                      id: 'item-1',
                      order: 1,
                      startingEquipmentKind: 'EQUIPMENT',
                      authoringModeKind: 'ALL',
                      selectionKind: 'CHOSEN',
                      count: 1,
                      quantity: 1
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    } as never)).rejects.toThrow('cannot persist quantity for CHOSEN')
  })

  it('rejects currency starting equipment items without currencies', async () => {
    await expect(upsertStartingEquipment({} as never, {
      id: 'starting-equipment-missing-currencies',
      sets: [
        {
          id: 'set-1',
          order: 1,
          groups: [
            {
              id: 'group-1',
              order: 1,
              options: [
                {
                  id: 'option-1',
                  order: 1,
                  items: [
                    {
                      id: 'item-1',
                      order: 1,
                      startingEquipmentKind: 'CURRENCY',
                      currencies: []
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    } as never)).rejects.toThrow('missing currencies')
  })

  it('rejects starting equipment items with invalid property codes', async () => {
    await expect(upsertStartingEquipment({} as never, {
      id: 'starting-equipment-bad-property',
      sets: [
        {
          id: 'set-1',
          order: 1,
          groups: [
            {
              id: 'group-1',
              order: 1,
              options: [
                {
                  id: 'option-1',
                  order: 1,
                  items: [
                    {
                      id: 'item-1',
                      order: 1,
                      startingEquipmentKind: 'EQUIPMENT',
                      authoringModeKind: 'ALL',
                      selectionKind: 'GRANTED',
                      quantity: 1,
                      properties: ['SHINY']
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    } as never)).rejects.toThrow('invalid property')
  })

  it('rejects charges with invalid reset kinds', async () => {
    await expect(upsertCharge({} as never, {
      id: 'charge-bad-reset',
      resetKind: 'EVENTUALLY',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      amount: 1
    } as never)).rejects.toThrow('invalid resetKind')
  })

  it('rejects charges with invalid ability bonus abilities', async () => {
    await expect(upsertCharge({} as never, {
      id: 'charge-bad-ability',
      resetKind: 'LONG_REST',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      amount: 1,
      bonuses: [
        {
          id: 'bonus-1',
          bonusKind: 'ABILITY_MODIFIER',
          ability: 'LUCK',
          order: 1
        }
      ]
    } as never)).rejects.toThrow('invalid ability')
  })
})
