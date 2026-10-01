import { describe, expect, it } from 'vitest'
import {
  JSON_PAYLOAD_CHUNK_MAX_BYTES,
  decodeUtf8PayloadChunks,
  encodeUtf8PayloadChunks
} from '../utils/jsonPayloadChunks.js'

describe('JSON payload UTF-8 chunks', () => {
  it('round-trips multibyte text below the fixed per-document byte ceiling', () => {
    const payload = '🎲'.repeat(90_000)
    const chunks = encodeUtf8PayloadChunks(payload)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.byteLength <= JSON_PAYLOAD_CHUNK_MAX_BYTES)).toBe(true)
    expect(decodeUtf8PayloadChunks(chunks, new TextEncoder().encode(payload).byteLength)).toBe(
      payload
    )
    const prefixed = '\uFEFF{"label":"🎲"}'
    expect(
      decodeUtf8PayloadChunks(
        encodeUtf8PayloadChunks(prefixed),
        new TextEncoder().encode(prefixed).byteLength
      )
    ).toBe(prefixed)
  })

  it('fails closed on incomplete, oversized, and invalid UTF-8 byte sequences', () => {
    const chunks = encodeUtf8PayloadChunks('{"label":"🎲"}')
    const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
    expect(() => decodeUtf8PayloadChunks(chunks.slice(0, -1), total)).toThrow('byte length')
    expect(() => decodeUtf8PayloadChunks(chunks, Number.MAX_SAFE_INTEGER)).toThrow('byte length')
    expect(() =>
      decodeUtf8PayloadChunks([new ArrayBuffer(JSON_PAYLOAD_CHUNK_MAX_BYTES + 1)], total)
    ).toThrow('chunk bytes')
    expect(() => decodeUtf8PayloadChunks([new Uint8Array([0xff]).buffer], 1)).toThrow('UTF-8')
  })
})
