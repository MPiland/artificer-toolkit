import { rollCharacterDice, type CharacterDiceRandomSource } from '../character/sheetResource.js'

const SUPPORTED_DICE = new Set([4, 6, 8, 10, 12, 20, 100])
const MAX_TERMS = 10
const MAX_DICE = 40
const MAX_REROLLS_PER_DIE = 100

export type RollTransform =
  | { kind: 'NONE' }
  | { kind: 'HALF' }
  | { kind: 'DOUBLE' }
  | { kind: 'MULTIPLY'; value: number }

/**
 * A System roll-mode code; the evaluator still branches on the D&D codes until RULES-2.T9a2 replaces
 * this with `keep`.
 */
export type RollMode = string
export type RollSelection = {
  kind: 'DROP_HIGHEST' | 'DROP_LOWEST' | 'KEEP_HIGHEST' | 'KEEP_LOWEST'
  count: number
}
export type RollReroll = { kind: 'ONCE' | 'REPEAT'; value: number }

interface RollEvidence {
  terms: {
    count: number
    die: number
    modifier?: number
    rolls: number[]
    rollSequences?: number[][]
    subtotal: number
    keptRollIndex?: number
    keptRollIndexes?: number[]
  }[]
  modifier: number
  mode: RollMode
  subtotal: number
  transform: RollTransform
  total: number
}

export interface ParsedRollExpression {
  terms: {
    count: number
    die: number
    modifier: number
    reroll?: RollReroll
    selection?: RollSelection
  }[]
  modifier: number
  transform: RollTransform
  normalizedExpression: string
}

const selectionKinds = {
  dh: 'DROP_HIGHEST',
  dl: 'DROP_LOWEST',
  kh: 'KEEP_HIGHEST',
  kl: 'KEEP_LOWEST'
} as const

function parseDiceTerm(unsigned: string) {
  const dice = unsigned.match(/^(\d*)d(\d+)(.*)$/i)
  if (!dice) return undefined

  const count = dice[1] ? Number(dice[1]) : 1
  const die = Number(dice[2])
  if (!Number.isSafeInteger(count) || count < 1 || !SUPPORTED_DICE.has(die)) {
    throw new RangeError('Roll expression contains unsupported dice.')
  }

  let reroll: RollReroll | undefined
  let selection: RollSelection | undefined
  const suffix = dice[3].toLowerCase()
  const operators = [...suffix.matchAll(/(kh|kl|dh|dl|ro|r)(\d+)/g)]
  if (operators.map((match) => match[0]).join('') !== suffix) {
    throw new SyntaxError('Roll expression contains unsupported dice operators.')
  }

  for (const operator of operators) {
    const code = operator[1]
    const value = Number(operator[2])
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError('Dice operator values must be positive integers.')
    }
    if (code === 'r' || code === 'ro') {
      if (reroll) throw new SyntaxError('A dice term can have only one reroll operator.')
      if (value > die) throw new RangeError(`A d${die} cannot reroll ${value}.`)
      reroll = { kind: code === 'ro' ? 'ONCE' : 'REPEAT', value }
      continue
    }

    if (selection) throw new SyntaxError('A dice term can have only one keep or drop operator.')
    if (value > count || (code.startsWith('d') && value === count)) {
      throw new RangeError('Keep or drop count is incompatible with the number of dice.')
    }
    selection = { kind: selectionKinds[code as keyof typeof selectionKinds], count: value }
  }

  return { count, die, modifier: 0, reroll, selection }
}

function parseTransform(expression: string): {
  inner: string
  transform: RollTransform
} {
  const half = expression.match(/^half\s+of\s+(.+)$/i)
  if (half) return { inner: half[1], transform: { kind: 'HALF' } }

  const double = expression.match(/^double\s+(.+)$/i)
  if (double) return { inner: double[1], transform: { kind: 'DOUBLE' } }

  const multiply = expression.match(/^(\d+)\s*[x×*]\s*\((.+)\)$/i)
  if (multiply) {
    const value = Number(multiply[1])
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError('Roll multiplier must be a positive integer.')
    }
    return { inner: multiply[2], transform: { kind: 'MULTIPLY', value } }
  }

  return { inner: expression, transform: { kind: 'NONE' } }
}

export function parseRollExpression(expression: string): ParsedRollExpression {
  if (expression.length > 200) throw new RangeError('Roll expression is too long.')

  const { inner, transform } = parseTransform(expression.trim())
  const compact = inner.replaceAll(/\s/g, '')
  if (!compact) throw new SyntaxError('Roll expression is empty.')

  const parts = compact.match(/[+-]?[^+-]+/g) ?? []
  if (parts.join('') !== compact) {
    throw new SyntaxError('Roll expression contains unsupported operators.')
  }
  const terms: ParsedRollExpression['terms'] = []
  let modifier = 0
  let globalModifier = 0
  let hasGlobalModifier = false
  const modifiedTerms = new Set<number>()

  for (const [index, part] of parts.entries()) {
    const sign = part.startsWith('-') ? -1 : 1
    const unsigned = part.replace(/^[+-]/, '')
    const dice = parseDiceTerm(unsigned)
    if (dice) {
      if (sign < 0) throw new SyntaxError('Dice terms must be additive.')
      terms.push(dice)
      continue
    }

    if (!/^\d+$/.test(unsigned) || (index === 0 && sign > 0)) {
      throw new SyntaxError('Roll expression contains unsupported terms.')
    }
    const value = sign * Number(unsigned)
    if (!Number.isSafeInteger(value)) throw new RangeError('Roll modifier is too large.')

    const termIndex = terms.length - 1
    if (termIndex >= 0) {
      if (modifiedTerms.has(termIndex)) {
        throw new SyntaxError('Each dice term can have at most one modifier.')
      }
      terms[termIndex].modifier = value
      modifiedTerms.add(termIndex)
    } else {
      if (hasGlobalModifier) throw new SyntaxError('Roll expression contains unsupported terms.')
      globalModifier = value
      hasGlobalModifier = true
    }
    modifier += value
  }

  if (terms.length < 1 || terms.length > MAX_TERMS) {
    throw new RangeError(`Roll expression must contain 1-${MAX_TERMS} dice terms.`)
  }
  if (terms.reduce((sum, term) => sum + term.count, 0) > MAX_DICE) {
    throw new RangeError(`Roll expression cannot exceed ${MAX_DICE} dice.`)
  }
  const minimumSubtotal = terms.reduce((sum, term) => sum + term.count, modifier)
  const maximumSubtotal = terms.reduce((sum, term) => sum + term.count * term.die, modifier)
  const maximumMagnitude = Math.max(Math.abs(minimumSubtotal), Math.abs(maximumSubtotal))
  const transformFactor =
    transform.kind === 'DOUBLE' ? 2 : transform.kind === 'MULTIPLY' ? transform.value : 1
  if (
    !Number.isSafeInteger(minimumSubtotal) ||
    !Number.isSafeInteger(maximumSubtotal) ||
    transformFactor > Math.floor(Number.MAX_SAFE_INTEGER / Math.max(maximumMagnitude, 1))
  ) {
    throw new RangeError('Roll total is too large.')
  }

  const diceExpression = terms
    .map(({ count, die, modifier: termModifier, reroll, selection }) => {
      const selectionCode = selection
        ? {
            DROP_HIGHEST: 'dh',
            DROP_LOWEST: 'dl',
            KEEP_HIGHEST: 'kh',
            KEEP_LOWEST: 'kl'
          }[selection.kind] + selection.count
        : ''
      const rerollCode = reroll ? `${reroll.kind === 'ONCE' ? 'ro' : 'r'}${reroll.value}` : ''
      const term = `${count}d${die}${selectionCode}${rerollCode}`
      return termModifier === 0
        ? term
        : `${term} ${termModifier > 0 ? '+' : '-'} ${Math.abs(termModifier)}`
    })
    .join(' + ')
  const arithmetic =
    globalModifier === 0
      ? diceExpression
      : `${diceExpression} ${globalModifier > 0 ? '+' : '-'} ${Math.abs(globalModifier)}`
  const normalizedExpression =
    transform.kind === 'HALF'
      ? `half of ${arithmetic}`
      : transform.kind === 'DOUBLE'
        ? `double ${arithmetic}`
        : transform.kind === 'MULTIPLY'
          ? `${transform.value} × (${arithmetic})`
          : arithmetic

  return { terms, modifier, transform, normalizedExpression }
}

export function evaluateRollExpression(
  parsed: ParsedRollExpression,
  random: CharacterDiceRandomSource,
  mode: RollMode = 'NORMAL'
): { normalizedExpression: string; evidence: RollEvidence } {
  validateRollMode(parsed, mode)

  const terms = parsed.terms.map(({ count, die, modifier, reroll, selection }) => {
    const result = rollCharacterDice(
      { count: mode === 'NORMAL' ? count : 2, die, modifier: 0 },
      random
    )
    if (mode === 'NORMAL') {
      const rollSequences = result.rolls.map((value) => {
        const sequence = [value]
        if (!reroll || value !== reroll.value) return sequence

        if (reroll.kind === 'ONCE') {
          sequence.push(rollCharacterDice({ count: 1, die, modifier: 0 }, random).rolls[0])
          return sequence
        }

        while (sequence.at(-1) === reroll.value) {
          if (sequence.length > MAX_REROLLS_PER_DIE) {
            throw new RangeError('A repeated reroll did not resolve.')
          }
          sequence.push(rollCharacterDice({ count: 1, die, modifier: 0 }, random).rolls[0])
        }
        return sequence
      })
      const rolls = rollSequences.map((sequence) => sequence.at(-1)!)
      const keptRollIndexes = selection ? selectRollIndexes(rolls, selection) : undefined
      const kept = keptRollIndexes ?? rolls.map((_, index) => index)
      return {
        count,
        die,
        modifier,
        rolls,
        ...(reroll ? { rollSequences } : {}),
        subtotal: kept.reduce((sum, index) => sum + rolls[index], 0),
        ...(selection ? { keptRollIndexes } : {})
      }
    }

    const keptRoll = mode === 'ADVANTAGE' ? Math.max(...result.rolls) : Math.min(...result.rolls)
    return {
      count: 2,
      die,
      modifier,
      rolls: result.rolls,
      subtotal: keptRoll,
      keptRollIndex: result.rolls.indexOf(keptRoll)
    }
  })
  const subtotal = terms.reduce((sum, term) => sum + term.subtotal, parsed.modifier)
  const total =
    parsed.transform.kind === 'HALF'
      ? Math.floor(subtotal / 2)
      : parsed.transform.kind === 'DOUBLE'
        ? subtotal * 2
        : parsed.transform.kind === 'MULTIPLY'
          ? subtotal * parsed.transform.value
          : subtotal

  if (!Number.isSafeInteger(total)) throw new RangeError('Roll total is too large.')

  return {
    normalizedExpression: parsed.normalizedExpression,
    evidence: {
      terms,
      modifier: parsed.modifier,
      mode,
      subtotal,
      transform: parsed.transform,
      total
    }
  }
}

function selectRollIndexes(rolls: number[], selection: RollSelection): number[] {
  const highest = selection.kind === 'DROP_HIGHEST' || selection.kind === 'KEEP_HIGHEST'
  const selected = rolls
    .map((_, index) => index)
    .sort(
      (left, right) =>
        (highest ? rolls[right] - rolls[left] : rolls[left] - rolls[right]) || left - right
    )
    .slice(0, selection.count)
  const selectedSet = new Set(selected)

  return rolls
    .map((_, index) => index)
    .filter((index) =>
      selection.kind === 'DROP_HIGHEST' || selection.kind === 'DROP_LOWEST'
        ? !selectedSet.has(index)
        : selectedSet.has(index)
    )
}

export function parseStandaloneDiceConfiguration(configuration: string): ParsedRollExpression {
  const parsed = parseRollExpression(configuration)
  if (parsed.terms.length !== 1 || parsed.modifier !== 0 || parsed.transform.kind !== 'NONE') {
    throw new RangeError('A dice configuration must contain one unmodified dice term.')
  }
  return parsed
}

export function validateRollMode(parsed: ParsedRollExpression, mode: RollMode): void {
  if (
    mode !== 'NORMAL' &&
    (parsed.terms.length !== 1 ||
      parsed.terms[0].count !== 1 ||
      parsed.terms[0].die !== 20 ||
      parsed.terms[0].reroll !== undefined ||
      parsed.terms[0].selection !== undefined ||
      parsed.transform.kind !== 'NONE')
  ) {
    throw new RangeError('Advantage and disadvantage require a single d20 roll.')
  }
}
