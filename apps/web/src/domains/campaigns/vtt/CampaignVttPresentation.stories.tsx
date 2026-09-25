import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef, useState } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { tabletopCurrentUserId, tabletopLiveScene } from './CampaignTabletop.stories.fixtures'
import { createVttSceneRenderer, type VttSceneRenderer } from './vttSceneRenderer'
import type { VttScenePresentationOverlay, VttTokenPresentation } from './vttSceneRenderer.model'

const artUrl =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#1c7ed6"/><circle cx="80" cy="70" r="42" fill="#74c0fc"/><path d="M34 150c8-38 84-38 92 0" fill="#0b7285"/></svg>'
  )

const presentationScene = {
  ...tabletopLiveScene,
  tokens: [
    {
      ...tabletopLiveScene.tokens[0]!,
      height: 140,
      position: { x: 270, y: 260 },
      rotationDegrees: 90,
      width: 140
    },
    {
      ...tabletopLiveScene.tokens[1]!,
      hidden: false,
      position: { x: 760, y: 260 },
      rotationDegrees: 225
    },
    {
      ...tabletopLiveScene.tokens[0]!,
      controlledByUserIds: [],
      id: '77777777-7777-4777-8777-777777777799',
      label: 'Scout',
      position: { x: 1080, y: 650 },
      rotationDegrees: 315
    }
  ]
} satisfies CampaignSceneStateDto

const tokenPresentations = {
  [presentationScene.tokens[0]!.id]: {
    accessibleDescription:
      'Ember. Character. Current turn. Reaction available, Lingering wound, Shaken, Restrained, Blessed, Bloodied.',
    artUrl,
    facing: true,
    fillColor: 0x1971c2,
    halo: { color: 0xf06595, label: 'Reaction available' },
    marked: true,
    outlineColor: 0x22b8cf,
    statuses: [
      { id: 'reaction', kind: 'REACTION', label: 'Reaction available', shortLabel: 'R' },
      { id: 'injury', kind: 'INJURY', label: 'Lingering wound', shortLabel: 'I' },
      { id: 'morale', kind: 'MORALE', label: 'Shaken', shortLabel: 'M' },
      { id: 'restrained', kind: 'CONDITION', label: 'Restrained', shortLabel: 'R' },
      { id: 'blessed', kind: 'EFFECT', label: 'Blessed', shortLabel: 'B' },
      { id: 'bloodied', kind: 'HEALTH', label: 'Bloodied', shortLabel: '!' }
    ]
  },
  [presentationScene.tokens[1]!.id]: {
    accessibleDescription: 'Vault Warden. Creature. Critical. Marked.',
    artUrl: null,
    facing: true,
    fillColor: 0xc92a2a,
    halo: { color: 0xc92a2a, label: 'Critical' },
    marked: true,
    outlineColor: 0xffffff,
    statuses: [{ id: 'critical', kind: 'HEALTH', label: 'Critical', shortLabel: '!' }]
  },
  [presentationScene.tokens[2]!.id]: {
    accessibleDescription: 'Scout. Creature. Healthy.',
    artUrl: null,
    facing: true,
    fillColor: 0x2f9e44,
    halo: null,
    marked: false,
    outlineColor: 0xffffff,
    statuses: []
  }
} satisfies Record<string, VttTokenPresentation>

const overlays = [
  {
    center: presentationScene.tokens[0]!.position,
    color: 0x22b8cf,
    id: 'range',
    kind: 'CIRCLE',
    label: '30 foot range',
    purpose: 'RANGE',
    radius: 280
  },
  {
    center: presentationScene.tokens[1]!.position,
    color: 0xf06595,
    id: 'target',
    kind: 'CIRCLE',
    label: 'Selected target',
    purpose: 'TARGET',
    radius: 48
  },
  {
    color: 0x74c0fc,
    id: 'path',
    kind: 'PATH',
    label: 'Movement path',
    points: [presentationScene.tokens[0]!.position, { x: 480, y: 420 }, { x: 660, y: 520 }],
    purpose: 'PATH'
  },
  {
    color: 0x51cf66,
    id: 'aura',
    kind: 'POLYGON',
    label: 'Aura preview',
    points: [
      { x: 860, y: 510 },
      { x: 1220, y: 510 },
      { x: 1220, y: 790 },
      { x: 860, y: 790 }
    ],
    purpose: 'AURA'
  },
  {
    color: 0xff922b,
    id: 'trap',
    kind: 'POLYGON',
    label: 'Trap preview',
    points: [
      { x: 500, y: 110 },
      { x: 650, y: 110 },
      { x: 650, y: 220 },
      { x: 500, y: 220 }
    ],
    purpose: 'TRAP'
  }
] satisfies VttScenePresentationOverlay[]

function PresentationFixture({ lowZoom = false }: { lowZoom?: boolean }) {
  const host = useRef<HTMLDivElement | null>(null)
  const renderer = useRef<VttSceneRenderer | null>(null)
  const [diagnostics, setDiagnostics] = useState<ReturnType<
    VttSceneRenderer['getDiagnostics']
  > | null>(null)

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
      onPointerPreview: () => undefined,
      onTokenCommit: () => undefined,
      onTokenPreview: () => undefined
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
        overlays,
        role: 'OWNER',
        scene: presentationScene,
        tokenPresentations,
        tool: 'SELECT'
      })
      if (lowZoom) for (let index = 0; index < 12; index += 1) nextRenderer.zoomOut()
      setDiagnostics(nextRenderer.getDiagnostics())
    })
    return () => {
      disposed = true
      renderer.current?.destroy()
      renderer.current = null
    }
  }, [lowZoom])

  return (
    <section
      aria-label='Token presentation fixture'
      style={{ display: 'grid', gap: 12, padding: 16 }}
    >
      <div ref={host} style={{ blockSize: 640, minInlineSize: 0, overflow: 'hidden' }} />
      <output aria-live='polite' data-testid='presentation-diagnostics'>
        {diagnostics ? JSON.stringify(diagnostics) : 'Loading token presentation…'}
      </output>
    </section>
  )
}

const meta = {
  component: PresentationFixture,
  parameters: { a11y: { test: 'error' }, layout: 'fullscreen' },
  title: 'Domains/Campaigns/VTT/Token Presentation'
} satisfies Meta<typeof PresentationFixture>

export default meta
type Story = StoryObj<typeof meta>

export const FullPresentation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const output = await canvas.findByTestId('presentation-diagnostics')
    await waitFor(() => expect(output).not.toHaveTextContent('Loading'))
    const diagnostics = JSON.parse(output.textContent ?? '{}') as Record<string, number>
    expect(diagnostics).toMatchObject({
      facingIndicatorCount: 3,
      overlayCount: 5,
      tokenArtCount: 1,
      tokenOverflowCount: 1,
      tokenStatusCount: 7,
      tokenVisualCount: 3
    })
    const rendererCanvas = canvas.getByRole('img', { name: 'Interactive campaign scene' })
    await expect(rendererCanvas).toHaveAttribute(
      'aria-description',
      expect.stringContaining('Lingering wound')
    )
    await expect(rendererCanvas).toHaveAttribute(
      'aria-description',
      expect.stringContaining('Shaken')
    )
    await expect(rendererCanvas).toHaveAttribute(
      'aria-description',
      expect.stringContaining('Reaction available')
    )
  }
}

export const LowZoom: Story = {
  args: { lowZoom: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const output = await canvas.findByTestId('presentation-diagnostics')
    await waitFor(() => expect(output).not.toHaveTextContent('Loading'))
    const diagnostics = JSON.parse(output.textContent ?? '{}') as Record<string, number>
    expect(diagnostics.zoomScale).toBeLessThan(0.5)
    await expect(canvas.getByRole('img', { name: 'Interactive campaign scene' })).toHaveAttribute(
      'aria-description',
      expect.stringContaining('Current turn')
    )
  }
}
