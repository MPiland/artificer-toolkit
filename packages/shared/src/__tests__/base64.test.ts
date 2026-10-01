import { describe, expect, it } from 'vitest'
import { decodeBase64, encodeBase64 } from '../utils/base64.js'

describe('Base64 byte codec', () => {
  it('round-trips all byte values and a 240 KiB payload', () => {
    const allBytes = Uint8Array.from({ length: 256 }, (_, index) => index)
    expect(decodeBase64(encodeBase64(allBytes))).toEqual(allBytes)

    const largePayload = Uint8Array.from({ length: 240 * 1024 }, (_, index) => index % 256)
    expect(decodeBase64(encodeBase64(largePayload))).toEqual(largePayload)
  })

  it('throws for malformed Base64', () => {
    expect(() => decodeBase64('not base64')).toThrow()
  })
})
