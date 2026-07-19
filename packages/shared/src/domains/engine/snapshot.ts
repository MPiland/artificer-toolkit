import type { CompiledEquipment, CompiledEquipmentVariant } from '../subjects/compilers/equipment.js'
import type {
  CharacterAcquisitionTiming,
  CharacterChosenGrantSelectionRecord,
  CharacterFeatureSelectionRecord,
  CharacterProvenance
} from '../subjects/authored/character/intent.js'

export type ContentRevisionBinding =
  | { kind: 'ACTIVE' }
  | { kind: 'REVISION', revisionId: string }

/** Stable definition identity plus the revision-binding policy used for resolution. */
export interface ContentRef {
  definitionId: string
  binding: ContentRevisionBinding
  systemId: string
}

/**
 * Equipment slot discriminated union.
 * A character may have at most one item in ARMOR, one in SHIELD, one in MAIN_HAND,
 * one in OFF_HAND, two in RING (position 1 and 2), and any number in GENERIC.
 */
export type EquippedState
  = | { slot: 'ARMOR' }
    | { slot: 'SHIELD' }
    | { slot: 'MAIN_HAND' }
    | { slot: 'OFF_HAND' }
    | { slot: 'RING', position: 1 | 2 }
    | { slot: 'GENERIC' }

/**
 * An owned copy of a piece of equipment in the character's inventory.
 * Equipped state is only present when the item is currently equipped.
 */
export interface OwnedEquipmentInstance {
  /** Stable UUID for this owned copy (not the content id) */
  instanceId: string
  contentRef: ContentRef
  /** For stackable items such as arrows; defaults to 1 */
  quantity: number
  /** Present only when the item is equipped to a slot */
  equippedState?: EquippedState
}

/**
 * Ephemeral engine input assembled from CharacterAuthored intent/state and CharacterAssemblyRegistry.
 *
 * It is never persisted — build it fresh from the current character before each engine run.
 */
export interface CharacterBuildSnapshot {
  characterId: string
  systemId: string
  totalLevel: number
  raceId?: string
  subraceId?: string
  backgroundId?: string
  chosenGrantSelections?: CharacterChosenGrantSelectionRecord[]

  /** Each class the character has levels in */
  classes: Array<{
    classId: string
    level: number
    subclassId?: string
    specializationId?: string
  }>

  /** Ability code → final base score (after racial/background bonuses but before engine modifiers) */
  abilities: Record<string, number>

  /** Per-level HP entries (value already includes CON modifier) */
  hitpoints: Array<{
    classId: string
    classLevel: number
    value: number
  }>

  /**
   * Assembled feature acquisitions sourced from CharacterAuthored intent.
   * The engine uses these to drive grant accumulation.
   */
  features: Array<{
    acquisitionId?: string
    featureId: string
    source: CharacterProvenance
    timing: CharacterAcquisitionTiming
    selections?: CharacterFeatureSelectionRecord[]
  }>

  /** Inventory items with their resolved compiled form and current play state. */
  equipmentItems: Array<{
    instanceId: string
    contentRef: ContentRef
    equippedState?: EquippedState
    attuned: boolean
    compiledItem: CompiledEquipment | CompiledEquipmentVariant
  }>
}
