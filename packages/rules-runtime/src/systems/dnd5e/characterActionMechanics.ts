import type {
  CharacterActionModelInput,
  CharacterActionModelOutput
} from '@artificer-toolkit/schema/api/characterActionRules'

import { formatAmount, rangeLabel } from '../../rangeLabel.js'
import { dnd5eAttackKind, dnd5eAttackModifierDomain, isDnd5eSpellAttackKind } from './attackKind.js'
import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eAttackingItem,
  dnd5eCharacterActionTarget,
  dnd5eModifierApplies,
  type Dnd5eModifierTarget
} from './modifierApplicability.js'

const ABILITY_MODIFIER_KINDS = ['ABILITY_MODIFIER_BONUS', 'OPTIONAL_ABILITY_MODIFIER_BONUS']

type ActionCandidate = CharacterActionModelInput['candidates'][number]
type SpellEffect = CharacterActionModelInput['spellEffects'][number]['effects'][number]
type RawOutcome = ActionCandidate['mechanicFacts']['outcomes'][number]
type DamageOrHealOutcome = Extract<RawOutcome, { readonly kind: 'DAMAGE' | 'HEAL' }>
type OutcomeValue = DamageOrHealOutcome['values'][number]
type ResolvedMechanic = CharacterActionModelOutput['actionDecisions'][number]['mechanic']
type ResolvedOutcome = ResolvedMechanic['outcomes'][number]
type OutcomeScaling = Extract<ResolvedOutcome, { readonly kind: 'DAMAGE' }>['scaling']
type AbilityCode = NonNullable<ResolvedMechanic['save']>['ability']
type SpellcastingMechanics = {
  readonly attackBonus: number | null
  readonly saveDc: number | null
} | null

type MechanicContext = {
  readonly spellcasting: SpellcastingMechanics
  readonly spellCastLevel: number | null
  readonly spellDamageBonus: number
  /** The spell whose effect is resolved, for spell-scoped modifiers. */
  readonly spellId: string | null
}
type ModifierContribution =
  CharacterActionModelInput['modifierGroups'][number]['contributions'][number]

const ABILITY_ALIASES: Readonly<Record<string, AbilityCode>> = {
  STR: 'STRENGTH',
  STRENGTH: 'STRENGTH',
  DEX: 'DEXTERITY',
  DEXTERITY: 'DEXTERITY',
  CON: 'CONSTITUTION',
  CONSTITUTION: 'CONSTITUTION',
  INT: 'INTELLIGENCE',
  INTELLIGENCE: 'INTELLIGENCE',
  WIS: 'WISDOM',
  WISDOM: 'WISDOM',
  CHA: 'CHARISMA',
  CHARISMA: 'CHARISMA'
}

function clamp(value: number, minimum: number | null, maximum: number | null): number {
  return Math.min(
    Math.max(value, minimum ?? Number.NEGATIVE_INFINITY),
    maximum ?? Number.POSITIVE_INFINITY
  )
}

function formatExpression(value: number | string, bonus: number): string {
  const base = typeof value === 'number' ? formatAmount(value) : value
  if (bonus === 0) return base
  return bonus > 0 ? `${base} + ${formatAmount(bonus)}` : `${base} - ${formatAmount(-bonus)}`
}

/**
 * Words the authored damage amount (kind and multiplier) as the roll expression's own transform,
 * so the sheet rolls it as stated. The bare dice stay in `diceExpression`.
 */
function applyDamageAmountMetadata(
  expression: string,
  amountKind: 'FULL' | 'HALF' | 'DOUBLE' | null,
  multiplier: number | null
): string {
  const factor = (multiplier ?? 1) * (amountKind === 'HALF' ? 0.5 : amountKind === 'DOUBLE' ? 2 : 1)
  if (factor === 1) return expression
  if (factor === 0.5) return `half of ${expression}`
  if (factor === 2) return `double ${expression}`
  if (Number.isInteger(factor) && factor > 2) return `${factor} × (${expression})`
  throw new Error(`Action damage amount factor ${factor} has no roll expression.`)
}

function canonicalAbility(value: string): AbilityCode | null {
  return ABILITY_ALIASES[value] ?? null
}

function abilityFromDefinitionId(input: CharacterActionModelInput, abilityDefinitionId: string) {
  const matches = input.abilityDefinitions.filter(
    (definition) => definition.id === abilityDefinitionId
  )
  const match = matches[0]
  return matches.length === 1 && match !== undefined ? canonicalAbility(match.code) : null
}

function abilityModifier(
  input: CharacterActionModelInput,
  value: string,
  spellcasting: SpellcastingMechanics
): number | null {
  if (value === 'SPELLCASTING') {
    return spellcasting === null || spellcasting.attackBonus === null
      ? null
      : spellcasting.attackBonus - input.proficiencyBonus
  }
  const canonical = canonicalAbility(value)
  const match = input.abilities.find((ability) => canonicalAbility(ability.abilityId) === canonical)
  return canonical === null || match === undefined ? null : match.modifier
}

function skillTotal(input: CharacterActionModelInput, skillId: string): number | null {
  return input.skills.find((skill) => skill.skillId === skillId)?.total ?? null
}

function classLevel(input: CharacterActionModelInput, classId: string | null): number | null {
  return classId === null
    ? null
    : (input.classLevels.find((entry) => entry.classId === classId)?.level ?? null)
}

function targetLevel(
  input: CharacterActionModelInput,
  source: DamageOrHealOutcome['scalingSource'],
  classId: string | null,
  spellCastLevel: number | null
): number | null {
  if (source === 'CHARACTER_LEVEL') return input.totalLevel
  if (source === 'CLASS_LEVEL') return classLevel(input, classId)
  if (source === 'SPELL_CAST_LEVEL') return spellCastLevel
  return null
}

function selectValue(values: readonly OutcomeValue[], level: number | null): OutcomeValue | null {
  const ordered = [...values].sort(
    (left, right) => (left.level ?? 0) - (right.level ?? 0) || left.order - right.order
  )
  if (level === null) return ordered[0] ?? null
  const eligible = ordered.filter((entry) => entry.level !== null && entry.level <= level)
  return eligible.length === 0 ? (ordered[0] ?? null) : eligible[eligible.length - 1]!
}

function resolveOutcomeValue(
  outcome: DamageOrHealOutcome,
  level: number | null
): number | string | null {
  const selected = selectValue(outcome.values, level)
  if (selected === null) return null
  // Half-hit-point dice depend on the source's live hit points, which only a Creature's bound
  // facts select, so a Character action leaves that damage unresolved.
  if ('halfHitPointsDice' in selected && selected.halfHitPointsDice !== null) return null
  if (outcome.valueKind === 'DICE') return selected.dice
  if (outcome.valueKind === 'POOL' && outcome.scalingKind !== 'NONE' && level !== null) {
    // A per-level multiplier rounds down, as authored damage multipliers do (SRD).
    return clamp(
      Math.floor((selected.amount ?? 0) + level * (selected.multiplier ?? 1)),
      selected.minimum,
      selected.maximum
    )
  }
  return selected.amount
}

/** The contributions of one value domain and modifier kinds in an attack's modifier domain. */
function attackModifierContributions(
  input: CharacterActionModelInput,
  attackDomain: string,
  valueDomainCode: 'ATTACK_ROLL' | 'DAMAGE',
  modifierKinds: readonly string[]
): ModifierContribution[] {
  return input.modifierGroups
    .filter((group) =>
      modifierKinds.some(
        (kind) => group.domainKey === `${valueDomainCode}:${kind}|attackDomain=${attackDomain}`
      )
    )
    .flatMap((group) => group.contributions)
}

/** The attack's ability is the one its highest applied ability modifier adds (finesse picks the better). */
function usedAttackAbility(
  input: CharacterActionModelInput,
  attackDomain: string,
  target: Dnd5eModifierTarget
): string | null {
  return (
    attackModifierContributions(input, attackDomain, 'ATTACK_ROLL', ABILITY_MODIFIER_KINDS)
      .filter(
        (contribution) =>
          contribution.state === 'APPLIED' && dnd5eModifierApplies(contribution, target)
      )
      .reduce<ModifierContribution | null>(
        (best, contribution) =>
          contribution.ability !== null && (best === null || contribution.value > best.value)
            ? contribution
            : best,
        null
      )?.ability ?? null
  )
}

export function resolveDnd5eActionMechanic(
  input: CharacterActionModelInput,
  candidate: ActionCandidate | SpellEffect,
  context: MechanicContext
): ResolvedMechanic {
  const { invocation, outcomes } = candidate.mechanicFacts
  const equipment = 'equipment' in candidate ? candidate.equipment : null
  const attackKind = dnd5eAttackKind(invocation.triggerCode)
  const attackDomain = attackKind === null ? null : dnd5eAttackModifierDomain(attackKind)
  const item = dnd5eAttackingItem(equipment)
  const actionTarget: Dnd5eModifierTarget =
    'sourceId' in candidate
      ? dnd5eCharacterActionTarget(candidate)
      : { ...DND5E_CHARACTER_WIDE_TARGET, spellId: context.spellId }
  const target: Dnd5eModifierTarget = {
    ...actionTarget,
    attackAbility:
      attackDomain === null ? null : usedAttackAbility(input, attackDomain, actionTarget)
  }
  const adjustment =
    equipment === null
      ? null
      : (input.itemAdjustments.find((entry) => entry.itemInstanceId === equipment.itemInstanceId) ??
        null)
  /** Contributions of the attack's modifier domain and kinds that apply to this action. */
  const applicable = (
    valueDomainCode: 'ATTACK_ROLL' | 'DAMAGE',
    modifierKinds: readonly string[],
    applies: (contribution: ModifierContribution) => boolean = (contribution) =>
      dnd5eModifierApplies(contribution, target)
  ): ModifierContribution[] =>
    attackDomain === null
      ? []
      : attackModifierContributions(input, attackDomain, valueDomainCode, modifierKinds).filter(
          applies
        )
  const appliedTotal = (contributions: readonly ModifierContribution[]): number =>
    contributions
      .filter((contribution) => contribution.state === 'APPLIED')
      .reduce((sum, contribution) => sum + contribution.value, 0)
  const numericKinds = ['BONUS', 'PENALTY', ...ABILITY_MODIFIER_KINDS]
  const resolveAttackBonus = (): number | null => {
    if (attackKind === null) return null
    if (isDnd5eSpellAttackKind(attackKind)) {
      if (context.spellcasting?.attackBonus == null) return null
      // Spellcasting already counts Character-wide spell attack modifiers; add the spell's own.
      return (
        context.spellcasting.attackBonus +
        appliedTotal(
          applicable(
            'ATTACK_ROLL',
            numericKinds,
            (contribution) =>
              dnd5eModifierApplies(contribution, target) &&
              !dnd5eModifierApplies(contribution, DND5E_CHARACTER_WIDE_TARGET)
          )
        )
      )
    }
    const abilities = applicable('ATTACK_ROLL', ABILITY_MODIFIER_KINDS)
    if (abilities.length === 0) return null
    if (adjustment?.attackOverride != null) return adjustment.attackOverride
    const proficiency =
      attackKind === 'UNARMED'
        ? 1
        : item === null
          ? 0
          : input.proficiencies
              .filter(
                (proficiency) =>
                  (proficiency.kind === 'EQUIPMENT' &&
                    (proficiency.subjectId === '*' ||
                      item.equipmentIds.includes(proficiency.subjectId))) ||
                  (proficiency.kind === 'EQUIPMENT_PROPERTY' &&
                    (proficiency.category === null || proficiency.category === item.category) &&
                    (proficiency.subjectId === '*' ||
                      item.properties.includes(proficiency.subjectId)))
              )
              .reduce(
                (maximum, proficiencyEntry) =>
                  Math.max(
                    maximum,
                    proficiencyEntry.scaling === 'DOUBLE'
                      ? 2
                      : proficiencyEntry.scaling === 'FULL'
                        ? 1
                        : 0.5
                  ),
                0
              )
    return (
      appliedTotal(abilities) +
      Math.floor(input.proficiencyBonus * proficiency) +
      appliedTotal(applicable('ATTACK_ROLL', ['BONUS', 'PENALTY'])) +
      (adjustment?.attackBonus ?? 0)
    )
  }
  const resolveAttackRollMode = (): ResolvedMechanic['attackRollMode'] => {
    if (attackKind === null) return null
    // Suppressed duplicate grants still count as roll-mode evidence.
    const advantage = applicable('ATTACK_ROLL', ['ADVANTAGE']).length > 0
    const disadvantage = applicable('ATTACK_ROLL', ['DISADVANTAGE']).length > 0
    return advantage === disadvantage ? 'NORMAL' : advantage ? 'ADVANTAGE' : 'DISADVANTAGE'
  }
  /** Weapon and spell attacks add their damage modifiers (ability, +N, Dueling) to the first
   * damage roll, together with the item's manual damage adjustment. */
  const attackDamageBonus =
    attackKind === null
      ? 0
      : appliedTotal(applicable('DAMAGE', numericKinds)) + (adjustment?.damageBonus ?? 0)
  const firstDamageOutcome = outcomes.find((outcome) => outcome.kind === 'DAMAGE')
  const resolveSave = (): ResolvedMechanic['save'] => {
    const savingThrow = invocation.savingThrow
    if (savingThrow === null) return null
    const ability = abilityFromDefinitionId(input, savingThrow.abilityDefinitionId)
    if (ability === null) return null
    if (savingThrow.dcMethod === 'SOURCE_SAVE_DC')
      return { ability, dc: context.spellcasting?.saveDc ?? null }
    if (savingThrow.dcMethod === 'FIXED_DC') return { ability, dc: savingThrow.baseDc }
    const bonuses = savingThrow.bonuses.map((bonus) => {
      if (bonus.bonusKind === 'STATIC_BONUS') return bonus.amount
      if (bonus.bonusKind === 'PROFICIENCY_BONUS') return input.proficiencyBonus
      const bonusAbility = abilityFromDefinitionId(input, bonus.abilityDefinitionId)
      return bonusAbility === null
        ? null
        : abilityModifier(input, bonusAbility, context.spellcasting)
    })
    let dc = Number(savingThrow.baseDc)
    for (const bonus of bonuses) {
      if (bonus === null) return { ability, dc: null }
      dc += bonus
    }
    return { ability, dc }
  }
  const resolveOutcome = (outcome: RawOutcome): ResolvedOutcome => {
    if (outcome.kind === 'CONDITION' || outcome.kind === 'EFFECT') return outcome
    const level =
      outcome.scalingKind === 'NONE'
        ? null
        : targetLevel(input, outcome.scalingSource, outcome.classId, context.spellCastLevel)
    const value = resolveOutcomeValue(outcome, level)
    if (value === null)
      return {
        kind: 'EFFECT',
        pathCode: outcome.pathCode,
        effectKind: outcome.kind,
        label: outcome.kind === 'DAMAGE' ? outcome.label : 'Healing effect'
      }
    const bonus = outcome.bonuses.reduce(
      (sum, entry) => {
        const value =
          entry.bonusKind === 'ABILITY_BONUS'
            ? abilityModifier(input, entry.ability, context.spellcasting)
            : entry.bonusKind === 'SKILL_BONUS'
              ? skillTotal(input, entry.skillId)
              : entry.bonusKind === 'CLASS_LEVEL'
                ? classLevel(input, entry.classId)
                : input.proficiencyBonus
        return (
          sum + (value === null ? 0 : clamp(value * (entry.multiplier ?? 1), entry.min, entry.max))
        )
      },
      outcome.kind === 'DAMAGE'
        ? context.spellDamageBonus + (outcome === firstDamageOutcome ? attackDamageBonus : 0)
        : 0
    )
    const scaling: OutcomeScaling = []
    if (
      outcome.scalingSource === 'SPELL_CAST_LEVEL' &&
      context.spellCastLevel === null &&
      (outcome.kind === 'DAMAGE' || outcome.scalingKind !== 'NONE')
    ) {
      for (const entry of outcome.values) {
        if (entry.level === null) continue
        const scalingValue = resolveOutcomeValue(outcome, entry.level)
        if (scalingValue === null) throw new Error('Action outcome scaling value is unresolved.')
        const scalingExpression = formatExpression(scalingValue, bonus)
        scaling.push({
          level: entry.level,
          expression:
            outcome.kind === 'DAMAGE'
              ? applyDamageAmountMetadata(
                  scalingExpression,
                  outcome.amountKind,
                  outcome.amountMultiplier
                )
              : scalingExpression
        })
      }
    }
    const expression = formatExpression(value, bonus)
    return outcome.kind === 'DAMAGE'
      ? {
          kind: 'DAMAGE',
          ...(outcome.outcomeId === undefined ? {} : { outcomeId: outcome.outcomeId }),
          pathCode: outcome.pathCode,
          expression: applyDamageAmountMetadata(
            expression,
            outcome.amountKind,
            outcome.amountMultiplier
          ),
          diceExpression: expression,
          damageTypeId: outcome.damageTypeId,
          scaling
        }
      : {
          kind: 'HEAL',
          ...(outcome.outcomeId === undefined ? {} : { outcomeId: outcome.outcomeId }),
          pathCode: outcome.pathCode,
          expression,
          temporary: outcome.temporary,
          scaling
        }
  }
  return {
    effectId: candidate.effectId,
    trigger: invocation.triggerCode,
    activation:
      invocation.activation !== null &&
      invocation.activation.amount !== null &&
      Number.isInteger(invocation.activation.amount) &&
      invocation.activation.amount > 0
        ? {
            kind: invocation.activation.code,
            amount: invocation.activation.amount
          }
        : null,
    rangeLabel: rangeLabel(invocation.range),
    attackKind,
    attackBonus: resolveAttackBonus(),
    attackRollMode: resolveAttackRollMode(),
    save: resolveSave(),
    outcomes: outcomes.map(resolveOutcome)
  }
}
