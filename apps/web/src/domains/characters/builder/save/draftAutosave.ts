import type { AuthoringDraftSaveStatus } from '#forms/layout/AuthoringFormContext'

const IDLE_MS = 2_000
const MIN_INTERVAL_MS = 10_000
const RETRY_BASE_MS = 2_000
const RETRY_MAX_MS = 30_000

/**
 * Debounced draft autosave (ADR 0036 S8): saves the latest value once edits have been idle for 2 s,
 * and no sooner than 10 s after the previous save began. `flush` saves at once (step change, unload,
 * "Save draft"). Saves never overlap; a failed save retries with doubling backoff up to 30 s.
 * `cancel` stops it for good, before a commit or discard replaces the draft.
 */
export function createDraftAutosave<Value>({
  save,
  onStatus
}: {
  save: (value: Value) => Promise<void>
  onStatus: (status: AuthoringDraftSaveStatus) => void
}) {
  let pending: { value: Value } | null = null
  let inFlight: Promise<void> | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastSaveStartedAt = -Infinity
  let retryDelay = 0
  let cancelled = false
  let status: AuthoringDraftSaveStatus | undefined

  function emit(next: AuthoringDraftSaveStatus) {
    if (next === status) return
    status = next
    onStatus(next)
  }

  function schedule(delay: number) {
    clearTimeout(timer)
    timer = setTimeout(() => void run(), Math.max(0, delay))
  }

  async function run(): Promise<void> {
    clearTimeout(timer)
    if (inFlight) {
      await inFlight
      return run()
    }
    if (cancelled || !pending) return
    const { value } = pending
    pending = null
    lastSaveStartedAt = Date.now()
    emit('saving')
    let failed = false
    inFlight = save(value).catch(() => {
      failed = true
    })
    await inFlight
    inFlight = null
    if (cancelled) return
    if (failed) {
      // Retry the newest value; edits made meanwhile replace the failed one.
      pending ??= { value }
      retryDelay = Math.min(retryDelay === 0 ? RETRY_BASE_MS : retryDelay * 2, RETRY_MAX_MS)
      emit('retrying')
      schedule(retryDelay)
      return
    }
    retryDelay = 0
    if (pending) {
      emit('pending')
      schedule(Math.max(IDLE_MS, lastSaveStartedAt + MIN_INTERVAL_MS - Date.now()))
    } else emit('saved')
  }

  return {
    change(value: Value) {
      if (cancelled) return
      pending = { value }
      // A retry keeps its backoff; the newest value goes with it.
      if (retryDelay > 0 || inFlight) return
      emit('pending')
      schedule(Math.max(IDLE_MS, lastSaveStartedAt + MIN_INTERVAL_MS - Date.now()))
    },
    flush: () => run(),
    cancel() {
      cancelled = true
      pending = null
      clearTimeout(timer)
    }
  }
}
