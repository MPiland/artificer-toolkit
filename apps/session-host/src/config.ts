export const DEFAULT_SESSION_HOST_PORT = 2567
export const DEFAULT_SESSION_HOST_ALLOWED_ORIGINS = [
  'http://127.0.0.1:3000',
  'http://localhost:3000'
] as const

export function resolveSessionHostTicketSecret(
  value = process.env.LIVE_SESSION_TICKET_SECRET
): string {
  if (!value || new TextEncoder().encode(value).byteLength < 32) {
    throw new Error('LIVE_SESSION_TICKET_SECRET must contain at least 32 bytes.')
  }
  return value
}

export function resolveSessionHostPort(value = process.env.PORT): number {
  if (value === undefined || value.trim() === '') return DEFAULT_SESSION_HOST_PORT

  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.')
  }
  return port
}

export function resolveSessionHostAllowedOrigins(
  value = process.env.SESSION_HOST_ALLOWED_ORIGINS
): string[] {
  if (value === undefined || value.trim() === '') return [...DEFAULT_SESSION_HOST_ALLOWED_ORIGINS]
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  if (origins.length === 0 || new Set(origins).size !== origins.length) {
    throw new Error('SESSION_HOST_ALLOWED_ORIGINS must contain unique comma-separated origins.')
  }
  for (const origin of origins) {
    let parsed: URL
    try {
      parsed = new URL(origin)
    } catch {
      throw new Error('SESSION_HOST_ALLOWED_ORIGINS must contain absolute HTTP origins.')
    }
    if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('SESSION_HOST_ALLOWED_ORIGINS must contain absolute HTTP origins.')
    }
  }
  return origins
}
