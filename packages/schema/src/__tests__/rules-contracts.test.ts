import { describe, expect, it } from 'vitest'

import {
  ruleEvaluationDtoSchema,
  rulePackDocumentDtoSchema,
  ruleRollRequestDtoSchema
} from '../api/rules.js'

const revisionId = '00000000-0000-4000-8000-000000000001'
const document = {
  schemaVersion: 1 as const,
  models: { attack: { expression: '1d20+5' } },
  fixtures: []
}

describe('rule pack contracts', () => {
  it('rejects invalid model keys and documents with no models', () => {
    expect(() => rulePackDocumentDtoSchema.parse({ ...document, models: {} })).toThrow()
    expect(() =>
      rulePackDocumentDtoSchema.parse({ ...document, models: { Invalid: {} } })
    ).toThrow()
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
