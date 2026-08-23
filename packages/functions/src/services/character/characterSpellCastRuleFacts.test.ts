import { describe, expect, it } from 'vitest'

import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

import {
  buildCharacterSpellCastRuleFacts,
  createCharacterSpellCastCandidateId
} from './characterSpellCastRuleFacts.js'

const snapshot: CharacterBuildSnapshot = {
  characterId: 'character-1',
  systemId: 'system-1',
  totalLevel: 3,
  classes: [],
  abilities: {},
  hitpoints: [],
  features: [],
  equipmentItems: [],
  spellSources: [
    {
      spellId: 'spell-class',
      sourceKind: 'CLASS',
      sourceInstanceId: 'CLASS:class-1'
    }
  ]
}

const accessCandidate: CharacterRulePolicyInput['spellAccessCandidates'][number] = {
  sequence: 0,
  accessId: 'access-1',
  sourceInstanceId: 'RACE:race-1:feature-1:grant-1',
  spellId: 'spell-feature',
  sourceFeatureId: 'feature-1',
  grantId: 'grant-1',
  sourceKind: 'RACE',
  sourceId: 'race-1',
  owningClassId: null,
  activeSourceLevel: 3,
  featureAvailableAtLevel: 1,
  inheritedFeatureDuplicate: false,
  specializationId: null,
  specializationRestrictionIds: null,
  selectionKind: 'GRANTED',
  authoringMode: 'SELECTED',
  selectedByCharacter: false,
  scalingKind: 'NONE',
  scalingSource: null,
  progressionLevel: null,
  totalLevel: 3,
  classLevel: null,
  attributes: ['LIMITED_USE'],
  castAtLevel: null,
  castingAbility: null,
  charge: { id: 'charge-1', limitKind: 'FIXED', resetKind: 'LONG_REST' }
}

describe('buildCharacterSpellCastRuleFacts', () => {
  it('builds raw class and feature candidates while leaving resolved state to Zen', () => {
    const facts = buildCharacterSpellCastRuleFacts({
      snapshot,
      spellCatalog: [
        {
          id: 'spell-class',
          label: 'Class spell',
          description: '',
          level: 2,
          classIds: ['class-1'],
          magicSchoolId: 'school-1',
          castingTime: { unit: 'ROUND', amount: 1 }
        },
        {
          id: 'spell-feature',
          label: 'Feature spell',
          description: '',
          level: 1,
          classIds: [],
          magicSchoolId: 'school-1',
          castingTime: { unit: 'ROUND', amount: 1 }
        }
      ],
      spellAccessCandidates: [accessCandidate],
      resourcePoolCandidates: [
        {
          sequence: 0,
          poolId: 'SPELL_SOURCE:access-1',
          ownerKind: 'SPELL_SOURCE',
          accessId: 'access-1',
          sourceInstanceId: accessCandidate.sourceInstanceId,
          spellId: accessCandidate.spellId,
          chargeId: 'charge-1',
          resourceDefinitionId: 'charge-1',
          chargeCalculationId: 'SPELL_SOURCE:access-1',
          baseResetKind: 'LONG_REST'
        }
      ]
    })

    const classSource = snapshot.spellSources![0]!
    const featureSource = {
      spellId: accessCandidate.spellId,
      sourceKind: 'FEATURE' as const,
      sourceInstanceId: accessCandidate.sourceInstanceId
    }
    expect(facts.spellCastCandidates).toHaveLength(9)
    expect(facts.spellCastCandidates.slice(0, 2)).toEqual([
      {
        sequence: 0,
        candidateId: createCharacterSpellCastCandidateId(classSource, 2),
        spellId: classSource.spellId,
        source: classSource,
        spellLevel: 2,
        castMode: 'SPELL_SLOT',
        castLevel: 2,
        baseEntry: true,
        resourceOwnerKey: null
      },
      {
        sequence: 1,
        candidateId: createCharacterSpellCastCandidateId(classSource, 3),
        spellId: classSource.spellId,
        source: classSource,
        spellLevel: 2,
        castMode: 'SPELL_SLOT',
        castLevel: 3,
        baseEntry: false,
        resourceOwnerKey: null
      }
    ])
    expect(facts.spellCastCandidates.at(-1)).toEqual({
      sequence: 8,
      candidateId: createCharacterSpellCastCandidateId(featureSource, 1),
      spellId: featureSource.spellId,
      source: featureSource,
      spellLevel: 1,
      castMode: 'LIMITED_USE',
      castLevel: 1,
      baseEntry: true,
      resourceOwnerKey: 'SPELL_SOURCE:access-1'
    })
    expect(facts.spellCastSlots).toEqual([])
    expect(facts.spellCastResources).toEqual([])
  })

  it('omits unselected CHOSEN options while retaining selected and fixed candidates', () => {
    const selected = {
      ...accessCandidate,
      accessId: 'selected-access',
      spellId: 'selected-spell',
      selectionKind: 'CHOSEN' as const,
      selectedByCharacter: true,
      attributes: ['CAST_AT_WILL' as const]
    }
    const unselected = {
      ...selected,
      accessId: 'unselected-access',
      spellId: 'unselected-spell',
      selectedByCharacter: false
    }
    const fixed = {
      ...selected,
      accessId: 'fixed-access',
      spellId: 'fixed-spell',
      selectionKind: 'GRANTED' as const,
      selectedByCharacter: false
    }
    const spellCatalog = [selected, unselected, fixed].map(({ spellId }) => ({
      id: spellId,
      label: spellId,
      description: '',
      level: 0,
      classIds: [],
      magicSchoolId: 'school-1',
      castingTime: { unit: 'ROUND' as const, amount: 1 }
    }))

    const facts = buildCharacterSpellCastRuleFacts({
      snapshot: { ...snapshot, spellSources: [] },
      spellCatalog,
      spellAccessCandidates: [unselected, selected, fixed],
      resourcePoolCandidates: []
    })

    expect(facts.spellCastCandidates.map(({ spellId }) => spellId)).toEqual([
      selected.spellId,
      fixed.spellId
    ])
  })
})
