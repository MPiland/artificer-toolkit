import type {
  CharacterActionModelInput,
  CharacterActionModelOutput
} from '@artificer-toolkit/schema/api/characterActionRules'

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
}

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

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatExpression(value: number | string, bonus: number): string {
  const base = typeof value === 'number' ? formatNumber(value) : value
  if (bonus === 0) return base
  return bonus > 0 ? `${base} + ${formatNumber(bonus)}` : `${base} - ${formatNumber(-bonus)}`
}

function applyDamageAmountMetadata(
  expression: string,
  amountKind: 'FULL' | 'HALF' | 'DOUBLE' | null,
  multiplier: number | null
): string {
  const multiplied =
    multiplier !== null && multiplier !== 1
      ? `${formatNumber(multiplier)} × ${expression}`
      : expression
  if (amountKind === 'HALF') return `half of ${multiplied}`
  if (amountKind === 'DOUBLE') return `double ${multiplied}`
  return multiplied
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
  if (outcome.valueKind === 'DICE') return selected.dice
  if (outcome.valueKind === 'POOL' && outcome.scalingKind !== 'NONE' && level !== null) {
    return clamp(
      (selected.amount ?? 0) + level * (selected.multiplier ?? 1),
      selected.minimum,
      selected.maximum
    )
  }
  return selected.amount
}

function rangeLabel(range: ActionCandidate['mechanicFacts']['invocation']['range']): string {
  if (range.rangeKind !== 'DISTANCE' || range.amount === null || range.unit === null)
    return titleCase(range.rangeKind)
  const unit =
    range.unit === 'FEET' || range.unit === 'FOOT'
      ? 'ft'
      : range.unit === 'MILES' || range.unit === 'MILE'
        ? 'mi'
        : range.unit === 'METERS' || range.unit === 'METER'
          ? 'm'
          : titleCase(range.unit)
  return `${formatNumber(range.amount)} ${unit}`
}

export function resolveDnd5eActionMechanic(
  input: CharacterActionModelInput,
  candidate: ActionCandidate | SpellEffect,
  context: MechanicContext
): ResolvedMechanic {
  const { invocation, outcomes } = candidate.mechanicFacts
  const sourceId = 'sourceId' in candidate ? candidate.sourceId : undefined
  const equipment = 'equipment' in candidate ? candidate.equipment : null
  const attackDomain =
    invocation.triggerCode === 'MELEE_WEAPON_ATTACK'
      ? 'MELEE'
      : invocation.triggerCode === 'RANGED_WEAPON_ATTACK'
        ? 'RANGED'
        : invocation.triggerCode === 'UNARMED_ATTACK'
          ? 'UNARMED'
          : invocation.triggerCode === 'SPELL_ATTACK'
            ? 'SPELL'
            : null
  const resolveAttackBonus = (): number | null => {
    if (attackDomain === null) return null
    if (attackDomain === 'SPELL') return context.spellcasting?.attackBonus ?? null
    const modifierKinds = ['ABILITY_MODIFIER_BONUS', 'OPTIONAL_ABILITY_MODIFIER_BONUS']
    const values = input.modifierGroups
      .filter((group) =>
        modifierKinds.some(
          (kind) => group.domainKey === `ATTACK_ROLL:${kind}|attackDomain=${attackDomain}`
        )
      )
      .flatMap((group) => group.contributions)
      .filter(
        (contribution) => contribution.sourceId === sourceId && contribution.state === 'APPLIED'
      )
      .map((contribution) => contribution.value)
    if (values.length === 0) return null
    const adjustment =
      equipment !== null
        ? (input.itemAttackAdjustments.find(
            (entry) => entry.itemInstanceId === equipment.itemInstanceId
          ) ?? null)
        : null
    if (adjustment?.override !== null && adjustment?.override !== undefined)
      return adjustment.override
    const proficiency =
      attackDomain === 'UNARMED'
        ? 1
        : equipment === null ||
            equipment.equipmentId === undefined ||
            equipment.equipmentId === null
          ? 0
          : input.proficiencies
              .filter(
                (proficiency) =>
                  (proficiency.kind === 'EQUIPMENT' &&
                    proficiency.subjectId === equipment.equipmentId) ||
                  (proficiency.kind === 'EQUIPMENT_PROPERTY' &&
                    (proficiency.category === null ||
                      proficiency.category === equipment.category) &&
                    (equipment.properties ?? []).includes(proficiency.subjectId))
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
    const sourceBonus = input.modifierGroups
      .filter((group) =>
        ['BONUS', 'PENALTY'].some(
          (kind) => group.domainKey === `ATTACK_ROLL:${kind}|attackDomain=${attackDomain}`
        )
      )
      .flatMap((group) => group.contributions)
      .filter(
        (contribution) => contribution.sourceId === sourceId && contribution.state === 'APPLIED'
      )
      .reduce((sum, contribution) => sum + contribution.value, 0)
    return (
      values.reduce((sum, value) => sum + value, 0) +
      Math.floor(input.proficiencyBonus * proficiency) +
      sourceBonus +
      (adjustment?.bonus ?? 0)
    )
  }
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
      outcome.kind === 'DAMAGE' ? context.spellDamageBonus : 0
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
    attackBonus: resolveAttackBonus(),
    attackRollMode: attackDomain === null ? null : input.attackRollModes[attackDomain],
    save: resolveSave(),
    outcomes: outcomes.map(resolveOutcome)
  }
}
