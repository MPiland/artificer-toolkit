import { assertNever } from '@artificer-toolkit/functions/utils'

import type { CharacterAbilityRollGroupRecord, CharacterAbilityScoresIntent, CharacterAcquisitionTiming, CharacterAdvancementIntent, CharacterAncestryAcquisition, CharacterBackgroundIntent, CharacterClassIntent, CharacterDieRollRecord, CharacterFeatureAcquisitionRecord, CharacterFeatureSelectionRecord, CharacterFeatureSelectionValue, CharacterFeatureSource, CharacterHitpointLevelEntry, CharacterHitpointsIntent, CharacterIntent, CharacterManualAbilityAssignment, CharacterManualRolledAbilityRecord, CharacterPointBuyAssignment, CharacterRaceIntent, CharacterResourceGrantRecord, CharacterSpellSelectionRecord, CharacterStandardArrayAssignment, CharacterStartingEquipmentDecision, CharacterStartingEquipmentGroupSelection, CharacterStartingGoldSelection } from '#authored'
import type { AbilityCode, HitpointCalculationMethodCode } from '#core'
import { ADVANCEMENT_METHOD_CODE, CHARACTER_ABILITY_GENERATION_METHOD } from '#core'

export type CompiledCharacterIntent = {
  advancement: CompiledAdvancement

  race: CompiledCharacterRaceIntent
  background: CompiledCharacterBackgroundIntent

  ancestrySelections?: CompiledCharacterAncestrySelection[]

  classes: CompiledCharacterClassIntent[]

  abilities: CompiledAbilityScores

  hitpoints: CompiledCharacterHitpointIntent

  startingEquipment?: {
    class?: CompiledCharacterStartingEquipment
    background?: CompiledCharacterStartingEquipment
  }

  featureAcquisitions: CompiledCharacterFeatureAcquisition[]

  spellSelections?: CompiledCharacterSpellSelection[]

  resourceGrants?: CompiledCharacterResourceGrant[]
}

/* ──────────────────────────────────────────────────────────────
 * Advancement
 * ────────────────────────────────────────────────────────────── */

export type CompiledAdvancement
  = | {
    method: typeof ADVANCEMENT_METHOD_CODE.EXPERIENCE
    experience?: number
  }
  | {
    method: typeof ADVANCEMENT_METHOD_CODE.MILESTONE
  }

export function compileAdvancementIntent(authored: CharacterAdvancementIntent): CompiledAdvancement {
  switch (authored.method) {
    case ADVANCEMENT_METHOD_CODE.EXPERIENCE:
      return {
        method: authored.method,
        experience: authored.experience
      }

    case ADVANCEMENT_METHOD_CODE.MILESTONE:
      return { method: authored.method }

    default:
      return assertNever(authored)
  }
}

/* ──────────────────────────────────────────────────────────────
 * Identity
 * ────────────────────────────────────────────────────────────── */

export type CompiledCharacterRaceIntent = {
  raceId: string
  subraceId?: string
}

export type CompiledCharacterBackgroundIntent = {
  backgroundId: string
}

export function compileCharacterRaceIntent(authored: CharacterRaceIntent): CompiledCharacterRaceIntent {
  return {
    raceId: authored.raceId,
    subraceId: authored.subraceId
  }
}

export function compileCharacterBackgroundIntent(
  authored: CharacterBackgroundIntent
): CompiledCharacterBackgroundIntent {
  return {
    backgroundId: authored.backgroundId
  }
}

/* ──────────────────────────────────────────────────────────────
 * Ancestry selections
 * ────────────────────────────────────────────────────────────── */

export type CompiledCharacterAncestrySelection = {
  id: string
  ancestryId: string
  optionId: string
  source:
    | { kind: 'RACE', raceId: string }
    | { kind: 'SUBRACE', subraceId: string }
  timing:
    | { kind: 'IMMEDIATE' }
    | { kind: 'CLASS_LEVEL', classId: string, classLevel: number }
}

export function compileAncestrySelection(
  authored: CharacterAncestryAcquisition
): CompiledCharacterAncestrySelection {
  return {
    id: authored.id,
    ancestryId: authored.ancestryId,
    optionId: authored.optionId,
    source: authored.source,
    timing: authored.timing
  }
}

/* ──────────────────────────────────────────────────────────────
 * Classes
 * ────────────────────────────────────────────────────────────── */

export type CompiledCharacterClassIntent = {
  classId: string
  classLevel: number
  subclassId?: string
  subtypeId?: string
}

export function compileCharacterClassIntent(authored: CharacterClassIntent): CompiledCharacterClassIntent {
  return {
    classId: authored.classId,
    classLevel: authored.classLevel,
    subclassId: authored.subclassId,
    subtypeId: authored.subtypeId
  }
}

/* ──────────────────────────────────────────────────────────────
 * Ability scores
 * ────────────────────────────────────────────────────────────── */

export type CompiledDieRoll = CharacterDieRollRecord

export type CompiledAbilityRollGroup = {
  id: string
  rolls?: CompiledDieRoll[]
  kept?: CompiledDieRoll[]
  assignedAbility?: AbilityCode
  score: number
  applied?: boolean
  rolling?: boolean
}

export type CompiledManualRolledAbilityState = {
  configuration?: string
  rollGroups?: CompiledAbilityRollGroup[]
  assignments: CharacterManualAbilityAssignment[]
}

export type CompiledAbilityScores
  = | {
    method: typeof CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY
    assignments: CharacterStandardArrayAssignment[]
  }
  | {
    method: typeof CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY
    assignments: CharacterPointBuyAssignment[]
  }
  | {
    method: typeof CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
    state: CompiledManualRolledAbilityState
  }

function compileAbilityRollGroup(authored: CharacterAbilityRollGroupRecord): CompiledAbilityRollGroup {
  const rolls = authored.rolls && authored.rolls.length ? authored.rolls : undefined
  const kept = authored.kept && authored.kept.length ? authored.kept : undefined

  return {
    id: authored.id,
    rolls,
    kept,
    assignedAbility: authored.assignedAbility,
    score: authored.score,
    applied: authored.applied,
    rolling: authored.rolling
  }
}

function compileManualRolledAbilityState(
  authored: CharacterManualRolledAbilityRecord
): CompiledManualRolledAbilityState {
  const rollGroups
    = authored.rollGroups && authored.rollGroups.length
      ? authored.rollGroups.map(compileAbilityRollGroup)
      : undefined

  return {
    configuration: authored.configuration,
    rollGroups,
    assignments: authored.assignments
  }
}

export function compileAbilityScoresIntent(authored: CharacterAbilityScoresIntent): CompiledAbilityScores {
  switch (authored.method) {
    case CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY:
      return {
        method: authored.method,
        assignments: authored.assignments
      }

    case CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY:
      return {
        method: authored.method,
        assignments: authored.assignments
      }

    case CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED:
      return {
        method: authored.method,
        state: compileManualRolledAbilityState(authored.state)
      }

    default:
      return assertNever(authored)
  }
}

/* ──────────────────────────────────────────────────────────────
 * Hit points
 * ────────────────────────────────────────────────────────────── */

export type CompiledHitpointLevelEntry = CharacterHitpointLevelEntry

export type CompiledCharacterHitpointIntent = {
  method: HitpointCalculationMethodCode
  levels: CompiledHitpointLevelEntry[]
}

export function compileHitpointIntent(authored: CharacterHitpointsIntent): CompiledCharacterHitpointIntent {
  return {
    method: authored.method,
    levels: authored.levels
  }
}

/* ──────────────────────────────────────────────────────────────
 * Starting equipment decisions
 * ────────────────────────────────────────────────────────────── */

export type CompiledCharacterStartingEquipmentGroupSelection = CharacterStartingEquipmentGroupSelection
export type CompiledCharacterStartingGoldSelection = CharacterStartingGoldSelection

export type CompiledCharacterStartingEquipment = {
  source: CharacterStartingEquipmentDecision['source']
  tookGold: boolean
  groups?: CompiledCharacterStartingEquipmentGroupSelection[]
  gold?: CompiledCharacterStartingGoldSelection
  applied?: boolean
}

export function compileStartingEquipmentDecision(
  authored: CharacterStartingEquipmentDecision
): CompiledCharacterStartingEquipment {
  const groups = authored.groups && authored.groups.length ? authored.groups : undefined

  return {
    source: authored.source,
    tookGold: authored.tookGold,
    groups,
    gold: authored.gold,
    applied: authored.applied
  }
}

/* ──────────────────────────────────────────────────────────────
 * Feature acquisitions
 * ────────────────────────────────────────────────────────────── */

export type CompiledFeatureSource = CharacterFeatureSource
export type CompiledAcquisitionTiming = CharacterAcquisitionTiming
export type CompiledFeatureSelectionValue = CharacterFeatureSelectionValue

export type CompiledFeatureSelection = {
  selectionKey: string
  values: CompiledFeatureSelectionValue[]
}

export type CompiledCharacterFeatureAcquisition = {
  id: string
  featureId: string
  source: CompiledFeatureSource
  timing: CompiledAcquisitionTiming
  selections?: CompiledFeatureSelection[]
}

function compileFeatureSelection(authored: CharacterFeatureSelectionRecord): CompiledFeatureSelection {
  return {
    selectionKey: authored.selectionKey,
    values: authored.values
  }
}

export function compileFeatureAcquisition(
  authored: CharacterFeatureAcquisitionRecord
): CompiledCharacterFeatureAcquisition {
  const selections
    = authored.selections && authored.selections.length
      ? authored.selections.map(compileFeatureSelection)
      : undefined

  return {
    id: authored.id,
    featureId: authored.featureId,
    source: authored.source,
    timing: authored.timing,
    selections
  }
}

/* ──────────────────────────────────────────────────────────────
 * Spell selections
 * ────────────────────────────────────────────────────────────── */

export type CompiledCharacterSpellSelection = {
  id: string
  source: CharacterSpellSelectionRecord['source']
  timing: CharacterAcquisitionTiming
  spells: string[]
  replacedSelectionId?: string
}

export function compileSpellSelection(
  authored: CharacterSpellSelectionRecord
): CompiledCharacterSpellSelection {
  return {
    id: authored.id,
    source: authored.source,
    timing: authored.timing,
    spells: authored.spells,
    replacedSelectionId: authored.replacedSelectionId
  }
}

/* ──────────────────────────────────────────────────────────────
 * Resource grants + usage
 * ────────────────────────────────────────────────────────────── */

export type CompiledCharacterResourceGrant = CharacterResourceGrantRecord

export function compileResourceGrant(
  authored: CharacterResourceGrantRecord
): CompiledCharacterResourceGrant {
  return {
    id: authored.id,
    resourceId: authored.resourceId,
    source: authored.source,
    timing: authored.timing
  }
}

/* ──────────────────────────────────────────────────────────────
 * Top-level compile
 * ────────────────────────────────────────────────────────────── */

export function compileCharacterIntent(authored: CharacterIntent): CompiledCharacterIntent {
  const ancestrySelections
    = authored.ancestrySelections && authored.ancestrySelections.length
      ? authored.ancestrySelections.map(compileAncestrySelection)
      : undefined

  const startingEquipment
    = authored.startingEquipment
      ? {
          class: authored.startingEquipment.class
            ? compileStartingEquipmentDecision(authored.startingEquipment.class)
            : undefined,
          background: authored.startingEquipment.background
            ? compileStartingEquipmentDecision(authored.startingEquipment.background)
            : undefined
        }
      : undefined

  const spellSelections
    = authored.spellSelections && authored.spellSelections.length
      ? authored.spellSelections.map(compileSpellSelection)
      : undefined

  const resourceGrants
    = authored.resourceGrants && authored.resourceGrants.length
      ? authored.resourceGrants.map(compileResourceGrant)
      : undefined

  return {
    advancement: compileAdvancementIntent(authored.advancement),

    race: compileCharacterRaceIntent(authored.race),
    background: compileCharacterBackgroundIntent(authored.background),

    ancestrySelections,

    classes: authored.classes.map(compileCharacterClassIntent),

    abilities: compileAbilityScoresIntent(authored.abilities),

    hitpoints: compileHitpointIntent(authored.hitpoints),

    startingEquipment,

    featureAcquisitions: authored.featureAcquisitions.map(compileFeatureAcquisition),

    spellSelections,

    resourceGrants
  }
}
