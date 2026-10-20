import type {
  FeatureEffectAuthored,
  FeatureGrantedSpellCastAuthored,
  FeatureSpellCastAuthored,
  FeatureWeaponAttackAuthored
} from '#authored'
import { EQUIPMENT_GRIP_OPTIONS, EQUIPMENT_PROPERTY_OPTIONS } from '#core'
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

const grantedSpellCast = buildNodeMap<FeatureGrantedSpellCastAuthored>()

/** The granted spell an action casts, chosen when it is used (D156). */
const GRANTED_SPELL_CAST_NODE_MAP = grantedSpellCast.define(
  'featureGrantedSpellCast',
  ({ map, nodes }) => {
    map.set(
      'spellKind',
      nodes.selectSingle(['spellKind'], 'Granted spell', {
        kind: 'INLINE_OPTIONS',
        options: [
          {
            code: 'CANTRIP',
            label: 'A cantrip',
            description: 'Casts one of the granted cantrips.'
          },
          {
            code: 'LEVELED',
            label: 'A levelled spell',
            description: 'Casts one of the granted levelled spells from a spell slot as normal.'
          }
        ]
      })
    )
  }
)

const weaponAttack = buildNodeMap<FeatureWeaponAttackAuthored>()

/** An attack made with each wielded weapon that has these properties (D156). */
const WEAPON_ATTACK_NODE_MAP = weaponAttack.define('featureWeaponAttack', ({ map, nodes }) => {
  map.set(
    'requiredPropertyCodes',
    nodes.selectMulti(['requiredPropertyCodes'], 'Weapon properties', {
      kind: 'INLINE_OPTIONS',
      options: EQUIPMENT_PROPERTY_OPTIONS
    })
  )
})

const featureEffect = buildNodeMap<FeatureEffectAuthored>()

/**
 * The shared effect editor plus the optional grip of a versatile weapon attack, which authors one
 * effect per grip, the spell an action casts, and an attack made with each wielded weapon. The
 * Feature and Creature schemas enforce them on save.
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
      .set(
        'grantedSpellCast',
        nodes.groupObject(
          ['grantedSpellCast'],
          'Casts a granted spell',
          () => GRANTED_SPELL_CAST_NODE_MAP,
          { presentation: 'inline' }
        )
      )
      .set(
        'weaponAttack',
        nodes.groupObject(
          ['weaponAttack'],
          'Attacks with each wielded weapon',
          () => WEAPON_ATTACK_NODE_MAP,
          { presentation: 'inline' }
        )
      )
  },
  EFFECT_NODE_MAP.authoring
)
