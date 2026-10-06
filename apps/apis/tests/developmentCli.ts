import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import { jsonToConvex } from 'convex/values'
import { z } from 'zod'
import { developmentTarget } from './developmentTarget'

const workspace = fileURLToPath(new URL('..', import.meta.url))
const execute = promisify(execFile)

export async function developmentCli(
  name: string,
  args: Record<string, unknown>,
  component = true
): Promise<unknown> {
  const command =
    '$ErrorActionPreference = "Stop"; $input | yarn.ps1 node tests/developmentCliEntry.mjs; if (-not $?) { exit 1 }; exit $LASTEXITCODE'
  let stdout: string
  const startedAt = Date.now()
  try {
    const localUrl = process.env.CONVEX_SELF_HOSTED_URL
    const localAdminKey = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY
    if (localUrl || localAdminKey) {
      const target = developmentTarget(process.env)
      if (target.mode !== 'local' || localUrl !== target.deploymentUrl.origin || !localAdminKey)
        throw new Error('Self-hosted fixture CLI requires the selected local backend and key.')
      if (!/^[\w./-]+:[\w]+$/.test(name))
        throw new Error('The local fixture function name is invalid.')
      // Use the CLI's native function endpoint without its Windows process-exit assertion
      // on large piped results. Keep fixture arguments and the admin key in memory.
      const response = await fetch(`${localUrl}/api/function`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Convex ${localAdminKey}` },
        body: JSON.stringify({
          path: name,
          componentPath: component ? 'betterAuth' : undefined,
          format: 'convex_encoded_json',
          args: z.record(z.string(), z.json()).parse(JSON.parse(JSON.stringify(args)))
        }),
        signal: AbortSignal.timeout(60_000)
      })
      if (!response.ok)
        throw Object.assign(new Error('The local fixture request failed.'), {
          status: response.status
        })
      const result = z
        .object({ status: z.literal('success'), value: z.json() })
        .parse(await response.json())
      return jsonToConvex(result.value)
    }
    const serializedArgs = JSON.stringify(args)
    const pending = execute('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      cwd: workspace,
      env: {
        ...process.env,
        DRAFT_PROOF_LOCAL_URL: localUrl ?? '',
        DRAFT_PROOF_LOCAL_ADMIN_KEY: localAdminKey ?? '',
        DRAFT_PROOF_FUNCTION: name,
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
  } catch (error) {
    const fields = error instanceof Error ? error : {}
    const code: unknown = Reflect.get(fields, 'code')
    const signal: unknown = Reflect.get(fields, 'signal')
    const killed: unknown = Reflect.get(fields, 'killed')
    const status: unknown = Reflect.get(fields, 'status')
    const childOut: unknown = Reflect.get(fields, 'stdout')
    const childErr: unknown = Reflect.get(fields, 'stderr')
    const metadata = {
      code:
        typeof code === 'number' || (typeof code === 'string' && /^[A-Z_\d]+$/.test(code))
          ? code
          : null,
      signal: typeof signal === 'string' && /^[A-Z\d]+$/.test(signal) ? signal : null,
      killed: killed === true,
      httpStatus: typeof status === 'number' ? status : null,
      elapsedMs: Date.now() - startedAt,
      stdoutBytes: typeof childOut === 'string' ? Buffer.byteLength(childOut) : null,
      stderrBytes: typeof childErr === 'string' ? Buffer.byteLength(childErr) : null,
      libuvClosingAssertion: typeof childErr === 'string' && childErr.includes('UV_HANDLE_CLOSING')
    }
    throw new Error(
      `Development fixture CLI failed at ${name}; ${JSON.stringify(metadata)}; arguments/output withheld.`
    )
  }
  try {
    return stdout.trim() ? JSON.parse(stdout) : null
  } catch {
    throw new Error('Development fixture CLI returned invalid JSON; output withheld.')
  }
}
