import { describe, expect, it } from 'vitest'

import { SPELLCASTING_ATTRIBUTE } from '@artificer-toolkit/shared/core'

import {
  collectCharacterSpellPreparationEligibility,
  getCharacterSpellKnownEligibleIdsByClass
} from './characterSpellPreparationEligibility.js'

const classIds = {
  cleric: '00000000-0000-4000-8000-000000000101',
  wizard: '00000000-0000-4000-8000-000000000102',
  warlock: '00000000-0000-4000-8000-000000000103'
}

function source(classId: string, attributes: string[]) {
  return {
    sourceKind: 'CLASS' as const,
    sourceId: classId,
    attributes,
    abilityIndex: 0,
    spellLimits: [{ classLevel: 1, preparedSpellsLimit: null, spellLevels: [1] }],
    prepareLimit: attributes.includes(SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS)
      ? {
          methodKinds: ['CLASS_LEVEL' as const],
          scaling: 'FULL' as const,
          rounding: null,
          perLevel: []
        }
      : null
  }
}

describe('Character Spell preparation eligibility', () => {
  it('uses full-list availability for a preparation-capable source', () => {
    const result = collectCharacterSpellPreparationEligibility({
      rulePolicyInput: {
        spellPreparationClasses: [
          {
            classId: classIds.cleric,
            classLevel: 1,
            sources: [source(classIds.cleric, [SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS])],
            learnedStatePresent: false,
            learnedStateSpellIds: [],
            intentSpellIds: [],
            preparedStateSpellIds: []
          }
        ]
      },
      rulePolicyOutput: {
        spellPreparation: {
          sources: [
            {
              classId: classIds.cleric,
              sourceIds: [classIds.cleric],
              preparedSpellLimit: 2,
              maxPreparableSpellLevel: 1,
              availableSpellIds: ['healing-word', 'bless'],
              learnedSpellIds: [],
              preparedSpellIds: ['bless']
            }
          ],
          requestDecision: null
        }
      }
    })

    expect(result).toEqual([
      {
        classId: classIds.cleric,
        preparedSpellLimit: 2,
        eligibleSpellIds: ['bless', 'healing-word'],
        preparedSpellIds: ['bless']
      }
    ])
  })

  it('limits a spellbook source to learned and available spells', () => {
    const result = collectCharacterSpellPreparationEligibility({
      rulePolicyInput: {
        spellPreparationClasses: [
          {
            classId: classIds.wizard,
            classLevel: 1,
            sources: [
              source(classIds.wizard, [
                SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS,
                SPELLCASTING_ATTRIBUTE.USES_SPELLBOOK
              ])
            ],
            learnedStatePresent: true,
            learnedStateSpellIds: ['magic-missile'],
            intentSpellIds: ['magic-missile'],
            preparedStateSpellIds: []
          }
        ]
      },
      rulePolicyOutput: {
        spellPreparation: {
          sources: [
            {
              classId: classIds.wizard,
              sourceIds: [classIds.wizard],
              preparedSpellLimit: 2,
              maxPreparableSpellLevel: 1,
              availableSpellIds: ['magic-missile', 'shield', 'above-level'],
              learnedSpellIds: ['magic-missile', 'not-available'],
              preparedSpellIds: []
            }
          ],
          requestDecision: null
        }
      }
    })

    expect(result[0]?.eligibleSpellIds).toEqual(['magic-missile'])
  })

  it('returns no options for a known-only source', () => {
    const result = collectCharacterSpellPreparationEligibility({
      rulePolicyInput: {
        spellPreparationClasses: [
          {
            classId: classIds.warlock,
            classLevel: 1,
            sources: [source(classIds.warlock, [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT])],
            learnedStatePresent: true,
            learnedStateSpellIds: ['hex'],
            intentSpellIds: ['hex'],
            preparedStateSpellIds: []
          }
        ]
      },
      rulePolicyOutput: {
        spellPreparation: {
          sources: [
            {
              classId: classIds.warlock,
              sourceIds: [classIds.warlock],
              preparedSpellLimit: null,
              maxPreparableSpellLevel: 0,
              availableSpellIds: ['hex'],
              learnedSpellIds: ['hex'],
              preparedSpellIds: []
            }
          ],
          requestDecision: null
        }
      }
    })

    expect(result).toEqual([])
  })

  it('derives known-spell admission from structured source capability', () => {
    const result = getCharacterSpellKnownEligibleIdsByClass({
      rulePolicyInput: {
        spellPreparationClasses: [
          {
            classId: classIds.warlock,
            classLevel: 1,
            sources: [source(classIds.warlock, [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT])],
            learnedStatePresent: true,
            learnedStateSpellIds: ['hex'],
            intentSpellIds: ['hex'],
            preparedStateSpellIds: []
          },
          {
            classId: classIds.cleric,
            classLevel: 1,
            sources: [source(classIds.cleric, [SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS])],
            learnedStatePresent: false,
            learnedStateSpellIds: [],
            intentSpellIds: [],
            preparedStateSpellIds: []
          }
        ]
      },
      rulePolicyOutput: {
        spellPreparation: {
          sources: [
            {
              classId: classIds.warlock,
              sourceIds: [classIds.warlock],
              preparedSpellLimit: null,
              maxPreparableSpellLevel: 0,
              availableSpellIds: ['hex', 'armor-of-agathys'],
              learnedSpellIds: ['hex'],
              preparedSpellIds: []
            },
            {
              classId: classIds.cleric,
              sourceIds: [classIds.cleric],
              preparedSpellLimit: 2,
              maxPreparableSpellLevel: 1,
              availableSpellIds: ['bless'],
              learnedSpellIds: [],
              preparedSpellIds: []
            }
          ],
          requestDecision: null
        }
      }
    })

    expect([...result.get(classIds.warlock)!]).toEqual(['hex', 'armor-of-agathys'])
    expect(result.has(classIds.cleric)).toBe(false)
  })

  it('keeps multiclass preparation eligibility independent by source class', () => {
    const result = collectCharacterSpellPreparationEligibility({
      rulePolicyInput: {
        spellPreparationClasses: [
          {
            classId: classIds.cleric,
            classLevel: 1,
            sources: [source(classIds.cleric, [SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS])],
            learnedStatePresent: false,
            learnedStateSpellIds: [],
            intentSpellIds: [],
            preparedStateSpellIds: []
          },
          {
            classId: classIds.wizard,
            classLevel: 1,
            sources: [
              source(classIds.wizard, [
                SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS,
                SPELLCASTING_ATTRIBUTE.USES_SPELLBOOK
              ])
            ],
            learnedStatePresent: true,
            learnedStateSpellIds: ['magic-missile'],
            intentSpellIds: ['magic-missile'],
            preparedStateSpellIds: []
          }
        ]
      },
      rulePolicyOutput: {
        spellPreparation: {
          sources: [
            {
              classId: classIds.cleric,
              sourceIds: [classIds.cleric],
              preparedSpellLimit: 2,
              maxPreparableSpellLevel: 1,
              availableSpellIds: ['bless', 'healing-word'],
              learnedSpellIds: [],
              preparedSpellIds: []
            },
            {
              classId: classIds.wizard,
              sourceIds: [classIds.wizard],
              preparedSpellLimit: 2,
              maxPreparableSpellLevel: 1,
              availableSpellIds: ['magic-missile', 'shield'],
              learnedSpellIds: ['magic-missile'],
              preparedSpellIds: []
            }
          ],
          requestDecision: null
        }
      }
    })

    expect(result.map(({ classId, eligibleSpellIds }) => ({ classId, eligibleSpellIds }))).toEqual([
      { classId: classIds.cleric, eligibleSpellIds: ['bless', 'healing-word'] },
      { classId: classIds.wizard, eligibleSpellIds: ['magic-missile'] }
    ])
  })
})
