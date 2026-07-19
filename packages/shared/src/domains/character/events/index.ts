import type { ContentRef } from '../../engine/snapshot.js'

/* ──────────────────────────────────────────────
 * Event envelope — all events extend this
 * ────────────────────────────────────────────── */

export interface CharacterEventEnvelope {
  eventId: string
  characterId: string
  /** ISO8601 timestamp */
  occurredAt: string
  actorId: string
  commandId: string
  schemaVersion: number
}

/* ──────────────────────────────────────────────
 * Identity & build events
 * ────────────────────────────────────────────── */

export interface CharacterCreatedEvent extends CharacterEventEnvelope {
  type: 'CHARACTER_CREATED'
  name: string
  systemId: string
}

export interface RaceAssignedEvent extends CharacterEventEnvelope {
  type: 'RACE_ASSIGNED'
  raceRef: ContentRef
  subraceRef?: ContentRef
}

export interface BackgroundAssignedEvent extends CharacterEventEnvelope {
  type: 'BACKGROUND_ASSIGNED'
  backgroundRef: ContentRef
}

/* ──────────────────────────────────────────────
 * Ability score events
 * ────────────────────────────────────────────── */

export interface AbilityScoresGeneratedEvent extends CharacterEventEnvelope {
  type: 'ABILITY_SCORES_GENERATED'
  method: 'STANDARD_ARRAY' | 'POINT_BUY' | 'MANUAL_ROLLED'
  /** Full dice history — only present for MANUAL_ROLLED */
  rolls?: Array<{
    rollGroupId: string
    /** Individual die faces rolled (e.g. [4, 3, 6, 2] for 4d6 drop lowest) */
    dice: number[]
    /** Dropped dice faces */
    dropped: number[]
    total: number
  }>
  /** Ability code → final assigned score */
  assignments: Record<string, number>
}

export interface AbilityScoresReplacedEvent extends CharacterEventEnvelope {
  type: 'ABILITY_SCORES_REPLACED'
  /** Ability code → new score */
  assignments: Record<string, number>
  reason?: string
}

/* ──────────────────────────────────────────────
 * Class progression events
 * ────────────────────────────────────────────── */

export interface ClassLevelGainedEvent extends CharacterEventEnvelope {
  type: 'CLASS_LEVEL_GAINED'
  classRef: ContentRef
  subclassRef?: ContentRef
  specializationRef?: ContentRef
  newLevel: number
  totalCharacterLevel: number
}

export interface HitPointsAppliedEvent extends CharacterEventEnvelope {
  type: 'HITPOINTS_APPLIED'
  classRef: ContentRef
  classLevel: number
  method: 'ROLLED' | 'AVERAGE' | 'MAXIMUM'
  /** Die result before CON modifier — only present for ROLLED */
  roll?: number
  /** Final value (CON modifier already included) */
  value: number
}

/* ──────────────────────────────────────────────
 * Choice events
 * ────────────────────────────────────────────── */

export interface FeatureSelectionMadeEvent extends CharacterEventEnvelope {
  type: 'FEATURE_SELECTION_MADE'
  featureId: string
  choiceKey: string
  selectedOptionRefs: ContentRef[]
  atLevel: number
}

export interface FeatChosenEvent extends CharacterEventEnvelope {
  type: 'FEAT_CHOSEN'
  featRef: ContentRef
  /** Which ASI/feat opportunity this consumed */
  sourceFeatureId: string
}

export interface SpellSelectionUpdatedEvent extends CharacterEventEnvelope {
  type: 'SPELL_SELECTION_UPDATED'
  added: ContentRef[]
  removed: ContentRef[]
  classRef: ContentRef
}

/* ──────────────────────────────────────────────
 * Equipment events
 * ────────────────────────────────────────────── */

export interface EquipmentAcquiredEvent extends CharacterEventEnvelope {
  type: 'EQUIPMENT_ACQUIRED'
  instanceId: string
  contentRef: ContentRef
  quantity: number
  source: 'STARTING_EQUIPMENT' | 'PURCHASED' | 'FOUND' | 'GRANTED'
}

export interface EquipmentRemovedEvent extends CharacterEventEnvelope {
  type: 'EQUIPMENT_REMOVED'
  instanceId: string
  quantity: number
  reason?: string
}

export interface ItemEquippedEvent extends CharacterEventEnvelope {
  type: 'ITEM_EQUIPPED'
  instanceId: string
  equippedSlot: string
  /** Position for RING slots */
  slotPosition?: number
  /** The slot this item was in before equipping (if it was already equipped elsewhere) */
  previousSlot?: string
}

export interface ItemUnequippedEvent extends CharacterEventEnvelope {
  type: 'ITEM_UNEQUIPPED'
  instanceId: string
  unequippedFromSlot: string
}

export interface CharacterSheetCommandAppliedEvent extends CharacterEventEnvelope {
  type: 'CHARACTER_SHEET_COMMAND_APPLIED'
  commandType: string
  commandFingerprint: string
  summary: string
}

/* ──────────────────────────────────────────────
 * Full event union
 * ────────────────────────────────────────────── */

export type CharacterEvent
  = | CharacterCreatedEvent
    | RaceAssignedEvent
    | BackgroundAssignedEvent
    | AbilityScoresGeneratedEvent
    | AbilityScoresReplacedEvent
    | ClassLevelGainedEvent
    | HitPointsAppliedEvent
    | FeatureSelectionMadeEvent
    | FeatChosenEvent
    | SpellSelectionUpdatedEvent
    | EquipmentAcquiredEvent
    | EquipmentRemovedEvent
    | ItemEquippedEvent
    | ItemUnequippedEvent
    | CharacterSheetCommandAppliedEvent
