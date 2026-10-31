import {
  rollRecordDtoSchema,
  type RollAfterRollOfferDto,
  type RollRecordDto,
  type RollSourceDto
} from '@artificer-toolkit/schema/api/rolls'
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
  /** Dice the roller holds for after the d20 (D168); the record offers them and rolls none. */
  afterRollOffers?: readonly RollAfterRollOfferDto[]
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
    ...(input.afterRollOffers?.length && { afterRollOffers: input.afterRollOffers }),
    createdAt: new Date().toISOString()
  })
}

function omitOffers(record: RollRecordDto) {
  const settled = { ...record }
  delete settled.afterRollOffers
  return settled
}

/**
 * The record with one of its offered dice rolled and added (D168), in the order a die rolled with
 * the d20 would be. The die's effect is spent by the caller; every offer that effect held is used up,
 * and the record offers nothing once none is left.
 */
export function withAfterRollDie(
  record: RollRecordDto,
  offer: RollAfterRollOfferDto,
  nextInt: (maxExclusive: number) => number
): RollRecordDto {
  const { normalizedExpression, evidence } = withAddedDiceTerms(record, [
    {
      label: offer.label,
      count: offer.count,
      faces: offer.faces,
      sign: offer.sign,
      rolledFaces: Array.from({ length: offer.count }, () => nextInt(offer.faces) + 1)
    }
  ])
  const remaining = (record.afterRollOffers ?? []).filter(
    ({ effectId }) => effectId !== offer.effectId
  )
  return rollRecordDtoSchema.parse({
    ...omitOffers(record),
    normalizedExpression,
    evidence,
    ...(remaining.length > 0 && { afterRollOffers: remaining })
  })
}

/** The record with its offers withdrawn: the roller kept the roll as rolled. */
export function withoutAfterRollOffers(record: RollRecordDto): RollRecordDto {
  return rollRecordDtoSchema.parse(omitOffers(record))
}
