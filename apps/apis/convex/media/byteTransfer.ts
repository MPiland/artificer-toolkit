'use node'

import { MediaValidationError } from './processing'

export async function readMediaBytes(
  url: string,
  maxBytes: number,
  label: 'Image' | 'File' | 'Map' = 'Image'
): Promise<Buffer> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    redirect: 'error'
  })
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    if (response.status !== 404 && response.status !== 410)
      throw new Error(`${label} storage is temporarily unavailable. Try again.`)
    throw new MediaValidationError(
      `${label} data is unavailable. Choose the ${label.toLowerCase()} again.`
    )
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    const declaredSize = Number(response.headers.get('content-length'))
    if (Number.isFinite(declaredSize) && declaredSize > maxBytes)
      throw new MediaValidationError(`${label} exceeds its upload limit.`)
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maxBytes) throw new MediaValidationError(`${label} exceeds its upload limit.`)
      chunks.push(value)
    }
    return Buffer.concat(chunks, length)
  } finally {
    await reader.cancel()
    reader.releaseLock()
  }
}
