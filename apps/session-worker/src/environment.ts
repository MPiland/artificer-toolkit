export interface SessionWorkerEnvironment {
  LIVE_SESSION_ALLOWED_ORIGINS: string
  LIVE_SESSION_WORKER_SECRET: string
  CONVEX_SITE_URL: string
  LIVE_SESSION_ROOMS: DurableObjectNamespace
  LIVE_SESSION_TICKET_SECRET: string
}

export function allowedOrigins(environment: SessionWorkerEnvironment): Set<string> {
  const origins = environment.LIVE_SESSION_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  if (origins.length === 0) throw new Error('LIVE_SESSION_ALLOWED_ORIGINS is not configured.')
  return new Set(origins)
}
