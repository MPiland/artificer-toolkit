import type {
  CharacterActionModelInput,
  CharacterActionModelOutput
} from '@artificer-toolkit/schema/api/characterActionRules'

import { formatAmount, rangeLabel } from '../../rangeLabel.js'
import { selectScalingRow } from '../../scalingRowSelection.js'
import { resolveSavingThrowDc } from './savingThrowDc.js'
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
  /** The ammunition stack this attack fires, whose modifiers apply to it alone. */
  readonly ammunition?: { itemInstanceId: string; equipmentId: string }
}
type ModifierContribution =
  CharacterActionModelInput['modifierGroups'][number]['contributions'][number]

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

/** The code when the Character has that ability; null for any other reference. */
function characterAbilityCode(input: CharacterActionModelInput, value: string): string | null {
  return input.abilities.some((ability) => ability.abilityId === value) ? value : null
}

function abilityFromDefinitionId(input: CharacterActionModelInput, abilityDefinitionId: string) {
  const matches = input.abilityDefinitions.filter(
    (definition) => definition.id === abilityDefinitionId
  )
  const match = matches[0]
  return matches.length === 1 && match !== undefined
    ? characterAbilityCode(input, match.code)
    : null
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
  return input.abilities.find((ability) => ability.abilityId === value)?.modifier ?? null
}

function skillTotal(input: CharacterActionModelInput, skillId: string): number | null {
  return input.skills.find((skill) => skill.skillId === skillId)?.total ?? null
}

function classLevel(input: CharacterActionModelInput, classId: string | null): number | null {
  return classId === null
    ? null
    : (input.classLevels.find((entry) => entry.classId === classId)?.level ?? null)
}

/** A class level divided by the authored divisor, rounded as authored. */
function dividedClassLevel(level: number, divisor: number, rounding: 'UP' | 'DOWN' | 'NEAREST'): number {
  const quotient = level / divisor
  return rounding === 'UP'
    ? Math.ceil(quotient)
    : rounding === 'DOWN'
      ? Math.floor(quotient)
      : Math.round(quotient)
}

/**
 * A spell slot exchange with its class-level budget and charge pool resolved. The pool modes need
 * exactly one resolved pool carrying the charge; otherwise the outcome stays a plain effect the
 * Sheet cannot run.
 */
function resolveSpellSlotExchange(
  input: CharacterActionModelInput,
  outcome: Extract<RawOutcome, { readonly kind: 'SPELL_SLOT_EXCHANGE' }>
): ResolvedOutcome {
  const effect = {
    kind: 'EFFECT' as const,
    pathCode: outcome.pathCode,
    effectKind: outcome.exchange.effectKind,
    label: outcome.label
  }
  const { exchange } = outcome
  if (exchange.mode === 'RECOVER_SLOTS') {
    const level = classLevel(input, exchange.levelBudget.classId)
    return level === null
      ? effect
      : {
          ...effect,
          spellSlotExchange: {
            mode: exchange.mode,
            levelBudget: dividedClassLevel(
              level,
              exchange.levelBudget.divisor,
              exchange.levelBudget.rounding
            ),
            maximumSlotLevel: exchange.maximumSlotLevel
          }
        }
  }
  const pools = input.resources.filter(
    (resource) => resource.chargeId === exchange.chargeId && resource.state === 'RESOLVED'
  )
  const [pool] = pools
  if (pools.length !== 1 || !pool) return effect
  return {
    ...effect,
    spellSlotExchange:
      exchange.mode === 'SLOT_TO_RESOURCE'
        ? {
            mode: exchange.mode,
            resourcePoolId: pool.poolId,
            maximumSlotLevel: exchange.maximumSlotLevel ?? null
          }
        : {
            mode: exchange.mode,
            resourcePoolId: pool.poolId,
            costs: exchange.costs.map((entry) => ({ ...entry }))
          }
  }
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
  // Below every row, or without a level, the Sheet shows the lowest row.
  return (
    (level === null ? null : selectScalingRow(values, level)) ??
    values.reduce<OutcomeValue | null>(
      (lowest, entry) =>
        lowest === null ||
        (entry.level ?? 0) < (lowest.level ?? 0) ||
        ((entry.level ?? 0) === (lowest.level ?? 0) && entry.order < lowest.order)
          ? entry
          : lowest,
      null
    )
  )
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

/**
 * The contributions of one value domain and modifier kinds in an attack's modifier domain, plus
 * those scoped to the ability the attack is made with (Weakening Breath's Strength-based attacks).
 */
function attackModifierContributions(
  modifierGroups: CharacterActionModelInput['modifierGroups'],
  attackDomain: string,
  valueDomainCode: 'ATTACK_ROLL' | 'DAMAGE',
  modifierKinds: readonly string[],
  attackAbility: string | null = null,
  influence: string | null = null
): ModifierContribution[] {
  // Domain keys sort their params, so a roll influence's comes last.
  const influenceParam = influence === null ? '' : `|influence=${influence}`
  return modifierGroups
    .filter((group) =>
      modifierKinds.some((kind) => {
        const key = `${valueDomainCode}:${kind}`
        return (
          group.domainKey === `${key}|attackDomain=${attackDomain}${influenceParam}` ||
          (attackAbility !== null &&
            group.domainKey ===
              `${key}|ability=${attackAbility}|attackDomain=${attackDomain}${influenceParam}`)
        )
      })
    )
    .flatMap((group) => group.contributions)
}

/**
 * The applied bonuses and penalties an attack's modifier domain adds to its roll or its damage for
 * one target. Character and Creature attacks share it (ATTACK-6.3).
 */
export function dnd5eAttackBonusTotal(
  modifierGroups: CharacterActionModelInput['modifierGroups'],
  attackDomain: string,
  valueDomainCode: 'ATTACK_ROLL' | 'DAMAGE',
  target: Dnd5eModifierTarget
): number {
  return attackModifierContributions(
    modifierGroups,
    attackDomain,
    valueDomainCode,
    ['BONUS', 'PENALTY'],
    target.attackAbility
  )
    .filter(
      (contribution) =>
        contribution.state === 'APPLIED' && dnd5eModifierApplies(contribution, target)
    )
    .reduce((sum, contribution) => sum + contribution.value, 0)
}

/**
 * The attack's ability is the one its highest applied ability modifier adds (finesse picks the better).
 * Only the attacking item's own modifiers name it; a Character-wide ability bonus from another source
 * adds to the roll without changing which ability the attack uses.
 */
function usedAttackAbility(
  input: CharacterActionModelInput,
  attackDomain: string,
  target: Dnd5eModifierTarget
): string | null {
  return (
    attackModifierContributions(
      input.modifierGroups,
      attackDomain,
      'ATTACK_ROLL',
      ABILITY_MODIFIER_KINDS
    )
      .filter(
        (contribution) =>
          contribution.state === 'APPLIED' &&
          contribution.scope === 'SOURCE' &&
          dnd5eModifierApplies(contribution, target)
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
      ? dnd5eCharacterActionTarget(candidate, context.ammunition)
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
      dnd5eModifierApplies(contribution, target),
    influence: string | null = null
  ): ModifierContribution[] =>
    attackDomain === null
      ? []
      : attackModifierContributions(
          input.modifierGroups,
          attackDomain,
          valueDomainCode,
          modifierKinds,
          target.attackAbility,
          influence
        ).filter(applies)
  const appliedTotal = (contributions: readonly ModifierContribution[]): number =>
    contributions
      .filter((contribution) => contribution.state === 'APPLIED')
      .reduce((sum, contribution) => sum + contribution.value, 0)
  const numericKinds = ['BONUS', 'PENALTY', ...ABILITY_MODIFIER_KINDS]
  /**
   * An attack adds one ability modifier of its own: the attacking item's and any bound to it
   * (Shillelagh's spellcasting ability "instead of Strength") are alternatives, so only the one the
   * attack uses counts. A Character-wide ability bonus from another source adds on top.
   */
  const abilityTotal = (valueDomainCode: 'ATTACK_ROLL' | 'DAMAGE'): number => {
    const contributions = applicable(valueDomainCode, ABILITY_MODIFIER_KINDS).filter(
      (contribution) => contribution.state === 'APPLIED'
    )
    const own = contributions.filter((contribution) => contribution.scope === 'SOURCE')
    const used =
      own.find((contribution) => contribution.ability === target.attackAbility) ??
      own.reduce<ModifierContribution | null>(
        (best, contribution) =>
          best === null || contribution.value > best.value ? contribution : best,
        null
      )
    return (
      appliedTotal(contributions.filter((contribution) => contribution.scope !== 'SOURCE')) +
      (used?.value ?? 0)
    )
  }
  const resolveAttackBonus = (): number | null => {
    if (attackKind === null || attackDomain === null) return null
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
      abilityTotal('ATTACK_ROLL') +
      Math.floor(input.proficiencyBonus * proficiency) +
      dnd5eAttackBonusTotal(input.modifierGroups, attackDomain, 'ATTACK_ROLL', target) +
      (adjustment?.attackBonus ?? 0)
    )
  }
  const resolveAttackRollMode = (): ResolvedMechanic['attackRollMode'] => {
    if (attackKind === null) return null
    // Suppressed duplicate grants still count as roll-mode evidence.
    const influenced = (influence: string): boolean =>
      applicable('ATTACK_ROLL', ['ROLL_INFLUENCE'], undefined, influence).length > 0
    const advantage = influenced('ADVANTAGE')
    const disadvantage = influenced('DISADVANTAGE')
    return advantage === disadvantage ? 'NORMAL' : advantage ? 'ADVANTAGE' : 'DISADVANTAGE'
  }
  /** Weapon and spell attacks add their damage modifiers (ability, +N, Dueling) to the first
   * damage roll, together with the item's manual damage adjustment. */
  const attackDamageBonus =
    attackDomain === null
      ? 0
      : abilityTotal('DAMAGE') +
        dnd5eAttackBonusTotal(input.modifierGroups, attackDomain, 'DAMAGE', target) +
        (adjustment?.damageBonus ?? 0) -
        (equipment?.degradation ?? 0)
  const firstDamageOutcome = outcomes.find((outcome) => outcome.kind === 'DAMAGE')
  /** A weapon attack's damage die can be replaced (Shillelagh's d8); the largest one applies. */
  const weaponDieFaces =
    attackKind === null || isDnd5eSpellAttackKind(attackKind)
      ? null
      : input.modifierGroups
          .filter((group) => group.domainKey === 'WEAPON_DAMAGE_DIE:SET_VALUE')
          .flatMap((group) => group.contributions)
          .filter(
            (contribution) =>
              contribution.state === 'APPLIED' && dnd5eModifierApplies(contribution, target)
          )
          .reduce<number | null>(
            (largest, contribution) => Math.max(largest ?? 0, contribution.value),
            null
          )
  const withWeaponDie = (value: number | string | null): number | string | null =>
    weaponDieFaces === null || typeof value !== 'string'
      ? value
      : value.replace(/^(\d+)d\d+$/, `$1d${weaponDieFaces}`)
  const resolveSave = (): ResolvedMechanic['save'] => {
    const savingThrow = invocation.savingThrow
    if (savingThrow === null) return null
    const ability = abilityFromDefinitionId(input, savingThrow.abilityDefinitionId)
    if (ability === null) return null
    return {
      ability,
      dc: resolveSavingThrowDc(savingThrow, {
        spellSaveDc: context.spellcasting?.saveDc ?? null,
        proficiencyBonus: input.proficiencyBonus,
        abilityModifier: (abilityDefinitionId) => {
          const bonusAbility = abilityFromDefinitionId(input, abilityDefinitionId)
          return bonusAbility === null
            ? null
            : abilityModifier(input, bonusAbility, context.spellcasting)
        }
      })
    }
  }
  const resolveOutcome = (outcome: RawOutcome): ResolvedOutcome => {
    if (outcome.kind === 'CONDITION' || outcome.kind === 'EFFECT') return outcome
    if (outcome.kind === 'SPELL_SLOT_EXCHANGE') return resolveSpellSlotExchange(input, outcome)
    const level =
      outcome.scalingKind === 'NONE'
        ? null
        : targetLevel(input, outcome.scalingSource, outcome.classId, context.spellCastLevel)
    const resolvedValue = resolveOutcomeValue(outcome, level)
    const value = outcome === firstDamageOutcome ? withWeaponDie(resolvedValue) : resolvedValue
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
          ...(weaponDieFaces !== null && value !== resolvedValue ? { weaponDieFaces } : {}),
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
    attackAbility:
      target.attackAbility === null ? null : characterAbilityCode(input, target.attackAbility),
    attackBonus: resolveAttackBonus(),
    attackRollMode: resolveAttackRollMode(),
    save: resolveSave(),
    ...(invocation.targetCountLevels ? { targetCountLevels: invocation.targetCountLevels } : {}),
    outcomes: outcomes.map(resolveOutcome)
  }
}
