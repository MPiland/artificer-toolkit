import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect, type Page, type WebSocket } from '@playwright/test'
import { signIn, waitForRouterIdle, watchAuthenticatedSession } from './campaignCollaboration'

type Account = { email: string; password: string; username: string }
type Preview = {
  sceneId: string
  sequence: number
  tokenId: string
  position: { x: number; y: number }
}
type Frame<T> = T & { at: number; raw: string; socketId: number }
type Ping = { sequence: number; position: { x: number; y: number }; baselineVersion: number }
type ReceivedPreview = Frame<Preview & { resolution: { accepted: boolean; path: unknown } | null }>
type BrowserProof = {
  versions: Record<number, number>
  paints: (Preview & { paintedAt: number })[]
}
type Client = {
  page: Page
  errors: string[]
  sent: Frame<Preview>[]
  pings: Frame<Ping>[]
  sentKinds: string[]
  received: ReceivedPreview[]
  receivedPings: Frame<Ping>[]
  receivedKinds: string[]
  syncTokenIds: string[]
  syncTokens: (Preview['position'] & { id: string })[]
  syncVersion: number | null
  socketPath: string | null
  socket: WebSocket | null
  socketId: number
  ready: boolean
}

const origin = 'http://localhost:3000'
const workerOrigin = 'ws://127.0.0.1:8787'
const limits = { previewP95Ms: 150, durableP95Ms: 250, durableP99Ms: 500 }
const proofInitScript = `(() => {
  const proof = { versions: {}, paints: [] }
  window.__v15Proof = proof
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name !== 'artificer:vtt-token-preview-rendered') continue
      const detail = entry.detail
      if (typeof detail?.sceneId !== 'string' || typeof detail.sequence !== 'number' || typeof detail.tokenId !== 'string') continue
      const position = detail.position
      if (typeof position?.x !== 'number' || typeof position.y !== 'number') continue
      const { sceneId, sequence, tokenId } = detail
      requestAnimationFrame(() => proof.paints.push({ sceneId, sequence, tokenId, position, paintedAt: Date.now() }))
    }
  }).observe({ type: 'mark', buffered: true })
})()`
const observeVersionScript = `(() => {
  const region = document.querySelector('section[aria-label^="Live scene: "]')
  if (!region) throw new Error('V15 live scene region is missing.')
  const proof = window.__v15Proof
  const capture = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim() ?? ''
      if (!/^v[0-9]+$/.test(text)) continue
      const parent = walker.currentNode.parentElement
      if (!parent || parent.getClientRects().length === 0) continue
      const version = Number(text.slice(1))
      proof.versions[version] ??= Date.now()
    }
  }))
  new MutationObserver(capture).observe(region, { subtree: true, childList: true, characterData: true })
  capture()
})()`

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readPreview(payload: string, sent: boolean): Preview | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(payload) as unknown
  } catch {
    return null
  }
  const frame = record(parsed)
  if (frame?.type !== 'TRANSIENT') return null
  const envelope = record(sent ? frame.envelope : record(frame.message)?.envelope)
  const position = record(envelope?.position)
  if (
    envelope?.kind !== 'TOKEN_DRAG_PREVIEW' ||
    typeof envelope.sceneId !== 'string' ||
    typeof envelope.sequence !== 'number' ||
    typeof envelope.tokenId !== 'string' ||
    typeof position?.x !== 'number' ||
    typeof position.y !== 'number'
  )
    return null
  return {
    sceneId: envelope.sceneId,
    sequence: envelope.sequence,
    tokenId: envelope.tokenId,
    position: { x: position.x, y: position.y }
  }
}

function readPing(payload: string, sent: boolean): Ping | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(payload) as unknown
  } catch {
    return null
  }
  const frame = record(parsed)
  if (frame?.type !== 'TRANSIENT') return null
  const envelope = record(sent ? frame.envelope : record(frame.message)?.envelope)
  const position = record(envelope?.position)
  if (
    envelope?.kind !== 'PING' ||
    typeof envelope.sequence !== 'number' ||
    typeof envelope.baselineVersion !== 'number' ||
    typeof position?.x !== 'number' ||
    typeof position.y !== 'number'
  )
    return null
  return {
    sequence: envelope.sequence,
    baselineVersion: envelope.baselineVersion,
    position: { x: position.x, y: position.y }
  }
}

function percentile(values: readonly number[], rank: number): number {
  assert.ok(values.length > 0, 'V15 browser timing has no samples.')
  return [...values].sort((a, b) => a - b)[Math.ceil(rank * values.length) - 1]!
}

function summary(values: readonly number[]) {
  return {
    samples: values.length,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    p99Ms: percentile(values, 0.99),
    maximumMs: Math.max(...values),
    rawMs: values
  }
}

function liveScene(page: Page) {
  return page.getByRole('region', { name: /^Live scene: / })
}

async function sceneVersion(page: Page): Promise<number> {
  const label = await liveScene(page)
    .getByText(/^v\d+$/)
    .innerText()
  return Number(label.slice(1))
}

export async function openV15WorkloadBrowser(input: {
  owner: Account
  players: readonly Account[]
  campaignPublicId: string
  evidenceDirectory?: string
  map: { width: number; height: number }
  tokenPosition: { x: number; y: number }
}) {
  assert.equal(input.players.length, 5)
  const browser = await chromium.launch({ headless: true })
  const clients: Client[] = []
  const previewMs: number[] = []
  const durableMs: number[] = []
  const previewSamples: {
    sequence: number
    tokenId: string
    perPeerMs: number[]
    slowestPeerMs: number
    warmupMs: number
  }[] = []
  const durableSamples: { version: number; perPeerMs: number[]; slowestPeerMs: number }[] = []
  const preflight: { sequence: number; tokenId: string; perPeerMs: number[]; warmupMs: number }[] =
    []
  const warmups: { sequence: number; durationMs: number }[] = []
  const saveDiagnostics = async () => {
    if (!input.evidenceDirectory) return
    await mkdir(input.evidenceDirectory, { recursive: true })
    await writeFile(
      `${input.evidenceDirectory}/v15-browser-diagnostics.json`,
      JSON.stringify(
        {
          previewSamples,
          durableSamples,
          preflight,
          warmups,
          clients: clients.map((client) => ({
            errors: client.errors,
            socketId: client.socketId,
            socketPath: client.socketPath,
            ready: client.ready,
            syncVersion: client.syncVersion,
            syncTokenIds: client.syncTokenIds,
            sentKinds: client.sentKinds.slice(-30),
            receivedKinds: client.receivedKinds.slice(-30),
            sent: client.sent.slice(-30),
            pings: client.pings.slice(-30),
            received: client.received.slice(-30),
            receivedPings: client.receivedPings.slice(-30)
          }))
        },
        null,
        2
      )
    )
  }
  try {
    for (const account of [input.owner, ...input.players]) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        reducedMotion: 'reduce'
      })
      context.setDefaultTimeout(30_000)
      const page = await context.newPage()
      await page.addInitScript({ content: proofInitScript })
      const client: Client = {
        page,
        errors: [],
        sent: [],
        pings: [],
        sentKinds: [],
        received: [],
        receivedPings: [],
        receivedKinds: [],
        syncTokenIds: [],
        syncTokens: [],
        syncVersion: null,
        socketPath: null,
        socket: null,
        socketId: 0,
        ready: false
      }
      clients.push(client)
      page.on('pageerror', (error) => client.errors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') client.errors.push(message.text())
      })
      page.on('websocket', (socket) => {
        if (new URL(socket.url()).origin !== workerOrigin) return
        client.socket = socket
        client.socketId += 1
        client.ready = false
        client.syncVersion = null
        client.syncTokenIds = []
        client.syncTokens = []
        client.socketPath = new URL(socket.url()).pathname
        const disconnected = () => {
          if (client.socket !== socket) return
          client.ready = false
          client.syncVersion = null
          client.syncTokenIds = []
          client.syncTokens = []
        }
        socket.on('close', disconnected)
        socket.on('socketerror', disconnected)
        socket.on('framesent', ({ payload }) => {
          if (client.socket !== socket) return
          const raw = payload.toString()
          try {
            const frame = record(JSON.parse(raw) as unknown)
            const envelope = record(frame?.envelope)
            client.sentKinds.push(
              `${String(frame?.type)}:${String(envelope?.kind)}:v${String(envelope?.baselineVersion)}`
            )
          } catch {
            client.sentKinds.push('unparsed')
          }
          const preview = readPreview(raw, true)
          if (preview)
            client.sent.push({
              ...preview,
              at: Date.now(),
              raw: raw.slice(0, 8192),
              socketId: client.socketId
            })
          const ping = readPing(raw, true)
          if (ping)
            client.pings.push({
              ...ping,
              at: Date.now(),
              raw: raw.slice(0, 8192),
              socketId: client.socketId
            })
        })
        socket.on('framereceived', ({ payload }) => {
          if (client.socket !== socket) return
          const raw = payload.toString()
          let resolution: ReceivedPreview['resolution'] = null
          try {
            const frame = record(JSON.parse(raw) as unknown)
            const message = record(frame?.message)
            const envelope = record(message?.envelope)
            client.receivedKinds.push(`${String(frame?.type)}:${String(envelope?.kind)}`)
            if (frame?.type === 'AUTHENTICATION_REQUIRED') client.ready = false
            if (frame?.type === 'TRANSIENT_READY') client.ready = true
            if (frame?.type === 'STATE_SYNC') {
              const scene = record(record(frame.state)?.scene)
              client.syncVersion = typeof scene?.version === 'number' ? scene.version : null
              client.syncTokenIds = Array.isArray(scene?.tokens)
                ? scene.tokens.flatMap((token) => {
                    const id = record(token)?.id
                    return typeof id === 'string' ? [id] : []
                  })
                : []
              client.syncTokens = Array.isArray(scene?.tokens)
                ? scene.tokens.flatMap((token) => {
                    const value = record(token)
                    const position = record(value?.position)
                    return typeof value?.id === 'string' &&
                      typeof position?.x === 'number' &&
                      typeof position.y === 'number'
                      ? [{ id: value.id, x: position.x, y: position.y }]
                      : []
                  })
                : []
            }
            if (envelope?.kind === 'TOKEN_DRAG_PREVIEW') {
              const parsedResolution = record(message?.tokenDragResolution)
              if (typeof parsedResolution?.accepted === 'boolean')
                resolution = { accepted: parsedResolution.accepted, path: parsedResolution.path }
            }
          } catch {
            return
          }
          const preview = readPreview(raw, false)
          if (preview)
            client.received.push({
              ...preview,
              at: Date.now(),
              raw: raw.slice(0, 8192),
              resolution,
              socketId: client.socketId
            })
          const ping = readPing(raw, false)
          if (ping)
            client.receivedPings.push({
              ...ping,
              at: Date.now(),
              raw: raw.slice(0, 8192),
              socketId: client.socketId
            })
        })
      })
      const session = watchAuthenticatedSession(page)
      await signIn(page, account, session)
      await page.goto(
        `${origin}/tabletop/campaigns/${encodeURIComponent(input.campaignPublicId)}`,
        { waitUntil: 'domcontentloaded', timeout: 90_000 }
      )
      await waitForRouterIdle(page)
      const canvas = liveScene(page).getByRole('img', { name: 'Interactive campaign scene' })
      try {
        await expect(canvas).toBeVisible({ timeout: 60_000 })
      } catch {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 })
        await waitForRouterIdle(page)
        try {
          await expect(canvas).toBeVisible({ timeout: 60_000 })
        } catch (error) {
          if (input.evidenceDirectory)
            await page.screenshot({
              path: `${input.evidenceDirectory}/v15-scene-failure-${clients.length}.png`
            })
          throw new Error(
            `V15 browser ${clients.length} scene did not load at ${new URL(page.url()).pathname}.`,
            { cause: error }
          )
        }
      }
      await expect(page.getByText('Scene map ready.', { exact: true })).toBeVisible({
        timeout: 60_000
      })
      await page.evaluate(observeVersionScript)
      await expect.poll(() => client.ready, { timeout: 30_000 }).toBe(true)
    }
    const [gm, ...peers] = clients
    if (!gm || peers.length !== 5) throw new Error('V15 browser cohort is incomplete.')
    // GM previews are private by default; the workload measures previews the GM shares with players.
    const sharePreviews = gm.page.getByRole('button', {
      name: 'Show my previews to players',
      exact: true
    })
    await sharePreviews.click()
    await expect(sharePreviews).toHaveAttribute('aria-pressed', 'true')
    assert.equal(new Set(clients.map((client) => client.socketPath)).size, 1)
    const initialVersion = await sceneVersion(gm.page)
    for (const peer of peers) assert.equal(await sceneVersion(peer.page), initialVersion)
    const matchingToken = () =>
      gm.syncTokens.find(
        (item) => item.x === input.tokenPosition.x && item.y === input.tokenPosition.y
      )
    await expect.poll(matchingToken, { timeout: 15_000 }).toBeDefined()
    const tokenId = matchingToken()!.id

    return {
      async preview(options: { measure?: boolean } = {}): Promise<void> {
        const priorVersion = await sceneVersion(gm.page)
        await gm.page.getByRole('button', { name: 'Fit map to view' }).click()
        await gm.page.evaluate(
          'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
        )
        const canvas = liveScene(gm.page).getByRole('img', { name: 'Interactive campaign scene' })
        const bounds = await canvas.boundingBox()
        if (!bounds) throw new Error('V15 GM scene canvas has no layout bounds.')
        let currentBounds = bounds
        const warmupStartedAt = Date.now()
        let nextPingAt = warmupStartedAt
        let warmupSequence = -1
        const synced = () =>
          clients.every(
            (client) =>
              client.ready &&
              client.syncVersion === priorVersion &&
              client.syncTokenIds.includes(tokenId)
          )
        try {
          await expect
            .poll(
              async () => {
                if (!synced()) return false
                if (Date.now() >= nextPingAt) {
                  // P pings the centre of the fitted map, inside the Scene the room accepts pings in.
                  await canvas.focus()
                  await gm.page.keyboard.press('p')
                  // Poll delivery between pings instead of blocking every poll on browser input.
                  nextPingAt = Date.now() + 1000
                }
                const ping = [...gm.pings]
                  .reverse()
                  .find(
                    (item) =>
                      item.at >= warmupStartedAt &&
                      item.socketId === gm.socketId &&
                      item.baselineVersion === priorVersion &&
                      peers.every((peer) =>
                        peer.receivedPings.some(
                          (received) =>
                            received.at >= warmupStartedAt &&
                            received.socketId === peer.socketId &&
                            received.sequence === item.sequence &&
                            received.baselineVersion === item.baselineVersion &&
                            received.position.x === item.position.x &&
                            received.position.y === item.position.y
                        )
                      )
                  )
                if (ping && synced()) {
                  warmupSequence = ping.sequence
                  return true
                }
                return false
              },
              { timeout: 15_000, intervals: [50, 100, 250] }
            )
            .toBe(true)
        } catch (error) {
          if (input.evidenceDirectory)
            await gm.page.screenshot({ path: `${input.evidenceDirectory}/v15-warmup-failure.png` })
          throw new Error(
            `V15 ping warmup failed; startedAt=${warmupStartedAt}, failedAt=${Date.now()}, socketIds=${clients.map((client) => client.socketId)}, ready=${clients.map((client) => client.ready)}, syncVersions=${clients.map((client) => client.syncVersion)}, tokenVisible=${clients.map((client) => client.syncTokenIds.includes(tokenId))}, GM pings=${JSON.stringify(gm.pings.slice(-8).map(({ sequence }) => sequence))}, peer pings=${JSON.stringify(peers.map((peer) => peer.receivedPings.slice(-8).map(({ sequence }) => sequence)))}.`,
            { cause: error }
          )
        }
        const warmupMs = Date.now() - warmupStartedAt
        warmups.push({ sequence: warmupSequence, durationMs: warmupMs })
        const start = gm.sent.length
        const peerStarts = peers.map((peer) => peer.received.length)
        let pressed = false
        let successfulFrom: { x: number; y: number } | undefined
        try {
          const cursor = () => canvas.evaluate((element) => getComputedStyle(element).cursor)
          try {
            await expect
              .poll(
                async () => {
                  const current = await canvas.boundingBox()
                  if (!current) return null
                  currentBounds = current
                  const currentScale =
                    Math.min(current.width / input.map.width, current.height / input.map.height) *
                    0.94
                  const point = {
                    x:
                      current.x +
                      (current.width - input.map.width * currentScale) / 2 +
                      input.tokenPosition.x * currentScale,
                    y:
                      current.y +
                      (current.height - input.map.height * currentScale) / 2 +
                      input.tokenPosition.y * currentScale
                  }
                  await gm.page.mouse.move(point.x, point.y)
                  const currentCursor = await cursor()
                  if (currentCursor === 'grab') successfulFrom = point
                  return currentCursor
                },
                { timeout: 15_000 }
              )
              .toBe('grab')
          } catch (error) {
            if (input.evidenceDirectory)
              await gm.page.screenshot({ path: `${input.evidenceDirectory}/v15-focus-failure.png` })
            throw new Error(
              `V15 focused token missed at canvas bounds ${JSON.stringify(currentBounds)}.`,
              {
                cause: error
              }
            )
          }
          if (!successfulFrom) throw new Error('V15 focused token has no drag position.')
          await gm.page.mouse.down()
          pressed = true
          await gm.page.mouse.move(successfulFrom.x + 45, successfulFrom.y)
          try {
            await expect.poll(() => gm.sent.length, { timeout: 15_000 }).toBeGreaterThan(start)
          } catch (error) {
            if (input.evidenceDirectory)
              await gm.page.screenshot({ path: `${input.evidenceDirectory}/v15-drag-failure.png` })
            throw new Error(
              `V15 GM sent no token preview; cursor=${await cursor()}, socketReady=${gm.ready}, sent=${gm.sent.length - start}, frames=${gm.sentKinds.slice(-10).join('|')}.`,
              { cause: error }
            )
          }
          const sent = gm.sent[start]!
          assert.equal(sent.socketId, gm.socketId, 'V15 GM socket changed during drag.')
          assert.equal(sent.tokenId, tokenId, 'V15 dragged the wrong token.')
          const resolution = () =>
            gm.received.find(
              (frame) =>
                frame.socketId === gm.socketId &&
                frame.sequence === sent.sequence &&
                frame.tokenId === sent.tokenId &&
                frame.resolution !== null
            )
          await expect.poll(resolution, { timeout: 15_000 }).toBeDefined()
          const gmResponse = resolution()!
          assert.equal(
            gmResponse.resolution?.accepted,
            true,
            `V15 GM drag rejected; sent position=${JSON.stringify(sent.position)}, resolution=${JSON.stringify(gmResponse.resolution)}, socketPath=${gm.socketPath}.`
          )
          const perPeerMs = await Promise.all(
            peers.map(async (peer, index) => {
              const read = () =>
                peer.received
                  .slice(peerStarts[index])
                  .find(
                    (frame) =>
                      frame.socketId === peer.socketId &&
                      frame.sequence === sent.sequence &&
                      frame.sceneId === sent.sceneId &&
                      frame.tokenId === sent.tokenId &&
                      frame.position.x === sent.position.x &&
                      frame.position.y === sent.position.y
                  )
              try {
                await expect.poll(read, { timeout: 15_000 }).toBeDefined()
              } catch (error) {
                throw new Error(
                  `V15 peer ${index + 1} missed preview sequence ${sent.sequence}; sent=${JSON.stringify(sent)}, ready=${clients.map((client) => client.ready)}, syncVersions=${clients.map((client) => client.syncVersion)}, peer frames=${JSON.stringify(peer.received.slice(peerStarts[index]).map(({ sequence, tokenId, position, resolution }) => ({ sequence, tokenId, position, resolution })))}, socketPath=${peer.socketPath}.`,
                  { cause: error }
                )
              }
              const paintedAt = () =>
                peer.page.evaluate((target) => {
                  const proof = (window as Window & { __v15Proof?: BrowserProof }).__v15Proof
                  for (const paint of proof?.paints ?? [])
                    if (
                      paint.paintedAt >= target.at &&
                      paint.sceneId === target.sceneId &&
                      paint.sequence === target.sequence &&
                      paint.tokenId === target.tokenId &&
                      paint.position.x === target.position.x &&
                      paint.position.y === target.position.y
                    )
                      return paint.paintedAt
                  return null
                }, sent)
              await expect.poll(paintedAt, { timeout: 15_000 }).not.toBeNull()
              return (await paintedAt())! - sent.at
            })
          )
          if (options.measure !== false) {
            const slowestPeerMs = Math.max(...perPeerMs)
            previewMs.push(slowestPeerMs)
            previewSamples.push({
              sequence: sent.sequence,
              tokenId: sent.tokenId,
              perPeerMs,
              slowestPeerMs,
              warmupMs
            })
          } else
            preflight.push({ sequence: sent.sequence, tokenId: sent.tokenId, perPeerMs, warmupMs })
        } finally {
          if (pressed) {
            await gm.page.mouse.move(0, 0)
            await gm.page.mouse.up()
          }
        }
        await gm.page.waitForTimeout(250)
        assert.equal(
          await sceneVersion(gm.page),
          priorVersion,
          'Preview must not commit a Scene move.'
        )
      },
      // From the committing command's acknowledgement to each peer's paint of the Scene version.
      async observeDurable(version: number, committedAt: number): Promise<void> {
        const painted = await Promise.all(
          peers.map(async (peer) => {
            await expect(
              liveScene(peer.page).getByText(`v${version}`, { exact: true })
            ).toBeVisible({ timeout: 15_000 })
            const timestamp = () =>
              peer.page.evaluate(
                (value) =>
                  (window as Window & { __v15Proof?: BrowserProof }).__v15Proof?.versions[value] ??
                  null,
                version
              )
            await expect.poll(timestamp, { timeout: 15_000 }).not.toBeNull()
            return (await timestamp())!
          })
        )
        const perPeerMs = painted.map((value) => value - committedAt)
        const slowestPeerMs = Math.max(...perPeerMs)
        durableMs.push(slowestPeerMs)
        durableSamples.push({ version, perPeerMs, slowestPeerMs })
      },
      summary(expected: { previewSamples: number; durableSamples: number }) {
        assert.deepEqual(
          clients.flatMap((client) => client.errors),
          [],
          'V15 browsers reported application errors.'
        )
        assert.equal(previewMs.length, expected.previewSamples)
        assert.equal(durableMs.length, expected.durableSamples)
        const result = {
          preview: summary(previewMs),
          durable: summary(durableMs),
          previewSamples,
          durableSamples,
          preflight,
          warmups
        }
        assert.ok(
          result.preview.p95Ms <= limits.previewP95Ms,
          'V15 peer preview p95 exceeded 150 ms.'
        )
        assert.ok(
          result.durable.p95Ms <= limits.durableP95Ms,
          'V15 durable peer p95 exceeded 250 ms.'
        )
        assert.ok(
          result.durable.p99Ms <= limits.durableP99Ms,
          'V15 durable peer p99 exceeded 500 ms.'
        )
        return result
      },
      async close(): Promise<void> {
        try {
          await saveDiagnostics()
        } finally {
          await browser.close()
        }
      }
    }
  } catch (error) {
    try {
      await saveDiagnostics()
    } catch {
      // Preserve the browser failure when diagnostic storage is unavailable.
    }
    await browser.close().catch(() => undefined)
    throw error
  }
}
