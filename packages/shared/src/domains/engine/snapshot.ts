import type { CompiledEquipment, CompiledEquipmentVariant } from '../subjects/compilers/equipment.js'

/**
 * Stable reference to authored content. contentVersionId is optional now;
 * required once the marketplace/versioning phase is active.
 */
export interface ContentRef {
  contentId: string
  contentVersionId?: string
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
 * Ephemeral engine input assembled from CharacterBuildState + CharacterAssemblyRegistry.
 *
 * This type replaces the old AssembledCharacterSnapshot as the engine input.
 * It is never persisted — build it fresh from the current character before each engine run.
 */
export interface CharacterBuildSnapshot {
  characterId: string
  systemId: string
  totalLevel: number

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
   * Assembled feature acquisitions — sourced from CharacterBuildState.
   * The engine uses these to drive grant accumulation.
   */
  features: Array<{
    featureId: string
    source: { kind: string } & Record<string, unknown>
    timing: { kind: string } & Record<string, unknown>
  }>

  /**
   * Equipped items with their resolved compiled form.
   * Only equipped items (equippedState is present) should be included here.
   * Items in inventory only are excluded.
   */
  equippedItems: Array<{
    instanceId: string
    contentRef: ContentRef
    equippedState: EquippedState
    compiledItem: CompiledEquipment | CompiledEquipmentVariant
  }>
}
