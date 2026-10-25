import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import {
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import {
  buildSkillSubjectAliasMap,
  buildModifierDomainKey,
  normalizeAbilityKey,
  resolveAbilityAlias,
  resolveSkillAlias,
  resolveSystemSkillAbilities
} from '@artificer-toolkit/shared/character'

import { abilityScoreCapabilityRegistry } from '../platformPolicyModules.js'

type DerivedFacts = CharacterRulePolicyInput['derivedBaseFacts']
type NumericBonus = DerivedFacts['abilities'][number]['bonuses'][number]

function manualSource(adjustmentId: string) {
  return { kind: 'MANUAL_ADJUSTMENT' as const, adjustmentId }
}

const NUMERIC_MODIFIER_KINDS = [
  'ABILITY_MODIFIER_BONUS',
  'BONUS',
  'OPTIONAL_ABILITY_MODIFIER_BONUS',
  'PENALTY',
  'SET_VALUE'
] as const

function modifierBonuses(
  valueDomainCode: string,
  domain: Record<string, string> = {},
  includeSetValue = true
): NumericBonus[] {
  return NUMERIC_MODIFIER_KINDS.flatMap((modifierKind) => {
    if (!includeSetValue && modifierKind === 'SET_VALUE') return []
    const domainKey = buildModifierDomainKey(valueDomainCode, modifierKind, domain)
    return [
      {
        kind: 'MODIFIER_GROUP' as const,
        sourceId: domainKey,
        domainKey,
        operation: modifierKind === 'SET_VALUE' ? ('SET' as const) : ('ADD' as const)
      }
    ]
  })
}

function canonicalAbility(abilityId: string): string {
  return resolveAbilityAlias(abilityId) ?? abilityId
}

function abilityModifierBonuses(
  valueDomainCode: string,
  abilityId: string,
  includeSetValue = true
): NumericBonus[] {
  const aliases = [abilityId, canonicalAbility(abilityId), normalizeAbilityKey(abilityId)].filter(
    (ability): ability is string => ability !== undefined
  )
  return [...new Set(aliases)].flatMap((ability) =>
    modifierBonuses(valueDomainCode, { ability }, includeSetValue)
  )
}

function abilityMatches(left: string | undefined, right: string): boolean {
  return left !== undefined && canonicalAbility(left) === canonicalAbility(right)
}

/** The snapshot's key for an ability, matched through its aliases; the ability itself when absent. */
export function abilityRecordKey(
  abilities: CharacterBuildSnapshot['abilities'],
  abilityId: string
): string {
  return (
    Object.keys(abilities).find((candidate) => abilityMatches(candidate, abilityId)) ?? abilityId
  )
}

/** The snapshot's index of an ability, matched through its aliases; null when absent. */
export function abilityRecordIndex(
  abilities: CharacterBuildSnapshot['abilities'],
  abilityId: string
): number | null {
  const index = Object.keys(abilities).findIndex((candidate) =>
    abilityMatches(candidate, abilityId)
  )
  return index < 0 ? null : index
}

function fixedBonus(sourceId: string, value: number): NumericBonus {
  return {
    kind: 'FIXED',
    sourceId,
    source: manualSource(sourceId),
    value,
    operation: 'ADD'
  }
}

export function buildCharacterDerivedRuleFacts(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry
): DerivedFacts {
  const adjustments = snapshot.adjustments ?? []
  const skillAliases = buildSkillSubjectAliasMap(registry.system)
  const abilities: DerivedFacts['abilities'] = Object.entries(snapshot.abilities).map(
    ([abilityId, baseScore]) => {
      const abilityAdjustments = adjustments.filter(
        (adjustment) =>
          adjustment.family === 'ABILITY' && abilityMatches(adjustment.ability, abilityId)
      )
      const manualBonus = abilityAdjustments.find(
        (adjustment) => adjustment.field === 'OTHER_MODIFIER'
      )
      const override = abilityAdjustments.find(
        (adjustment) => adjustment.field === 'SCORE_OVERRIDE'
      )

      return {
        abilityId,
        baseScore,
        bonuses: [
          ...abilityModifierBonuses('ABILITY_SCORE', abilityId),
          ...(manualBonus && typeof manualBonus.value === 'number'
            ? [fixedBonus(manualBonus.id, manualBonus.value)]
            : [])
        ],
        scoreOverride:
          override && typeof override.value === 'number'
            ? {
                sourceId: override.id,
                source: manualSource(override.id),
                value: override.value
              }
            : null
      }
    }
  )

  const savingThrows: DerivedFacts['savingThrows'] = Object.keys(snapshot.abilities).map(
    (abilityId) => {
      const canonicalId = canonicalAbility(abilityId)
      const targetAdjustments = adjustments.filter(
        (adjustment) =>
          adjustment.family === 'SAVING_THROW' && abilityMatches(adjustment.ability, abilityId)
      )
      const proficiencyOverride = targetAdjustments.find(
        (adjustment) => adjustment.field === 'PROFICIENCY_OVERRIDE'
      )
      const totalOverride = targetAdjustments.find(
        (adjustment) => adjustment.field === 'TOTAL_OVERRIDE'
      )
      const manualBonuses = targetAdjustments.filter(
        (adjustment) => adjustment.field === 'MAGIC_BONUS' || adjustment.field === 'MISC_BONUS'
      )

      return {
        abilityId,
        abilityIndex: abilityRecordIndex(snapshot.abilities, abilityId),
        proficiencySubjectId: canonicalId,
        proficiencyOverride: proficiencyOverride
          ? {
              sourceId: proficiencyOverride.id,
              source: manualSource(proficiencyOverride.id),
              value: proficiencyOverride.value
            }
          : null,
        bonuses: [
          {
            kind: 'PROFICIENCY' as const,
            sourceId: `saving-throw-proficiency:${canonicalId}`,
            operation: 'ADD' as const
          },
          ...abilityModifierBonuses('SAVING_THROW_MODIFIER', abilityId, false),
          ...manualBonuses.flatMap((adjustment) =>
            typeof adjustment.value === 'number'
              ? [fixedBonus(adjustment.id, adjustment.value)]
              : []
          )
        ],
        totalOverride:
          totalOverride && typeof totalOverride.value === 'number'
            ? {
                sourceId: totalOverride.id,
                source: manualSource(totalOverride.id),
                value: totalOverride.value
              }
            : null
      }
    }
  )

  const systemSkills = registry.system
    ? resolveSystemSkillAbilities(registry.system).map(
        ({ canonicalId, abilityCode }) => [canonicalId, abilityCode] as const
      )
    : []

  const skills: DerivedFacts['skills'] = systemSkills.map(([skillId, defaultAbilityId]) => {
    const skillAdjustments = adjustments.filter(
      (adjustment) =>
        (adjustment.family === 'SKILL' || adjustment.family === 'PASSIVE') &&
        resolveSkillAlias(adjustment.skillId, skillAliases) === skillId
    )
    const governingOverride = skillAdjustments.find(
      (adjustment) =>
        adjustment.family === 'SKILL' && adjustment.field === 'GOVERNING_ABILITY_OVERRIDE'
    )
    const proficiencyOverride = skillAdjustments.find(
      (adjustment) => adjustment.family === 'SKILL' && adjustment.field === 'PROFICIENCY_OVERRIDE'
    )
    const totalOverride = skillAdjustments.find(
      (adjustment) => adjustment.family === 'SKILL' && adjustment.field === 'TOTAL_OVERRIDE'
    )
    const passiveOverride = skillAdjustments.find(
      (adjustment) => adjustment.family === 'PASSIVE' && adjustment.field === 'TOTAL_OVERRIDE'
    )
    const manualBonuses = skillAdjustments.filter(
      (adjustment) =>
        adjustment.family === 'SKILL' &&
        (adjustment.field === 'MAGIC_BONUS' || adjustment.field === 'MISC_BONUS')
    )

    return {
      skillId,
      governingAbilityId: defaultAbilityId,
      governingAbilityIndex: abilityRecordIndex(snapshot.abilities, defaultAbilityId),
      governingAbilityOverride: governingOverride
        ? {
            sourceId: governingOverride.id,
            value: governingOverride.value,
            abilityIndex: abilityRecordIndex(snapshot.abilities, governingOverride.value)
          }
        : null,
      proficiencySubjectIds: [
        ...[...skillAliases.entries()]
          .filter(([, canonicalSkillId]) => canonicalSkillId === skillId)
          .map(([alias]) => alias)
      ],
      proficiencyOverride: proficiencyOverride
        ? {
            sourceId: proficiencyOverride.id,
            source: manualSource(proficiencyOverride.id),
            value: proficiencyOverride.value
          }
        : null,
      bonuses: [
        {
          kind: 'PROFICIENCY' as const,
          sourceId: `skill-proficiency:${skillId}`,
          operation: 'ADD' as const
        },
        ...modifierBonuses('SKILL_MODIFIER', { skillId }, false),
        ...manualBonuses.flatMap((adjustment) =>
          typeof adjustment.value === 'number' ? [fixedBonus(adjustment.id, adjustment.value)] : []
        )
      ],
      totalOverride:
        totalOverride && typeof totalOverride.value === 'number'
          ? {
              sourceId: totalOverride.id,
              source: manualSource(totalOverride.id),
              value: totalOverride.value
            }
          : null,
      passiveOverride:
        passiveOverride && typeof passiveOverride.value === 'number'
          ? {
              sourceId: passiveOverride.id,
              source: manualSource(passiveOverride.id),
              value: passiveOverride.value
            }
          : null
    }
  })

  const spellcastingAbility = snapshot.classes.flatMap(({ classId }) => {
    const abilityId = registry.classes[classId]?.spellcasting?.ability
    return abilityId ? [abilityRecordKey(snapshot.abilities, abilityId)] : []
  })[0]
  const { initiative } = abilityScoreCapabilityRegistry.require(
    snapshot.systemId
  ).derivedStatisticAbilityCodes

  return {
    abilities,
    savingThrows,
    skills,
    initiative: {
      abilityId: abilityRecordKey(snapshot.abilities, initiative),
      abilityIndex: abilityRecordIndex(snapshot.abilities, initiative),
      bonuses: modifierBonuses('INITIATIVE', {}, false)
    },
    spellcasting: spellcastingAbility
      ? {
          abilityId: spellcastingAbility,
          abilityIndex: abilityRecordIndex(snapshot.abilities, spellcastingAbility),
          saveDcBonuses: modifierBonuses('SAVE_DC', {}, false),
          attackBonuses: modifierBonuses('ATTACK_ROLL', { attackDomain: 'SPELL' }, false)
        }
      : null
  }
}
