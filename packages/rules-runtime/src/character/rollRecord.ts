import { rollRecordDtoSchema, type RollSourceDto } from '@artificer-toolkit/schema/api/rolls'
import type { D20AddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'

import { withAddedDiceTerms } from '../encounterRuleCheckRolls.js'

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
  /** Dice the roll adds beside its d20, rolled after advantage keeps one (D156). */
  addedDice?: readonly D20AddedDieDto[]
  nextInt: (maxExclusive: number) => number
}) {
  const { system, resolved } = input
  return rollRecordDtoSchema.parse({
    id: crypto.randomUUID(),
    characterId: input.characterId,
    characterLabel: input.label,
    source: resolved.source,
    ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
    ...withAddedDiceTerms(
      evaluateRollExpression(
        parseRollExpression(resolved.expression),
        { nextInt: input.nextInt },
        resolved.rollMode
      ),
      input.addedDice?.map((die) => ({
        ...die,
        rolledFaces: Array.from({ length: die.count }, () => input.nextInt(die.faces) + 1)
      }))
    ),
    createdAt: new Date().toISOString()
  })
}
