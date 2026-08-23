import { describe, expect, it } from 'vitest'

import { uuidSchema } from '../api/campaignContractSchemas.js'

describe('campaign contract schemas', () => {
  it.each([
    '00000000-0000-0000-0080-000100000000',
    '00000000-0000-0000-0000-000000000001',
    'f3e3a390-5b22-4a1f-8a0b-bf7f184bd7c9'
  ])('accepts PostgreSQL UUID text %s', (value) => {
    expect(uuidSchema.parse(value)).toBe(value)
  })

  it.each([
    '00000000-0000-0000-0000-00000000000g',
    '00000000-0000-0000-0000-00000000001',
    '00000000000000000000000000000000',
    '{00000000-0000-0000-0000-000000000001}'
  ])('rejects malformed UUID text %s', (value) => {
    expect(uuidSchema.safeParse(value).success).toBe(false)
  })
})
