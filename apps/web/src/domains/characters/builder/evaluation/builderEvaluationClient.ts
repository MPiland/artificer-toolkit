import type { ContentSnapshotKind } from '@artificer-toolkit/schema/api/contentSnapshots'
import type {
  BuilderEvaluationRequest,
  BuilderEvaluationResult,
  BuilderEvaluationWorkerMessage,
  BuilderEvaluationWorkerRequest
} from './builderEvaluation.types'

const FAILED: BuilderEvaluationResult = { ok: false, failedKind: null }

/**
 * The page side of the Builder evaluation worker. The worker starts on the first evaluation, so
 * nothing loads during SSR or before the Builder edits; its content token requests are answered
 * from `getToken`.
 */
export function createBuilderEvaluationClient(options: {
  createWorker: () => Worker
  getToken: (refresh: boolean) => Promise<string>
  onLoading: (kinds: ContentSnapshotKind[]) => void
}) {
  let worker: Worker | null = null
  const pending = new Map<number, (result: BuilderEvaluationResult) => void>()
  let lastId = 0

  function settleAll() {
    for (const settle of pending.values()) settle(FAILED)
    pending.clear()
  }

  function start() {
    if (worker) return worker
    const started = options.createWorker()
    const send = (message: BuilderEvaluationWorkerRequest) => started.postMessage(message)
    started.addEventListener('message', (event: MessageEvent<BuilderEvaluationWorkerMessage>) => {
      const message = event.data
      switch (message.type) {
        case 'result':
          pending.get(message.id)?.(message.result)
          pending.delete(message.id)
          break
        case 'loading':
          options.onLoading(message.kinds)
          break
        case 'token':
          options.getToken(message.refresh).then(
            (token) => send({ type: 'token', id: message.id, token }),
            () => send({ type: 'token', id: message.id, token: null })
          )
          break
      }
    })
    started.addEventListener('error', () => {
      settleAll()
      options.onLoading([])
      started.terminate()
      if (worker === started) worker = null
    })
    worker = started
    return started
  }

  return {
    evaluate(request: BuilderEvaluationRequest): Promise<BuilderEvaluationResult> {
      const id = ++lastId
      return new Promise((resolve) => {
        pending.set(id, resolve)
        start().postMessage({
          type: 'evaluate',
          id,
          request
        } satisfies BuilderEvaluationWorkerRequest)
      })
    },
    terminate() {
      worker?.terminate()
      worker = null
      settleAll()
    }
  }
}

export type BuilderEvaluationClient = ReturnType<typeof createBuilderEvaluationClient>
