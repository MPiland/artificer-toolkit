import { describe, expect, it } from 'vitest'
import { auditSrdSourceSemantics } from './audit.js'

describe('SRD source semantics', () => {
  it('has no canonical source audit issues', () => {
    expect(auditSrdSourceSemantics()).toEqual([])
  })
})
