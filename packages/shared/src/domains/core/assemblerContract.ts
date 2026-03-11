import type { CharacterAcquisitionTiming, CharacterFeatureSelectionRecord, CharacterFeatureSource, CharacterResourceGrantSource, CharacterSpellSelectionSource } from '#authored'
import type { CompiledModifierGrant } from '#compilers'

/**
 * A feature that exists on the character *right now*
 */
export interface AssembledCharacterFeature {
  /** Stable runtime id (character-unique) */
  id: string

  /** System feature id */
  featureId: string

  /** Why it exists */
  source: CharacterFeatureSource

  /** When it exists */
  timing: CharacterAcquisitionTiming

  /** Player choices */
  selections?: CharacterFeatureSelectionRecord[]
}

export interface AssembledCharacterResource {
  /** Character-unique id */
  id: string

  /** System resource id */
  resourceId: string

  /** Why it exists */
  source: CharacterResourceGrantSource
  /** When it becomes available */
  timing: CharacterAcquisitionTiming
}

export interface AssembledCharacterSpellAccess {
  /** Character-unique id */
  id: string

  /** System spell id */
  spellId: string

  /** Why this spell exists */
  source: CharacterSpellSelectionSource

  /** When it becomes available */
  timing: CharacterAcquisitionTiming
}

export interface AssembledCharacterModifierGrant {
  /** Stable character-unique runtime id */
  id: string

  /** Provenance (why this exists) */
  source: CharacterFeatureSource

  /** When it exists */
  timing: CharacterAcquisitionTiming

  /** The compiled modifier grant definition */
  grant: CompiledModifierGrant
}
