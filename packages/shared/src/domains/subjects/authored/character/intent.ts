import {
  CHARACTER_ABILITY_GENERATION_METHOD,
  ADVANCEMENT_METHOD_CODE,
  type StandardArrayScore,
  type PointBuyScore,
  type HitpointCalculationMethodCode
} from '#core'

export type CharacterProvenance =
  | { kind: 'CLASS'; classId: string; classLevel?: number }
  | { kind: 'SUBCLASS'; subclassId: string; classLevel?: number }
  | { kind: 'RACE'; raceId: string }
  | { kind: 'SUBRACE'; subraceId: string }
  | { kind: 'ANCESTRY'; ancestryId: string; optionId: string }
  | { kind: 'BACKGROUND'; backgroundId: string }
  | { kind: 'FEAT'; featId: string }
  | { kind: 'FEATURE'; featureId: string }
  | { kind: 'OPTION'; acquiredParentId: string; optionId: string }
  | { kind: 'MANUAL'; reason?: string }

export function getCharacterProvenanceIdentityKey(source: CharacterProvenance): string {
  switch (source.kind) {
    case 'CLASS':
      return `CLASS:${encodeURIComponent(source.classId)}`
    case 'SUBCLASS':
      return `SUBCLASS:${encodeURIComponent(source.subclassId)}`
    case 'RACE':
      return `RACE:${encodeURIComponent(source.raceId)}`
    case 'SUBRACE':
      return `SUBRACE:${encodeURIComponent(source.subraceId)}`
    case 'ANCESTRY':
      return `ANCESTRY:${encodeURIComponent(source.ancestryId)}:${encodeURIComponent(source.optionId)}`
    case 'BACKGROUND':
      return `BACKGROUND:${encodeURIComponent(source.backgroundId)}`
    case 'FEAT':
      return `FEAT:${encodeURIComponent(source.featId)}`
    case 'FEATURE':
      return `FEATURE:${encodeURIComponent(source.featureId)}`
    case 'OPTION':
      return `OPTION:${encodeURIComponent(source.acquiredParentId)}:${encodeURIComponent(source.optionId)}`
    case 'MANUAL':
      return source.reason === undefined
        ? 'MANUAL:0'
        : `MANUAL:1:${encodeURIComponent(source.reason)}`
  }
}

export function isSameCharacterProvenanceIdentity(
  left: CharacterProvenance,
  right: CharacterProvenance
): boolean {
  return getCharacterProvenanceIdentityKey(left) === getCharacterProvenanceIdentityKey(right)
}

/* ──────────────────────────────────────────────
 * Timing
 * ────────────────────────────────────────────── */

export type CharacterAcquisitionTiming =
  | { kind: 'IMMEDIATE' }
  | { kind: 'CHARACTER_LEVEL'; level: number }
  | { kind: 'CLASS_LEVEL'; classId: string; classLevel: number }

/* ──────────────────────────────────────────────
 * Feature acquisition provenance
 * ────────────────────────────────────────────── */

export type CharacterFeatureSource = CharacterProvenance

export type CharacterFeatureSelectionValue =
  | { kind: 'ID'; id: string }
  | { kind: 'IDS'; ids: string[] }
  | { kind: 'NUMBER'; value: number }
  | { kind: 'BOOLEAN'; value: boolean }

export interface CharacterFeatureSelectionRecord {
  /** Stable key within the feature definition */
  selectionKey: string
  /** What the player selected */
  values: CharacterFeatureSelectionValue[]
}

export interface CharacterFeatureAcquisitionRecord {
  /** Unique to the character */
  id: string
  /** System feature being acquired */
  featureId: string
  /** Why this feature exists on the character */
  source: CharacterFeatureSource
  /** When it was acquired */
  timing: CharacterAcquisitionTiming
  /** Player choices made within this feature */
  selections?: CharacterFeatureSelectionRecord[]
}

export interface CharacterChosenGrantSelectionIdentity {
  /** The authored proficiency, spell, feat, sense, or modifier grant being resolved. */
  grantId: string
  /** The active character source that owns the grant. */
  source: CharacterProvenance
  /** Present when a PER_LEVEL progression entry owns this choice. */
  progressionLevel?: number
}

export function getCharacterChosenGrantSelectionIdentityKey(
  selection: CharacterChosenGrantSelectionIdentity
): string {
  return [
    encodeURIComponent(selection.grantId),
    selection.progressionLevel ?? 'root',
    encodeURIComponent(getCharacterProvenanceIdentityKey(selection.source))
  ].join(':')
}

export interface CharacterChosenGrantSelectionRecord extends CharacterChosenGrantSelectionIdentity {
  /** Unique to this character selection record. */
  id: string
  /** When the owning source became active. */
  timing: CharacterAcquisitionTiming
  /** Ordered slot values. Duplicates are meaningful for REPEATABLE grants. */
  targetIds: string[]
}

/* ──────────────────────────────────────────────
 * Advancement
 * ────────────────────────────────────────────── */

export type CharacterAdvancementIntent =
  | { method: typeof ADVANCEMENT_METHOD_CODE.EXPERIENCE; experience?: number }
  | { method: typeof ADVANCEMENT_METHOD_CODE.MILESTONE }

/* ──────────────────────────────────────────────
 * Hitpoints (split intent vs state)
 * ────────────────────────────────────────────── */

export interface CharacterDieRollRecord {
  die: number // e.g., 6
  value: number // 1..die
}

export interface CharacterHitpointLevelEntry {
  level: number
  classId: string
  classLevel: number
  value: number
  rolls?: CharacterDieRollRecord[]
}

/* ──────────────────────────────────────────────
 * Identity intents
 * ────────────────────────────────────────────── */

export interface CharacterRaceIntent {
  raceId: string
  subraceId?: string
}

export interface CharacterBackgroundIntent {
  backgroundId: string
}

/**
 * Explicit record so ancestry can be swapped/removed deterministically.
 * (Dragonborn-style ancestry options remain source-addressable.)
 */
export interface CharacterAncestryAcquisition {
  id: string
  ancestryId: string
  optionId: string
  source: { kind: 'RACE'; raceId: string } | { kind: 'SUBRACE'; subraceId: string }
  timing: { kind: 'IMMEDIATE' } | { kind: 'CLASS_LEVEL'; classId: string; classLevel: number }
}

/* ──────────────────────────────────────────────
 * Class intent
 * ────────────────────────────────────────────── */

export interface CharacterClassIntent {
  classId: string
  classLevel: number
  subclassId?: string
  specializationId?: string
}

/* ──────────────────────────────────────────────
 * Abilities intent (keeps your UX audit model)
 * ────────────────────────────────────────────── */

export interface CharacterAbilityRollGroupRecord {
  id: string
  rolls: CharacterDieRollRecord[]
  kept: CharacterDieRollRecord[]
  assignedAbility?: string
  score: number
  applied?: boolean
  rolling?: boolean
}

export interface CharacterManualAbilityAssignment {
  ability: string
  score: number
}

export interface CharacterManualRolledAbilityRecord {
  configuration?: string
  rollGroups?: CharacterAbilityRollGroupRecord[]
  assignments: CharacterManualAbilityAssignment[]
}

export interface CharacterStandardArrayAssignment {
  ability: string
  option: StandardArrayScore
}

export interface CharacterPointBuyAssignment {
  ability: string
  option: PointBuyScore
}

export type CharacterAbilityScoresIntent =
  | {
      method: typeof CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY
      assignments: CharacterStandardArrayAssignment[]
    }
  | {
      method: typeof CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY
      assignments: CharacterPointBuyAssignment[]
    }
  | {
      method: typeof CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
      state: CharacterManualRolledAbilityRecord
    }

/* ──────────────────────────────────────────────
 * Starting equipment intent (UX record)
 * ────────────────────────────────────────────── */

export enum CharacterStartingEquipmentSource {
  CLASS = 'CLASS',
  BACKGROUND = 'BACKGROUND'
}

/**
 * Stable authored IDs keep character decisions resilient if option arrays are
 * reordered during content edits or later seed migrations.
 */
export interface CharacterStartingEquipmentGroupSelection {
  groupId: string
  optionId: string
  selections?: {
    selectionKey: string
    equipmentId: string
    quantity: number
  }[]
}

export interface CharacterStartingGoldSelection {
  goldOption: string
  totalGold: number
}

export interface CharacterStartingEquipmentDecision {
  source: CharacterStartingEquipmentSource
  tookGold: boolean
  groups?: CharacterStartingEquipmentGroupSelection[]
  gold?: CharacterStartingGoldSelection
  applied?: boolean
}

/* ──────────────────────────────────────────────
 * Spells intent (ONLY for feature/option-based picks)
 * ────────────────────────────────────────────── */

export type CharacterSpellSelectionSource = Extract<
  CharacterProvenance,
  { kind: 'CLASS' } | { kind: 'SUBCLASS' } | { kind: 'FEATURE' } | { kind: 'OPTION' }
>

export interface CharacterSpellSelectionRecord {
  id: string
  source: CharacterSpellSelectionSource
  timing: CharacterAcquisitionTiming
  spells: string[] // spellIds
  replacedSelectionId?: string
}

/* ──────────────────────────────────────────────
 * Resources intent (grant provenance only)
 * ────────────────────────────────────────────── */

export type CharacterResourceGrantSource = Extract<
  CharacterProvenance,
  { kind: 'CLASS' } | { kind: 'SUBCLASS' } | { kind: 'FEATURE' } | { kind: 'OPTION' }
>

export interface CharacterResourceGrantRecord {
  id: string
  resourceId: string
  source: CharacterResourceGrantSource
  timing: CharacterAcquisitionTiming
}

/* ──────────────────────────────────────────────
 * Character Intent root
 * ────────────────────────────────────────────── */

export interface CharacterHitpointsIntent {
  method: HitpointCalculationMethodCode
  levels: CharacterHitpointLevelEntry[]
}

export interface CharacterIntent {
  advancement: CharacterAdvancementIntent

  race: CharacterRaceIntent
  ancestrySelections?: CharacterAncestryAcquisition[]
  background: CharacterBackgroundIntent

  classes: CharacterClassIntent[]

  abilities: CharacterAbilityScoresIntent
  hitpoints: CharacterHitpointsIntent

  startingEquipment?: {
    class?: CharacterStartingEquipmentDecision
    background?: CharacterStartingEquipmentDecision
  }

  featureAcquisitions: CharacterFeatureAcquisitionRecord[]
  chosenGrantSelections?: CharacterChosenGrantSelectionRecord[]
  spellSelections?: CharacterSpellSelectionRecord[]
  resourceGrants?: CharacterResourceGrantRecord[]
}
