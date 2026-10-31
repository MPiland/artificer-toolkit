import type { SpatialWallSide } from '@artificer-toolkit/shared/vtt'

/** How the drawer words each way of aiming an area on the map. */
export const AREA_AIM_COPY = {
  POINT: { title: 'Area origin', pick: 'Pick on map', clear: 'Clear origin', hint: null },
  DIRECTED: {
    title: 'Area direction',
    pick: 'Aim on map',
    clear: 'Clear aim',
    hint: "Drag from your token's edge toward where it points."
  },
  WALL: {
    title: 'Wall',
    pick: 'Draw on map',
    clear: 'Clear wall',
    hint: 'Drag from one end of the wall to the other.'
  },
  RING: {
    title: 'Ring',
    pick: 'Draw on map',
    clear: 'Clear ring',
    hint: "Drag from the ring's center out to its edge."
  }
} as const

/** The sides of a drawn wall a zone's band can reach (D154): a wall's as drawn, or a ring's. */
export const BAND_SIDES = {
  WALL: [
    { label: 'Left as drawn', value: 'LEFT' },
    { label: 'Right as drawn', value: 'RIGHT' }
  ],
  RING: [
    { label: 'Inside', value: 'INSIDE' },
    { label: 'Outside', value: 'OUTSIDE' }
  ]
} as const satisfies Record<
  'WALL' | 'RING',
  ReadonlyArray<{ label: string; value: SpatialWallSide }>
>
