import type { CharacterSheet } from '../core/CharacterSheet.types'
import { formatSigned } from '../core/characterSheet.utils'

type SheetAction = CharacterSheet['actions']['items'][number]
type SheetSpell = CharacterSheet['spells']['spells'][number]

export type CharacterSheetMechanic = NonNullable<
  NonNullable<SheetAction['mechanic']> | NonNullable<SheetSpell['mechanics']>[number]
>
export type CharacterSheetMechanicOutcome = CharacterSheetMechanic['outcomes'][number]

export type CharacterSheetMechanicSummary = {
  effectId: string
  facts: string
  outcomes: string[]
  hasScaling: boolean
}

export function summarizeCharacterSheetMechanics(
  mechanics: readonly CharacterSheetMechanic[] | undefined,
  castLevel?: number
): CharacterSheetMechanicSummary[] {
  return (mechanics ?? []).map((mechanic) => ({
    effectId: mechanic.effectId,
    facts: formatMechanicFacts(mechanic),
    outcomes: mechanic.outcomes.map((outcome) => formatMechanicOutcome(outcome, castLevel)),
    hasScaling: mechanic.outcomes.some(
      (outcome) =>
        (outcome.kind === 'DAMAGE' || outcome.kind === 'HEAL') && Boolean(outcome.scaling?.length)
    )
  }))
}

export function formatMechanicOutcome(
  outcome: CharacterSheetMechanicOutcome,
  castLevel?: number
): string {
  const path = formatOutcomePath(outcome.pathCode)

  switch (outcome.kind) {
    case 'DAMAGE':
      return joinFacts(
        resolveOutcomeExpression(outcome, castLevel),
        `${outcome.damageTypeLabel} damage`,
        path
      )
    case 'HEAL':
      return joinFacts(
        resolveOutcomeExpression(outcome, castLevel),
        outcome.temporary ? 'temporary hit points' : 'healing',
        path
      )
    case 'CONDITION':
      return joinFacts(outcome.label, path)
    case 'EFFECT':
      return joinFacts(outcome.label ?? formatCodeLabel(outcome.effectKind), path)
  }
}

function formatMechanicFacts(mechanic: CharacterSheetMechanic): string {
  const save = mechanic.save
    ? `${formatAbilityLabel(mechanic.save.ability)} save${mechanic.save.dc == null ? '' : ` DC ${mechanic.save.dc}`}`
    : undefined

  return joinFacts(
    mechanic.rangeLabel,
    mechanic.attackBonus == null ? undefined : `${formatSigned(mechanic.attackBonus)} to hit`,
    save
  )
}

function resolveOutcomeExpression(
  outcome: Extract<CharacterSheetMechanicOutcome, { kind: 'DAMAGE' | 'HEAL' }>,
  castLevel: number | undefined
): string {
  if (castLevel == null || !outcome.scaling?.length) return outcome.expression

  return (
    [...outcome.scaling]
      .sort((left, right) => right.level - left.level)
      .find((entry) => entry.level <= castLevel)?.expression ?? outcome.expression
  )
}

function formatOutcomePath(pathCode: string): string | undefined {
  switch (pathCode) {
    case 'ON_HIT':
      return 'on hit'
    case 'ON_MISS':
      return 'on miss'
    case 'ON_SAVE_FAIL':
      return 'on failed save'
    case 'ON_SAVE_SUCCESS':
      return 'on successful save'
    case 'ON_USE':
      return undefined
    default:
      return formatCodeLabel(pathCode).toLocaleLowerCase()
  }
}

function formatAbilityLabel(ability: string): string {
  return `${ability.charAt(0)}${ability.slice(1).toLocaleLowerCase()}`
}

function formatCodeLabel(value: string): string {
  return value
    .toLocaleLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toLocaleUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function joinFacts(...facts: Array<string | undefined>): string {
  return facts.filter((fact): fact is string => Boolean(fact)).join(' · ')
}
