import type { ManifestZoneMoveAuthored } from '#authored'
import { ACTIVATION_OPTIONS, LENGTH_UNIT_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'

const manifestZoneMove = buildNodeMap<ManifestZoneMoveAuthored>()
const manifestZoneMoveDistance = buildNodeMap<ManifestZoneMoveAuthored['maxDistance']>()

const MANIFEST_ZONE_MOVE_DISTANCE_NODE_MAP = manifestZoneMoveDistance.define(
  'manifestZoneMoveDistance',
  ({ map, nodes }) => {
    map
      .set(
        'amount',
        nodes.number(['amount'], 'Distance', { requiredIf: true, constraints: { minimum: 1 } })
      )
      .set(
        'unit',
        nodes.selectSingle(
          ['unit'],
          'Unit',
          { kind: 'INLINE_OPTIONS', options: LENGTH_UNIT_OPTIONS },
          { requiredIf: true }
        )
      )
  }
)

export const MANIFEST_ZONE_MOVE_NODE_MAP = manifestZoneMove.define(
  'manifestZoneMove',
  ({ map, nodes }) => {
    map
      .set(
        'activation',
        nodes.selectSingle(
          ['activation'],
          'Costs',
          {
            kind: 'INLINE_OPTIONS',
            options: ACTIVATION_OPTIONS.filter(
              ({ code }) => code === 'ACTION' || code === 'BONUS_ACTION'
            )
          },
          { requiredIf: true }
        )
      )
      .set(
        'maxDistance',
        nodes.groupObject(
          ['maxDistance'],
          'Farthest Move',
          () => MANIFEST_ZONE_MOVE_DISTANCE_NODE_MAP,
          { presentation: 'inline', requiredIf: true }
        )
      )
  }
)
