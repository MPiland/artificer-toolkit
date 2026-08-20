import { describe, expect, it } from 'vitest'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterAssemblyRegistry } from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { dnd5e2014CharacterPolicyDocument } from '../rules/systems/dnd5e/2014/characterPolicy.js'
import {
  advanceCharacterMechanicsProjectionCommandState,
  compileCharacterMechanicsProjection
} from './characterMechanicsCompiler.js'

const checksum = (value: string) => value.repeat(64)

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
  systemId: 'system-1',
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
        systemId: 'system-1',
        snapshotVersion: 2,
        schemaVersion: 1,
        checksum: checksum('a'),
        document: {
          id: 'system-1',
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
      ruleRegistry: registry,
      ruleSnapshot: {
        characterId: 'character-1',
        systemId: 'system-1',
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
    expect(rebuilt.commandStateChecksum).toMatch(/^[a-f0-9]{64}$/)
    expect(rebuilt.commandLaneChecksum).toMatch(/^[a-f0-9]{64}$/)
    expect(
      compileCharacterMechanicsProjection({
        ...input,
        characterCommandState: {
          ...input.characterCommandState,
          state: {
            ...input.characterCommandState.state,
            hitpoints: { ...input.characterCommandState.state.hitpoints, current: 9 }
          }
        }
      })
    ).toMatchObject({
      commandStateChecksum: expect.not.stringMatching(new RegExp(`^${first.commandStateChecksum}$`)),
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
        hitpoints: { ...characterCommandState.state.hitpoints, current: 9, temp: 2 }
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
      rulePolicyOutput: first.rulePolicyOutput
    })
    expect(advanced.commandLaneChecksum).not.toBe(first.commandLaneChecksum)
    expect(advanced.projectionChecksum).not.toBe(first.projectionChecksum)
  })
})
