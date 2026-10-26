import type { ManifestCamouflageAuthored } from '#authored'
import { buildNodeMap } from '#utils'
import { HELD_ESCAPE_DC_NODE_MAP } from './check.js'

const manifestCamouflage = buildNodeMap<ManifestCamouflageAuthored>()

export const MANIFEST_CAMOUFLAGE_NODE_MAP = manifestCamouflage.define(
  'manifestCamouflage',
  ({ map, nodes }) => {
    map.set(
      'spotDc',
      nodes.groupObject(['spotDc'], 'Spot DC', () => HELD_ESCAPE_DC_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true
      })
    )
  }
)
