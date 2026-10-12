import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef, useState } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  resolveSceneIlluminationAt,
  SceneBarrierIndex,
  type ScenePoint
} from '@artificer-toolkit/shared/vtt'
import { tabletopCurrentUserId, tabletopLiveScene } from './CampaignTabletop.stories.fixtures'
import { createVttSceneRenderer, type VttSceneRenderer } from './vttSceneRenderer'
import {
  countDarknessZones,
  describeDarknessZone,
  gmDarknessCapAlpha,
  illuminationOverlayAlpha,
  lightTintAlpha
} from './vttSceneRenderer.model'

type Diagnostics = ReturnType<VttSceneRenderer['getDiagnostics']>
type Zone = CampaignSceneStateDto['darknessZones'][number]
type Light = CampaignSceneStateDto['lights'][number]

const ember = tabletopLiveScene.tokens[0]!
const warden = tabletopLiveScene.tokens[1]!

const emptyScene = {
  ...tabletopLiveScene,
  ambientIllumination: 'BRIGHT',
  barriers: [],
  darknessZones: [],
  doorStates: {},
  fogMode: 'OFF',
  lights: [],
  tokens: [{ ...ember, vision: null }]
} satisfies CampaignSceneStateDto

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
  scene
}: {
  /** A Token whose Encounter actor control arrives in a later update, as when the Encounter loads. */
  boundTokenId?: string
  /** The GM's token-view preview: draws what a Player controlling this Token sees. */
  previewTokenId?: string
  role?: 'OWNER' | 'PLAYER'
  /** Scene points whose drawn darkness the fixture reads back from the overlay. */
  samplePoints?: ScenePoint[]
  scene: CampaignSceneStateDto
}) {
  const host = useRef<HTMLDivElement | null>(null)
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null)
  const [samples, setSamples] = useState<Sample[]>([])

  useEffect(() => {
    if (!host.current) return
    let disposed = false
    let renderer: VttSceneRenderer | null = null
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
      renderer = nextRenderer
      const update = {
        boundTokenControl: new Map<string, boolean>(),
        currentUserId: tabletopCurrentUserId,
        mapDelivery: null,
        mode: 'PLAY',
        previewTokenId,
        role,
        scene,
        tool: 'SELECT'
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
  }, [boundTokenId, previewTokenId, role, samplePoints, scene])

  return (
    <section aria-label='Lighting fixture' style={{ display: 'grid', gap: 12, padding: 16 }}>
      <div ref={host} style={{ blockSize: 640, minInlineSize: 0, overflow: 'hidden' }} />
      <output aria-live='polite' data-testid='lighting-diagnostics'>
        {diagnostics ? JSON.stringify(diagnostics) : 'Loading lighting scene…'}
      </output>
      <output data-testid='lighting-samples'>{JSON.stringify(samples)}</output>
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
    samples: JSON.parse(canvas.getByTestId('lighting-samples').textContent ?? '[]') as Sample[]
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
    new SceneBarrierIndex(scene.barriers)
  )
  return illuminationOverlayAlpha(illumination) * strength
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

const brightAndDimScene = {
  ...emptyScene,
  lights: [
    lightAt('77777777-7777-4777-8777-777777777801', 400, 100, 250),
    lightAt('77777777-7777-4777-8777-777777777802', 900, 80, 80)
  ]
} satisfies CampaignSceneStateDto
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
  return { ...emptyScene, ambientIllumination } satisfies CampaignSceneStateDto
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

const darkRoomWithLights = {
  ...darkRoom,
  lights: [
    lightAt('77777777-7777-4777-8777-777777777801', 400, 100, 250),
    lightAt('77777777-7777-4777-8777-777777777802', 900, 80, 80)
  ]
} satisfies CampaignSceneStateDto
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

const torchInDarkZone = {
  ...emptyScene,
  darknessZones: [zoneAt('77777777-7777-4777-8777-777777777831', 300, 'ORDINARY_DARKNESS', null)],
  lights: [lightAt('77777777-7777-4777-8777-777777777801', 400, 60, 150)]
} satisfies CampaignSceneStateDto
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

const torchInMagicalDarkness = {
  ...darkRoom,
  darknessZones: [zoneAt('77777777-7777-4777-8777-777777777832', 300, 'MAGICAL_DARKNESS', null)],
  lights: [lightAt('77777777-7777-4777-8777-777777777801', 400, 100, 250)]
} satisfies CampaignSceneStateDto
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

const litRoomWithWall = {
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
} satisfies CampaignSceneStateDto
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
  ({
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
  }) satisfies CampaignSceneStateDto
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
    for (const zone of darknessKinds) expect(description).toContain(describeDarknessZone(zone))
    expect(description).toContain('Magical darkness')
    // The visual-only zone's drawn fill carries the zone's own opacity.
    expect(lighting.visualZoneAlphas).toEqual([darknessKinds[3]!.opacity])
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

const sightScene = {
  ...emptyScene,
  tokens: [
    { ...ember, position: { x: 400, y: 450 } },
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
} satisfies CampaignSceneStateDto

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

const previewScene = {
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
} satisfies CampaignSceneStateDto
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
    // Ember sees all round to 120; the Warden's sight is not theirs to see.
    expect(samples.map((sample) => sample.masked)).toEqual([false, true])
  }
}
