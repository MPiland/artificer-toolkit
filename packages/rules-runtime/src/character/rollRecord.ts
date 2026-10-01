import { rollRecordDtoSchema, type RollSourceDto } from '@artificer-toolkit/schema/api/rolls'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'

/**
 * The retained record of one Campaign or Character roll, shared by Convex and the live room. The
 * caller supplies the dice source, so each host keeps its own secure randomness.
 */
export function createRollRecord(input: {
  /** Null for the GM's manual roll, which shows the GM's username as its label. */
  characterId: string | null
  label: string
  system: { id: string; rulesetCode: string; rulesetVersion: string }
  resolved: {
    expression: string
    rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
    source: RollSourceDto
  }
  nextInt: (maxExclusive: number) => number
}) {
  const { system, resolved } = input
  return rollRecordDtoSchema.parse({
    id: crypto.randomUUID(),
    characterId: input.characterId,
    characterLabel: input.label,
    source: resolved.source,
    ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
    ...evaluateRollExpression(
      parseRollExpression(resolved.expression),
      { nextInt: input.nextInt },
      resolved.rollMode
    ),
    createdAt: new Date().toISOString()
  })
}