import { describe, expect, it } from 'vitest'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'
import type { SenseReusableDefinitionDocumentDto } from '@artificer-toolkit/schema/shared/combatPerception'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CharacterAssemblyRegistry } from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { dnd5e2014CharacterPolicyDocument } from '../rules/systems/dnd5e/2014/characterPolicy.js'
import {
  advanceCharacterMechanicsProjectionCommandState,
  carryPinnedCharacterSenseDefinitions,
  compileCharacterMechanicsProjection
} from './characterMechanicsCompiler.js'

const checksum = (value: string) => value.repeat(64)
const SYSTEM_ID = '00000000-0000-4000-8000-000000000301'
const SENSE_DEFINITION_ID = '00000000-0000-4000-8000-000000000303'

function senseRange(amount: number) {
  return {
    id: '00000000-0000-4000-8000-000000000304',
    amount,
    unit: 'FEET' as const,
    calculation: {
      base: amount,
      effective: amount,
      contributions: [],
      override: null
    }
  }
}

function pinnedSense(amount: number) {
  const document: SenseReusableDefinitionDocumentDto = {
    schemaVersion: 1 as const,
    kind: 'SENSE' as const,
    id: SENSE_DEFINITION_ID,
    gameSystemId: SYSTEM_ID,
    capabilities: [
      {
        channel: 'VISUAL' as const,
        accessGrade: 'PRECISE' as const,
        satisfies: ['SEE'],
        illuminationAccess: 'ORDINARY_DARKNESS' as const,
        obscurementAccess: 'IGNORE' as const,
        perceivesInvisible: false,
        physicalConstraints: []
      }
    ]
  }
  return {
    senseDefinitionId: SENSE_DEFINITION_ID,
    definitionVersion: 1,
    definitionContractVersion: 1,
    definitionChecksum: checksumRuleDocument(document),
    document,
    range: senseRange(amount)
  }
}

function policyFixture() {
  const fixture = dnd5e2014CharacterPolicyDocument.fixtures.find(
    (candidate) => candidate.modelKey === 'character-policy'
  )
  if (!fixture) throw new Error('Character policy fixture is missing.')
  return {
    input: characterRulePolicyInputSchema.parse(fixture.input),
    output: characterRulePolicyOutputSchema.parse(fixture.expected)
  }
}

const registry: CharacterAssemblyRegistry = {
  backgrounds: {},
  classes: {},
  equipment: {},
  feats: {},
  features: {},
  races: {},
  spells: {}
}

const characterCommandState: CharacterAuthored = {
  id: 'character-1',
  label: 'Aria',
  status: 'ACTIVE',
  profile: {},
  systemId: SYSTEM_ID,
  primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000302',
  userId: 'user-1',
  intent: {
    advancement: { method: 'MILESTONE' },
    race: { raceId: 'race-1' },
    background: { backgroundId: 'background-1' },
    classes: [{ classId: 'class-1', classLevel: 1 }],
    abilities: {
      method: 'STANDARD_ARRAY',
      assignments: [{ ability: 'DEXTERITY', option: '14' }]
    },
    hitpoints: {
      method: 'FIXED',
      levels: [{ level: 1, classId: 'class-1', classLevel: 1, value: 10 }]
    },
    featureAcquisitions: []
  },
  state: {
    equipment: { inventory: [], equipped: [], attuned: [] },
    currency: [],
    hitpoints: { current: 10, hitDice: [] }
  }
}

describe('compileCharacterMechanicsProjection', () => {
  it('produces the same checksum for the same bounded inputs regardless of vector order', () => {
    const policy = policyFixture()
    const input = {
      characterId: 'character-1',
      characterCommandState,
      characterStreamVersion: 3,
      vocabularySnapshot: {
        snapshotId: 'system-snapshot-1',
        snapshotVersion: 2,
        checksum: checksum('a'),
        document: {
          id: SYSTEM_ID,
          label: 'System',
          rulesetCode: 'dnd5e',
          rulesetVersion: '2014',
          userId: 'user-1',
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
          terrains: []
        }
      },
      ruleBinding: {
        revisionId: 'revision-1',
        checksum: checksum('b'),
        evaluatorKind: 'ZEN' as const,
        evaluatorVersion: '1.0.0',
        modelContractVersion: 4
      },
      rulePolicyInput: policy.input,
      rulePolicyOutput: policy.output,
      compiledActionEntryPoints: [],
      ruleRegistry: registry,
      ruleSnapshot: {
        characterId: 'character-1',
        systemId: SYSTEM_ID,
        totalLevel: 1,
        classes: [],
        abilities: {},
        hitpoints: [],
        features: [],
        equipmentItems: []
      },
      authoredVersionVector: [
        {
          subjectKind: 'RACE' as const,
          subjectId: 'race-1',
          versionId: 'race-version-1',
          version: 1,
          checksum: checksum('c')
        },
        {
          subjectKind: 'CLASS' as const,
          subjectId: 'class-1',
          versionId: 'class-version-1',
          version: 1,
          checksum: checksum('d')
        }
      ]
    }

    const first = compileCharacterMechanicsProjection(input)
    const rebuilt = compileCharacterMechanicsProjection({
      ...input,
      authoredVersionVector: [...input.authoredVersionVector].reverse()
    })

    expect(rebuilt).toEqual(first)
    expect(rebuilt.projectionChecksum).toMatch(/^[a-f0-9]{64}$/)
    expect(first.projectionChecksum).toBe(
      'd5e2769165804693e0ecd365b160bc41faf48677d5fcf07de9ed8a5c09c93fcc'
    )
    expect(rebuilt.commandStateChecksum).toMatch(/^[a-f0-9]{64}$/)
    expect(rebuilt.commandLaneChecksum).toMatch(/^[a-f0-9]{64}$/)
    expect(
      compileCharacterMechanicsProjection({
        ...input,
        characterCommandState: {
          ...input.characterCommandState,
          state: {
            ...input.characterCommandState.state,
            hitpoints: {
              ...input.characterCommandState.state.hitpoints,
              current: 9
            }
          }
        }
      })
    ).toMatchObject({
      commandStateChecksum: expect.not.stringMatching(
        new RegExp(`^${first.commandStateChecksum}$`)
      ),
      commandLaneChecksum: expect.not.stringMatching(new RegExp(`^${first.commandLaneChecksum}$`)),
      projectionChecksum: expect.not.stringMatching(new RegExp(`^${first.projectionChecksum}$`))
    })
    expect(
      compileCharacterMechanicsProjection({
        ...input,
        ruleSnapshot: {
          ...input.ruleSnapshot,
          classes: [{ classId: 'class-1', level: 1 }]
        }
      }).projectionChecksum
    ).not.toBe(first.projectionChecksum)

    const nextState = {
      ...characterCommandState,
      state: {
        ...characterCommandState.state,
        hitpoints: {
          ...characterCommandState.state.hitpoints,
          current: 9,
          temp: 2
        }
      }
    }
    const advanced = advanceCharacterMechanicsProjectionCommandState({
      current: first,
      characterCommandState: nextState,
      characterStreamVersion: 4
    })
    expect(
      advanceCharacterMechanicsProjectionCommandState({
        current: first,
        characterCommandState: nextState,
        characterStreamVersion: 4
      })
    ).toEqual(advanced)
    expect(advanced).toMatchObject({
      characterStreamVersion: 4,
      commandState: { state: { hitpoints: { current: 9, temp: 2 } } },
      authoredVersionVector: first.authoredVersionVector,
      rulePolicyInput: first.rulePolicyInput,
      rulePolicyOutput: first.rulePolicyOutput,
      compiledActionEntryPoints: first.compiledActionEntryPoints
    })
    expect(advanced.commandLaneChecksum).not.toBe(first.commandLaneChecksum)
    expect(advanced.projectionChecksum).not.toBe(first.projectionChecksum)
  })

  it('pins exact race size and equipped-item property codes for System initiative policy', () => {
    const policy = policyFixture()
    const projection = compileCharacterMechanicsProjection({
      characterId: 'character-initiative-facts',
      characterCommandState,
      characterStreamVersion: 1,
      vocabularySnapshot: {
        snapshotId: 'system-snapshot-initiative-facts',
        snapshotVersion: 1,
        checksum: checksum('a')
      },
      ruleBinding: {
        revisionId: 'revision-initiative-facts',
        checksum: checksum('b'),
        evaluatorKind: 'ZEN',
        evaluatorVersion: '1.0.0',
        modelContractVersion: 4
      },
      rulePolicyInput: policy.input,
      rulePolicyOutput: policy.output,
      compiledActionEntryPoints: [],
      ruleRegistry: {
        ...registry,
        races: {
          'race-initiative': {
            id: 'race-initiative',
            category: 'BASE',
            size: 'MEDIUM'
          } as CharacterAssemblyRegistry['races'][string]
        }
      },
      ruleSnapshot: {
        characterId: 'character-initiative-facts',
        systemId: SYSTEM_ID,
        totalLevel: 1,
        raceId: 'race-initiative',
        classes: [],
        abilities: {},
        hitpoints: [],
        features: [],
        equipmentItems: [
          {
            instanceId: 'item-initiative',
            contentRef: {
              definitionId: 'equipment-initiative',
              binding: { kind: 'ACTIVE' },
              systemId: SYSTEM_ID
            },
            equippedState: { slot: 'MAIN_HAND' },
            attuned: false,
            compiledItem: {
              id: 'equipment-initiative',
              category: 'WEAPON',
              properties: ['HEAVY', 'MELEE'],
              rarityId: 'rarity'
            }
          }
        ]
      },
      authoredVersionVector: []
    })

    expect(projection.initiativeActorFacts).toEqual({
      effectiveSize: 'MEDIUM',
      equippedItems: [
        {
          itemInstanceId: 'item-initiative',
          equipmentDefinitionId: 'equipment-initiative',
          properties: ['HEAVY', 'MELEE']
        }
      ]
    })
  })

  it('pins exact sense documents and rejects a mismatched effective range', () => {
    const policy = policyFixture()
    const senses = [
      {
        senseDefinitionId: SENSE_DEFINITION_ID,
        range: senseRange(60)
      }
    ]
    const projection = compileCharacterMechanicsProjection({
      characterId: 'character-1',
      characterCommandState,
      characterStreamVersion: 1,
      vocabularySnapshot: {
        snapshotId: 'system-snapshot-1',
        snapshotVersion: 2,
        checksum: checksum('a')
      },
      ruleBinding: {
        revisionId: 'revision-1',
        checksum: checksum('b'),
        evaluatorKind: 'ZEN',
        evaluatorVersion: '1.0.0',
        modelContractVersion: 4
      },
      rulePolicyInput: policy.input,
      rulePolicyOutput: { ...policy.output, senses },
      pinnedSenseDefinitions: [pinnedSense(60)],
      compiledActionEntryPoints: [],
      ruleRegistry: registry,
      ruleSnapshot: {
        characterId: 'character-1',
        systemId: SYSTEM_ID,
        totalLevel: 1,
        classes: [],
        abilities: {},
        hitpoints: [],
        features: [],
        equipmentItems: []
      },
      authoredVersionVector: []
    })

    expect(projection.pinnedSenseDefinitions).toEqual([pinnedSense(60)])
    expect(() =>
      compileCharacterMechanicsProjection({
        ...projection,
        characterCommandState,
        characterStreamVersion: 2,
        vocabularySnapshot: {
          snapshotId: 'system-snapshot-1',
          snapshotVersion: 2,
          checksum: checksum('a')
        },
        ruleBinding: {
          revisionId: 'revision-1',
          checksum: checksum('b'),
          evaluatorKind: 'ZEN',
          evaluatorVersion: '1.0.0',
          modelContractVersion: 4
        },
        rulePolicyInput: policy.input,
        rulePolicyOutput: { ...policy.output, senses },
        pinnedSenseDefinitions: [pinnedSense(30)],
        compiledActionEntryPoints: [],
        ruleRegistry: registry,
        ruleSnapshot: {
          characterId: 'character-1',
          systemId: SYSTEM_ID,
          totalLevel: 1,
          classes: [],
          abilities: {},
          hitpoints: [],
          features: [],
          equipmentItems: []
        },
        authoredVersionVector: []
      })
    ).toThrow(/range/i)
  })

  it('carries prior sense documents forward without repinning', () => {
    const prior = pinnedSense(60)
    const carried = carryPinnedCharacterSenseDefinitions({
      prior: [prior],
      senses: [{ senseDefinitionId: SENSE_DEFINITION_ID, range: senseRange(90) }]
    })

    expect(carried).toEqual([{ ...prior, range: senseRange(90) }])
    expect(() =>
      carryPinnedCharacterSenseDefinitions({
        prior: [],
        senses: [{ senseDefinitionId: SENSE_DEFINITION_ID, range: senseRange(90) }]
      })
    ).toThrow(/no prior immutable definition pin/i)
  })
})
