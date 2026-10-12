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
import {
  drawnToken,
  expectDrawnPresentation,
  type VttRendererDiagnostics
} from './vttSceneRenderer.assertions'
import type { VttScenePresentationOverlay } from './vttSceneRenderer.model'
import {
  maxStatusSegments,
  selectionOutlineColor,
  statusCategoryColours
} from './vttSceneRenderer.model'
import { buildVttTokenPresentations, dispositionRingColours } from './vttTokenPresentation.model'

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
    { id: 'condition', kind: 'CONDITION', label: 'Restrained' },
    { id: 'condition-2', kind: 'CONDITION', label: 'Blinded' },
    { id: 'condition-3', kind: 'CONDITION', label: 'Deafened' },
    { id: 'condition-4', kind: 'CONDITION', label: 'Grappled' },
    { id: 'condition-5', kind: 'CONDITION', label: 'Prone' }
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

function PresentationFixture({
  lowZoom = false,
  presentations = tokenPresentations,
  scene = presentationScene,
  selectedTokenId = null
}: {
  lowZoom?: boolean
  presentations?: typeof tokenPresentations
  scene?: CampaignSceneStateDto
  selectedTokenId?: string | null
}) {
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
        scene,
        selectedTokenId,
        tokenPresentations: presentations,
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
  }, [lowZoom, presentations, scene, selectedTokenId])

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
    diagnostics: JSON.parse(output.textContent ?? '{}') as VttRendererDiagnostics
  }
}

// VTT_UI-1.2: presentations come from buildVttTokenPresentations over Encounter data.
export const StatusOrderingAndOverflow: Story = {
  play: async ({ canvasElement }) => {
    const { description, diagnostics } = await renderedScene(canvasElement)
    // Ember carries more statuses than the outer ring has segments, so the ring ends in an overflow.
    await expect(emberPresentation.statuses.length).toBeGreaterThan(maxStatusSegments)
    await expect(diagnostics.tokenOverflowCount).toBe(
      presentationList.filter((presentation) => presentation.statuses.length > maxStatusSegments)
        .length
    )
    await expect(diagnostics.tokenStatusCount).toBe(
      presentationList.reduce((total, presentation) => total + presentation.statuses.length, 0)
    )
    await expect(diagnostics).toMatchObject({ overlayCount: 5, tokenVisualCount: 3 })
    // The drawn ring segments, halos, rings and fills match the real presentations.
    for (const token of presentationScene.tokens) {
      await expectDrawnPresentation(
        drawnToken(diagnostics, token.id),
        tokenPresentations[token.id]!
      )
    }
    // Ember has more statuses than the ring has segments; the Warden does not.
    await expect(emberPresentation.statuses.length).toBeGreaterThan(maxStatusSegments)
    await expect(drawnToken(diagnostics, emberToken!.id).statusSegments.at(-1)?.overflow).toBe(true)
    await expect(drawnToken(diagnostics, wardenToken!.id).statusSegments.at(-1)?.overflow).toBe(
      false
    )
    // The accessible description lists statuses in the model's order.
    await expect(description).toContain(emberPresentation.accessibleDescription)
    const positions = emberPresentation.statuses.map((status) => description.indexOf(status.label))
    await expect(positions.every((position) => position >= 0)).toBe(true)
    await expect(positions).toEqual([...positions].sort((a, b) => a - b))
  }
}

export const ReactionHaloBeatsCurrentTurn: Story = {
  play: async ({ canvasElement }) => {
    const { description, diagnostics } = await renderedScene(canvasElement)
    await expect(emberPresentation.halo?.label).toBe('Reaction available')
    await expect(drawnToken(diagnostics, emberToken!.id).halo).toEqual({
      color: emberPresentation.halo!.color,
      label: 'Reaction available'
    })
    await expect(drawnToken(diagnostics, wardenToken!.id).halo).toBeNull()
    await expect(emberPresentation.statuses[0]).toMatchObject({ kind: 'REACTION' })
    await expect(emberPresentation.marked).toBe(true)
    await expect(description).toContain('Ember. Character. Current turn. Reaction available')
    await expect(description).toContain('Yours')
  }
}

export const DefeatedToken: Story = {
  play: async ({ canvasElement }) => {
    const { description, diagnostics } = await renderedScene(canvasElement)
    const defeated = wardenPresentation.statuses.find((status) => status.label === 'Defeated')
    const drawnWarden = drawnToken(diagnostics, wardenToken!.id)
    await expect(defeated).toBeDefined()
    await expect(drawnWarden.statusSegments.map((segment) => segment.color)).toContain(
      statusCategoryColours[defeated!.category]
    )
    await expect(drawnWarden.bodyFillColor).toBe(wardenPresentation.fillColor)
    await expect(drawnWarden.bodyFillColor).not.toBe(
      drawnToken(diagnostics, emberToken!.id).bodyFillColor
    )
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
    await expect(diagnostics.facingIndicatorCount).toBeGreaterThan(0)
    await expect(diagnostics.facingIndicatorCount).toBe(
      presentationList.filter((presentation) => presentation.facing).length
    )
  }
}

// VTT_UI-1.1: the ring carries the actor's disposition; control and turn never recolour it.
const neutralScoutPresentations = buildVttTokenPresentations({
  actorIdByTokenId: new Map([
    [emberToken!.id, emberActor.id],
    [wardenToken!.id, wardenActor.id],
    [scoutToken!.id, neutralScoutActor().id]
  ]),
  boundTokenControl: new Map(),
  currentUserId: tabletopCurrentUserId,
  encounter: {
    ...presentationEncounter,
    actors: [...presentationEncounter.actors, neutralScoutActor()]
  },
  pending: null,
  scene: presentationScene
})

function neutralScoutActor() {
  return {
    ...tabletopGmEncounter.actors[1]!,
    defeated: false,
    disposition: 'NEUTRAL' as const,
    id: '99999999-9999-4999-8999-999999999977'
  }
}

export const DispositionRings: Story = {
  args: { presentations: neutralScoutPresentations },
  play: async ({ canvasElement }) => {
    const { diagnostics } = await renderedScene(canvasElement)
    // Ember is Friendly and controlled by the viewer; neither control nor the current turn recolours it.
    await expect(emberActor.disposition).toBe('FRIENDLY')
    await expect(drawnToken(diagnostics, emberToken!.id).ringColor).toBe(
      dispositionRingColours.FRIENDLY
    )
    await expect(wardenActor.disposition).toBe('HOSTILE')
    await expect(drawnToken(diagnostics, wardenToken!.id).ringColor).toBe(
      dispositionRingColours.HOSTILE
    )
    await expect(drawnToken(diagnostics, scoutToken!.id).ringColor).toBe(
      dispositionRingColours.NEUTRAL
    )
  }
}

export const NoActorKeepsAWhiteRing: Story = {
  play: async ({ canvasElement }) => {
    const { diagnostics } = await renderedScene(canvasElement)
    await expect(drawnToken(diagnostics, scoutToken!.id).ringColor).toBe(0xffffff)
  }
}

export const SelectionOutlineMarksOnlyTheSelectedToken: Story = {
  args: { selectedTokenId: emberToken!.id },
  play: async ({ canvasElement }) => {
    const { diagnostics } = await renderedScene(canvasElement)
    const selected = drawnToken(diagnostics, emberToken!.id)
    await expect(selected.selection?.color).toBe(selectionOutlineColor)
    // A dashed outline set apart from the ring, so it reads without colour and apart from the halo.
    await expect(selected.selection?.dashSegmentCount).toBeGreaterThan(1)
    await expect(selected.halo).not.toBeNull()
    await expect(selected.selection?.color).not.toBe(selected.halo?.color)
    await expect(selected.ringColor).toBe(dispositionRingColours.FRIENDLY)
    await expect(drawnToken(diagnostics, wardenToken!.id).selection).toBeNull()
    await expect(drawnToken(diagnostics, scoutToken!.id).selection).toBeNull()
  }
}

// A 1x1 token beside a 2x2 token that touches it: their outer rings stay inside their footprints.
const cell = tabletopLiveScene.grid.cellSize
const neighbourScene = {
  ...presentationScene,
  tokens: [
    { ...emberToken!, height: cell, position: { x: 400, y: 400 }, width: cell },
    {
      ...wardenToken!,
      height: cell * 2,
      position: { x: 400 + cell / 2 + cell, y: 400 },
      width: cell * 2
    }
  ]
} satisfies CampaignSceneStateDto
const neighbourPresentations = buildVttTokenPresentations({
  actorIdByTokenId: new Map([
    [emberToken!.id, emberActor.id],
    [wardenToken!.id, wardenActor.id]
  ]),
  boundTokenControl: new Map(),
  currentUserId: tabletopCurrentUserId,
  encounter: presentationEncounter,
  pending: null,
  scene: neighbourScene
})

export const OuterRingsStayWithinNeighbouringFootprints: Story = {
  args: { presentations: neighbourPresentations, scene: neighbourScene },
  play: async ({ canvasElement }) => {
    const { diagnostics } = await renderedScene(canvasElement)
    const [small, large] = neighbourScene.tokens.map((token) => {
      const drawn = drawnToken(diagnostics, token.id)
      return {
        drawn,
        left: drawn.position.x + drawn.outerRing.x,
        right: drawn.position.x + drawn.outerRing.x + drawn.outerRing.width,
        token
      }
    })
    for (const { drawn, token } of [small!, large!]) {
      await expect(drawn.statusSegments.length).toBeGreaterThan(0)
      await expect(drawn.outerRing.width).toBeGreaterThan(0)
      await expect(drawn.outerRing.width).toBeLessThanOrEqual(token.width)
      await expect(drawn.outerRing.height).toBeLessThanOrEqual(token.height)
    }
    await expect(small!.right).toBeLessThanOrEqual(large!.left)
    // Both rings sit strictly inside the footprint, the status ring clear of its edge, and the
    // inner disposition ring inside the status ring.
    for (const { drawn, token } of [small!, large!]) {
      const halfWidth = token.width / 2
      const halfHeight = token.height / 2
      const { innerRing, outerRing } = drawn
      await expect(outerRing.x).toBeGreaterThan(-halfWidth)
      await expect(outerRing.x + outerRing.width).toBeLessThan(halfWidth)
      await expect(outerRing.y).toBeGreaterThan(-halfHeight)
      await expect(outerRing.y + outerRing.height).toBeLessThan(halfHeight)
      await expect(innerRing.width).toBeGreaterThan(0)
      await expect(innerRing.x).toBeGreaterThan(outerRing.x)
      await expect(innerRing.x + innerRing.width).toBeLessThan(outerRing.x + outerRing.width)
      await expect(innerRing.y).toBeGreaterThan(outerRing.y)
      await expect(innerRing.y + innerRing.height).toBeLessThan(outerRing.y + outerRing.height)
    }
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
