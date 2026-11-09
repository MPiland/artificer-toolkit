import { brotliCompressSync, brotliDecompressSync } from 'node:zlib'

/** Decodes an embedded SRD manifest (base64 of Brotli-compressed JSON) to its JSON text. */
export function decodeBrotliBase64(encoded: string) {
  return brotliDecompressSync(Buffer.from(encoded, 'base64')).toString('utf8')
}

/** Encodes JSON text the way the generated SRD manifest embeds it. */
export function encodeBrotliBase64(json: string) {
  return brotliCompressSync(Buffer.from(json)).toString('base64')
}
