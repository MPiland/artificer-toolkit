import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import { developmentTarget } from './developmentTarget'

const workspace = fileURLToPath(new URL('..', import.meta.url))
const execute = promisify(execFile)

export async function developmentCli(
  name: string,
  args: Record<string, unknown>,
  component = true,
  operation: 'run' | 'disarm-receipts' = 'run'
): Promise<unknown> {
  const command =
    '$ErrorActionPreference = "Stop"; $input | yarn.ps1 node tests/developmentCliEntry.mjs; if (-not $?) { exit 1 }; exit $LASTEXITCODE'
  let stdout: string
  try {
    const localUrl = process.env.CONVEX_SELF_HOSTED_URL
    const localAdminKey = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY
    if (localUrl || localAdminKey) {
      const target = developmentTarget(process.env)
      if (target.mode !== 'local' || localUrl !== target.deploymentUrl.origin || !localAdminKey)
        throw new Error('Self-hosted fixture CLI requires the selected local backend and key.')
    }
    if (operation === 'disarm-receipts') {
      const target = developmentTarget(process.env)
      if (
        target.mode !== 'local' ||
        localUrl !== target.deploymentUrl.origin ||
        !localAdminKey ||
        name !== 'encounterRuleReceipts' ||
        component
      )
        throw new Error('Disarm receipt audit requires the selected isolated local backend.')
      for (const key of ['encounterId', 'commandId']) {
        if (
          typeof args[key] !== 'string' ||
          !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(args[key])
        )
          throw new Error('Disarm receipt audit requires exact fixture identities.')
      }
    }
    const serializedArgs = JSON.stringify(args)
    const pending = execute('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      cwd: workspace,
      env: {
        ...process.env,
        DRAFT_PROOF_LOCAL_URL: localUrl ?? '',
        DRAFT_PROOF_LOCAL_ADMIN_KEY: localAdminKey ?? '',
        DRAFT_PROOF_FUNCTION: name,
        DRAFT_PROOF_OPERATION: operation,
        DRAFT_PROOF_COMPONENT: component ? 'betterAuth' : ''
      },
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 16 * 1024 * 1024
    })
    const stdin = pending.child.stdin
    if (!stdin) {
      await pending
      throw new Error('Development fixture CLI stdin is unavailable.')
    }
    // ASCII stdin avoids Windows console decoding changing Unicode JSON values.
    const input = pipeline(Readable.from([Buffer.from(serializedArgs).toString('base64')]), stdin)
    ;[{ stdout }] = await Promise.all([pending, input])
  } catch {
    throw new Error(`Development fixture CLI failed at ${name}; arguments/output withheld.`)
  }
  let result: unknown
  try {
    result = stdout.trim() ? JSON.parse(stdout) : null
  } catch {
    throw new Error('Development fixture CLI returned invalid JSON; output withheld.')
  }
  if (operation !== 'disarm-receipts') return result
  if (!Array.isArray(result) || result.length > 100)
    throw new Error('Disarm receipt audit exceeded its bounded table response.')
  const matching = result.filter(
    (row: unknown): row is Record<string, unknown> =>
      row !== null &&
      typeof row === 'object' &&
      'encounterId' in row &&
      row.encounterId === args.encounterId &&
      'commandId' in row &&
      row.commandId === args.commandId
  )
  if (matching.length !== 1)
    throw new Error('Disarm receipt audit requires exactly one matching fixture receipt.')
  const { _id, _creationTime, ...receipt } = matching[0]!
  return receipt
}
