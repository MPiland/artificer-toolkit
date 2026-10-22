import type { D20AddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import type { RollModeKeep } from '@artificer-toolkit/schema/shared/systemVocabularyCode'
import type { ReceiptD20ContributorDto } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { MaintenanceLinkHook } from './events/encounterEventTable.js'

/** The damage-triggered save a System's maintenance link (Concentration) owes its holder. */
export type MaintenanceLinkSaveFacts = {
  /** The dice the holder rolls with the save (D156). */
  addedDice: readonly D20AddedDieDto[]
  facts: Record<string, string | number | boolean>
  /** A code from the System's `rollMode` vocabulary, with the face its adapter keeps. */
  rollMode: string
  keep: RollModeKeep
  modifier: number
  contributors: ReadonlyArray<ReceiptD20ContributorDto>
  contributorChecksum: string
}

/**
 * System-owned maintenance-link policy (ADR 0039 decision 5): the link itself is neutral persistence
 * keyed by `maintenanceDefinitionId`; the System supplies which events break it or owe a save, the
 * save's ability and DC formula, and the holder's save facts.
 */
export interface MaintenanceLinkCapabilityAdapter {
  readonly gameSystemId: string
  /** The published maintenance rule of the System's Concentration. */
  readonly maintenanceDefinitionId: string
  /** Break and save hooks, a break in priority order (the first met names the reason). */
  readonly hooks: readonly MaintenanceLinkHook[]
  /** The ability the damage save rolls, by vocabulary definition id. */
  readonly saveAbilityDefinitionId: string
  saveDc(appliedDamage: number): number
  saveFacts(input: {
    appliedDamage: number
    targetActorId: string
    target: Pick<MovementTarget, 'effectiveRulePolicyOutput' | 'targetDerivedFacts'>
  }): MaintenanceLinkSaveFacts
}
