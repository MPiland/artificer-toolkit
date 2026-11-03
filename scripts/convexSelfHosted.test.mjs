import { createServer } from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { convexEnvironmentValue } from './convexSelfHosted.mjs'

// Self-hosted admin keys are `<instance>|<hex>`; the `|` once split the key in a cmd.exe shim.
const adminKey = 'phase82-local-linux|0123456789abcdef'
const secret = 's'.repeat(40)

describe('convexEnvironmentValue', () => {
  const hostEnvironment = process.env
  let server
  let requests
  let respond

  beforeEach(async () => {
    requests = []
    respond = (response) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ status: 'success', value: { name: 'X', value: secret } }))
    }
    server = createServer((request, response) => {
      let body = ''
      request.on('data', (chunk) => (body += chunk))
      request.on('end', () => {
        requests.push({
          authorization: request.headers.authorization,
          body: JSON.parse(body),
          method: request.method,
          url: request.url
        })
        respond(response)
      })
    })
    await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
    process.env = {
      CONVEX_SELF_HOSTED_URL: `http://127.0.0.1:${server.address().port}`,
      CONVEX_SELF_HOSTED_ADMIN_KEY: adminKey
    }
  })

  afterEach(async () => {
    process.env = hostEnvironment
    await new Promise((resolveClose) => server.close(resolveClose))
  })

  it('reads the value through the admin query API with the whole admin key', async () => {
    await expect(convexEnvironmentValue('LIVE_SESSION_WORKER_SECRET')).resolves.toBe(secret)
    expect(requests).toEqual([
      {
        authorization: `Convex ${adminKey}`,
        body: {
          path: '_system/cli/queryEnvironmentVariables:get',
          args: { name: 'LIVE_SESSION_WORKER_SECRET' },
          format: 'json'
        },
        method: 'POST',
        url: '/api/query'
      }
    ])
  })

  it('names an unset variable without echoing the admin key', async () => {
    respond = (response) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ status: 'success', value: null }))
    }
    const failure = convexEnvironmentValue('LIVE_SESSION_WORKER_SECRET')
    await expect(failure).rejects.toThrow(
      'LIVE_SESSION_WORKER_SECRET is not set in the selected local Convex deployment.'
    )
    await expect(failure).rejects.not.toThrow(/0123456789abcdef/u)
  })

  it('reports the HTTP status of a rejected read', async () => {
    respond = (response) => {
      response.writeHead(401)
      response.end()
    }
    await expect(convexEnvironmentValue('LIVE_SESSION_TICKET_SECRET')).rejects.toThrow(
      'LIVE_SESSION_TICKET_SECRET could not be read from the selected local Convex deployment (HTTP 401).'
    )
  })

  it('rejects a value shorter than 32 bytes', async () => {
    respond = (response) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ status: 'success', value: { name: 'X', value: 'short' } }))
    }
    await expect(convexEnvironmentValue('CONTENT_SNAPSHOT_TOKEN_SECRET')).rejects.toThrow(
      'CONTENT_SNAPSHOT_TOKEN_SECRET must be one line of at least 32 bytes.'
    )
  })

  it('refuses a non-loopback deployment before sending the admin key', async () => {
    process.env.CONVEX_SELF_HOSTED_URL = 'https://example.convex.cloud'
    await expect(convexEnvironmentValue('LIVE_SESSION_WORKER_SECRET')).rejects.toThrow(
      'Refusing to run against non-loopback CONVEX_SELF_HOSTED_URL.'
    )
    expect(requests).toEqual([])
  })
})
