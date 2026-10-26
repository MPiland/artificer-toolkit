import type { ManifestLightAuthored } from '#authored'
import { buildNodeMap } from '#utils'
import { MEASUREMENT_NODE_MAP } from '../../shared/maps/index.js'

const manifestLight = buildNodeMap<ManifestLightAuthored>()

export const MANIFEST_LIGHT_NODE_MAP = manifestLight.define('manifestLight', ({ map, nodes }) => {
  const { groupObject } = nodes

  map
    .set(
      'bright',
      groupObject(['bright'], 'Bright Light', () => MEASUREMENT_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true
      })
    )
    .set(
      'dimAdditional',
      groupObject(['dimAdditional'], 'Additional Dim Light', () => MEASUREMENT_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true
      })
    )
})
