import type { FeatureBaseAuthored } from '#authored'
import { buildNodeMap } from '#utils'
import { FEAT_GRANT_NODE_MAP } from './feat.js'
import { MODIFIER_GRANT_NODE_MAP } from './modifier.js'
import { PROFICIENCY_NODE_MAP } from './proficiency.js'
import { SENSE_GRANT_NODE_MAP } from './sense.js'
import { SPELL_GRANT_NODE_MAP } from './spell.js'

type FeatureGrantsAuthored = NonNullable<FeatureBaseAuthored['grants']>

const featureGrants = buildNodeMap<FeatureGrantsAuthored>()

const FEATURE_GRANT_SECTIONS = {
  feats: { id: 'feats', label: 'Feats', order: 10 },
  modifiers: { id: 'modifiers', label: 'Modifiers', order: 20 },
  proficiencies: { id: 'proficiencies', label: 'Proficiencies', order: 30 },
  senses: { id: 'senses', label: 'Senses', order: 40 },
  spells: { id: 'spells', label: 'Spells', order: 50 }
} as const

export const FEATURE_GRANTS_NODE_MAP = featureGrants.define('featureGrants', ({ map, nodes }) => {
  const { groupArray } = nodes

  map
    .set(
      'feats',
      groupArray(['feats'], 'Feat Grants', () => FEAT_GRANT_NODE_MAP, {
        presentation: 'focused',
        section: FEATURE_GRANT_SECTIONS.feats
      })
    )
    .set(
      'modifiers',
      groupArray(['modifiers'], 'Modifier Grants', () => MODIFIER_GRANT_NODE_MAP, {
        presentation: 'focused',
        section: FEATURE_GRANT_SECTIONS.modifiers
      })
    )
    .set(
      'proficiencies',
      groupArray(['proficiencies'], 'Proficiency Grants', () => PROFICIENCY_NODE_MAP, {
        presentation: 'focused',
        section: FEATURE_GRANT_SECTIONS.proficiencies
      })
    )
    .set(
      'senses',
      groupArray(['senses'], 'Sense Grants', () => SENSE_GRANT_NODE_MAP, {
        presentation: 'focused',
        section: FEATURE_GRANT_SECTIONS.senses
      })
    )
    .set(
      'spells',
      groupArray(['spells'], 'Spell Grants', () => SPELL_GRANT_NODE_MAP, {
        presentation: 'focused',
        section: FEATURE_GRANT_SECTIONS.spells
      })
    )
})
