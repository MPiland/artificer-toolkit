import type { RollEvidenceDto, RollResultDto } from '@artificer-toolkit/schema/api/rolls'
import type { CharacterSheet } from '../core/CharacterSheet.types'
import type {
  CharacterSheetRollRequest,
  CharacterSheetRollTarget,
  ManualDieRow
} from './dice.types'

type SheetMechanic = NonNullable<CharacterSheet['actions']['items'][number]['mechanic']>

export const MAX_3D_DICE = 20

export function getVisualDiceCount(roll: RollResultDto) {
  return roll.evidence.terms.reduce(
    (total, term) => total + term.rolls.length * (term.die === 100 ? 2 : 1),
    0
  )
}

export function supportsWebGL() {
  if (typeof document === 'undefined') return false
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'))
  } catch {
    return false
  }
}

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

export function formatRollEvidence(evidence: RollEvidenceDto) {
  const termModifierTotal = evidence.terms.reduce((total, term) => total + (term.modifier ?? 0), 0)
  const dice = evidence.terms
    .map((term) => {
      const rolls = term.rolls
        .map((roll, index) => {
          const sequence = term.rollSequences?.[index]
          const value = sequence && sequence.length > 1 ? sequence.join(' → ') : String(roll)
          const kept = term.keptRollIndexes
            ? term.keptRollIndexes.includes(index)
            : term.keptRollIndex == null || index === term.keptRollIndex
          return term.keptRollIndexes == null && term.keptRollIndex == null
            ? value
            : `${value} ${kept ? 'kept' : 'dropped'}`
        })
        .join(', ')
      const modifier = term.modifier ?? 0
      return `d${term.die} [${rolls}]${
        modifier === 0 ? '' : ` ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`
      }`
    })
    .join(' + ')
  const globalModifier = evidence.modifier - termModifierTotal
  const modifier =
    globalModifier === 0 ? '' : ` ${globalModifier > 0 ? '+' : '-'} ${Math.abs(globalModifier)}`
  const transform =
    evidence.transform.kind === 'NONE'
      ? ''
      : evidence.transform.kind === 'HALF'
        ? ' · halved'
        : evidence.transform.kind === 'DOUBLE'
          ? ' · doubled'
          : ` · × ${evidence.transform.value}`
  const mode =
    evidence.mode === 'NORMAL'
      ? ''
      : ` · ${evidence.mode === 'ADVANTAGE' ? 'advantage' : 'disadvantage'}`

  return `${dice}${modifier}${mode}${transform}`
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
