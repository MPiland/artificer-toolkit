import { contentOrigin } from '#app/data/contentSnapshots/contentOrigin'
import { createContentSnapshotStore } from '#app/data/contentSnapshots/contentSnapshotStore'
import type {
  BuilderEvaluationWorkerMessage,
  BuilderEvaluationWorkerRequest
} from './builderEvaluation.types'
import { createBuilderEvaluator } from './builderEvaluator'

// The Builder's evaluation worker (ADR 0036 S6). Content tokens come from the page, which holds the
// Convex session; everything else stays in the worker.

const post = (message: BuilderEvaluationWorkerMessage) => self.postMessage(message)

const tokenRequests = new Map<
  number,
  { resolve: (token: string) => void; reject: (error: Error) => void }
>()
let lastTokenRequestId = 0

const evaluate = contentOrigin
  ? createBuilderEvaluator({
      store: createContentSnapshotStore({
        contentOrigin,
        getToken: (refresh) =>
          new Promise((resolve, reject) => {
            const id = ++lastTokenRequestId
            tokenRequests.set(id, { resolve, reject })
            post({ type: 'token', id, refresh })
          })
      }),
      onLoading: (kinds) => post({ type: 'loading', kinds })
    })
  : null

self.addEventListener('message', (event: MessageEvent<BuilderEvaluationWorkerRequest>) => {
  const message = event.data
  if (message.type === 'token') {
    const pending = tokenRequests.get(message.id)
    tokenRequests.delete(message.id)
    if (message.token === null) pending?.reject(new Error('Content access was refused.'))
    else pending?.resolve(message.token)
    return
  }
  if (!evaluate) {
    post({ type: 'result', id: message.id, result: { ok: false, failedKind: null } })
    return
  }
  void evaluate(message.request).then((result) => post({ type: 'result', id: message.id, result }))
})
