import type { CharacterDiceRandomSource } from './sheetResource.js'
import { rollCharacterDice } from './sheetResource.js'

export interface CharacterHitDieSelection {
  die: number
  count: number
}

export interface CharacterHitDiceRollInput extends CharacterHitDieSelection {
  modifierPerDie: number
}

export interface CharacterHitDiceRollTerm extends CharacterHitDiceRollInput {
  rolls: number[]
}

export interface CharacterHitDiceRollEvidence {
  expression: string
  terms: CharacterHitDiceRollTerm[]
  total: number
}

export interface CharacterCompletedRestResult {
  restKind: 'SHORT' | 'LONG'
  previewFingerprint: string
  hitPoints: {
    currentBefore: number
    currentAfter: number
    temporaryBefore: number
    temporaryAfter: number
    healingApplied: number
  }
  exhaustion: {
    before: number
    after: number
  }
  spentHitDice: CharacterHitDieSelection[]
  recoveredHitDice: CharacterHitDieSelection[]
  rollEvidence?: CharacterHitDiceRollEvidence
  resetMaximumHitPointModifier: boolean
  recoveredResourceIds: string[]
  recoveredSpellSlotKeys: string[]
  companionRecoveries: Array<{
    companionInstanceId: string
    recoveredHitDice: CharacterHitDieSelection[]
    recoveredResourceIds: string[]
  }>
}

export type CharacterSheetCommandResult = {
  type: 'COMPLETE_REST'
  rest: CharacterCompletedRestResult
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer.`)
  }
}

function requireInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer.`)
  }
}

export function formatCharacterHitDiceRollExpression(
  terms: ReadonlyArray<CharacterHitDiceRollInput>
): string {
  if (terms.length === 0) {
    throw new RangeError('At least one hit-die roll term is required.')
  }

  const seenDice = new Set<number>()
  const normalizedTerms = [...terms].sort((left, right) => right.die - left.die)

  for (const term of normalizedTerms) {
    requirePositiveInteger(term.die, 'Hit die size')
    requirePositiveInteger(term.count, 'Hit die count')
    requireInteger(term.modifierPerDie, 'Hit die modifier')
    if (seenDice.has(term.die)) {
      throw new RangeError(`Hit die d${term.die} may appear only once.`)
    }
    seenDice.add(term.die)
  }

  const diceExpression = normalizedTerms.map((term) => `${term.count}d${term.die}`).join(' + ')
  const modifier = normalizedTerms.reduce(
    (total, term) => total + term.count * term.modifierPerDie,
    0
  )

  if (modifier === 0) return diceExpression
  return `${diceExpression} ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`
}

export function validateCharacterHitDiceRollEvidence(evidence: CharacterHitDiceRollEvidence): void {
  const expectedExpression = formatCharacterHitDiceRollExpression(evidence.terms)
  if (evidence.expression !== expectedExpression) {
    throw new RangeError(`Hit-die expression must be "${expectedExpression}".`)
  }

  const expectedTotal = evidence.terms.reduce((total, term) => {
    if (term.rolls.length !== term.count) {
      throw new RangeError(`Hit-die d${term.die} roll count does not match its selected count.`)
    }
    for (const roll of term.rolls) {
      requirePositiveInteger(roll, 'Hit-die roll')
      if (roll > term.die) {
        throw new RangeError(`Hit-die d${term.die} roll must not exceed ${term.die}.`)
      }
    }
    return (
      total +
      term.rolls.reduce((termTotal, roll) => termTotal + roll, 0) +
      term.count * term.modifierPerDie
    )
  }, 0)

  requireInteger(evidence.total, 'Hit-die roll total')
  if (evidence.total !== expectedTotal) {
    throw new RangeError(`Hit-die roll total must be ${expectedTotal}.`)
  }
}

export function rollCharacterHitDice(
  terms: ReadonlyArray<CharacterHitDiceRollInput>,
  random: CharacterDiceRandomSource
): CharacterHitDiceRollEvidence {
  const sortedTerms = [...terms].sort((left, right) => right.die - left.die)
  const rolledTerms = sortedTerms.map((term) => {
    const result = rollCharacterDice(
      {
        count: term.count,
        die: term.die,
        modifier: term.count * term.modifierPerDie
      },
      random
    )
    return {
      ...term,
      rolls: result.rolls
    }
  })
  const evidence = {
    expression: formatCharacterHitDiceRollExpression(rolledTerms),
    terms: rolledTerms,
    total: rolledTerms.reduce(
      (total, term) =>
        total +
        term.rolls.reduce((termTotal, roll) => termTotal + roll, 0) +
        term.count * term.modifierPerDie,
      0
    )
  }
  validateCharacterHitDiceRollEvidence(evidence)
  return evidence
}
