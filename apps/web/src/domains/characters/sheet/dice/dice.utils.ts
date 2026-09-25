import type { CharacterSheet } from '../core/CharacterSheet.types'
import type {
  CharacterSheetRollDestinationOption,
  CharacterSheetRollRequest,
  CharacterSheetRollTarget,
  ManualDieRow
} from './dice.types'

type SheetMechanic = NonNullable<CharacterSheet['actions']['items'][number]['mechanic']>

export const playerRollDestinationOptions: readonly CharacterSheetRollDestinationOption[] = [
  { label: 'Table', value: 'TABLE' },
  { label: 'To GM', value: 'GM' },
  { label: 'Just me', value: 'PRIVATE' }
]

export const gmRollDestinationOptions: readonly CharacterSheetRollDestinationOption[] = [
  { label: 'Table', value: 'TABLE' },
  { label: 'Private', value: 'PRIVATE' },
  { label: 'Blind', value: 'BLIND' }
]

export const noRollDestinationOptions: readonly CharacterSheetRollDestinationOption[] = []

export const playerStateRollDestinationOptions = playerRollDestinationOptions.filter(
  (option) => option.value !== 'PRIVATE'
)

export const gmStateRollDestinationOptions = gmRollDestinationOptions.filter(
  (option) => option.value !== 'BLIND'
)

export const blindRollLabel = 'Blind roll: hidden until revealed'

export function withRollModifier(die: string, modifier: number) {
  if (modifier === 0) return die
  return `${die} ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`
}

export function buildManualExpression(rows: ManualDieRow[]) {
  return rows
    .map(({ count, die, modifier }) => withRollModifier(`${count}d${die}`, modifier))
    .join(' + ')
}

export function getMechanicRollTargets(
  mechanics: readonly SheetMechanic[] | undefined,
  label: string
): CharacterSheetRollTarget[] {
  return (mechanics ?? []).flatMap((mechanic) => {
    const attack: CharacterSheetRollTarget[] =
      mechanic.attackBonus == null
        ? []
        : [
            {
              expression: withRollModifier('1d20', mechanic.attackBonus),
              rollMode: mechanic.attackRollMode,
              source: { kind: 'ATTACK', label: `${label} attack`.slice(0, 80) },
              text:
                mechanic.attackBonus >= 0
                  ? `+${mechanic.attackBonus}`
                  : String(mechanic.attackBonus)
            }
          ]
    const outcomes = mechanic.outcomes.flatMap((outcome): CharacterSheetRollTarget[] => {
      if (outcome.kind === 'DAMAGE') {
        return [
          {
            expression: outcome.expression,
            source: { kind: 'DAMAGE' as const, label: `${label} damage`.slice(0, 80) },
            text: outcome.expression
          }
        ]
      }
      if (outcome.kind === 'HEAL') {
        return [
          {
            expression: outcome.expression,
            source: { kind: 'HEALING' as const, label: `${label} healing`.slice(0, 80) },
            text: outcome.expression
          }
        ]
      }
      return []
    })

    return [...attack, ...outcomes]
  })
}

export function splitRollText(text: string, targets: readonly CharacterSheetRollTarget[]) {
  const remainingTargets = [...targets]
  const parts: { text: string; target?: CharacterSheetRollTarget }[] = []
  let remainingText = text

  while (remainingText && remainingTargets.length) {
    const match = remainingTargets
      .map((target) => ({
        index: remainingText.toLocaleLowerCase().indexOf(target.text.toLocaleLowerCase()),
        target
      }))
      .filter(({ index }) => index >= 0)
      .sort((left, right) => left.index - right.index)[0]
    if (!match) break

    if (match.index > 0) parts.push({ text: remainingText.slice(0, match.index) })
    parts.push({
      target: match.target,
      text: remainingText.slice(match.index, match.index + match.target.text.length)
    })
    remainingText = remainingText.slice(match.index + match.target.text.length)
    remainingTargets.splice(remainingTargets.indexOf(match.target), 1)
  }

  if (remainingText) parts.push({ text: remainingText })
  return parts
}

export function toManualRollRequest(
  rows: ManualDieRow[],
  rollMode: CharacterSheetRollRequest['rollMode']
): CharacterSheetRollRequest {
  return {
    expression: buildManualExpression(rows),
    rollMode,
    source: { kind: 'MANUAL', label: 'Manual roll' }
  }
}
