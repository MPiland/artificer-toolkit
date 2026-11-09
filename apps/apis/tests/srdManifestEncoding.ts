import { brotliCompressSync } from 'node:zlib'

/** Embeds JSON text the way the generated SRD manifest does: base64 of Brotli-compressed JSON. */
export function encodeBrotliBase64(json: string) {
  return brotliCompressSync(Buffer.from(json)).toString('base64')
}
