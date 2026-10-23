import { rollRecordDtoSchema, type RollSourceDto } from '@artificer-toolkit/schema/api/rolls'
import type { D20AddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import type { D20MinimumRollDto } from '@artificer-toolkit/schema/shared/d20MinimumRoll'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'

import { rollModeCapabilityRegistry } from '../platformPolicyModules.js'
import { withAddedDiceTerms, withMinimumRoll } from '../encounterRuleCheckRolls.js'

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
    /** The System roll mode of a d20 roll; absent for any other roll. */
    rollMode?: string | undefined
    source: RollSourceDto
  }
  /** Dice the roll adds beside its d20, rolled after advantage keeps one (D156). */
  addedDice?: readonly D20AddedDieDto[]
  /** The floor on the d20 the roll keeps (Glibness); the record raises a lower face to it. */
  minimumRoll?: D20MinimumRollDto
  nextInt: (maxExclusive: number) => number
}) {
  const { system, resolved } = input
  const { evaluated, ruleCheck } = withMinimumRoll(
    withAddedDiceTerms(
      evaluateRollExpression(
        parseRollExpression(resolved.expression),
        { nextInt: input.nextInt },
        resolved.rollMode === undefined
          ? undefined
          : rollModeCapabilityRegistry.d20Roll({
              gameSystemId: system.id,
              rollMode: resolved.rollMode
            })
      ),
      input.addedDice?.map((die) => ({
        ...die,
        rolledFaces: Array.from({ length: die.count }, () => input.nextInt(die.faces) + 1)
      }))
    ),
    input.minimumRoll
  )
  return rollRecordDtoSchema.parse({
    id: crypto.randomUUID(),
    characterId: input.characterId,
    characterLabel: input.label,
    source: resolved.source,
    ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
    ...evaluated,
    ...(ruleCheck && { ruleCheck }),
    createdAt: new Date().toISOString()
  })
}
