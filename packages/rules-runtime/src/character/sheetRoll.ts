import { addsFullProficiency } from '@artificer-toolkit/schema/api/characterSheet'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ExecuteRollInputDto, RollSourceDto } from '@artificer-toolkit/schema/api/rolls'
import { parseRollExpression } from '@artificer-toolkit/shared/rolls'

import { savingThrowSpentEffects } from '../encounterEndedEffectRelease.js'
import { discoverEncounterEventHooks } from '../events/encounterEventHooks.js'
import { characterProgressionCapabilityRegistry } from '../platformPolicyModules.js'
import {
  abilityCheckMinimumRoll,
  activeAbilityCheckDice,
  activeSavingThrowDice
} from './activeEffectGrantTotals.js'

type ResolvedRoll = {
  expression: string
  /** The System roll mode of a d20 roll; absent for a roll that is not a System-governed d20. */
  rollMode?: string | undefined
  source: RollSourceDto
  /** The ability a check or saving throw is made with: the dice its carried effects add key on it. */
  abilityCode?: string
  /** Whether a skill check adds the Character's full proficiency bonus or more. */
  proficient?: boolean
}

function withModifier(expression: string, modifier: number) {
  return modifier === 0
    ? expression
    : `${expression} ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`
}

function mechanicRolls(
  label: string,
  mechanic: NonNullable<CharacterSheetResponseDto['actions']['items'][number]['mechanic']>
): ResolvedRoll[] {
  const sourceLabel = label.slice(0, 80)
  return [
    ...(mechanic.attackBonus == null
      ? []
      : [
          {
            expression: withModifier('1d20', mechanic.attackBonus),
            rollMode: mechanic.attackRollMode,
            source: { kind: 'ATTACK' as const, label: `${sourceLabel} attack`.slice(0, 80) }
          }
        ]),
    ...mechanic.outcomes.flatMap((outcome): ResolvedRoll[] => {
      if (outcome.kind === 'DAMAGE') {
        return [
          {
            expression: outcome.expression,
            source: { kind: 'DAMAGE', label: `${sourceLabel} damage`.slice(0, 80) }
          }
        ]
      }
      if (outcome.kind === 'HEAL') {
        return [
          {
            expression: outcome.expression,
            source: { kind: 'HEALING', label: `${sourceLabel} healing`.slice(0, 80) }
          }
        ]
      }
      return []
    })
  ]
}

function structuredRolls(sheet: CharacterSheetResponseDto): ResolvedRoll[] {
  return [
    ...sheet.overview.abilities.map((ability) => ({
      expression: withModifier('1d20', ability.modifier),
      rollMode: ability.rollMode,
      abilityCode: ability.ability,
      source: { kind: 'ABILITY_CHECK' as const, label: `${ability.label} check` }
    })),
    ...sheet.overview.savingThrows.map((save) => ({
      expression: withModifier('1d20', save.total),
      rollMode: save.rollMode,
      abilityCode: save.ability,
      source: { kind: 'SAVING_THROW' as const, label: `${save.label} saving throw` }
    })),
    ...sheet.overview.skills.map((skill) => ({
      expression: withModifier('1d20', skill.total),
      rollMode: skill.rollMode,
      abilityCode: skill.ability,
      proficient: addsFullProficiency(skill.proficiency),
      source: { kind: 'SKILL_CHECK' as const, label: `${skill.label} check` }
    })),
    {
      expression: withModifier('1d20', sheet.overview.initiative),
      rollMode: sheet.overview.initiativeRollMode,
      source: { kind: 'INITIATIVE', label: 'Initiative' }
    },
    ...(sheet.spells.attackBonus == null
      ? []
      : [
          {
            expression: withModifier('1d20', sheet.spells.attackBonus),
            rollMode: sheet.spells.attackRollMode,
            source: { kind: 'ATTACK' as const, label: 'Spell attack' }
          }
        ]),
    ...sheet.actions.items.flatMap((action) =>
      action.mechanic ? mechanicRolls(action.label, action.mechanic) : []
    ),
    ...sheet.spells.activeGroups.flatMap((group) =>
      group.entries.flatMap((entry) =>
        (entry.mechanics ?? []).flatMap((mechanic) => mechanicRolls(entry.displayName, mechanic))
      )
    )
  ]
}

function resolveHitDieRoll(input: ExecuteRollInputDto, sheet: CharacterSheetResponseDto) {
  if (input.rollMode !== undefined) return undefined
  const parsed = parseRollExpression(input.expression)
  if (parsed.transform.kind !== 'NONE') return undefined

  const counts = new Map<number, number>()
  for (const term of parsed.terms) counts.set(term.die, (counts.get(term.die) ?? 0) + term.count)
  if (
    counts.size !== parsed.terms.length ||
    [...counts].some(([die, count]) => {
      const pool = sheet.overview.hitDice.find((candidate) => candidate.die === die)
      return !pool || count > pool.remaining
    })
  )
    return undefined

  const { hitPoints } = characterProgressionCapabilityRegistry.require(
    sheet.meta.systemId
  ).derivedStatisticAbilityCodes
  const constitution = sheet.overview.abilities.find((ability) => ability.ability === hitPoints)
  const totalDice = parsed.terms.reduce((total, term) => total + term.count, 0)
  if (!constitution || parsed.modifier !== totalDice * constitution.modifier) return undefined

  return {
    expression: parsed.normalizedExpression,
    source: { kind: 'HIT_DIE' as const, label: 'Short rest hit dice' }
  }
}

function sameRoll(left: ResolvedRoll, input: ExecuteRollInputDto, displayLabel: string) {
  return (
    left.expression === input.expression &&
    left.rollMode === input.rollMode &&
    left.source.kind === input.source.kind &&
    displayLabel === input.source.label
  )
}

export function resolveCharacterSheetRoll(
  input: ExecuteRollInputDto,
  sheet: CharacterSheetResponseDto,
  presentedSheet: CharacterSheetResponseDto = sheet
): ResolvedRoll {
  // Presentation preserves candidate order and mechanics. Match its displayed label,
  // but resolve against the raw candidate so stored roll provenance retains the original.
  const candidates = input.source.kind === 'HIT_DIE' ? [] : structuredRolls(sheet)
  const displayed = presentedSheet === sheet ? candidates : structuredRolls(presentedSheet)
  const resolved =
    input.source.kind === 'HIT_DIE'
      ? resolveHitDieRoll(input, sheet)
      : candidates.find((candidate, index) => {
          const display = displayed[index]
          return display && sameRoll(candidate, input, display.source.label)
        })
  if (!resolved) throw new RangeError('This roll is not available on the current character sheet.')
  return resolved
}

/**
 * The dice the Character's carried effects add to a resolved ability check, skill check or saving
 * throw (Guidance, Resistance), the effects the test spends: those whose die applied to its
 * ability (D156), and the floor a check's d20 takes from those effects and the Character's own
 * features (Glibness, Reliable Talent). Any other roll adds none.
 */
export function carriedTestDice(
  resolved: ResolvedRoll,
  activeEffects: readonly ActiveRuleEffectRecord[],
  character: NonNullable<Parameters<typeof abilityCheckMinimumRoll>[0]['character']>
) {
  const { abilityCode } = resolved
  if (abilityCode === undefined) return { addedDice: [], spent: [], minimumRoll: null }
  if (resolved.source.kind === 'SAVING_THROW')
    return {
      addedDice: activeSavingThrowDice(activeEffects, abilityCode),
      spent: savingThrowSpentEffects(activeEffects, abilityCode),
      minimumRoll: null
    }
  return {
    addedDice: activeAbilityCheckDice(activeEffects, abilityCode),
    spent: discoverEncounterEventHooks({
      effects: activeEffects,
      events: [{ kind: 'TEST', test: 'CHECK', ability: { code: abilityCode } }]
    }).ended,
    minimumRoll: abilityCheckMinimumRoll({
      effects: activeEffects,
      character,
      abilityCode,
      proficient: resolved.proficient === true
    })
  }
}
