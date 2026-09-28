import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef, useState } from 'react'
import { expect, fireEvent, waitFor, within } from 'storybook/test'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { tabletopCurrentUserId, tabletopLiveScene } from './CampaignTabletop.stories.fixtures'
import { createVttSceneRenderer, type VttSceneRenderer } from './vttSceneRenderer'

const movementScene = {
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
  tokens: [tabletopLiveScene.tokens[0]!]
} satisfies CampaignSceneStateDto

let nextPointerId = 1

function MovementFixture() {
  const host = useRef<HTMLDivElement | null>(null)
  const renderer = useRef<VttSceneRenderer | null>(null)
  const [ready, setReady] = useState(false)
  const [preview, setPreview] = useState<ScenePoint | null>(null)
  const [committedPath, setCommittedPath] = useState<ScenePoint[] | null>(null)
  const [appearanceChanged, setAppearanceChanged] = useState(false)

  useEffect(() => {
    if (!host.current) return
    let disposed = false
    void createVttSceneRenderer(host.current, {
      onCreateBarrier: () => undefined,
      onCreateDarkness: () => undefined,
      onCreateLight: () => undefined,
      onCreateToken: () => undefined,
      onDoorState: () => undefined,
      onMeasurementCommit: () => undefined,
      onMeasurementPreview: () => undefined,
      onPing: () => false,
      onTokenCommit: (_tokenId, path) => setCommittedPath(path),
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
        scene: movementScene,
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
      scene: movementScene,
      tokenPresentations: appearanceChanged
        ? {
            [movementScene.tokens[0]!.id]: {
              accessibleDescription: 'Moved token.',
              artUrl: null,
              facing: false,
              fillColor: 0x1971c2,
              halo: null,
              marked: false,
              outlineColor: 0xffffff,
              statuses: []
            }
          }
        : undefined,
      tool: 'SELECT'
    })
  }, [appearanceChanged])

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
      <button type='button' onClick={() => setAppearanceChanged(true)}>
        Change token appearance
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

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function committedPath(value: string | null): ScenePoint[] {
  return JSON.parse(value ?? '[]') as ScenePoint[]
}
