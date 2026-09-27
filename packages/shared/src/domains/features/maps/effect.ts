import type { FeatureEffectAuthored } from '#authored'
import { EQUIPMENT_GRIP_OPTIONS } from '#core'
import { EFFECT_NODE_MAP } from '../../effects/maps/effect.js'
import { buildNodeMap, type NodeMap } from '#utils'

const featureEffect = buildNodeMap<FeatureEffectAuthored>()

/**
 * The shared effect editor plus the optional grip of a versatile weapon attack, which authors one
 * effect per grip. The Creature schema enforces the pairing on save.
 */
export const FEATURE_EFFECT_NODE_MAP = featureEffect.define(
  'featureEffect',
  ({ map, nodes }) => {
    map.merge(EFFECT_NODE_MAP.nodes as NodeMap<FeatureEffectAuthored>['nodes']).set(
      'grip',
      nodes.selectSingle(['grip'], 'Versatile grip', {
        kind: 'INLINE_OPTIONS',
        options: EQUIPMENT_GRIP_OPTIONS
      })
    )
  },
  EFFECT_NODE_MAP.authoring
)
