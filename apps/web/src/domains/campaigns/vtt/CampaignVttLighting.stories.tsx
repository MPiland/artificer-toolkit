import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef, useState } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import {
  campaignSceneStateDtoSchema,
  type CampaignSceneStateDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { combatPerceptionCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  requireSceneIlluminationLevel,
  resolveSceneIlluminationAt,
  SceneBarrierIndex,
  type ScenePoint
} from '@artificer-toolkit/shared/vtt'
import { tabletopCurrentUserId, tabletopLiveScene } from './CampaignTabletop.stories.fixtures'
import { createVttSceneRenderer, type VttSceneRenderer } from './vttSceneRenderer'
import {
  describeDarknessZone,
  gmDarknessCapAlpha,
  illuminationOverlayAlpha,
  lightTintAlpha,
  resolveViewTokenId
} from './vttSceneRenderer.model'
import { countDarknessZones } from './vttDarknessZoneCounts.testUtils'
import { validated } from '../../../test/validatedFixture'

const { illuminationLevels } = combatPerceptionCapabilityRegistry.require(SRD_SYSTEM_ID)

type Diagnostics = ReturnType<VttSceneRenderer['getDiagnostics']>
type Zone = CampaignSceneStateDto['darknessZones'][number]
type Light = CampaignSceneStateDto['lights'][number]

const ember = tabletopLiveScene.tokens[0]!
const warden = tabletopLiveScene.tokens[1]!

const emptyScene = validated(campaignSceneStateDtoSchema)({
  ...tabletopLiveScene,
  ambientIllumination: 'BRIGHT',
  daylight: false,
  barriers: [],
  darknessZones: [],
  doorStates: {},
  fogMode: 'OFF',
  lights: [],
  tokens: [{ ...ember, vision: null }]
})

function lightAt(id: string, x: number, bright: number, dim: number): Light {
  return {
    brightRadius: bright,
    color: '#f6c56f',
    dimRadius: dim,
    id,
    intensity: 0.9,
    kind: 'POINT',
    position: { x, y: 450 }
  }
}

function zoneAt(
  id: string,
  x: number,
  mechanicalIllumination: Zone['mechanicalIllumination'],
  mechanicalObscurement: Zone['mechanicalObscurement']
): Zone {
  return {
    id,
    mechanicalIllumination,
    mechanicalObscurement,
    opacity: 0.5,
    polygon: {
      points: [
        { x, y: 300 },
        { x: x + 200, y: 300 },
        { x: x + 200, y: 600 },
        { x, y: 600 }
      ]
    }
  }
}

type Sample = ReturnType<VttSceneRenderer['sampleDarkness']>[number]

function LightingFixture({
  boundTokenId,
  previewTokenId,
  role = 'PLAYER',
  samplePoints = [],
  scene,
  view
}: {
  /** A Token whose Encounter actor control arrives in a later update, as when the Encounter loads. */
  boundTokenId?: string
  /** The GM's token-view preview: draws what a Player controlling this Token sees. */
  previewTokenId?: string
  role?: 'OWNER' | 'PLAYER'
  /** Scene points whose drawn darkness the fixture reads back from the overlay. */
  samplePoints?: ScenePoint[]
  scene: CampaignSceneStateDto
  /** The viewer's selection and assigned Token, resolved to a view Token by the real model. */
  view?: { assignedTokenId: string | null; selectedTokenId: string | null }
}) {
  const host = useRef<HTMLDivElement | null>(null)
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null)
  const [samples, setSamples] = useState<Sample[]>([])
  const [viewTokenId, setViewTokenId] = useState<string | null>(null)

  useEffect(() => {
    if (!host.current) return
    let disposed = false
    let renderer: VttSceneRenderer | null = null
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
      renderer = nextRenderer
      const boundTokenControl = new Map<string, boolean>()
      const resolvedViewTokenId = view
        ? resolveViewTokenId({
            assignedTokenId: view.assignedTokenId,
            boundTokenControl,
            currentUserId: tabletopCurrentUserId,
            previewTokenId: previewTokenId ?? null,
            role,
            selectedTokenId: view.selectedTokenId,
            tokens: scene.tokens
          })
        : null
      setViewTokenId(resolvedViewTokenId)
      const update = {
        boundTokenControl,
        currentUserId: tabletopCurrentUserId,
        mapDelivery: null,
        mode: 'PLAY',
        previewTokenId,
        role,
        scene,
        tool: 'SELECT',
        viewTokenId: resolvedViewTokenId
      } as const
      nextRenderer.update(update)
      if (boundTokenId) {
        nextRenderer.update({ ...update, boundTokenControl: new Map([[boundTokenId, true]]) })
      }
      setSamples(nextRenderer.sampleDarkness(samplePoints))
      setDiagnostics(nextRenderer.getDiagnostics())
    })
    return () => {
      disposed = true
      renderer?.destroy()
    }
  }, [boundTokenId, previewTokenId, role, samplePoints, scene, view])

  return (
    <section aria-label='Lighting fixture' style={{ display: 'grid', gap: 12, padding: 16 }}>
      <div ref={host} style={{ blockSize: 640, minInlineSize: 0, overflow: 'hidden' }} />
      <output aria-live='polite' data-testid='lighting-diagnostics'>
        {diagnostics ? JSON.stringify(diagnostics) : 'Loading lighting scene…'}
      </output>
      <output data-testid='lighting-samples'>{JSON.stringify(samples)}</output>
      <output data-testid='lighting-view-token'>{viewTokenId ?? 'none'}</output>
    </section>
  )
}

const meta = {
  component: LightingFixture,
  parameters: { a11y: { test: 'error' }, layout: 'fullscreen' },
  title: 'Domains/Campaigns/VTT/Lighting'
} satisfies Meta<typeof LightingFixture>

export default meta
type Story = StoryObj<typeof meta>

async function readLighting(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const output = await canvas.findByTestId('lighting-diagnostics')
  await waitFor(() => expect(output).not.toHaveTextContent('Loading'))
  return {
    description: canvas
      .getByRole('img', { name: 'Interactive campaign scene' })
      .getAttribute('aria-description'),
    lighting: (JSON.parse(output.textContent ?? '{}') as Diagnostics).lighting,
    samples: JSON.parse(canvas.getByTestId('lighting-samples').textContent ?? '[]') as Sample[],
    tokens: (JSON.parse(output.textContent ?? '{}') as Diagnostics).tokens,
    viewTokenId: canvas.getByTestId('lighting-view-token').textContent
  }
}

/**
 * The overlay alpha D108's precedence gives a point, from the real resolver. A GM's see-all view
 * draws the same classes at the capped strength.
 */
function expectedAlpha(scene: CampaignSceneStateDto, point: ScenePoint, strength = 1): number {
  const { illumination } = resolveSceneIlluminationAt(
    scene,
    point,
    new SceneBarrierIndex(scene.barriers),
    illuminationLevels
  )
  const { renderClass } = requireSceneIlluminationLevel(illuminationLevels, illumination)
  return illuminationOverlayAlpha(renderClass) * strength
}

function expectSamplesMatchResolver(
  scene: CampaignSceneStateDto,
  samples: Sample[],
  points: ScenePoint[],
  strength = 1
) {
  expect(samples).toHaveLength(points.length)
  for (const [index, point] of points.entries()) {
    expect(samples[index]!.point).toEqual(point)
    expect(samples[index]!.alpha).toBeCloseTo(expectedAlpha(scene, point, strength), 1)
  }
}

const wallId = '77777777-7777-4777-8777-777777777891'

const brightAndDimScene = validated(campaignSceneStateDtoSchema)({
  ...emptyScene,
  lights: [
    lightAt('77777777-7777-4777-8777-777777777801', 400, 100, 250),
    lightAt('77777777-7777-4777-8777-777777777802', 900, 80, 80)
  ]
})
// Core and dim ring of the first light, the core of the second, and plain bright ground.
const brightAndDimPoints = [
  { x: 400, y: 450 },
  { x: 600, y: 450 },
  { x: 900, y: 450 },
  { x: 1200, y: 450 }
]

export const BrightAndDimLights: Story = {
  args: { samplePoints: brightAndDimPoints, scene: brightAndDimScene },
  play: async ({ canvasElement }) => {
    const { description, lighting, samples } = await readLighting(canvasElement)
    // In a bright room a light cannot make anything clearer: every point stays undarkened.
    expectSamplesMatchResolver(brightAndDimScene, samples, brightAndDimPoints)
    expect(samples.every((sample) => sample.alpha === 0)).toBe(true)
    // Both lights have a bright core; only the first reaches further as dim light.
    expect(lighting).toMatchObject({
      ambientIllumination: 'BRIGHT',
      brightLightCount: 2,
      dimLightCount: 1,
      visionCount: 0
    })
    expect(description).not.toContain('Lighting.')
    // The drawn tint layer: the first light's dim reach then its bright core, the second's core,
    // each one polygon filled in the light's colour at the faint tint alpha.
    const [first, second] = brightAndDimScene.lights as [Light, Light]
    const expectedTints = [
      { light: first, radius: 'dim' },
      { light: first, radius: 'bright' },
      { light: second, radius: 'bright' }
    ] as const
    expect(lighting.lightTints).toHaveLength(expectedTints.length)
    for (const [index, { light, radius }] of expectedTints.entries()) {
      const tint = lighting.lightTints[index]!
      expect(tint.radius).toBe(radius)
      expect(tint.color).toBe(Number.parseInt(light.color.slice(1), 16))
      expect(tint.alpha).toBeCloseTo(lightTintAlpha(light), 5)
      expect(tint.alpha).toBeLessThanOrEqual(0.2)
      expect(tint.polygonCount).toBe(1)
    }
  }
}

const ambientRoomPoints = [
  { x: 200, y: 450 },
  { x: 1000, y: 450 }
]

function ambientRoom(ambientIllumination: CampaignSceneStateDto['ambientIllumination']) {
  return validated(campaignSceneStateDtoSchema)({ ...emptyScene, ambientIllumination })
}

const brightRoom = ambientRoom('BRIGHT')
const dimRoom = ambientRoom('DIM')
const darkRoom = ambientRoom('ORDINARY_DARKNESS')

export const BrightRoomDrawsNoDarkness: Story = {
  args: { samplePoints: ambientRoomPoints, scene: brightRoom },
  play: async ({ canvasElement }) => {
    const { description, samples } = await readLighting(canvasElement)
    expectSamplesMatchResolver(brightRoom, samples, ambientRoomPoints)
    expect(samples.every((sample) => sample.alpha === 0)).toBe(true)
    expect(description).not.toContain('Lighting.')
  }
}

export const DimRoomDrawsHalfDarkness: Story = {
  args: { samplePoints: ambientRoomPoints, scene: dimRoom },
  play: async ({ canvasElement }) => {
    const { samples } = await readLighting(canvasElement)
    expectSamplesMatchResolver(dimRoom, samples, ambientRoomPoints)
    expect(samples[0]!.alpha).toBeGreaterThan(0.2)
    expect(samples[0]!.alpha).toBeLessThan(0.8)
  }
}

export const DarkRoomDrawsFullDarkness: Story = {
  args: { samplePoints: ambientRoomPoints, scene: darkRoom },
  play: async ({ canvasElement }) => {
    const { samples } = await readLighting(canvasElement)
    expectSamplesMatchResolver(darkRoom, samples, ambientRoomPoints)
    expect(samples.every((sample) => sample.alpha > 0.95)).toBe(true)
  }
}

const darkRoomWithLights = validated(campaignSceneStateDtoSchema)({
  ...darkRoom,
  lights: [
    lightAt('77777777-7777-4777-8777-777777777801', 400, 100, 250),
    lightAt('77777777-7777-4777-8777-777777777802', 900, 80, 80)
  ]
})
// Core and dim ring of the first light, the core of the second, and unlit ground.
const darkRoomWithLightsPoints = [
  { x: 400, y: 450 },
  { x: 600, y: 450 },
  { x: 900, y: 450 },
  { x: 1200, y: 450 }
]

export const LightsPushBackAmbientDarkness: Story = {
  args: { samplePoints: darkRoomWithLightsPoints, scene: darkRoomWithLights },
  play: async ({ canvasElement }) => {
    const { samples } = await readLighting(canvasElement)
    expectSamplesMatchResolver(darkRoomWithLights, samples, darkRoomWithLightsPoints)
    expect(samples.map((sample) => sample.alpha)).toEqual([
      expect.closeTo(0, 1),
      expect.closeTo(illuminationOverlayAlpha('DIM'), 1),
      expect.closeTo(0, 1),
      expect.closeTo(1, 1)
    ])
  }
}

const torchInDarkZone = validated(campaignSceneStateDtoSchema)({
  ...emptyScene,
  darknessZones: [zoneAt('77777777-7777-4777-8777-777777777831', 300, 'ORDINARY_DARKNESS', null)],
  lights: [lightAt('77777777-7777-4777-8777-777777777801', 400, 60, 150)]
})
// Torch core, torch dim ring and unlit corner, all inside the zone; then bright ground outside it.
const torchInDarkZonePoints = [
  { x: 400, y: 450 },
  { x: 480, y: 450 },
  { x: 490, y: 310 },
  { x: 700, y: 450 }
]

export const TorchLightsAnOrdinaryDarknessZone: Story = {
  args: { samplePoints: torchInDarkZonePoints, scene: torchInDarkZone },
  play: async ({ canvasElement }) => {
    const { samples } = await readLighting(canvasElement)
    expectSamplesMatchResolver(torchInDarkZone, samples, torchInDarkZonePoints)
    // Lights push ordinary darkness back: lit inside the zone, dark only beyond the torch.
    expect(samples.map((sample) => sample.alpha)).toEqual([
      expect.closeTo(0, 1),
      expect.closeTo(illuminationOverlayAlpha('DIM'), 1),
      expect.closeTo(1, 1),
      expect.closeTo(0, 1)
    ])
  }
}

const torchInMagicalDarkness = validated(campaignSceneStateDtoSchema)({
  ...darkRoom,
  darknessZones: [zoneAt('77777777-7777-4777-8777-777777777832', 300, 'MAGICAL_DARKNESS', null)],
  lights: [lightAt('77777777-7777-4777-8777-777777777801', 400, 100, 250)]
})
const torchInMagicalDarknessPoints = [
  { x: 400, y: 450 },
  { x: 560, y: 450 },
  { x: 800, y: 450 }
]

export const MagicalDarknessStaysBlackOverATorch: Story = {
  args: { samplePoints: torchInMagicalDarknessPoints, scene: torchInMagicalDarkness },
  play: async ({ canvasElement }) => {
    const { samples } = await readLighting(canvasElement)
    expectSamplesMatchResolver(torchInMagicalDarkness, samples, torchInMagicalDarknessPoints)
    // The torch sits inside the zone yet cannot light it; its dim reach outside still shines,
    // and the dark beyond that reach stays dark.
    expect(samples[0]!.alpha).toBeGreaterThan(0.95)
    expect(samples[1]!.alpha).toBeCloseTo(illuminationOverlayAlpha('DIM'), 1)
    expect(samples[2]!.alpha).toBeGreaterThan(0.95)
  }
}

const litRoomWithWall = validated(campaignSceneStateDtoSchema)({
  ...darkRoom,
  barriers: [
    {
      a: { x: 500, y: 200 },
      b: { x: 500, y: 700 },
      blocksLight: true,
      blocksMovement: true,
      id: wallId,
      kind: 'WALL'
    }
  ],
  lights: [lightAt('77777777-7777-4777-8777-777777777801', 400, 150, 300)]
})
const litRoomWithWallPoints = [
  { x: 450, y: 450 },
  { x: 540, y: 450 },
  { x: 600, y: 450 }
]

export const WallBlocksALightInTheDrawnOverlay: Story = {
  args: { samplePoints: litRoomWithWallPoints, scene: litRoomWithWall },
  play: async ({ canvasElement }) => {
    const { samples } = await readLighting(canvasElement)
    expectSamplesMatchResolver(litRoomWithWall, samples, litRoomWithWallPoints)
    expect(samples[0]!.alpha).toBeCloseTo(0, 1)
    // Within the torch's reach but behind the wall: still dark.
    expect(samples[1]!.alpha).toBeGreaterThan(0.95)
    expect(samples[2]!.alpha).toBeGreaterThan(0.95)
  }
}

const doorId = '77777777-7777-4777-8777-777777777892'
const litRoomBehindADoor = (state: 'CLOSED' | 'OPEN') =>
  validated(campaignSceneStateDtoSchema)({
    ...darkRoom,
    barriers: [
      {
        a: { x: 500, y: 200 },
        b: { x: 500, y: 700 },
        blocksLightWhenClosed: true,
        blocksMovementWhenClosed: true,
        id: doorId,
        initialState: 'CLOSED',
        kind: 'DOOR',
        openAngleDegrees: 90
      }
    ],
    doorStates: { [doorId]: state },
    lights: [lightAt('77777777-7777-4777-8777-777777777801', 400, 150, 300)]
  })
const closedDoorScene = litRoomBehindADoor('CLOSED')
const openDoorScene = litRoomBehindADoor('OPEN')
// Beside the light, then within its reach but on the far side of the door.
const doorPoints = [
  { x: 450, y: 450 },
  { x: 540, y: 450 }
]

export const ClosedDoorBlocksALightInTheDrawnOverlay: Story = {
  args: { samplePoints: doorPoints, scene: closedDoorScene },
  play: async ({ canvasElement }) => {
    const { samples } = await readLighting(canvasElement)
    expectSamplesMatchResolver(closedDoorScene, samples, doorPoints)
    expect(samples[0]!.alpha).toBeCloseTo(0, 1)
    expect(samples[1]!.alpha).toBeGreaterThan(0.95)
  }
}

export const OpenDoorLetsALightThrough: Story = {
  args: { samplePoints: doorPoints, scene: openDoorScene },
  play: async ({ canvasElement }) => {
    const { samples } = await readLighting(canvasElement)
    expectSamplesMatchResolver(openDoorScene, samples, doorPoints)
    expect(samples[0]!.alpha).toBeCloseTo(0, 1)
    expect(samples[1]!.alpha).toBeCloseTo(0, 1)
  }
}

export const MagicalAmbientDarknessIgnoresLights: Story = {
  args: {
    samplePoints: [{ x: 400, y: 450 }],
    scene: {
      ...ambientRoom('MAGICAL_DARKNESS'),
      lights: [lightAt('77777777-7777-4777-8777-777777777801', 400, 100, 250)]
    }
  },
  play: async ({ canvasElement }) => {
    const { samples } = await readLighting(canvasElement)
    expect(samples[0]!.alpha).toBeGreaterThan(0.95)
  }
}

export const AmbientDarkness: Story = {
  args: {
    scene: {
      ...emptyScene,
      ambientIllumination: 'ORDINARY_DARKNESS',
      daylight: false,
      lights: [lightAt('77777777-7777-4777-8777-777777777801', 400, 100, 250)]
    }
  },
  play: async ({ canvasElement }) => {
    const { description, lighting } = await readLighting(canvasElement)
    expect(lighting).toMatchObject({
      ambientIllumination: 'ORDINARY_DARKNESS',
      brightLightCount: 1
    })
    expect(description).toContain('Ambient: Ordinary darkness')
  }
}

const darknessKinds = [
  zoneAt('77777777-7777-4777-8777-777777777811', 100, 'DIM', null),
  zoneAt('77777777-7777-4777-8777-777777777812', 400, 'ORDINARY_DARKNESS', null),
  zoneAt('77777777-7777-4777-8777-777777777813', 700, 'MAGICAL_DARKNESS', null),
  zoneAt('77777777-7777-4777-8777-777777777814', 1000, null, null)
]

export const DarknessZoneKinds: Story = {
  args: {
    scene: {
      ...emptyScene,
      ambientIllumination: 'DIM',
      daylight: false,
      darknessZones: darknessKinds,
      lights: [lightAt('77777777-7777-4777-8777-777777777801', 700, 150, 300)]
    }
  },
  play: async ({ canvasElement }) => {
    const { description, lighting } = await readLighting(canvasElement)
    // Counted from the zone graphics actually drawn, not from the input.
    expect(lighting.darknessZones).toEqual(countDarknessZones(darknessKinds))
    expect(lighting.darknessZones).toEqual({
      dim: 1,
      heavyObscured: 0,
      lightObscured: 0,
      magical: 1,
      ordinary: 1,
      unspecified: 1
    })
    expect(description).toContain('Ambient: Dim light')
    for (const zone of darknessKinds)
      expect(description).toContain(describeDarknessZone(zone, illuminationLevels))
    expect(description).toContain('Magical darkness')
    // The visual-only zone's drawn fill carries the zone's own opacity.
    expect(lighting.visualZoneAlphas).toEqual([darknessKinds[3]!.opacity])
  }
}

// Two visual-only zones at different opacities: each draws at its own, not at a fixed alpha.
const visualZones = [
  { ...zoneAt('77777777-7777-4777-8777-777777777815', 300, null, null), opacity: 0.3 },
  { ...zoneAt('77777777-7777-4777-8777-777777777816', 700, null, null), opacity: 0.62 }
]

export const VisualZonesDrawAtTheirOwnOpacity: Story = {
  args: { scene: { ...emptyScene, darknessZones: visualZones } },
  play: async ({ canvasElement }) => {
    const { lighting } = await readLighting(canvasElement)
    expect(lighting.visualZoneAlphas).toHaveLength(2)
    expect(lighting.visualZoneAlphas[0]).toBeCloseTo(0.3, 5)
    expect(lighting.visualZoneAlphas[1]).toBeCloseTo(0.62, 5)
  }
}

const obscuredZones = [
  zoneAt('77777777-7777-4777-8777-777777777821', 300, null, 'LIGHT'),
  zoneAt('77777777-7777-4777-8777-777777777822', 700, 'MAGICAL_DARKNESS', 'HEAVY')
]

export const LightAndHeavyObscurement: Story = {
  args: { scene: { ...emptyScene, darknessZones: obscuredZones } },
  play: async ({ canvasElement }) => {
    const { description, lighting } = await readLighting(canvasElement)
    expect(lighting.darknessZones).toMatchObject({
      heavyObscured: 1,
      lightObscured: 1,
      magical: 1
    })
    expect(description).toContain('Lightly obscured')
    expect(description).toContain('Magical darkness, heavily obscured')
  }
}

const sightScene = validated(campaignSceneStateDtoSchema)({
  ...emptyScene,
  tokens: [
    {
      ...ember,
      position: { x: 400, y: 450 },
      vision: {
        angleDegrees: 360,
        brightRange: 15,
        dimRange: 30,
        directionDegrees: 0,
        enabled: true
      }
    },
    {
      ...warden,
      hidden: false,
      position: { x: 900, y: 450 },
      vision: {
        angleDegrees: 90,
        brightRange: 100,
        dimRange: 200,
        directionDegrees: 0,
        enabled: true
      }
    }
  ]
})

export const PlayerVision: Story = {
  args: { role: 'PLAYER', scene: sightScene },
  play: async ({ canvasElement }) => {
    const { description, lighting } = await readLighting(canvasElement)
    // Only the Token this Player controls shows its senses; the Warden's sight stays unseen.
    expect(lighting.visionCount).toBe(1)
    expect(description).toContain('Vision: Ember')
    expect(description).not.toContain(`Vision: Ember, ${warden.label}`)
  }
}

export const ActorControlRevealsVision: Story = {
  args: { boundTokenId: warden.id, role: 'PLAYER', scene: sightScene },
  play: async ({ canvasElement }) => {
    const { description, lighting } = await readLighting(canvasElement)
    // Control of the Warden's actor arrives alone, with an unchanged Scene.
    expect(lighting.visionCount).toBe(2)
    expect(description).toContain(`Vision: Ember, ${warden.label}`)
  }
}

export const GmFullViewDrawsNoVision: Story = {
  args: { role: 'OWNER', scene: sightScene },
  play: async ({ canvasElement }) => {
    const { description, lighting } = await readLighting(canvasElement)
    expect(lighting.visionCount).toBe(0)
    expect(description).not.toContain('Vision:')
  }
}

const previewScene = validated(campaignSceneStateDtoSchema)({
  ...darkRoom,
  tokens: [
    ...darkRoom.tokens,
    {
      ...warden,
      controlledByUserIds: [],
      hidden: false,
      position: { x: 900, y: 450 },
      vision: {
        angleDegrees: 90,
        brightRange: 100,
        dimRange: 200,
        directionDegrees: 0,
        enabled: true
      }
    }
  ]
})
const previewPoints = [
  { x: 950, y: 450 },
  { x: 200, y: 450 },
  { x: 800, y: 450 }
]

export const GmSeesTheWholeMapAtCappedDarkness: Story = {
  args: { role: 'OWNER', samplePoints: previewPoints, scene: previewScene },
  play: async ({ canvasElement }) => {
    const { lighting, samples } = await readLighting(canvasElement)
    expectSamplesMatchResolver(previewScene, samples, previewPoints, gmDarknessCapAlpha)
    expect(samples.every((sample) => !sample.masked)).toBe(true)
    expect(lighting.visionCount).toBe(0)
  }
}

export const GmPreviewsOneTokensView: Story = {
  args: {
    previewTokenId: warden.id,
    role: 'OWNER',
    samplePoints: previewPoints,
    scene: previewScene
  },
  play: async ({ canvasElement }) => {
    const { description, lighting, samples } = await readLighting(canvasElement)
    // The preview draws what a Player controlling the Warden sees: full darkness, and only the
    // Warden's sight polygon visible. The point behind it is outside its 90 degree sight.
    expectSamplesMatchResolver(previewScene, samples, previewPoints)
    expect(samples.map((sample) => sample.masked)).toEqual([false, true, true])
    expect(lighting.visionCount).toBe(1)
    expect(description).toContain(`Vision: ${warden.label}`)
  }
}

export const PlayerWithoutASeeingTokenSeesABlackMap: Story = {
  // Ember has no vision here: a Player's sight comes only from their own seeing tokens.
  args: { role: 'PLAYER', samplePoints: previewPoints, scene: emptyScene },
  play: async ({ canvasElement }) => {
    const { lighting, samples } = await readLighting(canvasElement)
    expect(lighting.visionCount).toBe(0)
    expect(samples.map((sample) => sample.masked)).toEqual([true, true, true])
  }
}

const playerSightPoints = [
  { x: 440, y: 450 },
  { x: 1200, y: 100 }
]

export const PlayerMapIsBlackOutsideTheirSight: Story = {
  args: { role: 'PLAYER', samplePoints: playerSightPoints, scene: sightScene },
  play: async ({ canvasElement }) => {
    const { samples } = await readLighting(canvasElement)
    // Ember sees all round to 30 ft (420 px); the Warden's sight is not theirs to see.
    expect(samples.map((sample) => sample.masked)).toEqual([false, true])
  }
}

type Sense = CampaignSceneStateDto['tokens'][number]['senses'][number]

function senseOf(
  channel: Sense['channel'],
  illuminationAccess: Sense['illuminationAccess'],
  range: number,
  label: string,
  senseId: string
): Sense {
  return {
    channel,
    illuminationAccess,
    label,
    range: { rangeKind: 'DISTANCE', amount: range },
    senseId
  }
}

const darkvision = senseOf(
  'VISUAL',
  'ORDINARY_DARKNESS',
  20,
  'Darkvision 20 ft.',
  '66666666-6666-4666-8666-666666666601'
)
const truesight = senseOf(
  'VISUAL',
  'MAGICAL_DARKNESS',
  20,
  'Truesight 20 ft.',
  '66666666-6666-4666-8666-666666666602'
)
const blindsight = senseOf(
  'NONVISUAL',
  'IGNORE',
  10,
  'Blindsight 10 ft.',
  '66666666-6666-4666-8666-666666666603'
)
const tremorsense = senseOf(
  'VIBRATION',
  'IGNORE',
  20,
  'Tremorsense 20 ft.',
  '66666666-6666-4666-8666-666666666604'
)

/** A Token its Player controls, seeing all round: only its senses differ between the scenes. */
function seerWith(senses: Sense[]) {
  return {
    ...ember,
    position: { x: 200, y: 450 },
    senses,
    vision: {
      angleDegrees: 360,
      brightRange: 15,
      dimRange: 30,
      directionDegrees: 0,
      enabled: true
    }
  }
}

const viewEmber = { assignedTokenId: null, selectedTokenId: ember.id }

// A cave: ordinary darkness everywhere, a magical-darkness zone beside the seer, a torch further on
// and a wall below the seer.
const caveWallId = '77777777-7777-4777-8777-777777777893'
function caveSceneFor(seer: ReturnType<typeof seerWith>) {
  return validated(campaignSceneStateDtoSchema)({
    ...darkRoom,
    barriers: [
      {
        a: { x: 100, y: 550 },
        b: { x: 300, y: 550 },
        blocksLight: true,
        blocksMovement: true,
        id: caveWallId,
        kind: 'WALL'
      }
    ],
    darknessZones: [zoneAt('77777777-7777-4777-8777-777777777832', 300, 'MAGICAL_DARKNESS', null)],
    lights: [lightAt('77777777-7777-4777-8777-777777777803', 600, 40, 120)],
    tokens: [seer]
  })
}
// Dark ground beside and above the seer, magical darkness, the torch's dim ring just past the zone, ground behind the
// wall, and dark ground beyond the 20 ft sense (315 px from the Token centre).
const cavePoints = [
  { x: 250, y: 450 },
  { x: 200, y: 350 },
  { x: 400, y: 450 },
  { x: 505, y: 450 },
  { x: 200, y: 650 },
  { x: 900, y: 450 }
]

const dwarfCave = caveSceneFor(seerWith([darkvision]))

export const DwarfWithDarkvisionSeesTheCave: Story = {
  args: { samplePoints: cavePoints, scene: dwarfCave, view: viewEmber },
  play: async ({ canvasElement }) => {
    const { samples, viewTokenId } = await readLighting(canvasElement)
    expect(viewTokenId).toBe(ember.id)
    // Ordinary darkness in range is dim and drawn in greyscale; the torch's dim ring becomes
    // bright and keeps its colour; magical darkness, the far side of the wall and ground out of
    // range keep their normal class.
    expect(samples.map((sample) => sample.alpha)).toEqual([
      expect.closeTo(illuminationOverlayAlpha('DIM'), 1),
      expect.closeTo(illuminationOverlayAlpha('DIM'), 1),
      expect.closeTo(1, 1),
      expect.closeTo(0, 1),
      expect.closeTo(1, 1),
      expect.closeTo(1, 1)
    ])
    expect(samples.map((sample) => sample.greyscale)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false
    ])
  }
}

// Senses work within the sight every token has: line of sight to its authored range (30 ft, 420 px, here).
export const SensesStayWithinTheAuthoredSightRange: Story = {
  args: {
    samplePoints: [
      { x: 250, y: 450 },
      { x: 900, y: 450 },
      // 400 px and 440 px from the seer: the pair brackets 30 ft = 420 px, the same conversion
      // server fog uses (visionRangeInMapPixels).
      { x: 600, y: 450 },
      { x: 640, y: 450 }
    ],
    scene: dwarfCave,
    view: viewEmber
  },
  play: async ({ canvasElement }) => {
    const { samples, viewTokenId } = await readLighting(canvasElement)
    expect(viewTokenId).toBe(ember.id)
    expect(samples.map((sample) => sample.masked)).toEqual([false, true, false, true])
  }
}

const truesightCave = caveSceneFor(seerWith([truesight]))

export const TruesightSeesThroughMagicalDarkness: Story = {
  args: { samplePoints: cavePoints, scene: truesightCave, view: viewEmber },
  play: async ({ canvasElement }) => {
    const { samples } = await readLighting(canvasElement)
    // Ordinary and magical darkness in range are clear with no greyscale; the torch's dim ring
    // stays dim; beyond the range or the wall the darkness stands.
    expect(samples.map((sample) => sample.alpha)).toEqual([
      expect.closeTo(0, 1),
      expect.closeTo(0, 1),
      expect.closeTo(0, 1),
      expect.closeTo(illuminationOverlayAlpha('DIM'), 1),
      expect.closeTo(1, 1),
      expect.closeTo(1, 1)
    ])
    expect(samples.every((sample) => !sample.greyscale)).toBe(true)
  }
}

const blindsightCave = caveSceneFor(seerWith([blindsight]))
const blindsightPoints = [
  { x: 250, y: 450 },
  { x: 400, y: 450 }
]

export const BlindsightClearsDarknessInRange: Story = {
  args: { samplePoints: blindsightPoints, scene: blindsightCave, view: viewEmber },
  play: async ({ canvasElement }) => {
    const { samples } = await readLighting(canvasElement)
    // 10 ft reaches 175 px from the Token centre: the near ground is clear, the rest stays dark.
    expect(samples.map((sample) => sample.alpha)).toEqual([
      expect.closeTo(0, 1),
      expect.closeTo(1, 1)
    ])
    expect(samples.every((sample) => !sample.greyscale)).toBe(true)
  }
}

const nearToken = {
  ...warden,
  controlledByUserIds: [],
  hidden: false,
  id: '77777777-7777-4777-8777-777777777851',
  position: { x: 400, y: 450 },
  senses: [],
  vision: null
}
const farToken = {
  ...nearToken,
  id: '77777777-7777-4777-8777-777777777852',
  position: { x: 700, y: 450 }
}
const litToken = {
  ...nearToken,
  id: '77777777-7777-4777-8777-777777777853',
  position: { x: 1100, y: 450 }
}
const tremorScene = validated(campaignSceneStateDtoSchema)({
  ...darkRoom,
  barriers: [
    {
      a: { x: 300, y: 300 },
      b: { x: 300, y: 600 },
      blocksLight: true,
      blocksMovement: true,
      id: caveWallId,
      kind: 'WALL'
    }
  ],
  lights: [lightAt('77777777-7777-4777-8777-777777777804', 1100, 100, 150)],
  tokens: [seerWith([tremorsense]), nearToken, farToken, litToken]
})

export const TremorsenseRevealsTokensWithoutChangingTheMap: Story = {
  args: { samplePoints: blindsightPoints, scene: tremorScene, view: viewEmber },
  play: async ({ canvasElement }) => {
    const { samples, tokens } = await readLighting(canvasElement)
    const visible = (id: string) => tokens.find((token) => token.id === id)?.visible
    // Felt through the wall within 20 ft of the Token's edge; out of range in the dark stays
    // hidden; a lit Token is seen as ever, and the viewer's own Token is always shown.
    expect(visible(nearToken.id)).toBe(true)
    expect(visible(farToken.id)).toBe(false)
    expect(visible(litToken.id)).toBe(true)
    expect(visible(ember.id)).toBe(true)
    // The map keeps its normal class: tremorsense is not sight.
    expect(samples.map((sample) => sample.alpha)).toEqual([
      expect.closeTo(1, 1),
      expect.closeTo(1, 1)
    ])
    expect(samples.every((sample) => !sample.greyscale)).toBe(true)
  }
}

// The GM's preview Token has darkvision, but a Player's view is their own Token's: the preview
// Token's sight is never theirs.
const previewLeakScene = validated(campaignSceneStateDtoSchema)({
  ...darkRoom,
  tokens: [
    seerWith([]),
    {
      ...warden,
      controlledByUserIds: [],
      hidden: false,
      position: { x: 900, y: 450 },
      senses: [darkvision],
      vision: {
        angleDegrees: 360,
        brightRange: 60,
        dimRange: 120,
        directionDegrees: 0,
        enabled: true
      }
    }
  ]
})
const previewLeakPoints = [
  { x: 950, y: 450 },
  { x: 250, y: 450 }
]

export const PlayerNeverGetsTheGmPreviewTokensSight: Story = {
  args: {
    previewTokenId: warden.id,
    role: 'PLAYER',
    samplePoints: previewLeakPoints,
    scene: previewLeakScene,
    view: { assignedTokenId: null, selectedTokenId: null }
  },
  play: async ({ canvasElement }) => {
    const { lighting, samples, viewTokenId } = await readLighting(canvasElement)
    expect(viewTokenId).toBe('none')
    // Only the Player's own Token sees; the Warden's darkvision neither lights nor reveals ground.
    expect(lighting.visionCount).toBe(1)
    expect(samples.map((sample) => sample.masked)).toEqual([true, false])
    expect(samples.map((sample) => sample.alpha)).toEqual([
      expect.closeTo(1, 1),
      expect.closeTo(1, 1)
    ])
    expect(samples.every((sample) => !sample.greyscale)).toBe(true)
  }
}
