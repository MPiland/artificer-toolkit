import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { incomingAttackGatePayloadDtoSchema } from '@artificer-toolkit/schema/grants/modifier'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterIncomingGateOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import { listActiveEffectGrants } from './character/activeEffectGrantTotals.js'
import { heldSourceImmunityLabel } from './encounterSourceImmunity.js'
import { freezeD20Context } from './encounterD20Settlement.js'
import { EncounterValidationError } from './encounterErrors.js'
import { discoverEncounterEventHooks } from './events/encounterEventHooks.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import {
  abilityScoreCapabilityRegistry,
  savingThrowCapabilityRegistry
} from './platformPolicyModules.js'

type IncomingGatePayload = ReturnType<typeof incomingAttackGatePayloadDtoSchema.parse>

/** The ward a holder carries (`INCOMING_ATTACK_GATE`): its identity, the creature whose DC it uses and its save. */
export type HeldIncomingGate = {
  /** The ward's effect id, or the id of the holder's own feature grant that carries it. */
  wardId: string
  /** The creature whose save DC the ward's save uses: the caster of a spell ward, the holder of a feature's. */
  ownerActorId: string
  payload: IncomingGatePayload
}

/**
 * The holder's ward that the harmful action its attacker aims at it meets (ADR 0039 decision 4), and
 * the payload its first `INCOMING_ATTACK_GATE` grant carries. Wards from the holder's Active Effects
 * come first, in id order, then the holder's own feature grants (Nature's Sanctuary), so every replay
 * picks the same; a ward the attacker already passed is not held against it.
 */
export function heldIncomingGate(input: {
  holderActorId: string
  effects: readonly ActiveRuleEffectRecord[]
  grantFold: Pick<CharacterGrantFoldOutput, 'modifiers' | 'modifierGroups'> | null
  /** The attacker's Creature type; null for a Character, whose type is not in its facts. */
  attackerCreatureTypeId: string | null
  /** The attacker, whom a ward it already passed (its success immunity) no longer stops. */
  attacker: { actorId: string; characterId: string | null }
}): HeldIncomingGate | null {
  const held: HeldIncomingGate[] = []
  const passed = (wardId: string) =>
    heldSourceImmunityLabel({
      holderEffects: input.effects,
      immuneToId: wardId,
      sourceActorId: input.attacker.actorId,
      sourceCharacterId: input.attacker.characterId
    }) !== null
  for (const effect of [...input.effects].sort((left, right) => left.id.localeCompare(right.id))) {
    const { origin } = effect.definition
    for (const { modifiers } of listActiveEffectGrants([effect])) {
      for (const modifier of modifiers) {
        if (modifier.valueDomainCode !== 'INCOMING_ATTACK_GATE') continue
        // A Character's own effect (a standing ward its rest turned on) is owned by its holder.
        const ownerActorId =
          origin.kind === 'CHARACTER' ? input.holderActorId : origin.sourceActorId
        if (ownerActorId === null)
          throw new EncounterValidationError('An incoming attack gate needs its caster.')
        const payload = incomingAttackGatePayloadDtoSchema.parse(modifier.payload)
        if (!passed(effect.id)) held.push({ wardId: effect.id, ownerActorId, payload })
      }
    }
  }
  // The Character fold also carries its Active Effects' grants; those were read from the effects above.
  for (const { contributions } of input.grantFold?.modifierGroups ?? []) {
    for (const { acceptedModifierIndex, grantId } of contributions) {
      const modifier = input.grantFold!.modifiers[acceptedModifierIndex]!
      if (
        modifier.valueDomainCode !== 'INCOMING_ATTACK_GATE' ||
        modifier.source.kind === 'ACTIVE_EFFECT'
      )
        continue
      const payload = incomingAttackGatePayloadDtoSchema.parse(modifier.payload)
      if (!passed(grantId))
        held.push({ wardId: grantId, ownerActorId: input.holderActorId, payload })
    }
  }
  const [gate] = discoverEncounterEventHooks({
    incomingGates: held,
    events: [{ kind: 'HARMFUL_ACTION_AIMED', attackerCreatureTypeId: input.attackerCreatureTypeId }]
  }).incomingGates
  return gate ?? null
}

/**
 * The save DC of a ward's owner as it stands now: their spell save DC, or the ward's own `8 + bonuses`
 * from their ability modifiers and proficiency bonus. Null when the owner lacks what the DC reads.
 */
export function incomingGateSaveDc(
  gameSystemId: string,
  savingThrow: IncomingGatePayload['savingThrow'],
  owner: Pick<MovementTarget, 'effectiveRulePolicyOutput' | 'effectiveScalarValues'>
): number | null {
  const derived = owner.effectiveRulePolicyOutput?.derivedStats
  const { abilityModifier } = abilityScoreCapabilityRegistry.require(gameSystemId)
  return savingThrowCapabilityRegistry.require(gameSystemId).resolveDc(savingThrow, {
    spellSaveDc: derived?.spellcasting?.saveDc.effective ?? null,
    proficiencyBonus: derived?.proficiencyBonus.effective ?? null,
    abilityModifier: (abilityDefinitionId) => {
      const score = owner.effectiveScalarValues[abilityDefinitionId]
      return score === undefined ? null : abilityModifier(score)
    }
  })
}

/**
 * The save the attacker owes the ward, frozen: the ability and DC the ward names, and the attacker's d20
 * for it (modifier, contributors, roll mode and added dice, conditions included). The DC is the ward
 * owner's, as it stands now.
 */
export function incomingGateOffer(input: {
  gameSystemId: string
  held: HeldIncomingGate
  holderActorId: string
  owner: Pick<MovementTarget, 'effectiveRulePolicyOutput' | 'effectiveScalarValues'>
  attacker: Pick<MovementTarget, 'effectiveRulePolicyOutput' | 'targetDerivedFacts'>
}): EncounterIncomingGateOfferDto {
  const { savingThrow } = input.held.payload
  const dc = incomingGateSaveDc(input.gameSystemId, savingThrow, input.owner)
  if (dc === null)
    throw new EncounterValidationError('The owner of the incoming attack gate has no save DC.')
  const savingThrows = savingThrowCapabilityRegistry.require(input.gameSystemId)
  const rows = savingThrows
    .holderSaves(input.attacker)
    .filter(
      (row) =>
        row.abilityDefinitionId === savingThrow.abilityDefinitionId &&
        row.ruleDefinitionId === undefined &&
        row.conditionTypeId === undefined
    )
  const [row] = rows
  if (rows.length !== 1 || row === undefined || !Number.isSafeInteger(row.modifier))
    throw new EncounterValidationError('The attacker has no saving throw for the incoming gate.')
  const addedDice = savingThrows.addedDice(
    input.attacker.targetDerivedFacts.savingThrowAddedDice,
    savingThrow.abilityDefinitionId
  )
  return {
    effectId: input.held.wardId,
    holderActorId: input.holderActorId,
    checkDefinitionId: savingThrow.abilityDefinitionId,
    dc,
    d20: freezeD20Context({
      gameSystemId: input.gameSystemId,
      rollMode: row.rollMode,
      contributors: row.contributors,
      modifier: row.modifier,
      addedDice
    })
  }
}
