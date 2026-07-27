import type { FeatureBaseAuthored } from '#authored'
import { buildNodeMap } from '#utils'
import { FEAT_GRANT_NODE_MAP } from './feat.js'
import { MODIFIER_GRANT_NODE_MAP } from './modifier.js'
import { PROFICIENCY_NODE_MAP } from './proficiency.js'
import { SENSE_GRANT_NODE_MAP } from './sense.js'
import { SPELL_GRANT_NODE_MAP } from './spell.js'

type FeatureGrantsAuthored = NonNullable<FeatureBaseAuthored['grants']>

const featureGrants = buildNodeMap<FeatureGrantsAuthored>()

export const FEATURE_GRANTS_NODE_MAP = featureGrants.define('featureGrants', ({ map, nodes }) => {
  const { groupArray } = nodes

  map
    .set(
      'feats',
      groupArray(['feats'], 'Feat Grants', () => FEAT_GRANT_NODE_MAP, { presentation: 'focused' })
    )
    .set(
      'modifiers',
      groupArray(['modifiers'], 'Modifier Grants', () => MODIFIER_GRANT_NODE_MAP, {
        presentation: 'focused'
      })
    )
    .set(
      'proficiencies',
      groupArray(['proficiencies'], 'Proficiency Grants', () => PROFICIENCY_NODE_MAP, {
        presentation: 'focused'
      })
    )
    .set(
      'senses',
      groupArray(['senses'], 'Sense Grants', () => SENSE_GRANT_NODE_MAP, {
        presentation: 'focused'
      })
    )
    .set(
      'spells',
      groupArray(['spells'], 'Spell Grants', () => SPELL_GRANT_NODE_MAP, {
        presentation: 'focused'
      })
    )
})
