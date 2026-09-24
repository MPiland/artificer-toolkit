export const JSON_PAYLOAD_CHUNK_MAX_BYTES = 240 * 1024

function requireChunkByteLimit(maximumChunkBytes: number) {
  if (!Number.isSafeInteger(maximumChunkBytes) || maximumChunkBytes <= 0)
    throw new Error('JSON payload chunk byte limit is invalid.')
}

function copyChunk(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer
}

export function encodeUtf8PayloadChunks(
  payloadJson: string,
  maximumChunkBytes = JSON_PAYLOAD_CHUNK_MAX_BYTES
): ArrayBuffer[] {
  requireChunkByteLimit(maximumChunkBytes)
  const bytes = new TextEncoder().encode(payloadJson)
  if (bytes.byteLength === 0) throw new Error('JSON payload bytes are empty.')
  const chunks: ArrayBuffer[] = []
  for (let offset = 0; offset < bytes.byteLength; offset += maximumChunkBytes)
    chunks.push(
      copyChunk(bytes.subarray(offset, Math.min(offset + maximumChunkBytes, bytes.byteLength)))
    )
  return chunks
}

export function decodeUtf8PayloadChunks(
  chunks: readonly ArrayBuffer[],
  totalByteLength: number,
  maximumChunkBytes = JSON_PAYLOAD_CHUNK_MAX_BYTES
): string {
  requireChunkByteLimit(maximumChunkBytes)
  if (!Number.isSafeInteger(totalByteLength) || totalByteLength <= 0)
    throw new Error('JSON payload byte length is invalid.')
  const bytes = new Uint8Array(totalByteLength)
  let offset = 0
  for (const chunk of chunks) {
    if (
      !(chunk instanceof ArrayBuffer) ||
      chunk.byteLength === 0 ||
      chunk.byteLength > maximumChunkBytes
    )
      throw new Error('JSON payload chunk bytes are invalid.')
    if (offset + chunk.byteLength > totalByteLength)
      throw new Error('JSON payload chunk byte length is invalid.')
    bytes.set(new Uint8Array(chunk), offset)
    offset += chunk.byteLength
  }
  if (offset !== totalByteLength) throw new Error('JSON payload chunk byte length is invalid.')
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('JSON payload chunk UTF-8 is invalid.')
  }
}
