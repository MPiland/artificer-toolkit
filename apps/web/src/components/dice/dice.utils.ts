import type { RollEvidenceDto, RollResultDto } from '@artificer-toolkit/schema/api/rolls'

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
