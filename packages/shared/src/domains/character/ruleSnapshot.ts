import type { SizeCode } from '../core/size.js'
import type { EquippedSlotCode } from '../subjects/core/equipmentHands.js'
import type {
  CompiledEquipment,
  CompiledEquipmentVariant
} from '../subjects/compilers/equipment.js'
import {
  getCharacterChosenGrantSelectionIdentityKey,
  type CharacterAcquisitionTiming,
  type CharacterChosenGrantSelectionRecord,
  type CharacterFeatureSelectionRecord,
  type CharacterProvenance
} from '../subjects/authored/character/intent.js'
import type {
  CharacterMechanicalAdjustment,
  CharacterMovementDisplayPreference
} from './sheetAdjustment.js'
import type { CharacterSpellSourceRef } from './sheetResource.js'

export type ContentRevisionBinding = { kind: 'ACTIVE' } | { kind: 'REVISION'; revisionId: string }

export interface ContentRef {
  definitionId: string
  binding: ContentRevisionBinding
  systemId: string
}

/** An equipped Character item, in the slot its state stores (D107). */
export interface EquippedState {
  slot: EquippedSlotCode
}

export interface OwnedEquipmentInstance {
  instanceId: string
  contentRef: ContentRef
  quantity: number
  equippedState?: EquippedState
}

export interface CharacterCompanionCalculationInput {
  companionInstanceId: string
  creatureId: string
  abilityScores: Record<string, number>
  armorClass: number
  maxHitPoints: number
  size?: SizeCode
  alignmentId?: string
  creatureTypeId?: string
}

/** Ephemeral, normalized Character state used to assemble versioned rule-policy facts. */
export interface CharacterBuildSnapshot {
  characterId: string
  systemId: string
  totalLevel: number
  raceId?: string
  subraceId?: string
  backgroundId?: string
  chosenGrantSelections?: CharacterChosenGrantSelectionRecord[]
  classes: Array<{
    classId: string
    level: number
    subclassId?: string
    specializationId?: string
  }>
  abilities: Record<string, number>
  hitpoints: Array<{
    classId: string
    classLevel: number
    value: number
  }>
  features: Array<{
    acquisitionId?: string
    featureId: string
    source: CharacterProvenance
    timing: CharacterAcquisitionTiming
    selections?: CharacterFeatureSelectionRecord[]
  }>
  equipmentItems: Array<{
    instanceId: string
    contentRef: ContentRef
    equippedState?: EquippedState
    attuned: boolean
    /** The penalty corrosion has put on its armor class or damage rolls; absent when none. */
    degradation?: number
    compiledItem: CompiledEquipment | CompiledEquipmentVariant
  }>
  adjustments?: CharacterMechanicalAdjustment[]
  movementDisplayPreference?: CharacterMovementDisplayPreference
  spellSources?: CharacterSpellSourceRef[]
  /** Spells a Class casts as rituals (D171); each is a source of its own, cast with no slot. */
  classRitualSources?: Array<{ classId: string; source: CharacterSpellSourceRef }>
  companions?: CharacterCompanionCalculationInput[]
}

export function getChosenGrantTargetIds(
  snapshot: CharacterBuildSnapshot,
  grantId: string,
  source: CharacterProvenance,
  progressionLevel?: number
): string[] {
  const identityKey = getCharacterChosenGrantSelectionIdentityKey({
    grantId,
    source,
    progressionLevel
  })

  return (
    snapshot.chosenGrantSelections?.find(
      (selection) => getCharacterChosenGrantSelectionIdentityKey(selection) === identityKey
    )?.targetIds ?? []
  )
}
