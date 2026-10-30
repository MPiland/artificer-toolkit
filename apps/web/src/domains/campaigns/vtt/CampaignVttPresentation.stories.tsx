import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef, useState } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import type { EncounterGmProjectionDto } from '@artificer-toolkit/schema/api/encounters'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import {
  campaignSceneStateDtoSchema,
  type CampaignSceneStateDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  buildTabletopPresentations,
  tabletopConditions,
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopLiveScene
} from './CampaignTabletop.stories.fixtures'
import { createVttSceneRenderer, type VttSceneRenderer } from './vttSceneRenderer'
import {
  drawnToken,
  expectDrawnPresentation,
  latestStageRenderer
} from './vttSceneRenderer.assertions'
import type { VttSceneRendererDiagnostics } from './vttSceneRendererDiagnostics'
import {
  actionPreviewOverlays,
  auraColor,
  auraOverlays,
  type VttScenePresentationOverlay
} from './vttSceneRenderer.model'
import {
  maxStatusSegments,
  minimumFocusedTokenScreenSize,
  selectionOutlineColor,
  statusCategoryColours
} from './vttSceneRenderer.model'
import { dispositionRingColours } from './vttTokenPresentation.model'
import { validated } from '../../../test/validatedFixture'

const artUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const presentationScene = validated(campaignSceneStateDtoSchema)({
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
})

const [emberToken, wardenToken, scoutToken] = presentationScene.tokens
// Only the DATA varies here; colours, ordering and halo precedence come from the real model.
const emberActor = {
  ...tabletopGmEncounter.actors[0]!,
  activeGrants: [
    {
      effectId: '55555555-5555-4555-8555-555555555501',
      label: 'Blessed',
      sourceHidden: false,
      sourceActorId: null,
      remainingTicks: 4,
      expiresAtCampaignMinute: null,
      polarity: 'BENEFICIAL' as const
    }
  ],
  conditions: tabletopConditions(
    'FRIGHTENED',
    'POISONED',
    'RESTRAINED',
    'BLINDED',
    'DEAFENED',
    'GRAPPLED',
    'PRONE'
  ),
  healthBand: 'CRITICAL' as const
}
const wardenActor = { ...tabletopGmEncounter.actors[1]!, defeated: true }
const presentationFacingArcs: NonNullable<EncounterGmProjectionDto['facingArcs']> = [
  { arc: 'FRONT', fromDegrees: -45, toDegrees: 45 },
  { arc: 'RIGHT_SIDE', fromDegrees: 45, toDegrees: 135 },
  { arc: 'REAR', fromDegrees: 135, toDegrees: 225 },
  { arc: 'LEFT_SIDE', fromDegrees: 225, toDegrees: 315 }
]
const presentationEncounter = {
  ...tabletopGmEncounter,
  actors: [emberActor, wardenActor],
  facingArcs: presentationFacingArcs,
  facingStepDegrees: 45
}
function reactionPending(reactor: {
  actorId: string
  tokenId: string
}): PendingEncounterRuleOccurrenceSummaryDto {
  return {
    allowedResponses: ['DECLINE', 'OPTION'],
    choice: {
      options: [
        { actionId: 'reaction', actionSourceKind: 'CHARACTER_ACTION', optionId: 'a'.repeat(64) }
      ],
      pathDistance: 5,
      reactorActorId: reactor.actorId,
      reactorTokenId: reactor.tokenId
    },
    encounterVersion: presentationEncounter.version,
    kind: 'MOVEMENT_REACTION',
    occurrenceId: '77777777-7777-4777-8777-777777777790',
    occurrenceVersion: 1
  }
}
const tokenPresentations = buildTabletopPresentations({
  actorIdByTokenId: new Map([
    [emberToken!.id, emberActor.id],
    [wardenToken!.id, wardenActor.id]
  ]),
  artUrls: { [scoutToken!.id]: artUrl },
  boundTokenControl: new Map(),
  currentUserId: tabletopCurrentUserId,
  encounter: presentationEncounter,
  pending: reactionPending({ actorId: emberActor.id, tokenId: emberToken!.id }),
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
    id: 'zone',
    kind: 'POLYGON',
    label: 'Zone preview',
    points: [
      { x: 500, y: 110 },
      { x: 650, y: 110 },
      { x: 650, y: 220 },
      { x: 500, y: 220 }
    ],
    purpose: 'ZONE'
  }
] satisfies VttScenePresentationOverlay[]

function PresentationFixture({
  lowZoom = false,
  overlays: shownOverlays = overlays,
  presentations = tokenPresentations,
  scene = presentationScene,
  selectedTokenId = null
}: {
  lowZoom?: boolean
  overlays?: VttScenePresentationOverlay[]
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
    void createVttSceneRenderer(host.current, SRD_SYSTEM_ID, {
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
        overlays: shownOverlays,
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
  }, [lowZoom, presentations, scene, selectedTokenId, shownOverlays])

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
    diagnostics: JSON.parse(output.textContent ?? '{}') as VttSceneRendererDiagnostics
  }
}

// VTT_UI-3.1: the chosen action's range and target are drawn from the server's range geometry.
export const ActionRangeAndTargetPreview: Story = {
  args: {
    overlays: actionPreviewOverlays(
      {
        range: {
          kind: 'RANGED',
          normal: { amount: 30, unit: 'FEET' },
          long: { amount: 120, unit: 'FEET' }
        },
        sourceTokenId: emberToken!.id,
        targetTokenId: wardenToken!.id
      },
      presentationScene
    )
  },
  play: async ({ canvasElement }) => {
    const { diagnostics } = await renderedScene(canvasElement)
    // Normal and long range around the acting token, and the ring on the target.
    await expect(diagnostics).toMatchObject({ overlayCount: 3 })
  }
}

// VTT_UI-3.1: a session aura is drawn as an AURA circle around its source token and described.
const emberAura = {
  id: '12121212-1212-4121-8121-000000000001',
  label: 'Spirit Guardians',
  radius: 245,
  sourceTokenId: emberToken!.id
}
export const AuraAroundItsSource: Story = {
  args: { overlays: auraOverlays([emberAura], presentationScene.tokens) },
  play: async ({ canvasElement }) => {
    const { description, diagnostics } = await renderedScene(canvasElement)
    const label = `Spirit Guardians around ${emberToken!.label}`
    await expect(diagnostics.overlays).toEqual([
      {
        circles: [{ center: emberToken!.position, radius: emberAura.radius }],
        label,
        strokeColors: [auraColor]
      }
    ])
    await expect(description).toContain(`Auras: ${label}`)
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
    await expect(description).toContain(
      'Ember. Character. Friendly. Current turn. Reaction available'
    )
    await expect(description).toContain('Yours')
  }
}

// VTT_UI-4.1: a reaction halo and the current-turn halo differ by shape too, not only by colour.
const otherTokenReactionPresentations = buildTabletopPresentations({
  actorIdByTokenId: new Map([
    [emberToken!.id, emberActor.id],
    [wardenToken!.id, wardenActor.id]
  ]),
  boundTokenControl: new Map(),
  currentUserId: tabletopCurrentUserId,
  encounter: presentationEncounter,
  pending: reactionPending({ actorId: wardenActor.id, tokenId: wardenToken!.id }),
  scene: presentationScene
})

export const CurrentTurnAndReactionHalosDifferByShape: Story = {
  args: { presentations: otherTokenReactionPresentations },
  play: async ({ canvasElement }) => {
    const { diagnostics } = await renderedScene(canvasElement)
    const currentTurn = drawnToken(diagnostics, emberToken!.id)
    const reaction = drawnToken(diagnostics, wardenToken!.id)
    await expect(currentTurn.halo?.label).toBe('Current turn')
    await expect(currentTurn.crosshairDrawn).toBe(true)
    await expect(reaction.halo?.label).toBe('Reaction available')
    await expect(reaction.crosshairDrawn).toBe(false)
    await expect(drawnToken(diagnostics, scoutToken!.id).crosshairDrawn).toBe(false)
  }
}

// VTT_UI-2.1: an accepted consequence is a named status on the token, drawn and described like any other.
const consequenceLabel = 'Shattered knee'
const consequencePresentations = buildTabletopPresentations({
  actorIdByTokenId: new Map([
    [emberToken!.id, emberActor.id],
    [wardenToken!.id, wardenActor.id]
  ]),
  boundTokenControl: new Map(),
  currentUserId: tabletopCurrentUserId,
  encounter: {
    ...presentationEncounter,
    actors: [
      {
        ...emberActor,
        activeGrants: [],
        conditions: [],
        consequences: [{ id: '77777777-7777-4777-8777-777777777791', label: consequenceLabel }]
      },
      wardenActor
    ]
  },
  pending: null,
  scene: presentationScene
})

export const AcceptedConsequenceShowsAsNamedStatus: Story = {
  args: { presentations: consequencePresentations },
  play: async ({ canvasElement }) => {
    const { description, diagnostics } = await renderedScene(canvasElement)
    const ember = consequencePresentations[emberToken!.id]!
    await expect(ember.statuses.filter(({ kind }) => kind === 'INJURY')).toMatchObject([
      { category: 'HARMFUL', label: consequenceLabel }
    ])
    await expectDrawnPresentation(drawnToken(diagnostics, emberToken!.id), ember)
    await expect(description).toContain(`${consequenceLabel}`)
    await expect(
      consequencePresentations[wardenToken!.id]!.statuses.some(({ kind }) => kind === 'INJURY')
    ).toBe(false)
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

// VTT_UI-1.3: the current-turn token draws front, side and rear arcs around its facing.
export const FacingArcsSurroundTheCurrentTurnToken: Story = {
  play: async ({ canvasElement }) => {
    const { diagnostics } = await renderedScene(canvasElement)
    const ember = drawnToken(diagnostics, emberToken!.id)
    await expect(ember.facingArcs.map(({ arc }) => arc)).toEqual([
      'FRONT',
      'RIGHT_SIDE',
      'REAR',
      'LEFT_SIDE'
    ])
    // Ember faces east (90 degrees): the front arc's middle vertex lies due east of the token.
    const front = ember.facingArcs[0]!.polygon
    const middle = front[Math.floor(front.length / 2)]!
    await expect(middle.x).toBeGreaterThan(emberToken!.width / 2)
    await expect(middle.y).toBeCloseTo(0, 5)
    // The rear arc reaches the opposite side.
    const rear = ember.facingArcs[2]!.polygon
    await expect(rear[Math.floor(rear.length / 2)]!.x).toBeLessThan(-emberToken!.width / 2)
    // Neither the Warden nor the Scout is selected or has the turn.
    await expect(drawnToken(diagnostics, wardenToken!.id).facingArcs).toEqual([])
    await expect(drawnToken(diagnostics, scoutToken!.id).facingArcs).toEqual([])
  }
}

// VTT_UI-1.1: the ring carries the actor's disposition; control and turn never recolour it.
const neutralScoutPresentations = buildTabletopPresentations({
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
const neighbourScene = validated(campaignSceneStateDtoSchema)({
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
})
const neighbourPresentations = buildTabletopPresentations({
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
      // A visible gap separates the two rings on every side: the status ring's inner edge (its
      // bounds less its 5 unit stroke) stays at least 2 units outside the disposition ring.
      const outerRingStroke = 5
      const minRingClearance = 2
      await expect(innerRing.x - (outerRing.x + outerRingStroke)).toBeGreaterThanOrEqual(
        minRingClearance
      )
      await expect(
        outerRing.x + outerRing.width - outerRingStroke - (innerRing.x + innerRing.width)
      ).toBeGreaterThanOrEqual(minRingClearance)
      await expect(innerRing.y - (outerRing.y + outerRingStroke)).toBeGreaterThanOrEqual(
        minRingClearance
      )
      await expect(
        outerRing.y + outerRing.height - outerRingStroke - (innerRing.y + innerRing.height)
      ).toBeGreaterThanOrEqual(minRingClearance)
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
    // Focusing a token zooms in until its larger footprint side is readable, and never zooms out.
    const renderer = await latestStageRenderer()
    renderer.focusToken(emberToken!)
    const focused = renderer.getDiagnostics()
    await expect(focused.zoomScale).toBeGreaterThan(diagnostics.zoomScale)
    await expect(
      focused.zoomScale * Math.max(emberToken!.width, emberToken!.height)
    ).toBeGreaterThanOrEqual(minimumFocusedTokenScreenSize - 1e-9)
    renderer.focusToken(emberToken!)
    await expect(renderer.getDiagnostics().zoomScale).toBeCloseTo(focused.zoomScale, 12)
    // At the minimum zoom every token, whatever its footprint, focuses to a readable size.
    for (const token of presentationScene.tokens) {
      let floor = renderer.getDiagnostics().zoomScale
      let zoomedOutTo = Number.NaN
      while (zoomedOutTo !== floor) {
        zoomedOutTo = floor
        renderer.zoomOut()
        floor = renderer.getDiagnostics().zoomScale
      }
      renderer.focusToken(token)
      await expect(
        renderer.getDiagnostics().zoomScale * Math.max(token.width, token.height)
      ).toBeGreaterThanOrEqual(minimumFocusedTokenScreenSize - 1e-9)
    }
    await expect(canvas.getByRole('img', { name: 'Interactive campaign scene' })).toHaveAttribute(
      'aria-description',
      expect.stringContaining('Current turn')
    )
  }
}
