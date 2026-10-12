import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef, useState } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopLiveScene
} from './CampaignTabletop.stories.fixtures'
import { createVttSceneRenderer, type VttSceneRenderer } from './vttSceneRenderer'
import type { VttScenePresentationOverlay } from './vttSceneRenderer.model'
import { buildVttTokenPresentations } from './vttTokenPresentation.model'

const artUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

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

const [emberToken, wardenToken, scoutToken] = presentationScene.tokens
// Only the DATA varies here; colours, ordering and halo precedence come from the real model.
const emberActor = {
  ...tabletopGmEncounter.actors[0]!,
  activeGrants: [
    {
      effectId: '55555555-5555-4555-8555-555555555501',
      label: 'Blessed',
      sourceHidden: false,
      remainingTicks: 4,
      expiresAtCampaignMinute: null
    }
  ],
  conditions: [
    { id: 'morale', kind: 'MORALE', label: 'Shaken' },
    { id: 'injury', kind: 'INJURY', label: 'Lingering wound' },
    { id: 'condition', kind: 'CONDITION', label: 'Restrained' }
  ],
  healthBand: 'CRITICAL' as const
}
const wardenActor = { ...tabletopGmEncounter.actors[1]!, defeated: true }
const presentationEncounter = {
  ...tabletopGmEncounter,
  actors: [emberActor, wardenActor]
}
const tokenPresentations = buildVttTokenPresentations({
  actorIdByTokenId: new Map([
    [emberToken!.id, emberActor.id],
    [wardenToken!.id, wardenActor.id]
  ]),
  artUrls: { [scoutToken!.id]: artUrl },
  boundTokenControl: new Map(),
  currentUserId: tabletopCurrentUserId,
  encounter: presentationEncounter,
  pending: {
    allowedResponses: ['DECLINE', 'OPTION'],
    choice: {
      options: [
        { actionId: 'reaction', actionSourceKind: 'CHARACTER_ACTION', optionId: 'a'.repeat(64) }
      ],
      pathDistance: 5,
      reactorActorId: emberActor.id,
      reactorTokenId: emberToken!.id
    },
    encounterVersion: presentationEncounter.version,
    kind: 'MOVEMENT_REACTION',
    occurrenceId: '77777777-7777-4777-8777-777777777790',
    occurrenceVersion: 1
  },
  scene: presentationScene
})
const emberPresentation = tokenPresentations[emberToken!.id]!
const wardenPresentation = tokenPresentations[wardenToken!.id]!
const presentationList = Object.values(tokenPresentations)

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
      onPing: () => false,
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

async function renderedScene(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const output = await canvas.findByTestId('presentation-diagnostics')
  await waitFor(() => expect(output).not.toHaveTextContent('Loading'))
  return {
    description:
      canvas
        .getByRole('img', { name: 'Interactive campaign scene' })
        .getAttribute('aria-description') ?? '',
    diagnostics: JSON.parse(output.textContent ?? '{}') as Record<string, number>
  }
}

// VTT_UI-1.2: presentations come from buildVttTokenPresentations over Encounter data.
export const StatusOrderingAndOverflow: Story = {
  play: async ({ canvasElement }) => {
    const { description, diagnostics } = await renderedScene(canvasElement)
    // Ember carries more statuses than a token can badge, so the renderer overflows it.
    await expect(emberPresentation.statuses.length).toBeGreaterThan(4)
    await expect(diagnostics.tokenOverflowCount).toBe(
      presentationList.filter((presentation) => presentation.statuses.length > 4).length
    )
    await expect(diagnostics.tokenStatusCount).toBe(
      presentationList.reduce((total, presentation) => total + presentation.statuses.length, 0)
    )
    await expect(diagnostics).toMatchObject({ overlayCount: 5, tokenVisualCount: 3 })
    // The accessible description lists statuses in the model's order.
    await expect(description).toContain(emberPresentation.accessibleDescription)
    const positions = emberPresentation.statuses.map((status) => description.indexOf(status.label))
    await expect(positions.every((position) => position >= 0)).toBe(true)
    await expect(positions).toEqual([...positions].sort((a, b) => a - b))
  }
}

export const ReactionHaloBeatsCurrentTurn: Story = {
  play: async ({ canvasElement }) => {
    const { description } = await renderedScene(canvasElement)
    await expect(emberPresentation.halo?.label).toBe('Reaction available')
    await expect(emberPresentation.statuses[0]).toMatchObject({ kind: 'REACTION' })
    await expect(emberPresentation.marked).toBe(true)
    await expect(description).toContain('Ember. Character. Current turn. Reaction available')
  }
}

export const DefeatedToken: Story = {
  play: async ({ canvasElement }) => {
    const { description } = await renderedScene(canvasElement)
    await expect(wardenPresentation.statuses.map((status) => status.label)).toContain('Defeated')
    await expect(description).toContain(wardenPresentation.accessibleDescription)
    await expect(description).toContain('Defeated')
  }
}

export const TokenArtIsPresented: Story = {
  play: async ({ canvasElement }) => {
    const { diagnostics } = await renderedScene(canvasElement)
    await expect(presentationList.filter((presentation) => presentation.artUrl)).toHaveLength(1)
    await expect(diagnostics.tokenArtCount).toBe(1)
    await expect(diagnostics.facingIndicatorCount).toBe(
      presentationList.filter((presentation) => presentation.facing).length
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
