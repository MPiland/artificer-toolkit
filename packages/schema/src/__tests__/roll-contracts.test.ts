import { describe, expect, it } from 'vitest'
import {
  executeDiceConfigurationInputDtoSchema,
  executeRollInputDtoSchema,
  rollHistoryResponseDtoSchema
} from '../api/rolls.js'

describe('roll contracts', () => {
  it('accepts the bounded execute contract and rejects client-supplied results', () => {
    expect(
      executeRollInputDtoSchema.parse({
        characterId: 'character-1',
        expression: '2d6 + 3',
        source: { kind: 'DAMAGE', label: 'Shortsword' }
      })
    ).toEqual({
      characterId: 'character-1',
      expression: '2d6 + 3',
      source: { kind: 'DAMAGE', label: 'Shortsword' }
    })

    expect(() =>
      executeRollInputDtoSchema.parse({
        characterId: 'character-1',
        expression: '1d20',
        source: { kind: 'MANUAL', label: 'Manual', total: 20 }
      })
    ).toThrow()
  })

  it('caps account history at twenty records', () => {
    expect(() =>
      rollHistoryResponseDtoSchema.parse(Array.from({ length: 21 }, () => ({})))
    ).toThrow()
  })

  it('accepts standalone keep, drop, and reroll configurations', () => {
    expect(executeDiceConfigurationInputDtoSchema.parse({ configuration: ' 4d6dl1r1 ' })).toEqual({
      configuration: '4d6dl1r1'
    })
    expect(() =>
      executeDiceConfigurationInputDtoSchema.parse({ configuration: '2d6 + 1d4' })
    ).toThrow('one unmodified dice term')
  })

  it('rejects unsupported dice grammar at the API boundary', () => {
    expect(() =>
      executeRollInputDtoSchema.parse({
        characterId: 'character-1',
        expression: '1d3 + 2',
        source: { kind: 'MANUAL', label: 'Manual' }
      })
    ).toThrow()
  })

  it('accepts a System roll mode code and rejects a malformed one', () => {
    expect(
      executeRollInputDtoSchema.parse({
        characterId: 'character-1',
        expression: '1d20 + 3',
        rollMode: 'ADVANTAGE',
        source: { kind: 'ATTACK', label: 'Longsword' }
      }).rollMode
    ).toBe('ADVANTAGE')

    expect(() =>
      executeRollInputDtoSchema.parse({
        characterId: 'character-1',
        expression: '1d20',
        rollMode: 'not a code',
        source: { kind: 'MANUAL', label: 'Manual' }
      })
    ).toThrow()
  })
})
