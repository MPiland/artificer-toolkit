import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema,
  type CharacterRulePolicyInput,
  type CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

import { evaluateDnd5e2014CharacterActions } from './characterActions.js'
import { evaluateDnd5eCharacterCompanionMechanics } from './characterCompanionMechanics.js'
import { evaluateDnd5eCharacterDefenses } from './characterDefenses.js'
import { evaluateDnd5eCharacterDerivedStats } from './characterDerivedStats.js'
import {
  evaluateDnd5eCharacterEligibility,
  type CharacterResolvedProficiency
} from './characterEligibility.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { evaluateDnd5e2014CharacterGrantFold } from './characterGrantFold.js'
import { evaluateDnd5eCharacterItemMechanics } from './characterItemMechanics.js'
import { evaluateDnd5eCharacterModifiers } from './characterModifiers.js'
import { evaluateDnd5eCharacterMovementAndSenses } from './characterMovementAndSenses.js'
import { evaluateDnd5eCharacterResources } from './characterResources.js'
import { evaluateDnd5eCharacterRollModes } from './characterRollModes.js'
import { evaluateDnd5eCharacterSpellAccess } from './characterSpellAccess.js'
import { evaluateDnd5eCharacterSpellMechanics } from './characterSpellMechanics.js'
import { evaluateDnd5eCharacterSpellPreparation } from './characterSpellPreparation.js'
import { evaluateDnd5eCharacterSpellSlots } from './characterSpellSlots.js'
import { evaluateDnd5eCharacterVitals } from './characterVitals.js'
import { dnd5eCharacterProgressionCapabilityAdapter } from './hitPointRules.js'
import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eFoldedModifierApplicability,
  dnd5eModifierApplies
} from './modifierApplicability.js'

/** Pure System-owned Character policy. The generic Rules Kernel remains scalar-only. */
export function evaluateDnd5e2014CharacterPolicy(
  candidate: CharacterRulePolicyInput
): CharacterRulePolicyOutput {
  const input = characterRulePolicyInputSchema.parse(candidate)
  const spells = evaluateDnd5eCharacterSpellAccess(input)
  const grantFold = evaluateDnd5e2014CharacterGrantFold({
    ...input.grantFoldFacts,
    upstreamSpellIds: [...new Set(spells.spellAccess.map((access) => access.spellId))]
  })
  const modifierGroups = evaluateDnd5eCharacterModifiers(input, grantFold)
  const derived = evaluateDnd5eCharacterDerivedStats(input, grantFold, modifierGroups)
  const { hitPointProgression, ...vitals } = evaluateDnd5eCharacterVitals(
    input,
    grantFold,
    modifierGroups,
    derived.abilities
  )
  const rolls = evaluateDnd5eCharacterRollModes(input, grantFold, modifierGroups)
  const proficiencies: CharacterResolvedProficiency[] = [
    ...grantFold.proficiencies,
    ...input.proficiencyFacts.manualAdditions.map((addition, index) => ({
      kind: addition.proficiencyKind === 'LANGUAGE' ? 'LANGUAGE' : 'EQUIPMENT',
      subjectId: addition.targetId,
      matchId: addition.targetId,
      scaling: 'FULL' as const,
      source: addition.source,
      acceptedProficiencyIndex: grantFold.proficiencies.length + index
    }))
  ]
  const spellSlots = evaluateDnd5eCharacterSpellSlots(input)
  const resources = evaluateDnd5eCharacterResources(input, grantFold, derived, spells.spellAccess)
  const spellMechanics = evaluateDnd5eCharacterSpellMechanics(input, spells.spellAccess, derived)
  const itemMechanics = evaluateDnd5eCharacterItemMechanics(input)
  const actions = evaluateDnd5e2014CharacterActions({
    candidates: input.actionCandidates,
    abilityDefinitions: input.abilityDefinitions,
    spellCandidates: input.spellCastCandidates,
    spellSlots: [
      ...spellSlots.maxByLevel.map((slot) => ({
        slotKey: `STANDARD:${slot.spellLevel}`,
        label: `STANDARD:${slot.spellLevel}`,
        level: slot.spellLevel,
        max: slot.slotCount,
        remaining: slot.remaining
      })),
      ...spellSlots.slotPools.map((pool) => ({
        slotKey: pool.poolCode,
        label: pool.poolCode,
        level: pool.level,
        max: pool.slots,
        remaining: pool.remaining
      }))
    ],
    spellEffects: input.spellActionFacts,
    spellcastingLocked: modifierGroups.some(
      (group) =>
        group.valueDomainCode === 'SPELLCASTING_LOCK' &&
        group.contributions.some((contribution) =>
          dnd5eModifierApplies(
            dnd5eFoldedModifierApplicability(grantFold, contribution),
            DND5E_CHARACTER_WIDE_TARGET
          )
        )
    ),
    spellMechanics: spellMechanics.map((mechanics) => ({
      source: mechanics.source,
      attackBonus: mechanics.attackBonus ?? null,
      saveDc: mechanics.saveDC ?? null,
      damageBonus: mechanics.damageBonus
    })),
    activeSourceIds: grantFold.activeSourceIds,
    activeEquipmentInstanceIds: grantFold.activeEquipmentInstanceIds,
    resources: resources.resources,
    proficiencies: proficiencies.map((proficiency) => ({
      kind: proficiency.kind,
      subjectId: proficiency.subjectId,
      scaling: proficiency.scaling,
      category: proficiency.category ?? null
    })),
    modifierGroups: modifierGroups.map((group) => ({
      domainKey: group.domainKey,
      contributions: group.contributions.map((contribution) => ({
        ...dnd5eFoldedModifierApplicability(grantFold, contribution),
        value: contribution.value,
        ability: contribution.ability ?? null,
        state: contribution.state
      }))
    })),
    itemAdjustments: itemMechanics.map((item) => ({
      itemInstanceId: item.itemInstanceId,
      attackBonus: item.calculations.attackBonus.override === null ? item.attackBonus : 0,
      attackOverride: item.calculations.attackBonus.override?.value ?? null,
      damageBonus: item.damageBonus
    })),
    totalLevel: input.totalLevel,
    classLevels: input.grantFoldFacts.base.classes.map(({ classId, level }) => ({
      classId,
      level
    })),
    proficiencyBonus: derived.proficiencyBonus.effective,
    abilities: derived.abilities.map((ability) => ({
      abilityId: ability.abilityId,
      modifier: ability.modifier.effective
    })),
    skills: derived.skills.map((skill) => ({
      skillId: skill.skillId,
      total: skill.total.effective
    })),
    spellcasting:
      derived.spellcasting === null
        ? null
        : {
            saveDc: derived.spellcasting.saveDc.effective,
            attackBonus: derived.spellcasting.attackBonus.effective
          }
  })
  const recoveredHitDice = (total: number) => (total === 0 ? 0 : Math.max(1, Math.floor(total / 2)))
  return characterRulePolicyOutputSchema.parse({
    grantFold,
    proficiencies: proficiencies.map(({ kind, subjectId, scaling, source, category, grantId }) => ({
      kind,
      subjectId,
      scaling,
      source,
      ...(category === undefined ? {} : { category }),
      ...(grantId === undefined ? {} : { grantId })
    })),
    proficiencyBonus: derived.proficiencyBonus.effective,
    abilityModifiers: derived.abilities.map((ability) => ({
      ability: ability.abilityId,
      value: ability.modifier.effective
    })),
    passiveChecks: derived.skills.map((skill) => ({
      checkId: skill.skillId,
      value: skill.passive.effective
    })),
    modifierGroups: modifierGroups.map(({ domainKey, effective, contributions }) => ({
      domainKey,
      effective,
      contributions
    })),
    ...rolls,
    ...evaluateDnd5eCharacterDefenses(input, grantFold),
    ...evaluateDnd5eCharacterMovementAndSenses(input, grantFold, modifierGroups),
    attacksPerAttackAction: Math.max(
      1,
      ...modifierGroups
        .filter(
          (group) =>
            group.valueDomainCode === 'ATTACKS_PER_ATTACK_ACTION' &&
            group.modifierKind === 'SET_VALUE'
        )
        .flatMap((group) => group.contributions)
        .filter((contribution) =>
          dnd5eModifierApplies(
            dnd5eFoldedModifierApplicability(grantFold, contribution),
            DND5E_CHARACTER_WIDE_TARGET
          )
        )
        .map((contribution) => contribution.value)
    ),
    hitPointProgression,
    derivedStats: { ...derived, ...vitals },
    ...spells,
    spellMechanics,
    itemMechanics,
    companions: evaluateDnd5eCharacterCompanionMechanics(input),
    spellPreparation: evaluateDnd5eCharacterSpellPreparation(input, derived),
    spellSlots,
    ...resources,
    ...actions,
    eligibilityFacets: evaluateDnd5eCharacterEligibility(
      input,
      grantFold,
      derived,
      proficiencies,
      spells.spellAccess
    ),
    rest: {
      hitDieConstitutionModifier:
        derived.abilities.find(
          (ability) =>
            ability.abilityId ===
            dnd5eCharacterProgressionCapabilityAdapter.derivedStatisticAbilityCodes.hitPoints
        )?.modifier.effective ?? 0,
      hitDiceRecoveredAfterLongRest: recoveredHitDice(input.rest.totalHitDice),
      currentExhaustion: input.rest.currentExhaustion,
      minimumExhaustion: 0,
      maximumExhaustion: 6,
      exhaustionAfterLongRest: Math.max(0, input.rest.currentExhaustion - 1),
      attunementSlotLimit: input.rest.attunementSlotOverride ?? 3,
      companionHitDiceRecoveredAfterLongRest: (input.rest.companions ?? []).map((companion) => ({
        companionInstanceId: companion.companionInstanceId,
        recovered: recoveredHitDice(companion.totalHitDice)
      }))
    }
  })
}

export const dnd5eCharacterPolicyRegistration = {
  gameSystemId: DND5E_SYSTEM_ID,
  evaluateCharacterPolicy: evaluateDnd5e2014CharacterPolicy
} as const
