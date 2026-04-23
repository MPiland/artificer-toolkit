import type { ABILITY_CODE } from './ability.js'
import type { CoreMeta } from './core.js'

export const NUMERIC_EXPR_CODE = {
  FIXED: 'FIXED',
  ADD: 'ADD',
  MUL: 'MUL',
  CLAMP: 'CLAMP',
  PROFICIENCY_BONUS: 'PROFICIENCY_BONUS',
  ABILITY_MODIFIER: 'ABILITY_MODIFIER',
  SKILL_BONUS: 'SKILL_BONUS',
  CHARACTER_LEVEL: 'CHARACTER_LEVEL',
  CLASS_LEVEL: 'CLASS_LEVEL',
  SPELL_LEVEL: 'SPELL_LEVEL',
  HIT_POINT_MAXIMUM: 'HIT_POINT_MAXIMUM'
} as const

export type NumericExprOption = CoreMeta<keyof typeof NUMERIC_EXPR_CODE>

export const NUMERIC_EXPR: Record<keyof typeof NUMERIC_EXPR_CODE, NumericExprOption> = {
  [NUMERIC_EXPR_CODE.FIXED]: {
    code: NUMERIC_EXPR_CODE.FIXED,
    label: 'Fixed value',
    description: 'A constant numeric value that does not change.',
    tooltip: 'Use a fixed number such as 8 or 15.'
  },

  [NUMERIC_EXPR_CODE.ADD]: {
    code: NUMERIC_EXPR_CODE.ADD,
    label: 'Add',
    description: 'Adds multiple values together.',
    tooltip: 'Combine multiple values by adding them.'
  },

  [NUMERIC_EXPR_CODE.MUL]: {
    code: NUMERIC_EXPR_CODE.MUL,
    label: 'Multiply',
    description: 'Multiplies one value by another.',
    tooltip: 'Scale a value by multiplying it.'
  },

  [NUMERIC_EXPR_CODE.CLAMP]: {
    code: NUMERIC_EXPR_CODE.CLAMP,
    label: 'Clamp',
    description: 'Restricts a value to a minimum and/or maximum.',
    tooltip: 'Limit a value so it cannot go below or above a set range.'
  },

  [NUMERIC_EXPR_CODE.PROFICIENCY_BONUS]: {
    code: NUMERIC_EXPR_CODE.PROFICIENCY_BONUS,
    label: 'Proficiency Bonus',
    description: 'Uses the character’s current proficiency bonus.',
    tooltip: 'Automatically scales with character level.'
  },

  [NUMERIC_EXPR_CODE.ABILITY_MODIFIER]: {
    code: NUMERIC_EXPR_CODE.ABILITY_MODIFIER,
    label: 'Ability Modifier',
    description: 'Uses the modifier of a selected ability.',
    tooltip: 'For example: Strength modifier or Spellcasting ability modifier.'
  },

  [NUMERIC_EXPR_CODE.SKILL_BONUS]: {
    code: NUMERIC_EXPR_CODE.SKILL_BONUS,
    label: 'Skill Bonus',
    description: 'Uses the bonus for a selected skill.',
    tooltip: 'Includes proficiency, expertise, and other skill modifiers.'
  },

  [NUMERIC_EXPR_CODE.CHARACTER_LEVEL]: {
    code: NUMERIC_EXPR_CODE.CHARACTER_LEVEL,
    label: 'Character Level',
    description: 'Uses the character\'s total level.',
    tooltip: 'Counts all class levels combined.'
  },

  [NUMERIC_EXPR_CODE.CLASS_LEVEL]: {
    code: NUMERIC_EXPR_CODE.CLASS_LEVEL,
    label: 'Class Level',
    description: 'Uses the level in a specific class.',
    tooltip: 'Optionally select a class to reference.'
  },

  [NUMERIC_EXPR_CODE.SPELL_LEVEL]: {
    code: NUMERIC_EXPR_CODE.SPELL_LEVEL,
    label: 'Spell Level',
    description: 'Uses the level the spell is cast at.',
    tooltip: 'Higher spell slots result in higher values.'
  },

  [NUMERIC_EXPR_CODE.HIT_POINT_MAXIMUM]: {
    code: NUMERIC_EXPR_CODE.HIT_POINT_MAXIMUM,
    label: 'Hit Point Maximum',
    description: 'Uses the source creature or character hit point maximum.',
    tooltip: 'Useful for summons whose hit points depend on the caster.'
  }
} as const

export type NumericAtom
  = | { kind: typeof NUMERIC_EXPR_CODE.FIXED, value: number }
    | { kind: typeof NUMERIC_EXPR_CODE.PROFICIENCY_BONUS }
    | { kind: typeof NUMERIC_EXPR_CODE.ABILITY_MODIFIER, ability: keyof typeof ABILITY_CODE }
    | { kind: typeof NUMERIC_EXPR_CODE.SKILL_BONUS, skillId: string }
    | { kind: typeof NUMERIC_EXPR_CODE.CHARACTER_LEVEL }
    | { kind: typeof NUMERIC_EXPR_CODE.CLASS_LEVEL, classId?: string }
    | { kind: typeof NUMERIC_EXPR_CODE.SPELL_LEVEL }
    | { kind: typeof NUMERIC_EXPR_CODE.HIT_POINT_MAXIMUM }

export type NumericMul = {
  kind: typeof NUMERIC_EXPR_CODE.MUL
  left: NumericAtom
  right: NumericAtom
}

export type NumericTerm = NumericAtom | NumericMul

export type NumericAdd = {
  kind: typeof NUMERIC_EXPR_CODE.ADD
  args: NumericTerm[]
}

export type NumericClamp = {
  kind: typeof NUMERIC_EXPR_CODE.CLAMP
  value: NumericAdd | NumericTerm
  min?: number
  max?: number
}

export type NumericExpr
  = | NumericTerm
    | NumericAdd
    | NumericClamp

export function atom(value: NumericAtom): NumericAtom {
  return value
}

export function mul(left: NumericAtom, right: NumericAtom): NumericMul {
  return { kind: NUMERIC_EXPR_CODE.MUL, left, right }
}

export function add(...args: NumericTerm[]): NumericAdd | NumericTerm {
  if (args.length === 1) return args[0]
  return { kind: NUMERIC_EXPR_CODE.ADD, args }
}

export function clamp(
  value: NumericTerm | NumericAdd,
  min?: number,
  max?: number
): NumericClamp | NumericTerm | NumericAdd {
  if (min == null && max == null) return value
  return { kind: NUMERIC_EXPR_CODE.CLAMP, value, min, max }
}
