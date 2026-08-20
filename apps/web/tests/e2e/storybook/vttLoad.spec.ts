import { expect, test, type Page } from '@playwright/test'

const requestedMinutes = Number(process.env.VTT_SOAK_MINUTES)
const fullSoakMs =
  Number.isFinite(requestedMinutes) && requestedMinutes > 0 ? requestedMinutes * 60_000 : 10_000
const diagnosticSoakMs = 10_000
const requestedCommitIntervalMs = Number(process.env.VTT_COMMIT_INTERVAL_MS)
const commitIntervalMs =
  Number.isFinite(requestedCommitIntervalMs) && requestedCommitIntervalMs >= 16
    ? requestedCommitIntervalMs
    : 250
const startupMarginMs = 150_000
const gestureProbeIntervalMs = 15_000
const modes = ['RAF_ONLY', 'TRANSIENTS', 'FULL'] as const

test('retains the 8K scene renderer correctness and diagnostic load evidence', async ({
  page
}, testInfo) => {
  test.setTimeout(fullSoakMs + diagnosticSoakMs * 2 + startupMarginMs)
  await page.setViewportSize({ width: 1_440, height: 900 })

  for (const mode of modes) {
    const soakMs = mode === 'FULL' ? fullSoakMs : diagnosticSoakMs
    await page.goto(
      `/iframe.html?id=domains-campaigns-vtt-load-fixture--eight-k-scene&viewMode=story&mode=${mode}&soakMs=${soakMs}&commitIntervalMs=${commitIntervalMs}`
    )
    await expect(page.getByTestId('vtt-load-canvas')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('vtt-load-status')).toHaveText('8K map fixture ready.', {
      timeout: 60_000
    })
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Performance.enable')
    await cdp.send('HeapProfiler.enable')
    await cdp.send('HeapProfiler.collectGarbage')
    const heapBefore = metricValue(await cdp.send('Performance.getMetrics'), 'JSHeapUsedSize')

    await exerciseRetainedTracer(page)
    await page.getByRole('button', { name: 'Start load exercise' }).click()
    const reportOutput = page.getByTestId('vtt-load-report')
    let peakHeapGrowthBytes = 0
    const gestureProbes = await waitForLoadReportWithGestureProbes(
      page,
      reportOutput,
      cdp,
      heapBefore,
      (growthBytes) => {
        peakHeapGrowthBytes = Math.max(peakHeapGrowthBytes, growthBytes)
      }
    )
    const heapBeforeCollection = metricValue(
      await cdp.send('Performance.getMetrics'),
      'JSHeapUsedSize'
    )
    peakHeapGrowthBytes = Math.max(peakHeapGrowthBytes, heapBeforeCollection - heapBefore)
    await cdp.send('HeapProfiler.collectGarbage')
    const heapAfter = metricValue(await cdp.send('Performance.getMetrics'), 'JSHeapUsedSize')
    const report = JSON.parse((await reportOutput.textContent()) ?? '') as VttLoadReport
    const heapGrowthBytes = heapAfter - heapBefore
    const reportDetails = `VTT report: ${JSON.stringify(report)}`

    await testInfo.attach(`vtt-load-${mode.toLowerCase()}`, {
      body: JSON.stringify({ gestureProbes, heapGrowthBytes, peakHeapGrowthBytes, report }, null, 2),
      contentType: 'application/json'
    })
    console.info(
      `VTT load ${mode}: ${JSON.stringify({ gestureProbes, heapGrowthBytes, peakHeapGrowthBytes, report })}`
    )
    expect(report.mode, reportDetails).toBe(mode)
    expect(report.mapLoadComplete, reportDetails).toBe(true)
    expect(report.transientVisualCount, reportDetails).toBe(0)
    expect(report.loadedMapAssetCount, reportDetails).toBe(65)
    expect(report.doorVisualCreateCount, reportDetails).toBeLessThanOrEqual(30)
    expect(report.fogRenderCount, reportDetails).toBeLessThanOrEqual(10)
    expect(report.journey, reportDetails).toEqual({
      fogEdit: true,
      measurementCommit: true,
      panZoom: true,
      playerPreview: true,
      tokenDragCommit: true
    })
    expect(heapGrowthBytes, reportDetails).toBeLessThanOrEqual(16 * 1024 * 1024)
    expect(peakHeapGrowthBytes, reportDetails).toBeLessThanOrEqual(96 * 1024 * 1024)
    if (mode === 'FULL') expect(report.updateCount, reportDetails).toBeGreaterThan(0)
    else expect(report.updateCount, reportDetails).toBe(0)
    if (testInfo.project.name === 'storybook-vtt-hardware') {
      expect(report.foregroundInterrupted, reportDetails).toBe(false)
      expect(report.maxForegroundFrameGapMs, reportDetails).toBeLessThanOrEqual(100)
      expect(report.maxLongTaskMs, reportDetails).toBeLessThanOrEqual(100)
      expect(gestureProbes, reportDetails).not.toHaveLength(0)
      expect(gestureProbes.every((probe) => probe.foreground), reportDetails).toBe(true)
      expect(Math.max(...gestureProbes.map((probe) => probe.elapsedWallMs)), reportDetails).toBeLessThanOrEqual(100)
    }
    if (testInfo.project.name === 'storybook-vtt-hardware' && mode === 'FULL') {
      expect(report.webglRenderer, reportDetails).not.toBeNull()
      expect(report.webglRenderer, reportDetails).not.toMatch(/SwiftShader/i)
      expect(report.averageFps, reportDetails).toBeGreaterThanOrEqual(45)
    }
  }
})

interface VttLoadReport {
  averageFps: number
  doorVisualCreateCount: number
  fogRenderCount: number
  foregroundInterrupted: boolean
  foregroundTransitions: Array<{
    focusState: boolean
    source: 'FOCUS' | 'INITIAL' | 'VISIBILITY'
    timestampMs: number
    visibilityState: DocumentVisibilityState
  }>
  frameGapRecords: Array<{
    durationMs: number
    focusState: boolean
    maxLongTaskMs: number
    timestampMs: number
    updateCount: number
    visibilityState: DocumentVisibilityState
  }>
  journey: {
    fogEdit: boolean
    measurementCommit: boolean
    panZoom: boolean
    playerPreview: boolean
    tokenDragCommit: boolean
  }
  loadedMapAssetCount: number
  mapLoadComplete: boolean
  maxFrameGapMs: number
  maxForegroundFrameGapMs: number
  maxLongTaskMs: number
  mode: (typeof modes)[number]
  transientVisualCount: number
  updateCount: number
  webglRenderer: string | null
  webglVendor: string | null
}

interface VttGestureProbe {
  elapsedWallMs: number
  foreground: boolean
  focusState: boolean
  visibilityState: DocumentVisibilityState
}

async function waitForLoadReportWithGestureProbes(
  page: Page,
  reportOutput: ReturnType<Page['getByTestId']>,
  cdp: Awaited<ReturnType<ReturnType<Page['context']>['newCDPSession']>>,
  heapBefore: number,
  recordPeakHeapGrowth: (growthBytes: number) => void
): Promise<VttGestureProbe[]> {
  const gestureProbes: VttGestureProbe[] = []
  let wheelDeltaY = -120
  while (!(await reportOutput.isVisible())) {
    const currentHeap = metricValue(await cdp.send('Performance.getMetrics'), 'JSHeapUsedSize')
    recordPeakHeapGrowth(currentHeap - heapBefore)
    gestureProbes.push(await probeCanvasGesture(page, wheelDeltaY))
    wheelDeltaY = -wheelDeltaY
    await page.waitForTimeout(gestureProbeIntervalMs)
  }
  return gestureProbes
}

async function probeCanvasGesture(page: Page, wheelDeltaY: number): Promise<VttGestureProbe> {
  const canvas = page.getByRole('img', { name: 'Interactive campaign scene' })
  await canvas.hover()
  const startedAt = Date.now()
  await page.mouse.wheel(0, wheelDeltaY)
  const foregroundState = await page.evaluate(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
    return {
      focusState: document.hasFocus(),
      visibilityState: document.visibilityState
    }
  })
  return {
    elapsedWallMs: Date.now() - startedAt,
    foreground: foregroundState.visibilityState === 'visible' && foregroundState.focusState,
    ...foregroundState
  }
}

async function exerciseRetainedTracer(page: Page): Promise<void> {
  const journey = page.getByTestId('vtt-load-journey')
  const canvas = page.getByRole('img', { name: 'Interactive campaign scene' })

  await page.getByRole('button', { name: 'Exercise pan and zoom' }).click()
  await expect(journey).toContainText('"panZoom":true')

  await page.getByRole('button', { name: 'Exercise fog and player preview' }).click()
  await expect(journey).toContainText('"fogEdit":true')
  await expect(journey).toContainText('"playerPreview":true')

  await page.getByRole('button', { name: 'Prepare local token drag' }).click()
  await expect(page.getByTestId('vtt-load-status')).toHaveText(
    'Token centered for the local drag check.'
  )
  const dragBounds = await canvas.boundingBox()
  if (!dragBounds) throw new Error('VTT load canvas has no drag bounds.')
  const dragStart = {
    x: dragBounds.x + dragBounds.width / 2,
    y: dragBounds.y + dragBounds.height / 2
  }
  await page.mouse.move(dragStart.x, dragStart.y)
  await page.mouse.down()
  await page.mouse.move(dragStart.x + 36, dragStart.y, { steps: 6 })
  await page.mouse.up()
  await expect(journey).toContainText('"tokenDragCommit":true')

  await page.getByRole('button', { name: 'Prepare local measurement' }).click()
  await expect(page.getByTestId('vtt-load-status')).toHaveText(
    'Measurement tool ready for the local commit check.'
  )
  const measureBounds = await canvas.boundingBox()
  if (!measureBounds) throw new Error('VTT load canvas has no measurement bounds.')
  const measureStart = { x: measureBounds.x + 240, y: measureBounds.y + 220 }
  await page.mouse.move(measureStart.x, measureStart.y)
  await page.mouse.down()
  await page.mouse.move(measureStart.x + 260, measureStart.y + 120, { steps: 8 })
  await page.mouse.up()
  await expect(journey).toContainText('"measurementCommit":true')
}

function metricValue(
  result: { metrics: Array<{ name: string; value: number }> },
  name: string
): number {
  const metric = result.metrics.find((candidate) => candidate.name === name)
  if (!metric) throw new Error(`Chrome did not report ${name}.`)
  return metric.value
}
