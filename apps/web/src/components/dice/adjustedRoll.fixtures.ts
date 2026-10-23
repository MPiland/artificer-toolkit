import { rollRecordDtoSchema } from '@artificer-toolkit/schema/api/rolls'

const FIXTURE_MODES = {
  NORMAL: { code: 'NORMAL', label: 'Normal', keep: 'FIRST' },
  ADVANTAGE: { code: 'ADVANTAGE', label: 'Advantage', keep: 'HIGHER' },
  DISADVANTAGE: { code: 'DISADVANTAGE', label: 'Disadvantage', keep: 'LOWER' }
} as const

/** A schema-valid roll record whose d20 the server settled in another mode (ATTACK-10.1). */
export function createAdjustedRoll({
  addedRollIndexes,
  appliedMode,
  cancelledRollIndexes,
  caption,
  id = 'adjusted-roll',
  keptRollIndex,
  rolledMode,
  rolls
}: {
  addedRollIndexes: number[]
  appliedMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
  cancelledRollIndexes: number[]
  caption: string | null
  id?: string
  keptRollIndex: number
  rolledMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
  rolls: number[]
}) {
  const kept = rolls[keptRollIndex]!
  return rollRecordDtoSchema.parse({
    id,
    normalizedExpression: '1d20+3',
    evidence: {
      terms: [{ count: rolls.length, die: 20, rolls, subtotal: kept, keptRollIndex }],
      modifier: 3,
      mode: appliedMode,
      modeLabel: FIXTURE_MODES[appliedMode].label,
      keep: FIXTURE_MODES[appliedMode].keep,
      subtotal: kept,
      transform: { kind: 'NONE' },
      total: kept + 3
    },
    characterId: null,
    characterLabel: 'Quill',
    source: { kind: 'ATTACK', label: 'Attack' },
    ruleset: { systemId: 'system', code: 'dnd5e', version: '2014' },
    createdAt: '2026-09-18T12:00:00.000Z',
    ruleCheck: {
      kind: 'D20_MODE_ADJUSTED',
      rolledMode: { code: rolledMode, label: FIXTURE_MODES[rolledMode].label },
      appliedMode: { code: appliedMode, label: FIXTURE_MODES[appliedMode].label },
      cancelledRollIndexes,
      addedRollIndexes,
      caption
    }
  })
}

export const cancelledAdvantageRoll = (id?: string) =>
  createAdjustedRoll({
    addedRollIndexes: [],
    appliedMode: 'NORMAL',
    cancelledRollIndexes: [1],
    caption: 'Advantage cancelled: the target can sense you',
    id,
    keptRollIndex: 0,
    rolledMode: 'ADVANTAGE',
    rolls: [7, 16]
  })

export const addedAdvantageRoll = (id?: string) =>
  createAdjustedRoll({
    addedRollIndexes: [1],
    appliedMode: 'ADVANTAGE',
    cancelledRollIndexes: [],
    caption: "Advantage: the target can't see you",
    id,
    keptRollIndex: 1,
    rolledMode: 'NORMAL',
    rolls: [12, 17]
  })
