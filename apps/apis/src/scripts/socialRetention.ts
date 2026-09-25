import { execFile } from 'node:child_process'
import { parseArgs, promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import {
  socialRetentionApplyInputSchema,
  socialRetentionApplyResultSchema,
  socialRetentionPreviewInputSchema,
  socialRetentionPreviewResultSchema,
  type SocialRetentionApplyResult,
  type SocialRetentionPreviewResult
} from '@artificer-toolkit/schema/api/socialRetention'

const execute = promisify(execFile)
const phases = ['INVITATIONS', 'REPORTS', 'APPLICATIONS'] as const
const workspace = fileURLToPath(new URL('../..', import.meta.url))

type Environment = NodeJS.ProcessEnv
type Phase = (typeof phases)[number]

function parseConfiguration(argv: string[], environment: Environment) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'deployment-name': { type: 'string' },
      'as-of': { type: 'string' },
      apply: { type: 'boolean', default: false }
    },
    allowPositionals: false,
    strict: true
  })
  const deployment = values['deployment-name']
  const asOf = values['as-of']
  if (typeof deployment !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(deployment))
    throw new Error('A lowercase hyphenated --deployment-name is required.')
  if (typeof asOf !== 'string') throw new Error('A canonical --as-of cutoff is required.')
  socialRetentionPreviewInputSchema.shape.asOf.parse(asOf)
  const cutoff = Date.parse(asOf)
  if (cutoff < 0 || cutoff > Date.now()) throw new Error('--as-of must be current or in the past.')
  if (environment.CONVEX_URL !== `https://${deployment}.convex.cloud`)
    throw new Error('CONVEX_URL must exactly match the requested deployment.')
  if (environment.CONVEX_DEPLOY_KEY) throw new Error('CONVEX_DEPLOY_KEY must be empty.')
  const apply = values.apply === true
  if (apply && environment.CONFIRM_SOCIAL_RETENTION_PURGE !== 'purge-expired-social-data')
    throw new Error('Apply requires CONFIRM_SOCIAL_RETENTION_PURGE=purge-expired-social-data.')
  return { deployment, asOf, apply }
}

async function invoke(
  phase: Phase,
  deployment: string,
  asOf: string,
  apply: boolean,
  cursor: string | null,
  environment: Environment
): Promise<SocialRetentionPreviewResult | SocialRetentionApplyResult> {
  const input = {
    phase,
    asOf,
    paginationOpts: { numItems: 8, cursor },
    ...(apply ? { confirm: 'purge-expired-social-data' as const } : {})
  }
  const validatedInput = apply
    ? socialRetentionApplyInputSchema.parse(input)
    : socialRetentionPreviewInputSchema.parse(input)
  const functionName = apply ? 'social/retention:apply' : 'social/retention:preview'
  const command =
    'yarn.ps1 convex run --deployment-name $env:SOCIAL_RETENTION_DEPLOYMENT $env:SOCIAL_RETENTION_FUNCTION $env:SOCIAL_RETENTION_ARGS; exit $LASTEXITCODE'
  let stdout: string
  try {
    ;({ stdout } = await execute(
      'pwsh.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      {
        cwd: workspace,
        env: {
          ...environment,
          SOCIAL_RETENTION_DEPLOYMENT: deployment,
          SOCIAL_RETENTION_FUNCTION: functionName,
          SOCIAL_RETENTION_ARGS: JSON.stringify(validatedInput)
        },
        windowsHide: true,
        timeout: 60_000,
        maxBuffer: 256 * 1024
      }
    ))
  } catch {
    throw new Error(`Social retention ${phase} phase failed; arguments/output withheld.`)
  }
  try {
    const result: unknown = stdout.trim() ? JSON.parse(stdout) : null
    return apply
      ? socialRetentionApplyResultSchema.parse(result)
      : socialRetentionPreviewResultSchema.parse(result)
  } catch {
    throw new Error(`Social retention ${phase} phase failed; arguments/output withheld.`)
  }
}

export async function runSocialRetention(
  argv: string[],
  environment: Environment = process.env
): Promise<void> {
  const { deployment, asOf, apply } = parseConfiguration(argv, environment)
  console.log({ mode: apply ? 'apply' : 'dry-run', deployment, asOf })
  for (const phase of phases) {
    let cursor: string | null = null
    let scanned = 0
    let eligible = 0
    let deleted = 0
    while (true) {
      const result = await invoke(phase, deployment, asOf, apply, cursor, environment)
      scanned += result.scanned
      eligible += result.eligible
      if (apply && 'deleted' in result) deleted += result.deleted
      if (result.isDone) break
      if (result.continueCursor === cursor)
        throw new Error(`Social retention ${phase} phase returned a nonadvancing cursor.`)
      cursor = result.continueCursor
    }
    console.log({ phase, scanned, eligible, ...(apply ? { deleted } : {}) })
  }
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]))
  runSocialRetention(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Social retention failed.')
    process.exitCode = 1
  })
