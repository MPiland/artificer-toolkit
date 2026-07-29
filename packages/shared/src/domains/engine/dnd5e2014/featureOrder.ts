/**
 * D&D 5e 2014 SRD ordering constants.
 * See RULE_ORDER.md §1 (feature acquisition) and §2 (grant application).
 */

/**
 * Feature source order: which provenance kind fires first.
 * Values are CharacterProvenance `kind` strings.
 */
export const DND5E2014_FEATURE_SOURCE_ORDER = [
  'RACE',
  'SUBRACE',
  'ANCESTRY',
  'BACKGROUND',
  'CLASS',
  'SUBCLASS',
  'FEAT',
  'FEATURE',
  'OPTION',
  'EQUIPMENT',
  'MANUAL'
] as const

/**
 * Grant application order within a single feature.
 * Values are GRANT_KIND constants.
 */
export const DND5E2014_GRANT_APPLICATION_ORDER = [
  'PROFICIENCY_GRANT',
  'SENSE_GRANT',
  'MODIFIER_GRANT',
  'FEAT_GRANT',
  'SPELL_GRANT'
] as const
