import { describe, expect, it } from 'vitest'

import { encounterCreatureRuleFactsSnapshotSchema } from '@artificer-toolkit/schema/api/encounterActorRules'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { compileInstalledCreatureRuleFacts } from '../../platformRulesRuntime.js'
import { compileDnd5eCreatureRuleFacts } from './creatureRuleFacts.js'

const ids = {
  snapshot: '00000000-0000-4000-8000-000000000010',
  strength: '00000000-0000-4000-8000-000000000011',
  dexterity: '00000000-0000-4000-8000-000000000012',
  athletics: '00000000-0000-4000-8000-000000000013',
  acrobatics: '00000000-0000-4000-8000-000000000014',
  foreign: '00000000-0000-4000-8000-000000000015',
  cr: '00000000-0000-4000-8000-000000000016'
}

function vocabulary(): SystemVocabularySnapshot {
  return {
    snapshotId: ids.snapshot,
    systemId: DND5E_SYSTEM_ID,
    snapshotVersion: 1,
    schemaVersion: 4,
    checksum: 'a'.repeat(64),
    document: {
      schemaVersion: 4,
      id: DND5E_SYSTEM_ID,
      label: 'Test',
      rulesetCode: 'test',
      rulesetVersion: '1',
      userId: 'system',
      alignments: [],
      challengeRatings: [{ id: ids.cr, code: 'CR_7', label: '7' }],
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
      speeds: [],
      terrains: [],
      abilities: [
        { id: ids.strength, code: 'STRENGTH', label: 'Strength' },
        { id: ids.dexterity, code: 'DEXTERITY', label: 'Dexterity' }
      ],
      skills: [
        {
          id: ids.athletics,
          code: 'ATHLETICS',
          label: 'Athletics',
          governingAbilityDefinitionId: ids.strength
        },
        {
          id: ids.acrobatics,
          code: 'ACROBATICS',
          label: 'Acrobatics',
          governingAbilityDefinitionId: ids.dexterity
        }
      ]
    }
  }
}

function creature(
  input: {
    challengeRatingId?: string
    proficiencies?: unknown[]
    abilityScores?: Record<string, number>
  } = {}
): CreatureAuthored {
  return {
    id: 'creature',
    label: 'Creature',
    userId: 'user',
    systemId: DND5E_SYSTEM_ID,
    category: 'NPC',
    creatureTypeId: 'humanoid',
    size: 'MEDIUM',
    abilityScores: input.abilityScores ?? { STRENGTH: 14, DEXTERITY: 12 },
    armorClass: 10,
    hitPoints: 10,
    speeds: [],
    ...(input.challengeRatingId ? { challengeRatingId: input.challengeRatingId } : {}),
    ...(input.proficiencies
      ? { proficiencies: input.proficiencies as CreatureAuthored['proficiencies'] }
      : {})
  }
}

function skillProficiency(skillId: string, level: 'FULL' | 'DOUBLE' | 'HALF' = 'FULL') {
  return {
    id: `proficiency:${skillId}`,
    grantKind: 'PROFICIENCY_GRANT',
    proficiencyKind: 'SKILL',
    selectionKind: 'GRANTED',
    scalingKind: 'NONE',
    authoringModeKind: 'SELECTED',
    level,
    ...(level === 'HALF' ? { rounding: 'DOWN' } : {}),
    skillIds: [skillId],
    order: 0
  }
}

describe('D&D Creature rule facts', () => {
  it('pins UUID check totals for proficient and unproficient checks', () => {
    const result = compileDnd5eCreatureRuleFacts({
      vocabulary: vocabulary(),
      creature: creature({
        challengeRatingId: ids.cr,
        proficiencies: [skillProficiency(ids.athletics), skillProficiency(ids.acrobatics, 'DOUBLE')]
      })
    })

    expect(result.checkTotals).toEqual({
      [ids.athletics]: 5,
      [ids.acrobatics]: 7
    })
  })

  it('computes unproficient checks without a Challenge Rating and omits proficient checks', () => {
    const result = compileDnd5eCreatureRuleFacts({
      vocabulary: vocabulary(),
      creature: creature({ proficiencies: [skillProficiency(ids.athletics)] })
    })

    expect(result.checkTotals).toEqual({ [ids.acrobatics]: 1 })
  })

  it('omits checks whose governing score is unavailable', () => {
    const result = compileDnd5eCreatureRuleFacts({
      vocabulary: vocabulary(),
      creature: creature({ abilityScores: { DEXTERITY: 12 } })
    })

    expect(result.checkTotals).toEqual({ [ids.acrobatics]: 1 })
  })

  it('uses authored half-proficiency rounding', () => {
    const result = compileDnd5eCreatureRuleFacts({
      vocabulary: vocabulary(),
      creature: creature({
        challengeRatingId: ids.cr,
        proficiencies: [skillProficiency(ids.athletics, 'HALF')]
      })
    })

    expect(result.checkTotals?.[ids.athletics]).toBe(3)
  })

  it('rejects foreign skill proficiency identities', () => {
    expect(() =>
      compileDnd5eCreatureRuleFacts({
        vocabulary: vocabulary(),
        creature: creature({
          challengeRatingId: ids.cr,
          proficiencies: [skillProficiency(ids.foreign)]
        })
      })
    ).toThrow('missing or foreign System check')
  })

  it('rejects a Creature paired with another System vocabulary before adapter selection', () => {
    expect(() =>
      compileInstalledCreatureRuleFacts({
        vocabulary: vocabulary(),
        creature: { ...creature(), systemId: ids.foreign }
      })
    ).toThrow('identities do not match')
  })

  it('reads historical snapshots without check totals as an empty record', () => {
    const parsed = encounterCreatureRuleFactsSnapshotSchema.parse({
      gameSystemId: DND5E_SYSTEM_ID,
      vocabularySnapshotId: ids.snapshot,
      vocabularySnapshotVersion: 1,
      vocabularySnapshotChecksum: 'a'.repeat(64),
      abilityScores: { [ids.dexterity]: 12 },
      resourceAbilityScores: { DEXTERITY: 12 },
      initiativeAbilityDefinitionId: ids.dexterity
    })
    expect(parsed.checkTotals).toBeUndefined()
  })
})
