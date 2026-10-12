import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef, useState } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { tabletopCurrentUserId, tabletopLiveScene } from './CampaignTabletop.stories.fixtures'
import { createVttSceneRenderer, type VttSceneRenderer } from './vttSceneRenderer'
import { describeDarknessZone } from './vttSceneRenderer.model'

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

function LightingFixture({
  boundTokenId,
  role = 'PLAYER',
  scene
}: {
  /** A Token whose Encounter actor control arrives in a later update, as when the Encounter loads. */
  boundTokenId?: string
  role?: 'OWNER' | 'PLAYER'
  scene: CampaignSceneStateDto
}) {
  const host = useRef<HTMLDivElement | null>(null)
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null)

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
        role,
        scene,
        tool: 'SELECT'
      } as const
      nextRenderer.update(update)
      if (boundTokenId) {
        nextRenderer.update({ ...update, boundTokenControl: new Map([[boundTokenId, true]]) })
      }
      setDiagnostics(nextRenderer.getDiagnostics())
    })
    return () => {
      disposed = true
      renderer?.destroy()
    }
  }, [boundTokenId, role, scene])

  return (
    <section aria-label='Lighting fixture' style={{ display: 'grid', gap: 12, padding: 16 }}>
      <div ref={host} style={{ blockSize: 640, minInlineSize: 0, overflow: 'hidden' }} />
      <output aria-live='polite' data-testid='lighting-diagnostics'>
        {diagnostics ? JSON.stringify(diagnostics) : 'Loading lighting scene…'}
      </output>
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
    lighting: (JSON.parse(output.textContent ?? '{}') as Diagnostics).lighting
  }
}

export const BrightAndDimLights: Story = {
  args: {
    scene: {
      ...emptyScene,
      lights: [
        lightAt('77777777-7777-4777-8777-777777777801', 400, 100, 250),
        lightAt('77777777-7777-4777-8777-777777777802', 900, 80, 80)
      ]
    }
  },
  play: async ({ canvasElement }) => {
    const { description, lighting } = await readLighting(canvasElement)
    // Both lights have a bright core; only the first reaches further as dim light.
    expect(lighting).toMatchObject({
      ambientIllumination: 'BRIGHT',
      brightLightCount: 2,
      dimLightCount: 1,
      visionCount: 0
    })
    expect(description).not.toContain('Lighting.')
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
