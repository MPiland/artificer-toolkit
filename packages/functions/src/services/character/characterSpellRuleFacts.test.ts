import { describe, expect, it } from 'vitest'

import {
  buildCharacterSpellRuleFacts,
  collectCharacterRuleInputSpellIds,
  collectCharacterRuleOutputSpellIds,
  isCharacterSpellActionAccessCandidate
} from './characterSpellRuleFacts.js'
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

  it('uses one boundary for selected and fixed mechanics while retaining unselected eligibility', () => {
    const { snapshot, registry } = createSpellGrantPolicyFixture()
    const candidates = buildCharacterSpellRuleFacts(snapshot, registry).spellAccessCandidates

    expect(
      candidates.filter(isCharacterSpellActionAccessCandidate).map(({ spellId }) => spellId)
    ).toEqual([
      'shield',
      'fog-cloud',
      'ice-storm',
      'mirror-image',
      'dancing-lights',
      'dancing-lights',
      'fire-bolt',
      'fire-bolt'
    ])
    expect(
      candidates.filter((candidate) => !isCharacterSpellActionAccessCandidate(candidate))
    ).toEqual([expect.objectContaining({ spellId: 'mage-hand', selectedByCharacter: false })])
  })

  it('collects only snapshot, selected or fixed grant, and explicit reference Spell inputs', () => {
    const { snapshot, registry } = createSpellGrantPolicyFixture()
    const candidates = buildCharacterSpellRuleFacts(snapshot, registry).spellAccessCandidates

    const spellIds = collectCharacterRuleInputSpellIds({
      referenceSpellIds: ['reference-spell', 'shield'],
      spellAccessCandidates: candidates,
      spellSources: [{ spellId: 'snapshot-spell' }]
    })

    expect([...spellIds]).toEqual([
      'snapshot-spell',
      'shield',
      'fog-cloud',
      'ice-storm',
      'mirror-image',
      'dancing-lights',
      'fire-bolt',
      'reference-spell'
    ])
    expect(spellIds.has('mage-hand')).toBe(false)
  })

  it('collects active output state, dedupes IDs, and excludes available-only Spells', () => {
    const output = {
      spellAccess: [{ spellId: 'grant-spell' }, { spellId: 'duplicate-spell' }],
      classSpellStates: [
        {
          learnedSpellIds: ['class-learned-spell', 'duplicate-spell'],
          preparedSpellIds: ['class-prepared-spell']
        }
      ],
      spellPreparation: {
        sources: [
          {
            availableSpellIds: ['available-only-spell'],
            learnedSpellIds: ['preparation-learned-spell', 'duplicate-spell'],
            preparedSpellIds: ['preparation-prepared-spell']
          }
        ]
      }
    }

    expect([...collectCharacterRuleOutputSpellIds(output)]).toEqual([
      'grant-spell',
      'duplicate-spell',
      'class-learned-spell',
      'class-prepared-spell',
      'preparation-learned-spell',
      'preparation-prepared-spell'
    ])
  })
})
