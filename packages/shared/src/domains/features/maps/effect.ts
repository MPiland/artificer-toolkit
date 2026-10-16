import type { FeatureEffectAuthored, FeatureSpellCastAuthored } from '#authored'
import { EQUIPMENT_GRIP_OPTIONS } from '#core'
import { EFFECT_NODE_MAP } from '../../effects/maps/effect.js'
import { buildNodeMap, type NodeMap } from '#utils'

const spellCast = buildNodeMap<FeatureSpellCastAuthored>()

/** The spell a Creature action casts: the level it is cast at (D136). */
const SPELL_CAST_NODE_MAP = spellCast.define('spellCast', ({ map, nodes }) => {
  map.set(
    'castLevel',
    nodes.number(['castLevel'], 'Cast level', { constraints: { minimum: 1, maximum: 9 } })
  )
})

const featureEffect = buildNodeMap<FeatureEffectAuthored>()

/**
 * The shared effect editor plus the optional grip of a versatile weapon attack, which authors one
 * effect per grip, and the spell an action casts. The Creature schema enforces both on save.
 */
export const FEATURE_EFFECT_NODE_MAP = featureEffect.define(
  'featureEffect',
  ({ map, nodes }) => {
    map
      .merge(EFFECT_NODE_MAP.nodes as NodeMap<FeatureEffectAuthored>['nodes'])
      .set(
        'grip',
        nodes.selectSingle(['grip'], 'Versatile grip', {
          kind: 'INLINE_OPTIONS',
          options: EQUIPMENT_GRIP_OPTIONS
        })
      )
      .set(
        'spellCast',
        nodes.groupObject(['spellCast'], 'Casts a spell', () => SPELL_CAST_NODE_MAP, {
          presentation: 'inline'
        })
      )
  },
  EFFECT_NODE_MAP.authoring
)
