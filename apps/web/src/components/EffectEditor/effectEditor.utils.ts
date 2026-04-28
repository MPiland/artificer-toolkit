import type { EffectDto, PathDto, RangeDto, TargetingDto } from '@artificer-toolkit/schema'
import type { EffectEditorReferenceData, OutcomeDraft } from './effectEditor.types'

type ResultBlockLike = {
  outcomes?: unknown
}

export const triggerOptions = [
  { value: 'ACTIVATED', label: 'Activated' },
  { value: 'SPELL_ATTACK', label: 'Spell attack' },
  { value: 'SAVING_THROW', label: 'Saving throw' },
  { value: 'ENTER_AREA', label: 'Enter area' },
  { value: 'MELEE_WEAPON_ATTACK', label: 'Melee weapon attack' },
  { value: 'RANGED_WEAPON_ATTACK', label: 'Ranged weapon attack' },
  { value: 'UNARMED_ATTACK', label: 'Unarmed attack' }
]

export const pathCodeOptions = [
  { value: 'ON_USE', label: 'On use' },
  { value: 'ON_ATTACK', label: 'On attack' },
  { value: 'ON_HIT', label: 'On hit' },
  { value: 'ON_MISS', label: 'On miss' },
  { value: 'ON_CRIT', label: 'On crit' },
  { value: 'ON_SAVE_FAIL', label: 'On save failure' },
  { value: 'ON_SAVE_SUCCESS', label: 'On save success' },
  { value: 'PASSIVE', label: 'Passive' }
] satisfies Array<{ value: PathDto['pathCode'], label: string }>

export const outcomeKindGroups = [
  {
    label: 'Common results',
    options: [
      { value: 'DAMAGE', label: 'Damage', description: 'Roll damage with a damage type.' },
      { value: 'CONDITION', label: 'Condition', description: 'Apply a condition to a target.' },
      { value: 'HEAL', label: 'Healing', description: 'Restore hit points or temporary hit points.' }
    ]
  },
  {
    label: 'Movement',
    options: [
      { value: 'FORCED_MOVEMENT', label: 'Forced movement', description: 'Push, pull, or move the target.' },
      { value: 'TELEPORT', label: 'Teleport', description: 'Move a target instantly to a destination.' }
    ]
  },
  {
    label: 'Manifested effects',
    options: [
      { value: 'MANIFEST', label: 'Create manifestation', description: 'Create a zone, summon, object, sensor, or illusion.' },
      { value: 'MOVE_MANIFEST', label: 'Move manifestation', description: 'Move a manifestation already created by this effect.' },
      { value: 'COMMAND_MANIFEST', label: 'Command manifestation', description: 'Command a manifestation already created by this effect.' }
    ]
  },
  {
    label: 'Advanced',
    options: [
      { value: 'APPLY_GRANT', label: 'Apply grant', description: 'Apply a reusable grant payload.' },
      { value: 'RULE', label: 'Rule note', description: 'Add an engine-readable rule marker.' }
    ]
  }
]

export const outcomeKindOptions = outcomeKindGroups.flatMap((group) => (
  group.options.map(({ value, label }) => ({ value, label }))
))

export const abilityOptions = [
  { value: 'STRENGTH', label: 'Strength' },
  { value: 'DEXTERITY', label: 'Dexterity' },
  { value: 'CONSTITUTION', label: 'Constitution' },
  { value: 'INTELLIGENCE', label: 'Intelligence' },
  { value: 'WISDOM', label: 'Wisdom' },
  { value: 'CHARISMA', label: 'Charisma' }
]

export const unitOptions = [
  { value: 'FEET', label: 'Feet' },
  { value: 'MILES', label: 'Miles' },
  { value: 'INCHES', label: 'Inches' }
]

export const targetingSelectionOptions = [
  { value: 'SELF', label: 'Self' },
  { value: 'SINGLE_TARGET', label: 'Single target' },
  { value: 'CHOSEN_CREATURES', label: 'Chosen creatures' },
  { value: 'AREA_CONTENTS', label: 'Area contents' }
]

export const targetDispositionOptions = [
  { value: 'ANY', label: 'Any' },
  { value: 'WILLING', label: 'Willing' },
  { value: 'HOSTILE', label: 'Hostile' }
]

export const emptyOption = { value: '', label: 'None yet' }

export function createDefaultEffect(order: number): EffectDto {
  return {
    id: crypto.randomUUID(),
    order,
    invocation: {
      kind: 'ACTION',
      triggerCode: 'ACTIVATED',
      activation: { code: 'ACTION', amount: 1 },
      range: createRange('SELF')
    },
    paths: [createDefaultPath(1, 'ON_USE')]
  }
}

export function createDefaultPath(order: number, pathCode: PathDto['pathCode'] = 'ON_USE'): PathDto {
  return {
    id: crypto.randomUUID(),
    order,
    pathCode,
    groupType: 'SINGLE',
    selectionKind: 'FIXED',
    resultBlock: {
      id: crypto.randomUUID(),
      resultKind: 'SINGLE',
      outcomes: []
    }
  } as PathDto
}

export function createPathForSelection({
  id,
  order,
  pathCode,
  selectionKind
}: {
  id: string
  order: number
  pathCode: PathDto['pathCode']
  selectionKind: 'FIXED' | 'CHOICE' | 'ROLL_TABLE'
}): PathDto {
  if (selectionKind === 'CHOICE') {
    return {
      id,
      order,
      pathCode,
      groupType: 'CHOICE',
      selectionKind: 'CHOICE',
      options: []
    } as PathDto
  }

  if (selectionKind === 'ROLL_TABLE') {
    return {
      id,
      order,
      pathCode,
      groupType: 'SINGLE',
      selectionKind: 'ROLL_TABLE',
      rollTableKind: 'RANGE',
      dieConfig: '1d6',
      rows: []
    } as PathDto
  }

  return {
    ...createDefaultPath(order, pathCode),
    id
  }
}

export function createRange(rangeKind = 'SELF', amount = 30): RangeDto {
  return rangeKind === 'DISTANCE'
    ? { id: crypto.randomUUID(), rangeKind: 'DISTANCE', amount, unit: 'FEET' }
    : { id: crypto.randomUUID(), rangeKind: rangeKind as Exclude<RangeDto['rangeKind'], 'DISTANCE'> }
}

export function createTargeting(selectionKind = 'SELF'): TargetingDto {
  if (selectionKind === 'SELF') return { selectionKind: 'SELF' }
  if (selectionKind === 'CHOSEN_CREATURES') return { selectionKind: 'CHOSEN_CREATURES', dispositionKind: 'ANY', maxTargets: 1 }
  if (selectionKind === 'AREA_CONTENTS') return { selectionKind: 'AREA_CONTENTS', dispositionKind: 'ANY' }
  return { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
}

export function createOutcome(kind: string, references: EffectEditorReferenceData): Record<string, unknown> {
  const id = crypto.randomUUID()

  switch (kind) {
    case 'DAMAGE':
      return {
        id,
        effectKind: 'DAMAGE',
        valueKind: 'DICE',
        scalingKind: 'NONE',
        diceConfig: '1d6',
        damageTypeId: references.damageTypes[0]?.value ?? ''
      }
    case 'CONDITION':
      return { id, effectKind: 'CONDITION', conditionId: references.conditionTypes[0]?.value ?? '' }
    case 'HEAL':
      return { id, effectKind: 'HEAL', valueKind: 'DICE', scalingKind: 'NONE', diceConfig: '1d6' }
    case 'APPLY_GRANT':
      return { id, effectKind: 'APPLY_GRANT', grants: {} }
    case 'FORCED_MOVEMENT':
      return {
        id,
        effectKind: 'FORCED_MOVEMENT',
        direction: 'AWAY_FROM_SOURCE',
        actionEconomy: 'NONE',
        distanceMode: 'FIXED_DISTANCE',
        amount: 10,
        unit: 'FEET'
      }
    case 'TELEPORT':
      return {
        id,
        effectKind: 'TELEPORT',
        targetKind: 'TARGET',
        destinationKind: 'VISIBLE',
        distance: createRange('DISTANCE', 30)
      }
    case 'MANIFEST':
      return { id, effectKind: 'MANIFEST', manifestKind: 'ZONE', label: 'Manifested effect' }
    case 'MOVE_MANIFEST':
      return { id, effectKind: 'MOVE_MANIFEST', manifestId: '', amount: 30, unit: 'FEET' }
    case 'COMMAND_MANIFEST':
      return { id, effectKind: 'COMMAND_MANIFEST', manifestId: '' }
    default:
      return { id, effectKind: 'RULE' }
  }
}

export function formatEffectSummary(effect: EffectDto): string {
  const invocation = toTitleCase(effect.invocation.triggerCode.replaceAll('_', ' '))
  const outcomes = (effect.paths as PathDto[]).flatMap((path) => getPathOutcomes(path)).length
  const pathText = `${effect.paths.length} path${effect.paths.length === 1 ? '' : 's'}`
  const outcomeText = outcomes === 0
    ? 'no outcomes yet'
    : `${outcomes} outcome${outcomes === 1 ? '' : 's'}`

  return `${invocation}, ${pathText}, ${outcomeText}`
}

export function getPathOutcomes(path: PathDto): OutcomeDraft[] {
  if ('resultBlock' in path) {
    return getOutcomesFromResultBlock(path.resultBlock)
  }

  if ('options' in path) {
    return path.options.flatMap((option) => getOutcomesFromResultBlock(option.resultBlock))
  }

  if ('rows' in path) {
    return path.rows.flatMap((row) => getOutcomesFromResultBlock(row.resultBlock))
  }

  return []
}

function getOutcomesFromResultBlock(resultBlock: unknown): OutcomeDraft[] {
  if (!isResultBlockLike(resultBlock) || !Array.isArray(resultBlock.outcomes)) return []
  return resultBlock.outcomes.filter(isOutcomeDraft)
}

function isResultBlockLike(value: unknown): value is ResultBlockLike {
  return typeof value === 'object' && value !== null && 'outcomes' in value
}

function isOutcomeDraft(value: unknown): value is OutcomeDraft {
  return typeof value === 'object' && value !== null
}

export function getSelectData(options: Array<{ value: string, label: string }>): Array<{ value: string, label: string }> {
  return options.length > 0 ? options : [emptyOption]
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
