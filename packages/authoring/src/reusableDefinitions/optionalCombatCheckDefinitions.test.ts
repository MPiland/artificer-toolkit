import { describe, expect, it } from 'vitest'

import {
  dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema,
  type Dnd5eOptionalCombatReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import {
  SRD_ACROBATICS_SKILL_ID,
  SRD_ATHLETICS_SKILL_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  OptionalCombatCheckDefinitionError,
  optionalCombatCheckDefinitionIds,
  validateOptionalCombatCheckDefinitions
} from './optionalCombatCheckDefinitions.js'

function srdDocument(kind: 'CLIMB_ONTO_LARGER_CREATURE' | 'OVERRUN' | 'SHOVE_ASIDE' | 'TUMBLE') {
  const definition = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
    (candidate) => candidate.document.kind === kind
  )
  if (!definition) throw new Error(`Missing SRD ${kind}.`)
  return structuredClone(definition.document)
}

function validate(document: Dnd5eOptionalCombatReusableDefinitionDocumentDto) {
  validateOptionalCombatCheckDefinitions({ document, systemVocabulary: srdSystemRecord })
}

describe('the SRD movement contests, as authored optional-combat definitions (MOVE-2)', () => {
  it('pins the contest checks the rules name: Overrun and Tumble one each side, Shove Aside a defender choice', () => {
    expect(optionalCombatCheckDefinitionIds(srdDocument('OVERRUN'))).toEqual([
      SRD_ATHLETICS_SKILL_ID,
      SRD_ATHLETICS_SKILL_ID
    ])
    expect(optionalCombatCheckDefinitionIds(srdDocument('TUMBLE'))).toEqual([
      SRD_ACROBATICS_SKILL_ID,
      SRD_ACROBATICS_SKILL_ID
    ])
    expect(optionalCombatCheckDefinitionIds(srdDocument('SHOVE_ASIDE'))).toEqual([
      SRD_ATHLETICS_SKILL_ID,
      SRD_ATHLETICS_SKILL_ID,
      SRD_ACROBATICS_SKILL_ID
    ])
  })

  it.each(['OVERRUN', 'SHOVE_ASIDE', 'TUMBLE'] as const)(
    'publishes the SRD %s against the SRD System vocabulary',
    (kind) => {
      expect(() => validate(srdDocument(kind))).not.toThrow()
    }
  )

  it('publishes a homebrew Tumble contested with Athletics, built from the same parameters', () => {
    const document = srdDocument('TUMBLE')
    if (document.parameters.kind !== 'TUMBLE') throw new Error('Tumble must author its checks.')
    document.parameters.targetCheckDefinitionId = SRD_ATHLETICS_SKILL_ID
    expect(() =>
      validate(dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse(document))
    ).not.toThrow()
  })

  it('refuses a check outside the System vocabulary, or a vocabulary of another System', () => {
    const document = srdDocument('OVERRUN')
    if (document.parameters.kind !== 'OVERRUN') throw new Error('Overrun must author its checks.')
    document.parameters.targetCheckDefinitionId = '00000000-0000-4000-8000-00000000ffff'
    expect(() => validate(document)).toThrow(OptionalCombatCheckDefinitionError)
    expect(() =>
      validateOptionalCombatCheckDefinitions({
        document: srdDocument('SHOVE_ASIDE'),
        systemVocabulary: { ...srdSystemRecord, id: '00000000-0000-4000-8000-00000000fffe' }
      })
    ).toThrow('Optional combat check definitions must use the same Game System vocabulary.')
  })

  it('pins the climb-onto checks: Athletics or Acrobatics for the climber, Acrobatics for the target', () => {
    const document = srdDocument('CLIMB_ONTO_LARGER_CREATURE')
    expect(optionalCombatCheckDefinitionIds(document)).toEqual([
      SRD_ATHLETICS_SKILL_ID,
      SRD_ACROBATICS_SKILL_ID,
      SRD_ACROBATICS_SKILL_ID
    ])
    expect(document.parameters).toMatchObject({ minimumTargetSizeSteps: 1, economies: ['ACTION'] })
    expect(() => validate(document)).not.toThrow()
  })

  it('authors the cling a won climb gives the target on the climb parameters, as a relationship', () => {
    const document = srdDocument('CLIMB_ONTO_LARGER_CREATURE')
    if (document.parameters.kind !== 'CLIMB_ONTO_LARGER_CREATURE')
      throw new Error('Climb onto must author its parameters.')
    expect(JSON.stringify(document.parameters.effect)).toContain('ACTOR_RELATIONSHIP')
    expect(() =>
      validate(dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse(document))
    ).not.toThrow()
    const { effect: _effect, ...withoutEffect } = document.parameters
    expect(
      dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.safeParse({
        ...document,
        parameters: withoutEffect
      }).success
    ).toBe(false)
  })

  it('publishes a homebrew climb-onto built from the same parameters, and refuses a broken one', () => {
    const document = srdDocument('CLIMB_ONTO_LARGER_CREATURE')
    if (document.parameters.kind !== 'CLIMB_ONTO_LARGER_CREATURE')
      throw new Error('Climb onto must author its checks.')
    document.parameters.initiatorCheckDefinitionIds = [SRD_ATHLETICS_SKILL_ID]
    document.parameters.targetCheckDefinitionId = SRD_ATHLETICS_SKILL_ID
    document.parameters.minimumTargetSizeSteps = 2
    document.parameters.economies = ['ACTION', 'BONUS_ACTION']
    expect(() =>
      validate(dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse(document))
    ).not.toThrow()
    const parses = (parameters: Record<string, unknown>) =>
      dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.safeParse({
        ...document,
        parameters: { ...document.parameters, ...parameters }
      }).success
    expect(parses({ minimumTargetSizeSteps: 0 })).toBe(false)
    expect(parses({ economies: [] })).toBe(false)
    expect(parses({ economies: ['ACTION', 'ACTION'] })).toBe(false)
    expect(parses({ initiatorCheckDefinitionIds: [] })).toBe(false)
    document.parameters.initiatorCheckDefinitionIds = ['00000000-0000-4000-8000-00000000ffff']
    expect(() => validate(document)).toThrow(OptionalCombatCheckDefinitionError)
  })

  it('accepts only the closed parameter arm of each movement contest', () => {
    const overrun = srdDocument('OVERRUN')
    const shoveAside = srdDocument('SHOVE_ASIDE')
    expect(
      dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.safeParse({
        ...overrun,
        parameters: { ...shoveAside.parameters, kind: 'OVERRUN' }
      }).success
    ).toBe(false)
    expect(
      dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.safeParse({
        ...shoveAside,
        parameters: { ...shoveAside.parameters, defenderCheckDefinitionIds: [] }
      }).success
    ).toBe(false)
  })
})
