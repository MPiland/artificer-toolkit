export const SSR_CPU_LIMITS: { readonly p75Ms: number; readonly requestMs: number }
export const SMOKE_BOUNDS: {
  readonly maxRounds: number
  readonly minIdleMinutes: number
  readonly maxIdleMinutes: number
}

export type SmokeTarget = {
  webOrigin: string
  convexSlug: string
  rounds: number
  idleMinutes: number
}

export function resolveSmokeTarget(
  input: { webOrigin?: string; rounds?: number; idleMinutes?: number },
  environment: Record<string, string | undefined>
): SmokeTarget

export function percentile(values: readonly number[], fraction: number): number

export type SmokeRequest = {
  path: string
  round: number
  cold: boolean
  status: number
  cacheControl: string | null
  cfRay: string
}

export type CpuRow = { cfRay: string; cpuTimeMs: number; outcome: string }

export function evaluateSsrCpu(input: {
  requests: readonly SmokeRequest[]
  cpuRows: readonly CpuRow[]
  cleanup: string
}): {
  pass: boolean
  violations: string[]
  figures: {
    requests: number
    measured: number
    p75Ms: number | undefined
    maxMs: number | undefined
    coldRequests: number
    coldMaxMs: number | undefined
  }
}

export function parseSmokeArguments(argv: readonly string[]): {
  command: 'run' | 'evaluate'
  options: Record<string, string>
}
