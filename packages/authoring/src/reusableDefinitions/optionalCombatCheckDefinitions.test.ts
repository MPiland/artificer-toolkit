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

function srdDocument(kind: 'OVERRUN' | 'SHOVE_ASIDE' | 'TUMBLE') {
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
