import { describe, expect, it } from 'vitest'

import { buildCharacterSpellRuleFacts } from './characterSpellRuleFacts.js'
import { createSpellGrantPolicyFixture } from '../rules/systems/dnd5e/2014/characterSpellPolicy.fixtures.js'

describe('Character spell rule facts', () => {
  it('enumerates ordered source candidates without applying spell-access mechanics', () => {
    const { snapshot, registry } = createSpellGrantPolicyFixture()
    const facts = buildCharacterSpellRuleFacts(snapshot, registry)

    expect(facts.spellClasses).toEqual([{ classId: 'wizard' }])
    expect(
      facts.spellAccessCandidates.map((candidate) => ({
        sequence: candidate.sequence,
        spellId: candidate.spellId,
        sourceKind: candidate.sourceKind,
        inheritedFeatureDuplicate: candidate.inheritedFeatureDuplicate,
        specializationRestrictionIds: candidate.specializationRestrictionIds,
        progressionLevel: candidate.progressionLevel,
        selectedByCharacter: candidate.selectedByCharacter
      }))
    ).toEqual([
      {
        sequence: 0,
        spellId: 'shield',
        sourceKind: 'CLASS',
        inheritedFeatureDuplicate: false,
        specializationRestrictionIds: null,
        progressionLevel: null,
        selectedByCharacter: false
      },
      {
        sequence: 1,
        spellId: 'fog-cloud',
        sourceKind: 'SUBCLASS',
        inheritedFeatureDuplicate: false,
        specializationRestrictionIds: ['arctic'],
        progressionLevel: 3,
        selectedByCharacter: false
      },
      {
        sequence: 2,
        spellId: 'ice-storm',
        sourceKind: 'SUBCLASS',
        inheritedFeatureDuplicate: false,
        specializationRestrictionIds: ['arctic'],
        progressionLevel: 7,
        selectedByCharacter: false
      },
      {
        sequence: 3,
        spellId: 'mirror-image',
        sourceKind: 'SUBCLASS',
        inheritedFeatureDuplicate: false,
        specializationRestrictionIds: ['coast'],
        progressionLevel: null,
        selectedByCharacter: false
      },
      {
        sequence: 4,
        spellId: 'dancing-lights',
        sourceKind: 'RACE',
        inheritedFeatureDuplicate: false,
        specializationRestrictionIds: null,
        progressionLevel: null,
        selectedByCharacter: false
      },
      {
        sequence: 5,
        spellId: 'dancing-lights',
        sourceKind: 'SUBRACE',
        inheritedFeatureDuplicate: true,
        specializationRestrictionIds: null,
        progressionLevel: null,
        selectedByCharacter: false
      },
      {
        sequence: 6,
        spellId: 'fire-bolt',
        sourceKind: 'SUBRACE',
        inheritedFeatureDuplicate: false,
        specializationRestrictionIds: null,
        progressionLevel: null,
        selectedByCharacter: true
      },
      {
        sequence: 7,
        spellId: 'fire-bolt',
        sourceKind: 'SUBRACE',
        inheritedFeatureDuplicate: false,
        specializationRestrictionIds: null,
        progressionLevel: null,
        selectedByCharacter: true
      },
      {
        sequence: 8,
        spellId: 'mage-hand',
        sourceKind: 'SUBRACE',
        inheritedFeatureDuplicate: false,
        specializationRestrictionIds: null,
        progressionLevel: null,
        selectedByCharacter: false
      }
    ])
  })
})
