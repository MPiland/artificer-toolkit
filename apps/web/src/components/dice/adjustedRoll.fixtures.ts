import { rollRecordDtoSchema } from '@artificer-toolkit/schema/api/rolls'

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
      rolledMode,
      appliedMode,
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
