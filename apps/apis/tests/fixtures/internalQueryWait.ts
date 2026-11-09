import { ConvexClient } from 'convex/browser'
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'
import type { DevelopmentClient } from '../developmentClient'
import { developmentTarget } from '../developmentTarget'

/** What a wait does with one state its query reports: settle, keep waiting, or fail the proof. */
export type InternalQueryVerdict = 'SETTLED' | 'WAITING' | Error

/**
 * Waits until an internal fixture query reports a settled state. Against the selected local
 * backend it subscribes with the local admin key; in-process, `client` runs the internal query in
 * its own transaction and the wait polls while convex-test runs scheduled work on its timer (with
 * no client there is nothing to wait for). `judge` learns which of the two it reads, and the wait
 * fails after `timeoutMs` with the last state it saw.
 */
export async function awaitInternalQuery<Query extends FunctionReference<'query'>>(input: {
  query: Query
  args: FunctionArgs<Query>
  judge: (state: FunctionReturnType<Query>, native: boolean) => InternalQueryVerdict
  label: string
  client?: DevelopmentClient
  timeoutMs?: number
}) {
  const timeoutMs = input.timeoutMs ?? 60_000
  const timedOut = (state: unknown) =>
    new Error(`${input.label} did not settle within ${timeoutMs} ms (last state ${String(state)}).`)
  const url = process.env.CONVEX_SELF_HOSTED_URL
  const adminKey = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY
  if (!url && !adminKey) {
    if (!input.client) return
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const state = await input.client.query(input.query, input.args)
      const verdict = input.judge(state, false)
      if (verdict instanceof Error) throw verdict
      if (verdict === 'SETTLED') return
      if (Date.now() >= deadline) throw timedOut(state)
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }
  const target = developmentTarget(process.env)
  if (target.mode !== 'local' || url !== target.deploymentUrl.origin || !adminKey)
    throw new Error(`${input.label} waits require the selected local backend and key.`)
  const subscriber = new ConvexClient(url, { logger: false })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    // Convex exposes admin auth on the socket client at runtime but strips it from public types.
    const socket: unknown = Reflect.get(subscriber, 'client')
    const setAdminAuth: unknown =
      typeof socket === 'object' && socket !== null ? Reflect.get(socket, 'setAdminAuth') : null
    if (typeof setAdminAuth !== 'function') throw new Error('Native admin socket is unavailable.')
    setAdminAuth.call(socket, adminKey)
    // Closing the client ends the subscription once the state settles.
    await new Promise<void>((resolve, reject) => {
      let last: unknown = 'none'
      timer = setTimeout(() => reject(timedOut(last)), timeoutMs)
      subscriber.onUpdate(
        input.query,
        input.args,
        (state) => {
          last = state
          const verdict = input.judge(state, true)
          if (verdict instanceof Error) reject(verdict)
          else if (verdict === 'SETTLED') resolve()
        },
        reject
      )
    })
  } finally {
    clearTimeout(timer)
    await subscriber.close()
  }
}
