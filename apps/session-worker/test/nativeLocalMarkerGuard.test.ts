import { describe, expect, it } from 'vitest'

import { assertNoLocalMarker } from './localMarkerGuard.js'

describe('the local marker guard', () => {
  it('refuses bindings that carry the local marker, naming the file and key but not the value', () => {
    const value = 'http://127.0.0.1:8026'
    const refusal = (() => {
      try {
        assertNoLocalMarker({ LOCAL_CONTENT_SNAPSHOT_ORIGIN: value })
        return null
      } catch (error) {
        return error instanceof Error ? error.message : String(error)
      }
    })()
    expect(refusal).toContain('apps/session-worker/.dev.vars sets LOCAL_CONTENT_SNAPSHOT_ORIGIN')
    expect(refusal).not.toContain(value)
  })

  it('accepts bindings without it', () => {
    expect(() => assertNoLocalMarker({})).not.toThrow()
  })
})
