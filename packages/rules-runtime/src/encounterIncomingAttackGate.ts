import { incomingAttackGatePayloadDtoSchema } from '@artificer-toolkit/schema/grants/modifier'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterIncomingGateOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { listActiveEffectGrants } from './character/activeEffectGrantTotals.js'
import { EncounterValidationError } from './encounterErrors.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { dnd5eConcentrationHolderSaves } from './systems/dnd5e/concentrationPolicy.js'
import { derivedAddedDice } from './systems/dnd5e/d20AddedDiceGraph.js'

/** The ward a holder carries (`INCOMING_ATTACK_GATE`): its effect, the caster whose DC it uses and its save. */
export type HeldIncomingGate = {
  effect: ActiveRuleEffectRecord
  /** The creature whose spell save DC the ward's save uses. */
  casterActorId: string
  payload: ReturnType<typeof incomingAttackGatePayloadDtoSchema.parse>
}

/**
 * The holder's ward and the payload its first `INCOMING_ATTACK_GATE` grant carries. A holder that carries
 * several wards answers to the one with the lowest id, so every replay picks the same.
 */
export function heldIncomingGate(
  effects: readonly ActiveRuleEffectRecord[]
): HeldIncomingGate | null {
  for (const effect of [...effects].sort((left, right) => left.id.localeCompare(right.id))) {
    const { origin } = effect.definition
    for (const { modifiers } of listActiveEffectGrants([effect])) {
      for (const modifier of modifiers) {
        if (modifier.valueDomainCode !== 'INCOMING_ATTACK_GATE') continue
        if (origin.kind !== 'ENCOUNTER' || origin.sourceActorId === null)
          throw new EncounterValidationError('An incoming attack gate needs its caster.')
        return {
          effect,
          casterActorId: origin.sourceActorId,
          payload: incomingAttackGatePayloadDtoSchema.parse(modifier.payload)
        }
      }
    }
  }
  return null
}

/**
 * The save the attacker owes the ward, frozen: the ability and DC the ward names, and the attacker's d20
 * for it (modifier, contributors, roll mode and added dice, conditions included). The DC is the caster's
 * spell save DC as it stands now.
 */
export function incomingGateOffer(input: {
  held: HeldIncomingGate
  holderActorId: string
  /** The caster's spell save DC; null when the caster has none. */
  casterSaveDc: number | null
  attacker: Pick<MovementTarget, 'effectiveRulePolicyOutput' | 'targetDerivedFacts'>
}): EncounterIncomingGateOfferDto {
  const { savingThrow } = input.held.payload
  if (savingThrow.dcMethod !== 'SOURCE_SAVE_DC')
    throw new EncounterValidationError('An incoming attack gate uses the caster’s save DC.')
  if (input.casterSaveDc === null)
    throw new EncounterValidationError('The caster of the incoming attack gate has no save DC.')
  const rows = (dnd5eConcentrationHolderSaves(input.attacker).savingThrowDefinitions ?? []).filter(
    (row) =>
      row.abilityDefinitionId === savingThrow.abilityDefinitionId &&
      row.ruleDefinitionId === undefined &&
      row.conditionTypeId === undefined
  )
  const [row] = rows
  if (rows.length !== 1 || row === undefined || !Number.isSafeInteger(row.modifier))
    throw new EncounterValidationError('The attacker has no saving throw for the incoming gate.')
  const addedDice = derivedAddedDice(
    input.attacker.targetDerivedFacts.savingThrowAddedDice,
    savingThrow.abilityDefinitionId
  )
  return {
    effectId: input.held.effect.id,
    holderActorId: input.holderActorId,
    checkDefinitionId: savingThrow.abilityDefinitionId,
    dc: input.casterSaveDc,
    d20: {
      rollMode: row.rollMode,
      contributors: [...row.contributors],
      contributorChecksum: checksumRuleDocument(row.contributors),
      modifier: row.modifier,
      ...(addedDice.length > 0 && { addedDice })
    }
  }
}
