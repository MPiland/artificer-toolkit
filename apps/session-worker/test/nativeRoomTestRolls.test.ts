import { createExecutionContext, runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { expect, it } from 'vitest'
import {
  LIVE_SESSION_CONTROL_SECRET_HEADER,
  LIVE_SESSION_TEST_ROLLS_PATH
} from '@artificer-toolkit/schema/api/liveSessions'
import type { SessionWorkerEnvironment } from '../src/environment.js'
import worker from '../src/index.js'
import { roomStub } from './roomTeardown.js'

const secret = 'test-secret-that-contains-at-least-thirty-two-bytes'
// The Worker's own bindings plus the secret the typed environment requires.
const deployedEnvironment: SessionWorkerEnvironment = {
  ...env,
  CONTENT_SNAPSHOT_TOKEN_SECRET: `${secret}-content`
}
const body = JSON.stringify({ rolls: [19, 0], repeat: 10 })

function queueRolls(
  environment: SessionWorkerEnvironment,
  options: { origin?: string; headers?: Record<string, string>; method?: string } = {}
) {
  const method = options.method ?? 'POST'
  return worker.fetch!(
    new Request(
      `${options.origin ?? 'http://127.0.0.1:8787'}${LIVE_SESSION_TEST_ROLLS_PATH}/${crypto.randomUUID()}`,
      {
        body: method === 'POST' ? body : undefined,
        headers: options.headers ?? { [LIVE_SESSION_CONTROL_SECRET_HEADER]: secret },
        method
      }
    ),
    environment,
    createExecutionContext()
  )
}

it('gives no test rolls route to a Worker that is not local development', async () => {
  expect((await queueRolls(deployedEnvironment)).status).toBe(404)
  for (const origin of ['http://localhost:8026', 'https://127.0.0.1:8026', 'http://10.0.0.1:8026'])
    expect(
      (await queueRolls({ ...deployedEnvironment, LOCAL_CONTENT_SNAPSHOT_ORIGIN: origin })).status
    ).toBe(404)
})

it('requires the worker secret and a loopback request host of a local development Worker', async () => {
  const local = { ...deployedEnvironment, LOCAL_CONTENT_SNAPSHOT_ORIGIN: 'http://127.0.0.1:41234' }
  expect((await queueRolls(local, { headers: {} })).status).toBe(401)
  expect(
    (await queueRolls(local, { headers: { [LIVE_SESSION_CONTROL_SECRET_HEADER]: 'wrong' } })).status
  ).toBe(401)
  expect((await queueRolls(local, { method: 'GET' })).status).toBe(404)
  expect((await queueRolls(local, { origin: 'https://session.example.test' })).status).toBe(404)
})

it('has the room itself refuse test rolls unless it runs in local development', async () => {
  const stub = roomStub(crypto.randomUUID())
  await runInDurableObject(stub, async (instance) => {
    const response = await instance.fetch(
      new Request(`https://live-session.internal${LIVE_SESSION_TEST_ROLLS_PATH}`, {
        body,
        method: 'POST'
      })
    )
    expect(response.status).toBe(404)
  })
})
