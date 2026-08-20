import { createServer } from 'node:http'

import liveSessionExecutor from '../../../netlify/functions/live-session-executor.mjs'

const host = '127.0.0.1'
const port = Number(process.env.LIVE_SESSION_LOCAL_EXECUTOR_PORT ?? 8_888)

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('LIVE_SESSION_LOCAL_EXECUTOR_PORT must be a valid TCP port.')
}

const server = createServer(async (incoming, outgoing) => {
  if (incoming.method === 'GET' && incoming.url === '/health') {
    outgoing.writeHead(200, { 'cache-control': 'no-store', 'content-type': 'application/json' })
    outgoing.end('{"ok":true}')
    return
  }
  const startedAt = performance.now()
  let operation = 'UNKNOWN'
  try {
    const chunks: Buffer[] = []
    for await (const chunk of incoming) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined
    if (body) {
      const parsed = JSON.parse(body.toString('utf8')) as { operation?: unknown }
      if (typeof parsed.operation === 'string') operation = parsed.operation
    }
    const headers = new Headers()
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) headers.append(name, item)
      } else if (value !== undefined) {
        headers.set(name, value)
      }
    }
    const request = new Request(
      new URL(incoming.url ?? '/', `http://${incoming.headers.host ?? `${host}:${port}`}`),
      {
        body,
        headers,
        method: incoming.method ?? 'GET'
      }
    )
    const response = await liveSessionExecutor(request)
    console.info(
      JSON.stringify({
        localLiveSessionExecutor: {
          durationMs: performance.now() - startedAt,
          operation,
          status: response.status
        }
      })
    )
    outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()))
    outgoing.end(Buffer.from(await response.arrayBuffer()))
  } catch (error) {
    console.error(error)
    outgoing.writeHead(500, { 'content-type': 'text/plain' })
    outgoing.end('Local live-session executor failed.')
  }
})

server.listen(port, host, () => {
  console.info(`Local live-session executor listening on http://${host}:${port}.`)
})

const shutdown = () => server.close(() => process.exit(0))
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
