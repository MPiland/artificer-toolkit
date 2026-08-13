import { describe, expect, it } from 'vitest'

import {
  ruleEvaluationDtoSchema,
  rulePackDocumentDtoSchema,
  rulePackRevisionDtoSchema,
  ruleRollRequestDtoSchema,
  simulateRulePackInputDtoSchema
} from '../api/rules.js'

const revisionId = '00000000-0000-4000-8000-000000000001'
const authorId = '00000000-0000-4000-8000-000000000002'
const document = {
  schemaVersion: 1 as const,
  models: { attack: { expression: '1d20+5' } },
  fixtures: []
}

describe('rule pack contracts', () => {
  it('accepts a bounded rule pack document and simulation input', () => {
    expect(
      simulateRulePackInputDtoSchema.parse({
        document,
        modelKey: 'attack',
        input: { actorId: revisionId }
      }).modelKey
    ).toBe('attack')
  })

  it('rejects invalid model keys and documents with no models', () => {
    expect(() => rulePackDocumentDtoSchema.parse({ ...document, models: {} })).toThrow()
    expect(() =>
      rulePackDocumentDtoSchema.parse({ ...document, models: { Invalid: {} } })
    ).toThrow()
  })

  it('requires exact, checksummed revision records', () => {
    expect(
      rulePackRevisionDtoSchema.parse({
        id: revisionId,
        packId: authorId,
        revision: 1,
        lifecycle: 'DRAFT',
        checksum: 'a'.repeat(64),
        document,
        createdBy: authorId,
        activatedBy: null,
        activatedAt: null,
        createdAt: '2026-08-07T00:00:00.000Z',
        updatedAt: '2026-08-07T00:00:00.000Z'
      }).checksum
    ).toHaveLength(64)
  })

  it('defaults omitted evaluation collections to empty arrays', () => {
    expect(
      ruleEvaluationDtoSchema.parse({ eligibility: { allowed: true, reasonCode: 'ALLOWED' } })
    ).toMatchObject({ rollRequests: [], outcomes: [] })
  })

  it('accepts only executable standalone dice configurations for roll requests', () => {
    const request = {
      id: revisionId,
      kind: 'ATTACK',
      label: 'Attack roll',
      targetActorId: null
    }
    expect(ruleRollRequestDtoSchema.parse({ ...request, configuration: '1d20' })).toMatchObject({
      configuration: '1d20'
    })
    expect(() =>
      ruleRollRequestDtoSchema.parse({ ...request, configuration: '1d20 + 5' })
    ).toThrow()
  })
})
