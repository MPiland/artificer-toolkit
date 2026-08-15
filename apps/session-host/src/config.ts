export const DEFAULT_SESSION_HOST_PORT = 2567

export function resolveSessionHostPort(value = process.env.PORT): number {
  if (value === undefined || value.trim() === '') return DEFAULT_SESSION_HOST_PORT

  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.')
  }
  return port
}
