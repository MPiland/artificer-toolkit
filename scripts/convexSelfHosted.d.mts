export const localConvex: {
  container: string
  instance: string
  url: string
  siteUrl: string
}
export function assertLoopbackUrl(name: string, value: string | undefined): void
export function assertConvexInstance(url: string, instance: string): Promise<void>
export function generateAdminKey(container: string): string
export function yarnSpawn(args: string[]): [string, string[]]
export function convexCliEnvironment(): NodeJS.ProcessEnv
export const convexDeployArguments: string[]
export function convexCliArguments(url: string, adminKey: string): string[]
export function convexEnvironmentValue(
  name: 'LIVE_SESSION_TICKET_SECRET' | 'LIVE_SESSION_WORKER_SECRET' | 'CONTENT_SNAPSHOT_TOKEN_SECRET'
): Promise<string>
