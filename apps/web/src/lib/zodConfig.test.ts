import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import './zodConfig'

describe('Zod browser configuration', () => {
  it('disables schema JIT compilation for strict CSP environments', () => {
    expect(z.config().jitless).toBe(true)
  })
})
