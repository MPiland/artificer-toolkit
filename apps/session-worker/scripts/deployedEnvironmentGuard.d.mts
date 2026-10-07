export const LOCAL_MARKER: 'LOCAL_CONTENT_SNAPSHOT_ORIGIN'
export const defaultConfigPath: string
export function findLocalMarkerViolations(config: {
  vars?: Record<string, unknown>
  secrets?: { required?: string[] }
  env?: Record<string, { vars?: Record<string, unknown>; secrets?: { required?: string[] } }>
}): string[]
export function readWranglerConfig(path: string): Parameters<typeof findLocalMarkerViolations>[0]
