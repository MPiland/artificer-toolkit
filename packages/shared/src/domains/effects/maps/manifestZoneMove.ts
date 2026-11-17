import type { ManifestZoneMoveAuthored } from '#authored'
import { ACTIVATION_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'
import { MEASUREMENT_NODE_MAP } from '../../shared/maps/index.js'

const manifestZoneMove = buildNodeMap<ManifestZoneMoveAuthored>()

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
        nodes.groupObject(['maxDistance'], 'Farthest Move', () => MEASUREMENT_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true
        })
      )
      .set('rams', nodes.toggle(['rams'], 'Rams Creatures'))
  }
)
