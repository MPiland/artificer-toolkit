import { describe, expect, it } from 'vitest'
import { upsertFeatGrant } from '../domains/grants/upserts/feat.js'
import { upsertProficiencyGrant } from '../domains/grants/upserts/proficiency.js'
import { upsertSenseGrant } from '../domains/grants/upserts/sense.js'
import { upsertSpellGrant } from '../domains/grants/upserts/spell.js'
import { InMemoryDb } from './helpers/in-memory-db.js'
describe('unsupported authored effect paths fail loudly', () => {
  it('rejects proficiency grant restrictions that mix DISTANCE with other selected range kinds', async () => {
    await expect(
      upsertProficiencyGrant(
        new InMemoryDb() as never,
        {
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
        } as never
      )
    ).rejects.toThrow('cannot mix DISTANCE')
  })
  it('rejects chosen proficiency grants without a count', async () => {
    await expect(
      upsertProficiencyGrant(
        {} as never,
        {
          id: 'proficiency-grant-missing-count',
          grantKind: 'PROFICIENCY_GRANT',
          proficiencyKind: 'SKILL',
          order: 1,
          selectionKind: 'CHOSEN',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          skillIds: ['skill-1'],
          level: 'FULL'
        } as never
      )
    ).rejects.toThrow('missing count')
  })
  it('rejects half proficiency grants without rounding', async () => {
    await expect(
      upsertProficiencyGrant(
        {} as never,
        {
          id: 'proficiency-grant-missing-rounding',
          grantKind: 'PROFICIENCY_GRANT',
          proficiencyKind: 'SKILL',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          skillIds: ['skill-1'],
          level: 'HALF'
        } as never
      )
    ).rejects.toThrow('missing rounding')
  })
  it('rejects granted proficiency grants with count payload', async () => {
    await expect(
      upsertProficiencyGrant(
        {} as never,
        {
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
        } as never
      )
    ).rejects.toThrow('cannot persist count for GRANTED')
  })
  it('rejects non-half proficiency grants with rounding payload', async () => {
    await expect(
      upsertProficiencyGrant(
        {} as never,
        {
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
        } as never
      )
    ).rejects.toThrow('cannot persist rounding for FULL level')
  })
  it('rejects spell grant filters that mix INSTANTANEOUS with timed duration kinds', async () => {
    await expect(
      upsertSpellGrant(
        new InMemoryDb() as never,
        {
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
        } as never
      )
    ).rejects.toThrow('cannot mix INSTANTANEOUS')
  })
  it('rejects spell grants with invalid attribute codes', async () => {
    await expect(
      upsertSpellGrant(
        {} as never,
        {
          id: 'spell-grant-invalid-attributes',
          grantKind: 'SPELL_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'ALL',
          attributes: ['SOMETIMES']
        } as never
      )
    ).rejects.toThrow('invalid attribute')
  })
  it('rejects spell grants with charges but without LIMITED_USE', async () => {
    await expect(
      upsertSpellGrant(
        {} as never,
        {
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
        } as never
      )
    ).rejects.toThrow('cannot persist charges without LIMITED_USE')
  })
  it('rejects spell grants with castAtLevel but without CAST_AT_LEVEL', async () => {
    await expect(
      upsertSpellGrant(
        {} as never,
        {
          id: 'spell-grant-cast-level-without-attribute',
          grantKind: 'SPELL_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'ALL',
          attributes: ['CAST_AT_WILL'],
          castAtLevel: 3
        } as never
      )
    ).rejects.toThrow('cannot persist castAtLevel without CAST_AT_LEVEL')
  })
  it('rejects class-level feat progression without a class id', async () => {
    await expect(
      upsertFeatGrant(
        {} as never,
        {
          id: 'feat-grant-missing-class',
          grantKind: 'FEAT_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'PER_LEVEL',
          progression: {
            scalingSource: 'CLASS_LEVEL',
            levels: []
          }
        } as never
      )
    ).rejects.toThrow('missing classId')
  })
  it('rejects class-level sense progression without a class id', async () => {
    await expect(
      upsertSenseGrant(
        {} as never,
        {
          id: 'sense-grant-missing-class',
          grantKind: 'SENSE_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'PER_LEVEL',
          progression: {
            scalingSource: 'CLASS_LEVEL',
            levels: []
          }
        } as never
      )
    ).rejects.toThrow('missing classId')
  })
  it('rejects class-level spell progression without a class id', async () => {
    await expect(
      upsertSpellGrant(
        {} as never,
        {
          id: 'spell-grant-missing-class',
          grantKind: 'SPELL_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'PER_LEVEL',
          progression: {
            scalingSource: 'CLASS_LEVEL',
            levels: []
          }
        } as never
      )
    ).rejects.toThrow('missing classId')
  })
  it('rejects chosen feat grants without a count', async () => {
    await expect(
      upsertFeatGrant(
        {} as never,
        {
          id: 'feat-grant-missing-count',
          grantKind: 'FEAT_GRANT',
          order: 1,
          selectionKind: 'CHOSEN',
          scalingKind: 'NONE',
          authoringModeKind: 'ALL'
        } as never
      )
    ).rejects.toThrow('missing count')
  })
  it('rejects granted feat grants with count payload', async () => {
    await expect(
      upsertFeatGrant(
        {} as never,
        {
          id: 'feat-grant-granted-count',
          grantKind: 'FEAT_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'ALL',
          count: 1
        } as never
      )
    ).rejects.toThrow('cannot persist count for GRANTED')
  })
  it('rejects chosen sense grants without a count', async () => {
    await expect(
      upsertSenseGrant(
        {} as never,
        {
          id: 'sense-grant-missing-count',
          grantKind: 'SENSE_GRANT',
          order: 1,
          selectionKind: 'CHOSEN',
          scalingKind: 'NONE',
          authoringModeKind: 'ALL'
        } as never
      )
    ).rejects.toThrow('missing count')
  })
  it('rejects granted sense grants with count payload', async () => {
    await expect(
      upsertSenseGrant(
        {} as never,
        {
          id: 'sense-grant-granted-count',
          grantKind: 'SENSE_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'ALL',
          count: 1
        } as never
      )
    ).rejects.toThrow('cannot persist count for GRANTED')
  })
  it('rejects chosen spell grants without a count', async () => {
    await expect(
      upsertSpellGrant(
        {} as never,
        {
          id: 'spell-grant-missing-count',
          grantKind: 'SPELL_GRANT',
          order: 1,
          selectionKind: 'CHOSEN',
          scalingKind: 'NONE',
          authoringModeKind: 'ALL'
        } as never
      )
    ).rejects.toThrow('missing count')
  })
  it('rejects granted spell grants with count payload', async () => {
    await expect(
      upsertSpellGrant(
        {} as never,
        {
          id: 'spell-grant-granted-count',
          grantKind: 'SPELL_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'ALL',
          count: 1
        } as never
      )
    ).rejects.toThrow('cannot persist count for GRANTED')
  })
  it('rejects selected feat grants without feat ids', async () => {
    await expect(
      upsertFeatGrant(
        {} as never,
        {
          id: 'feat-grant-missing-ids',
          grantKind: 'FEAT_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED'
        } as never
      )
    ).rejects.toThrow('missing featIds')
  })
  it('rejects all-mode feat grants with feat ids payload', async () => {
    await expect(
      upsertFeatGrant(
        {} as never,
        {
          id: 'feat-grant-all-feat-ids',
          grantKind: 'FEAT_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'ALL',
          featIds: ['feat-1']
        } as never
      )
    ).rejects.toThrow('cannot persist featIds when authoringModeKind is ALL')
  })
  it('rejects selected sense grants without sense ids', async () => {
    await expect(
      upsertSenseGrant(
        {} as never,
        {
          id: 'sense-grant-missing-ids',
          grantKind: 'SENSE_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED'
        } as never
      )
    ).rejects.toThrow('missing senseIds')
  })
  it('rejects all-mode sense grants with sense ids payload', async () => {
    await expect(
      upsertSenseGrant(
        {} as never,
        {
          id: 'sense-grant-all-sense-ids',
          grantKind: 'SENSE_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'ALL',
          senseIds: ['sense-1']
        } as never
      )
    ).rejects.toThrow('cannot persist senseIds when authoringModeKind is ALL')
  })
  it('rejects selected spell grants without spell ids', async () => {
    await expect(
      upsertSpellGrant(
        {} as never,
        {
          id: 'spell-grant-missing-ids',
          grantKind: 'SPELL_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED'
        } as never
      )
    ).rejects.toThrow('missing spellIds')
  })
  it('rejects all-mode spell grants with spell ids payload', async () => {
    await expect(
      upsertSpellGrant(
        {} as never,
        {
          id: 'spell-grant-all-spell-ids',
          grantKind: 'SPELL_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'ALL',
          spellIds: ['spell-1']
        } as never
      )
    ).rejects.toThrow('cannot persist spellIds when authoringModeKind is ALL')
  })
  it('rejects all-mode feat progression levels with feat ids payload', async () => {
    await expect(
      upsertFeatGrant(
        {} as never,
        {
          id: 'feat-grant-all-level-feat-ids',
          grantKind: 'FEAT_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'PER_LEVEL',
          progression: {
            scalingSource: 'CHARACTER_LEVEL',
            levels: [
              {
                id: 'level-1',
                level: 1,
                order: 1,
                authoringModeKind: 'ALL',
                featIds: ['feat-1']
              }
            ]
          }
        } as never
      )
    ).rejects.toThrow('cannot persist featIds when authoringModeKind is ALL')
  })
  it('rejects all-mode sense progression levels with sense ids payload', async () => {
    await expect(
      upsertSenseGrant(
        {} as never,
        {
          id: 'sense-grant-all-level-sense-ids',
          grantKind: 'SENSE_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'PER_LEVEL',
          progression: {
            scalingSource: 'CHARACTER_LEVEL',
            levels: [
              {
                id: 'level-1',
                level: 1,
                order: 1,
                authoringModeKind: 'ALL',
                senseIds: ['sense-1']
              }
            ]
          }
        } as never
      )
    ).rejects.toThrow('cannot persist senseIds when authoringModeKind is ALL')
  })
  it('rejects all-mode spell progression levels with spell ids payload', async () => {
    await expect(
      upsertSpellGrant(
        {} as never,
        {
          id: 'spell-grant-all-level-spell-ids',
          grantKind: 'SPELL_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'PER_LEVEL',
          progression: {
            scalingSource: 'CHARACTER_LEVEL',
            levels: [
              {
                id: 'level-1',
                level: 1,
                order: 1,
                authoringModeKind: 'ALL',
                spellIds: ['spell-1']
              }
            ]
          }
        } as never
      )
    ).rejects.toThrow('cannot persist spellIds when authoringModeKind is ALL')
  })
  it('rejects selected proficiency grants without skill ids', async () => {
    await expect(
      upsertProficiencyGrant(
        {} as never,
        {
          id: 'proficiency-grant-missing-skill-ids',
          grantKind: 'PROFICIENCY_GRANT',
          proficiencyKind: 'SKILL',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          level: 'FULL'
        } as never
      )
    ).rejects.toThrow('missing skillIds')
  })
  it('rejects proficiency grants with invalid ability codes', async () => {
    await expect(
      upsertProficiencyGrant(
        {} as never,
        {
          id: 'proficiency-grant-bad-ability',
          grantKind: 'PROFICIENCY_GRANT',
          proficiencyKind: 'SAVE_ABILITY',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          abilities: ['LUCK'],
          level: 'FULL'
        } as never
      )
    ).rejects.toThrow('invalid ability code')
  })
  it('rejects proficiency grants with invalid equipment property codes', async () => {
    await expect(
      upsertProficiencyGrant(
        {} as never,
        {
          id: 'proficiency-grant-bad-property',
          grantKind: 'PROFICIENCY_GRANT',
          proficiencyKind: 'EQUIPMENT_PROPERTY',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          properties: ['SHINY'],
          level: 'FULL'
        } as never
      )
    ).rejects.toThrow('invalid property code')
  })
  it('rejects all-mode equipment-property proficiency grants with properties payload', async () => {
    await expect(
      upsertProficiencyGrant(
        {} as never,
        {
          id: 'proficiency-grant-all-equipment-property-properties',
          grantKind: 'PROFICIENCY_GRANT',
          proficiencyKind: 'EQUIPMENT_PROPERTY',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'ALL',
          properties: ['LIGHT'],
          level: 'FULL'
        } as never
      )
    ).rejects.toThrow('cannot persist properties when authoringModeKind is ALL')
  })
})
