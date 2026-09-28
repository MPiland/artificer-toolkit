import { describe, expect, it, vi } from 'vitest'
import type {
  BuilderEvaluationRequest,
  BuilderEvaluationWorkerMessage,
  BuilderEvaluationWorkerRequest
} from './builderEvaluation.types'
import { createBuilderEvaluationClient } from './builderEvaluationClient'

/** A worker double: records what the page posts and replays what the worker would post. */
class FakeWorker extends EventTarget {
  readonly posted: BuilderEvaluationWorkerRequest[] = []
  terminated = false

  postMessage(message: BuilderEvaluationWorkerRequest) {
    this.posted.push(message)
  }

  terminate() {
    this.terminated = true
  }

  reply(message: BuilderEvaluationWorkerMessage) {
    this.dispatchEvent(new MessageEvent('message', { data: message }))
  }
}

const evaluation = { operation: 'resolve' } as BuilderEvaluationRequest

function setup() {
  const worker = new FakeWorker()
  const createWorker = vi.fn(() => worker as unknown as Worker)
  const getToken = vi.fn(async (refresh: boolean) => (refresh ? 'fresh' : 'cached'))
  const onLoading = vi.fn()
  const client = createBuilderEvaluationClient({ createWorker, getToken, onLoading })
  return { client, createWorker, getToken, onLoading, worker }
}

describe('Builder evaluation client', () => {
  it('starts the worker on first use and answers its content token requests', async () => {
    const { client, createWorker, getToken, onLoading, worker } = setup()
    expect(createWorker).not.toHaveBeenCalled()

    const result = client.evaluate(evaluation)
    expect(worker.posted).toEqual([{ type: 'evaluate', id: 1, request: evaluation }])
    worker.reply({ type: 'token', id: 7, refresh: true })
    await vi.waitFor(() =>
      expect(worker.posted).toContainEqual({ type: 'token', id: 7, token: 'fresh' })
    )
    expect(getToken).toHaveBeenCalledWith(true)
    worker.reply({ type: 'loading', kinds: ['SPELL'] })
    expect(onLoading).toHaveBeenCalledWith(['SPELL'])
    worker.reply({ type: 'result', id: 1, result: { ok: false, failedKind: 'SPELL' } })

    await expect(result).resolves.toEqual({ ok: false, failedKind: 'SPELL' })
    expect(createWorker).toHaveBeenCalledTimes(1)
  })

  it('fails pending evaluations when the worker crashes or is terminated', async () => {
    const { client, worker } = setup()
    const crashed = client.evaluate(evaluation)
    worker.dispatchEvent(new Event('error'))
    await expect(crashed).resolves.toEqual({ ok: false, failedKind: null })
    expect(worker.terminated).toBe(true)

    const pending = client.evaluate(evaluation)
    client.terminate()
    await expect(pending).resolves.toEqual({ ok: false, failedKind: null })
  })
})
