import type {
  RollEvidenceDto,
  RollResultDto,
  RollRuleCheckDto
} from '@artificer-toolkit/schema/api/rolls'

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

/** A roll the card can show; a rule-settled roll also carries the check that explains its dice. */
export type DicePresentationRoll = RollResultDto & { ruleCheck?: RollRuleCheckDto }

type D20ModeAdjustmentDto = Extract<RollRuleCheckDto, { kind: 'D20_MODE_ADJUSTED' }>

/** The mode-change card animation: the ✕ draws, then the added die rolls in (DESIGN.md Motion). */
export const MODE_CHANGE_ANIMATION_MS = 520

const MODE_LABELS = {
  NORMAL: 'Normal',
  ADVANTAGE: 'Advantage',
  DISADVANTAGE: 'Disadvantage'
} as const

/** "Advantage → Normal": the mode the roller rolled for and the mode the server settled. */
export function formatModeChange(adjustment: D20ModeAdjustmentDto) {
  return `${MODE_LABELS[adjustment.rolledMode]} → ${MODE_LABELS[adjustment.appliedMode]}`
}

export function formatRollEvidence(evidence: RollEvidenceDto, adjustment?: D20ModeAdjustmentDto) {
  const termModifierTotal = evidence.terms.reduce((total, term) => total + (term.modifier ?? 0), 0)
  // A d20 mode adjustment names the d20's rolls, the first term; added dice (D156) follow it.
  const dice = evidence.terms
    .map((term, termIndex) => {
      const termAdjustment = termIndex === 0 ? adjustment : undefined
      const rolls = term.rolls
        .map((roll, index) => {
          const sequence = term.rollSequences?.[index]
          const value = sequence && sequence.length > 1 ? sequence.join(' → ') : String(roll)
          if (termAdjustment?.cancelledRollIndexes.includes(index)) return `${value} cancelled`
          const kept = term.keptRollIndexes
            ? term.keptRollIndexes.includes(index)
            : term.keptRollIndex == null || index === term.keptRollIndex
          const status =
            term.keptRollIndexes == null && term.keptRollIndex == null
              ? ''
              : kept
                ? 'kept'
                : 'dropped'
          const added = termAdjustment?.addedRollIndexes.includes(index) ? 'added' : ''
          const labels = [added, status].filter(Boolean).join(', ')
          return labels ? `${value} ${labels}` : value
        })
        .join(', ')
      const modifier = term.modifier ?? 0
      const text = `d${term.die} [${rolls}]${
        modifier === 0 ? '' : ` ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`
      }`
      return termIndex === 0 ? text : `${term.subtracted ? ' - ' : ' + '}${text}`
    })
    .join('')
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
  const mode = adjustment
    ? ` · ${formatModeChange(adjustment)}`
    : evidence.mode === 'NORMAL'
      ? ''
      : ` · ${evidence.mode === 'ADVANTAGE' ? 'advantage' : 'disadvantage'}`

  const caption = adjustment?.caption ? ` · ${adjustment.caption}` : ''

  return `${dice}${modifier}${mode}${transform}${caption}`
}
