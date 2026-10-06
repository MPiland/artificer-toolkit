export interface SessionWorkerEnvironment {
  CONTENT_SNAPSHOTS: R2Bucket
  CONTENT_SNAPSHOT_TOKEN_SECRET: string
  LOCAL_CONTENT_SNAPSHOT_ORIGIN?: string
  LIVE_SESSION_ALLOWED_ORIGINS: string
  LIVE_SESSION_WORKER_SECRET: string
  CONVEX_SITE_URL: string
  LIVE_SESSION_ROOMS: DurableObjectNamespace
  LIVE_SESSION_TICKET_SECRET: string
  RULES_CONTINUATION_SECRET: string
}

/** The local-origin marker is absent from every deployed environment. */
export function isLocalDevelopment(
  environment: Pick<SessionWorkerEnvironment, 'LOCAL_CONTENT_SNAPSHOT_ORIGIN'>
): boolean {
  return environment.LOCAL_CONTENT_SNAPSHOT_ORIGIN === 'http://127.0.0.1:8026'
}

export function allowedOrigins(
  environment: Pick<SessionWorkerEnvironment, 'LIVE_SESSION_ALLOWED_ORIGINS'>
): Set<string> {
  const origins = environment.LIVE_SESSION_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  if (origins.length === 0) throw new Error('LIVE_SESSION_ALLOWED_ORIGINS is not configured.')
  return new Set(origins)
}
