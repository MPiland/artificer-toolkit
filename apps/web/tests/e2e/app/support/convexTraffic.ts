import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Page } from '@playwright/test'

export type ConvexCall = {
  at: number
  kind: 'Mutation' | 'Action' | 'Query' | 'ServerFunction' | 'HttpFunction'
  udfPath?: string
  url?: string
}

const CONVEX_HTTP_FUNCTION_PATHS = ['/api/query', '/api/mutation', '/api/action', '/api/run']

const AUTOSAVE_UDF_PATH = 'characters/drafts:save'
const SNAPSHOT_TOKEN_REFRESH_UDF_PATH = 'contentSnapshots/access:issueAccess'

type SyncModification = { type: string; udfPath?: string }
type SyncMessage = { type: string; udfPath?: string; modifications?: SyncModification[] }

function callsFromSyncFrame(payload: string | Buffer): ConvexCall[] {
  let message: SyncMessage
  try {
    message = JSON.parse(payload.toString())
  } catch {
    return []
  }
  const at = Date.now()
  if (message.type === 'Mutation' || message.type === 'Action')
    return [{ at, kind: message.type, udfPath: message.udfPath }]
  if (message.type !== 'ModifyQuerySet') return []
  return (message.modifications ?? [])
    .filter((modification) => modification.type === 'Add')
    .map((modification) => ({ at, kind: 'Query', udfPath: modification.udfPath }))
}

/**
 * Records every client-to-Convex call the page makes: Convex sync-socket mutations, actions and
 * query subscriptions, plus TanStack server functions and Convex HTTP function requests. Sockets
 * opened by later navigations and reloads are captured too. Connect, Authenticate and Event
 * frames and query removals are not calls and are ignored.
 */
export function recordConvexTraffic(page: Page): ConvexCall[] {
  const calls: ConvexCall[] = []
  page.on('websocket', (socket) => {
    if (!new URL(socket.url()).pathname.endsWith('/sync')) return
    socket.on('framesent', ({ payload }) => calls.push(...callsFromSyncFrame(payload)))
  })
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.includes('/_serverFn/'))
      calls.push({ at: Date.now(), kind: 'ServerFunction', url: url.pathname })
    else if (CONVEX_HTTP_FUNCTION_PATHS.some((path) => url.pathname.endsWith(path)))
      calls.push({ at: Date.now(), kind: 'HttpFunction', url: url.pathname })
  })
  return calls
}

/**
 * Asserts that a Builder edit phase made no Convex call except debounced autosave and the
 * time-based snapshot-token refresh, then appends the phase to the journeys evidence file when
 * `CONVEX_E2E_BUILDER_JOURNEYS` is set. Tests run serially, so read-modify-write is safe.
 */
export async function recordBuilderEditPhase(
  journey: { name: string; classCount: number },
  phase: { calls: readonly ConvexCall[]; startedAt: number }
): Promise<void> {
  const endedAt = Date.now()
  const isAutosave = (call: ConvexCall) =>
    call.kind === 'Mutation' && call.udfPath === AUTOSAVE_UDF_PATH
  const isTokenRefresh = (call: ConvexCall) =>
    call.kind === 'Action' && call.udfPath === SNAPSHOT_TOKEN_REFRESH_UDF_PATH
  const editPhase = {
    startedAt: phase.startedAt,
    endedAt,
    autosaves: phase.calls.filter(isAutosave).length,
    tokenRefreshes: phase.calls.filter(isTokenRefresh).length,
    otherCalls: phase.calls.filter((call) => !isAutosave(call) && !isTokenRefresh(call))
  }
  const evidencePath = process.env.CONVEX_E2E_BUILDER_JOURNEYS
  if (evidencePath) {
    const journeys: unknown[] = await readFile(evidencePath, 'utf8').then(
      (text) => JSON.parse(text),
      () => []
    )
    await mkdir(dirname(evidencePath), { recursive: true })
    await writeFile(
      evidencePath,
      JSON.stringify(
        [...journeys, { journey: journey.name, classCount: journey.classCount, editPhase }],
        null,
        2
      )
    )
  }
  if (editPhase.otherCalls.length > 0)
    throw new Error(
      `Builder edit phase "${journey.name}" made Convex calls other than autosave and token refresh:\n${JSON.stringify(editPhase.otherCalls, null, 2)}`
    )
}
