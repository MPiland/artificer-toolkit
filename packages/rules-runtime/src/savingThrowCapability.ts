import type { D20AddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import type { ReceiptD20ContributorDto } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import type { MovementTarget } from './encounterMovementTargets.js'

/** The facts a saving-throw DC reads from the creature that owns it. */
export type SavingThrowDcFacts = {
  spellSaveDc: number | null
  proficiencyBonus: number | null
  /** The owner's modifier for an ability definition, or null when the owner lacks that ability. */
  abilityModifier: (abilityDefinitionId: string) => number | null
}

/** One saving throw a creature rolls from, with the modifier and d20 contributors it carries. */
export type SavingThrowRow = {
  abilityDefinitionId: string
  ruleDefinitionId?: string
  conditionTypeId?: string
  modifier: number
  rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
  contributors: ReadonlyArray<ReceiptD20ContributorDto>
}

/** System-owned saving-throw policy: how a DC resolves and which rows and dice a creature saves with. */
export interface SavingThrowCapabilityAdapter {
  readonly gameSystemId: string
  /** The DC of an authored saving throw, or null when the owner lacks something it reads. */
  resolveDc(
    savingThrow: {
      dcMethod: string
      baseDc?: number | null
      bonuses?: readonly (
        | { bonusKind: 'STATIC_BONUS'; amount: number }
        | { bonusKind: 'PROFICIENCY_BONUS' }
        | { bonusKind: 'ABILITY_MODIFIER'; abilityDefinitionId: string }
      )[]
    },
    facts: SavingThrowDcFacts
  ): number | null
  /** The saving-throw rows of a creature, condition contributors included. */
  holderSaves(
    target: Pick<MovementTarget, 'effectiveRulePolicyOutput' | 'targetDerivedFacts'>
  ): readonly SavingThrowRow[]
  /** The added dice a creature's saving throw for `abilityDefinitionId` rolls. */
  addedDice(savingThrowAddedDice: unknown, abilityDefinitionId: string): D20AddedDieDto[]
}
