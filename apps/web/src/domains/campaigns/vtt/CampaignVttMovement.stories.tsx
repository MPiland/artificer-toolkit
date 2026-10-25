import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useMemo, useRef, useState } from 'react'
import { expect, fireEvent, waitFor, within } from 'storybook/test'
import {
  campaignSceneStateDtoSchema,
  type CampaignSceneStateDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { tabletopCurrentUserId, tabletopLiveScene } from './CampaignTabletop.stories.fixtures'
import { createVttSceneRenderer, type VttSceneRenderer } from './vttSceneRenderer'
import { validated } from '../../../test/validatedFixture'

const movementScene = validated(campaignSceneStateDtoSchema)({
  ...tabletopLiveScene,
  barriers: [
    {
      a: { x: 500, y: 150 },
      b: { x: 500, y: 400 },
      blocksLight: true,
      blocksMovement: true,
      id: '77777777-7777-4777-8777-777777777799',
      kind: 'WALL'
    }
  ],
  doorStates: {},
  tokens: [tabletopLiveScene.tokens[0]!]
})

const largeTokenSize = tabletopLiveScene.grid.cellSize * 2

// A 2x2 token on the open map, so only the map edge constrains it.
const largeTokenScene = validated(campaignSceneStateDtoSchema)({
  ...movementScene,
  barriers: [],
  tokens: [
    {
      ...tabletopLiveScene.tokens[0]!,
      height: largeTokenSize,
      position: { x: 300, y: 300 },
      width: largeTokenSize
    }
  ]
})

// The same 2x2 token beside the wall in movementScene.
const largeTokenBesideWallScene = validated(campaignSceneStateDtoSchema)({
  ...movementScene,
  tokens: [{ ...largeTokenScene.tokens[0], position: { x: 300, y: 230 } }]
})

const rotatedLargeTokenScene = validated(campaignSceneStateDtoSchema)({
  ...largeTokenScene,
  tokens: [{ ...largeTokenScene.tokens[0], rotationDegrees: 135 }]
})

let nextPointerId = 1

type Diagnostics = ReturnType<VttSceneRenderer['getDiagnostics']>

function MovementFixture({
  facing = false,
  scene = movementScene
}: {
  facing?: boolean
  scene?: CampaignSceneStateDto
}) {
  const host = useRef<HTMLDivElement | null>(null)
  const renderer = useRef<VttSceneRenderer | null>(null)
  const [ready, setReady] = useState(false)
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null)
  const [diagnosticsReads, setDiagnosticsReads] = useState(0)
  const [appearanceChanged, setAppearanceChanged] = useState(false)
  const [sceneRevision, setSceneRevision] = useState(0)
  const tokenPresentations = useMemo(
    () =>
      appearanceChanged || facing
        ? {
            [scene.tokens[0]!.id]: {
              accessibleDescription: 'Moved token.',
              artUrl: null,
              dispositionLabel: null,
              facing,
              fillColor: 0x1971c2,
              halo: null,
              marked: false,
              outlineColor: 0xffffff,
              statuses: [],
              targetable: false
            }
          }
        : undefined,
    [appearanceChanged, facing, scene]
  )
  const [preview, setPreview] = useState<ScenePoint | null>(null)
  const [committedPath, setCommittedPath] = useState<ScenePoint[] | null>(null)
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null)

  useEffect(() => {
    if (!host.current) return
    let disposed = false
    void createVttSceneRenderer(host.current, SRD_SYSTEM_ID, {
      onCreateBarrier: () => undefined,
      onCreateDarkness: () => undefined,
      onCreateLight: () => undefined,
      onCreateToken: () => undefined,
      onDoorState: () => undefined,
      onMeasurementCommit: () => undefined,
      onMeasurementPreview: () => undefined,
      onPing: () => false,
      onTokenCommit: (_tokenId, path) => setCommittedPath(path),
      onTokenHover: setHoveredTokenId,
      onTokenPreview: (_tokenId, position) => setPreview(position)
    }).then((nextRenderer) => {
      if (disposed) {
        nextRenderer.destroy()
        return
      }
      renderer.current = nextRenderer
      nextRenderer.update({
        boundTokenControl: new Map(),
        currentUserId: tabletopCurrentUserId,
        mapDelivery: null,
        mode: 'PLAY',
        role: 'PLAYER',
        scene,
        tokenPresentations,
        tool: 'SELECT'
      })
      setReady(true)
    })
    return () => {
      disposed = true
      renderer.current?.destroy()
      renderer.current = null
    }
  }, [])

  useEffect(() => {
    if (!renderer.current) return
    renderer.current.update({
      boundTokenControl: new Map(),
      currentUserId: tabletopCurrentUserId,
      mapDelivery: null,
      mode: 'PLAY',
      role: 'PLAYER',
      scene,
      tokenPresentations,
      tool: 'SELECT'
    })
    // A revision re-sends equal inputs, as live presence and chat updates do mid-drag.
  }, [scene, sceneRevision, tokenPresentations])

  return (
    <section aria-label='Movement path fixture' style={{ display: 'grid', gap: 12, padding: 16 }}>
      <div ref={host} style={{ blockSize: 600, minInlineSize: 0, overflow: 'hidden' }} />
      <output aria-live='polite' data-testid='movement-status'>
        {ready ? 'Movement scene ready.' : 'Loading movement scene…'}
      </output>
      <output aria-live='polite' data-testid='movement-preview'>
        {preview ? JSON.stringify(preview) : 'No movement preview.'}
      </output>
      <output aria-live='polite' data-testid='movement-commit'>
        {committedPath ? JSON.stringify(committedPath) : 'No committed movement.'}
      </output>
      <output aria-live='polite' data-testid='movement-hover'>
        {hoveredTokenId ?? 'No hovered token.'}
      </output>
      <output aria-live='polite' data-reads={diagnosticsReads} data-testid='movement-diagnostics'>
        {diagnostics ? JSON.stringify(diagnostics) : 'No diagnostics read.'}
      </output>
      <button
        type='button'
        onClick={() => {
          if (!renderer.current) return
          setDiagnostics(renderer.current.getDiagnostics())
          setDiagnosticsReads((reads) => reads + 1)
        }}
      >
        Read diagnostics
      </button>
      <button type='button' onClick={() => setAppearanceChanged(true)}>
        Change token appearance
      </button>
      <button type='button' onClick={() => setSceneRevision((revision) => revision + 1)}>
        Resend scene
      </button>
    </section>
  )
}

const meta = {
  component: MovementFixture,
  parameters: { a11y: { test: 'error' }, layout: 'fullscreen' },
  title: 'Domains/Campaigns/VTT/Movement'
} satisfies Meta<typeof MovementFixture>

export default meta
type Story = StoryObj<typeof meta>

export const StraightDrag: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Movement scene ready.')).toBeVisible()
    const rendererCanvas = canvas.getByRole('img', { name: 'Interactive campaign scene' })
    const from = sceneToClient(rendererCanvas, movementScene.tokens[0]!.position)
    const to = sceneToClient(rendererCanvas, { x: 420, y: 230 })
    await drag(rendererCanvas, [from, to])

    await waitFor(() =>
      expect(canvas.getByTestId('movement-preview')).not.toHaveTextContent('No movement')
    )
    const path = committedPath(canvas.getByTestId('movement-commit').textContent)
    expect(path).toHaveLength(2)
    expect(path.at(-1)?.x).toBeCloseTo(420)
    expect(path.at(-1)?.y).toBeCloseTo(230)
  }
}

export const WaypointDrag: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Movement scene ready.')).toBeVisible()
    const rendererCanvas = canvas.getByRole('img', { name: 'Interactive campaign scene' })
    await drag(rendererCanvas, [
      sceneToClient(rendererCanvas, movementScene.tokens[0]!.position),
      sceneToClient(rendererCanvas, { x: 450, y: 100 }),
      sceneToClient(rendererCanvas, { x: 550, y: 100 }),
      sceneToClient(rendererCanvas, { x: 650, y: 230 })
    ])

    await waitFor(() =>
      expect(canvas.getByTestId('movement-commit')).not.toHaveTextContent('No committed')
    )
    const path = committedPath(canvas.getByTestId('movement-commit').textContent)
    expect(path.length).toBeGreaterThan(2)
    expect(path.at(-1)?.x).toBeCloseTo(650)
    expect(path.at(-1)?.y).toBeCloseTo(230)
  }
}

export const AppearanceChangeDrag: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Movement scene ready.')).toBeVisible()
    await fireEvent.click(canvas.getByRole('button', { name: 'Change token appearance' }))
    const rendererCanvas = canvas.getByRole('img', { name: 'Interactive campaign scene' })
    const from = sceneToClient(rendererCanvas, movementScene.tokens[0]!.position)
    const to = sceneToClient(rendererCanvas, { x: 420, y: 230 })
    await drag(rendererCanvas, [from, to])
    await waitFor(() =>
      expect(canvas.getByTestId('movement-commit')).not.toHaveTextContent('No committed')
    )
    const path = committedPath(canvas.getByTestId('movement-commit').textContent)
    expect(path[0]).toEqual(movementScene.tokens[0]!.position)
    expect(path.at(-1)?.x).toBeCloseTo(420)
    expect(path.at(-1)?.y).toBeCloseTo(230)
  }
}

export const PresentedTokenDragSurvivesUpdate: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Movement scene ready.')).toBeVisible()
    await fireEvent.click(canvas.getByRole('button', { name: 'Change token appearance' }))
    const rendererCanvas = canvas.getByRole('img', { name: 'Interactive campaign scene' })
    const from = sceneToClient(rendererCanvas, movementScene.tokens[0]!.position)
    const middle = sceneToClient(rendererCanvas, { x: 380, y: 230 })
    const to = sceneToClient(rendererCanvas, { x: 420, y: 230 })
    const pointerId = nextPointerId++
    await nextFrame()
    fireEvent.pointerDown(rendererCanvas, {
      button: 0,
      buttons: 1,
      clientX: from.x,
      clientY: from.y,
      pointerId,
      pointerType: 'mouse'
    })
    await nextFrame()
    fireEvent.pointerMove(rendererCanvas, {
      buttons: 1,
      clientX: middle.x,
      clientY: middle.y,
      pointerId,
      pointerType: 'mouse'
    })
    await nextFrame()
    await fireEvent.click(canvas.getByRole('button', { name: 'Resend scene' }))
    await nextFrame()
    fireEvent.pointerMove(rendererCanvas, {
      buttons: 1,
      clientX: to.x,
      clientY: to.y,
      pointerId,
      pointerType: 'mouse'
    })
    await nextFrame()
    fireEvent.pointerUp(rendererCanvas, {
      button: 0,
      buttons: 0,
      clientX: to.x,
      clientY: to.y,
      pointerId,
      pointerType: 'mouse'
    })

    await waitFor(() =>
      expect(canvas.getByTestId('movement-commit')).not.toHaveTextContent('No committed')
    )
    const path = committedPath(canvas.getByTestId('movement-commit').textContent)
    expect(path[0]).toEqual(movementScene.tokens[0]!.position)
    expect(path.at(-1)?.x).toBeCloseTo(420)
    expect(path.at(-1)?.y).toBeCloseTo(230)
  }
}

export const PathPreviewDuringDrag: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Movement scene ready.')).toBeVisible()
    const rendererCanvas = canvas.getByRole('img', { name: 'Interactive campaign scene' })
    const token = movementScene.tokens[0]!
    const pointerId = await pressToken(rendererCanvas, token.position)
    // A single point draws no route line yet.
    await expect((await readDiagnostics(canvas)).activeDrag).toEqual({
      pointCount: 1,
      position: token.position,
      route: []
    })

    // The wall forces a bend: the straight line from the origin to the last point is blocked.
    for (const waypoint of [
      { x: 450, y: 100 },
      { x: 550, y: 100 },
      { x: 650, y: 230 }
    ]) {
      await movePointer(rendererCanvas, pointerId, waypoint)
    }
    const midDrag = (await readDiagnostics(canvas)).activeDrag
    expect(midDrag?.pointCount).toBe(3)
    expect(midDrag?.position.x).toBeCloseTo(650)
    expect(midDrag?.position.y).toBeCloseTo(230)
    // The drawn route line is the dragged path from the origin to the token's current position.
    expect(midDrag?.route).toHaveLength(midDrag?.pointCount ?? -1)
    expect(midDrag?.route[0]).toEqual(token.position)
    expect(midDrag?.route.at(-1)?.x).toBeCloseTo(650)
    expect(midDrag?.route.at(-1)?.y).toBeCloseTo(230)
    expect((await readDiagnostics(canvas)).dragRouteLineCount).toBe(1)
    expect(canvas.getByTestId('movement-preview')).toHaveTextContent('"x":650')
    expect(canvas.getByTestId('movement-commit')).toHaveTextContent('No committed movement.')

    releasePointer(rendererCanvas, pointerId, { x: 650, y: 230 })
    await waitFor(() =>
      expect(canvas.getByTestId('movement-commit')).not.toHaveTextContent('No committed')
    )
    const released = await readDiagnostics(canvas)
    expect(released.activeDrag).toBeNull()
    expect(released.dragRouteLineCount).toBe(0)
    const path = committedPath(canvas.getByTestId('movement-commit').textContent)
    expect(path).toHaveLength(midDrag?.pointCount ?? -1)
    expect(path[0]).toEqual(token.position)
    expect(path.at(-1)?.x).toBeCloseTo(650)
    expect(path.at(-1)?.y).toBeCloseTo(230)
  }
}

const largeToken = largeTokenScene.tokens[0]

export const LargeTokenFootprintAndOffCentreGrab: Story = {
  args: { scene: largeTokenScene },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Movement scene ready.')).toBeVisible()
    const rendererCanvas = canvas.getByRole('img', { name: 'Interactive campaign scene' })
    expect((await readDiagnostics(canvas)).tokens).toEqual([
      expect.objectContaining({
        footprint: { height: largeTokenSize, width: largeTokenSize },
        position: largeToken.position
      })
    ])

    // Grab 40 units right and below the centre: still inside the 140-unit footprint, not at the centre.
    const grab = { x: largeToken.position.x + 40, y: largeToken.position.y + 40 }
    const pointerId = await pressToken(rendererCanvas, grab)
    await movePointer(rendererCanvas, pointerId, { x: grab.x + 100, y: grab.y })
    releasePointer(rendererCanvas, pointerId, { x: grab.x + 100, y: grab.y })

    await waitFor(() =>
      expect(canvas.getByTestId('movement-commit')).not.toHaveTextContent('No committed')
    )
    // The grab offset is kept, so the token centre moves by the pointer delta rather than snapping to it.
    const path = committedPath(canvas.getByTestId('movement-commit').textContent)
    expect(path[0]).toEqual(largeToken.position)
    expect(path.at(-1)?.x).toBeCloseTo(largeToken.position.x + 100)
    expect(path.at(-1)?.y).toBeCloseTo(largeToken.position.y)
  }
}

export const LargeTokenClampsAtBottomRightEdge: Story = {
  args: { scene: largeTokenScene },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Movement scene ready.')).toBeVisible()
    const rendererCanvas = canvas.getByRole('img', { name: 'Interactive campaign scene' })
    const pointerId = await pressToken(rendererCanvas, largeToken.position)
    // The map corner is the farthest point still inside the canvas; the token centre must stop short of it.
    const mapCorner = { x: largeTokenScene.map.width, y: largeTokenScene.map.height }
    await movePointer(rendererCanvas, pointerId, mapCorner)
    releasePointer(rendererCanvas, pointerId, mapCorner)

    await waitFor(() =>
      expect(canvas.getByTestId('movement-commit')).not.toHaveTextContent('No committed')
    )
    // The centre stops half a footprint inside the edge, so the whole token stays on the map.
    const path = committedPath(canvas.getByTestId('movement-commit').textContent)
    expect(path.at(-1)?.x).toBeCloseTo(largeTokenScene.map.width - largeTokenSize / 2)
    expect(path.at(-1)?.y).toBeCloseTo(largeTokenScene.map.height - largeTokenSize / 2)
  }
}

export const LargeTokenClampsAtTopLeftEdge: Story = {
  args: { scene: largeTokenScene },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Movement scene ready.')).toBeVisible()
    const rendererCanvas = canvas.getByRole('img', { name: 'Interactive campaign scene' })
    const pointerId = await pressToken(rendererCanvas, largeToken.position)
    const mapCorner = { x: 0, y: 0 }
    await movePointer(rendererCanvas, pointerId, mapCorner)
    releasePointer(rendererCanvas, pointerId, mapCorner)

    await waitFor(() =>
      expect(canvas.getByTestId('movement-commit')).not.toHaveTextContent('No committed')
    )
    const path = committedPath(canvas.getByTestId('movement-commit').textContent)
    expect(path.at(-1)?.x).toBeCloseTo(largeTokenSize / 2)
    expect(path.at(-1)?.y).toBeCloseTo(largeTokenSize / 2)
  }
}

export const LargeTokenDragStopsAtBarrier: Story = {
  args: { scene: largeTokenBesideWallScene },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Movement scene ready.')).toBeVisible()
    const rendererCanvas = canvas.getByRole('img', { name: 'Interactive campaign scene' })
    const origin = largeTokenBesideWallScene.tokens[0].position
    const pointerId = await pressToken(rendererCanvas, origin)
    // Straight across the wall at x = 500, which spans y 150 to 400.
    const pastWall = { x: 700, y: origin.y }
    await movePointer(rendererCanvas, pointerId, pastWall)

    // The token never crosses: it stays where it last had a clear move and no movement is previewed.
    await expect((await readDiagnostics(canvas)).activeDrag).toEqual({
      pointCount: 1,
      position: origin,
      route: []
    })
    expect(canvas.getByTestId('movement-preview')).toHaveTextContent('No movement preview.')

    releasePointer(rendererCanvas, pointerId, pastWall)
    await nextFrame()
    expect(canvas.getByTestId('movement-commit')).toHaveTextContent('No committed movement.')
    expect((await readDiagnostics(canvas)).tokens[0]?.position).toEqual(origin)
  }
}

export const HoveringATokenReportsIt: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Movement scene ready.')).toBeVisible()
    const rendererCanvas = canvas.getByRole('img', { name: 'Interactive campaign scene' })
    const token = movementScene.tokens[0]!
    const pointerId = nextPointerId++
    await movePointer(rendererCanvas, pointerId, token.position)
    await waitFor(() => expect(canvas.getByTestId('movement-hover')).toHaveTextContent(token.id))
    await movePointer(rendererCanvas, pointerId, { x: 900, y: 700 })
    await waitFor(() =>
      expect(canvas.getByTestId('movement-hover')).toHaveTextContent('No hovered token.')
    )
  }
}

export const HoveringATokenRebuiltBeforeTheNextFrameReportsIt: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Movement scene ready.')).toBeVisible()
    const rendererCanvas = canvas.getByRole('img', { name: 'Interactive campaign scene' })
    const token = movementScene.tokens[0]!
    await nextFrame()
    // The appearance change rebuilds the token visual and leaves a frame pending. The pointer move
    // follows in the same synchronous block, so no frame can run first: only the Stage's own
    // render of the pending frame lets Pixi hit-test the rebuilt token.
    fireEvent.click(canvas.getByRole('button', { name: 'Change token appearance' }))
    await movePointer(rendererCanvas, nextPointerId++, token.position)
    await waitFor(() => expect(canvas.getByTestId('movement-hover')).toHaveTextContent(token.id))
  }
}

export const RotationTurnsOnlyTheFacingIndicator: Story = {
  args: { facing: true, scene: rotatedLargeTokenScene },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Movement scene ready.')).toBeVisible()
    const diagnostics = await readDiagnostics(canvas)
    expect(diagnostics.facingIndicatorCount).toBeGreaterThan(0)
    const [drawn] = diagnostics.tokens
    expect(drawn?.facingRotationDegrees).toBeCloseTo(
      rotatedLargeTokenScene.tokens[0].rotationDegrees
    )
    // The token itself, with its art and label, stays upright at its footprint.
    expect(drawn?.rotationDegrees).toBe(0)
    expect(drawn?.footprint).toEqual({ height: largeTokenSize, width: largeTokenSize })
  }
}

function sceneToClient(canvas: HTMLElement, point: ScenePoint): ScenePoint {
  const bounds = canvas.getBoundingClientRect()
  const scale =
    Math.min(bounds.width / movementScene.map.width, bounds.height / movementScene.map.height) *
    0.94
  return {
    x: bounds.left + (bounds.width - movementScene.map.width * scale) / 2 + point.x * scale,
    y: bounds.top + (bounds.height - movementScene.map.height * scale) / 2 + point.y * scale
  }
}

async function drag(canvas: HTMLElement, points: ScenePoint[]): Promise<void> {
  const [first, ...rest] = points
  if (!first) return
  await nextFrame()
  const pointerId = nextPointerId++
  fireEvent.pointerDown(canvas, {
    button: 0,
    buttons: 1,
    clientX: first.x,
    clientY: first.y,
    pointerId,
    pointerType: 'mouse'
  })
  await nextFrame()
  for (const point of rest) {
    fireEvent.pointerMove(canvas, {
      buttons: 1,
      clientX: point.x,
      clientY: point.y,
      pointerId,
      pointerType: 'mouse'
    })
    await nextFrame()
  }
  const last = points.at(-1)!
  fireEvent.pointerUp(canvas, {
    button: 0,
    buttons: 0,
    clientX: last.x,
    clientY: last.y,
    pointerId,
    pointerType: 'mouse'
  })
}

async function pressToken(canvas: HTMLElement, scenePoint: ScenePoint): Promise<number> {
  const point = sceneToClient(canvas, scenePoint)
  const pointerId = nextPointerId++
  await nextFrame()
  fireEvent.pointerDown(canvas, {
    button: 0,
    buttons: 1,
    clientX: point.x,
    clientY: point.y,
    pointerId,
    pointerType: 'mouse'
  })
  await nextFrame()
  return pointerId
}

async function movePointer(
  canvas: HTMLElement,
  pointerId: number,
  scenePoint: ScenePoint
): Promise<void> {
  const point = sceneToClient(canvas, scenePoint)
  fireEvent.pointerMove(canvas, {
    buttons: 1,
    clientX: point.x,
    clientY: point.y,
    pointerId,
    pointerType: 'mouse'
  })
  await nextFrame()
}

function releasePointer(canvas: HTMLElement, pointerId: number, scenePoint: ScenePoint): void {
  const point = sceneToClient(canvas, scenePoint)
  fireEvent.pointerUp(canvas, {
    button: 0,
    buttons: 0,
    clientX: point.x,
    clientY: point.y,
    pointerId,
    pointerType: 'mouse'
  })
}

async function readDiagnostics(canvas: ReturnType<typeof within>): Promise<Diagnostics> {
  const output = canvas.getByTestId('movement-diagnostics')
  const readsBefore = output.dataset.reads
  await fireEvent.click(canvas.getByRole('button', { name: 'Read diagnostics' }))
  await waitFor(() => expect(output.dataset.reads).not.toBe(readsBefore))
  return JSON.parse(output.textContent ?? '{}') as Diagnostics
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function committedPath(value: string | null): ScenePoint[] {
  return JSON.parse(value ?? '[]') as ScenePoint[]
}
