import type { ContentRef, OwnedEquipmentInstance } from '../engine/snapshot.js'

/**
 * Canonical persisted current build for a character.
 *
 * This is the source of truth for character editing. It is patched from events
 * and used by the character assembly layer to create CharacterBuildSnapshot input.
 *
 * Three distinct read models — responsibilities never overlap:
 *   CharacterBuildState    — persisted in DB, canonical editing truth (this type)
 *   CharacterHistoryView   — derived from event log, audit/UI timeline
 *   CharacterBuildSnapshot — ephemeral engine input assembled from the current character
 *   EngineCharacterOutput  — ephemeral full resolved character sheet
 */
export interface CharacterBuildState {
  characterId: string
  systemId: string
  /** Optimistic concurrency counter. Incremented on every persisted event. */
  streamVersion: number

  name: string
  raceRef?: ContentRef
  subraceRef?: ContentRef
  backgroundRef?: ContentRef

  classes: Array<{
    classRef: ContentRef
    subclassRef?: ContentRef
    specializationRef?: ContentRef
    level: number
  }>

  /** Ability code → assigned score */
  abilityScores: Record<string, number>
  abilityGenerationMethod: 'STANDARD_ARRAY' | 'POINT_BUY' | 'MANUAL_ROLLED'

  /** Per-level HP record (value already includes CON modifier) */
  hitpointsByLevel: Array<{
    classRef: ContentRef
    classLevel: number
    value: number
  }>

  /** Feature option/choice selections */
  featureSelections: Array<{
    featureId: string
    choiceKey: string
    selectedOptionIds: string[]
    atLevel: number
  }>

  featRefs: ContentRef[]
  spellRefs: ContentRef[]

  /** All owned items including unequipped inventory. */
  ownedEquipment: OwnedEquipmentInstance[]
}
