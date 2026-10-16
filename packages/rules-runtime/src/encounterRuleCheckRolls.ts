import { v5 as uuidv5 } from 'uuid'
import { rollRecordDtoSchema, type RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type {
  basicActionCheckApplicationOutputDtoSchema,
  concentrationCheckApplicationOutputDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import type { ServerRuleExecutionD20EvidenceDto } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'

const ruleCheckRollNamespace = '6b1f0c7e-3d2a-4f5b-9c8e-1a2b3c4d5e6f'

/** One settled rule check's log identity: its occurrence plus the check's index within it. */
export function ruleCheckRollId(
  occurrenceId: string,
  checkIndex: number,
  scope = 'rule-check-roll'
) {
  return uuidv5(`${occurrenceId}:${checkIndex}:${scope}`, ruleCheckRollNamespace)
}

/**
 * The roll-log record of one settled Concentration check: its dice as roll evidence, plus the
 * actor, the damage that triggered it, the DC and whether Concentration was kept.
 */
export function concentrationCheckRollRecord(input: {
  output: ReturnType<typeof concentrationCheckApplicationOutputDtoSchema.parse>
  actorLabel: string
  ruleset: RollRecordDto['ruleset']
  createdAt: string
}): RollRecordDto {
  const { output } = input
  const { d20 } = output
  const faces = [...d20.rawFaces]
  const modifier =
    d20.modifier === 0 ? '' : d20.modifier > 0 ? `+${d20.modifier}` : `${d20.modifier}`
  // The recorded faces replay through the shared evaluator, so the evidence matches the check.
  const evaluated = evaluateRollExpression(
    parseRollExpression(`1d20${modifier}`),
    { nextInt: () => faces.shift()! - 1 },
    d20.rollMode
  )
  if (evaluated.evidence.total !== d20.total)
    throw new Error('The Concentration roll record does not match its check.')
  return rollRecordDtoSchema.parse({
    id: ruleCheckRollId(output.occurrenceId, 0),
    ...evaluated,
    characterId: null,
    characterLabel: input.actorLabel,
    source: { kind: 'SAVING_THROW', label: 'Concentration' },
    ruleset: input.ruleset,
    createdAt: input.createdAt,
    ruleCheck: {
      kind: 'CONCENTRATION',
      actorId: output.application.targetActorId,
      actorLabel: input.actorLabel,
      damage: {
        amount: output.application.appliedAmount,
        typeLabel: output.trigger.damageTypeLabel
      },
      sourceLabel: output.trigger.sourceLabel,
      dc: d20.dc,
      faces: d20.rawFaces,
      modifier: d20.modifier,
      total: d20.total,
      outcome: output.outcome === 'SAVE_SUCCESS' ? 'KEPT' : 'LOST'
    }
  })
}

/**
 * The roll-log record of one d20 an action rolled, from its recorded faces. An attack rolls for the
 * source; a save (`ON_SAVE_*`) rolls for the target. Damage has its own total-only record
 * ({@link actionDamageRollRecord}).
 *
 * A d20 the server settled in another mode than it was rolled for (ATTACK-10.1) lists every die,
 * rolled then added, with the cancelled ones marked and the kept one indexed. `reader` picks the
 * caption: the player's generic one, or the GM's specific reason, which is a distinct card.
 */
export function actionD20RollRecord(input: {
  occurrenceId: string
  checkIndex: number
  d20: ServerRuleExecutionD20EvidenceDto
  actionLabel: string
  rollerLabel: string
  ruleset: RollRecordDto['ruleset']
  createdAt: string
  reader: 'PLAYER' | 'GM'
}): RollRecordDto {
  const { d20 } = input
  const faces = [...d20.rawFaces]
  const modifier =
    d20.modifier === 0 ? '' : d20.modifier > 0 ? `+${d20.modifier}` : `${d20.modifier}`
  const evaluated = evaluateRollExpression(
    parseRollExpression(`1d20${modifier}`),
    { nextInt: () => faces.shift()! - 1 },
    d20.rollMode
  )
  if (evaluated.evidence.total !== d20.total)
    throw new Error('The action roll record does not match its evidence.')
  const isSave = d20.resultPath.startsWith('ON_SAVE_')
  const adjustment = d20.modeAdjustment
  const dice = adjustment ? [...adjustment.rolledFaces, ...adjustment.addedFaces] : []
  const standing = dice.flatMap((_, index) =>
    adjustment?.cancelledRollIndexes.includes(index) ? [] : [index]
  )
  const term = evaluated.evidence.terms[0]!
  return rollRecordDtoSchema.parse({
    id: ruleCheckRollId(
      input.occurrenceId,
      input.checkIndex,
      adjustment && input.reader === 'GM' ? 'rule-check-roll-gm' : undefined
    ),
    ...evaluated,
    ...(adjustment
      ? {
          evidence: {
            ...evaluated.evidence,
            terms: [
              {
                ...term,
                count: dice.length,
                rolls: dice,
                keptRollIndex: standing[term.keptRollIndex ?? 0]
              }
            ]
          }
        }
      : {}),
    characterId: null,
    characterLabel: input.rollerLabel,
    source: {
      kind: isSave ? 'SAVING_THROW' : 'ATTACK',
      label: (isSave ? `${input.actionLabel} save` : input.actionLabel).slice(0, 80)
    },
    ruleset: input.ruleset,
    createdAt: input.createdAt,
    ...(adjustment
      ? {
          ruleCheck: {
            kind: 'D20_MODE_ADJUSTED',
            rolledMode: adjustment.rolledMode,
            appliedMode: d20.rollMode,
            cancelledRollIndexes: adjustment.cancelledRollIndexes,
            addedRollIndexes: adjustment.addedRollIndexes,
            caption: input.reader === 'GM' ? adjustment.gmReason : adjustment.playerCaption
          }
        }
      : {})
  })
}

/**
 * The roll-log record of a dying Character's death save: one d20, no modifiers (D96). The
 * Encounter turn-start save is the actor's (no Character id); a Sheet save names its Character and
 * keys the record by its command.
 */
export function deathSaveRollRecord(input: {
  occurrenceId: string
  rawDie: number
  characterId?: string
  rollerLabel: string
  ruleset: RollRecordDto['ruleset']
  createdAt: string
}): RollRecordDto {
  const evaluated = evaluateRollExpression(
    parseRollExpression('1d20'),
    { nextInt: () => input.rawDie - 1 },
    'NORMAL'
  )
  return rollRecordDtoSchema.parse({
    id: ruleCheckRollId(input.occurrenceId, 0),
    ...evaluated,
    characterId: input.characterId ?? null,
    characterLabel: input.rollerLabel,
    source: { kind: 'DEATH_SAVE', label: 'Death save' },
    ruleset: input.ruleset,
    createdAt: input.createdAt
  })
}

/**
 * The roll-log record of one Recharge d6 an entering creature rolled at its turn start. The caller
 * scopes `occurrenceId` per Feature so one turn's several Recharge cards keep distinct ids.
 */
export function rechargeRollRecord(input: {
  occurrenceId: string
  rawDie: number
  featureLabel: string
  rollerLabel: string
  ruleset: RollRecordDto['ruleset']
  createdAt: string
}): RollRecordDto {
  const evaluated = evaluateRollExpression(
    parseRollExpression('1d6'),
    { nextInt: () => input.rawDie - 1 },
    'NORMAL'
  )
  return rollRecordDtoSchema.parse({
    id: ruleCheckRollId(input.occurrenceId, 0),
    ...evaluated,
    characterId: null,
    characterLabel: input.rollerLabel,
    source: { kind: 'RECHARGE', label: `${input.featureLabel} recharge`.slice(0, 80) },
    ruleset: input.ruleset,
    createdAt: input.createdAt
  })
}

/** `1dN` plus a signed initiative modifier, as a roll expression. */
export function initiativeRollExpression(sides: number, modifier: number) {
  return `1d${sides}${modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : modifier}`
}

/**
 * The roll-log record of one initiative roll: the Initiative card both a GM-rolled initiative
 * (live `nextInt`) and a declaration's settled die (recorded faces replayed through `nextInt`)
 * post, so the two cards are the same by construction.
 */
export function initiativeRollRecord(input: {
  id: string
  expression: string
  rollMode: Parameters<typeof evaluateRollExpression>[2]
  nextInt: (size: number) => number
  characterId: string | null
  rollerLabel: string
  ruleset: RollRecordDto['ruleset']
  createdAt: string
}): RollRecordDto {
  const evaluated = evaluateRollExpression(
    parseRollExpression(input.expression),
    { nextInt: input.nextInt },
    input.rollMode
  )
  return rollRecordDtoSchema.parse({
    id: input.id,
    ...evaluated,
    characterId: input.characterId,
    characterLabel: input.rollerLabel,
    source: { kind: 'INITIATIVE', label: 'Initiative' },
    ruleset: input.ruleset,
    createdAt: input.createdAt
  })
}

/**
 * The roll-log record of a basic action's check (First Aid's Wisdom (Medicine), Hide's Dexterity
 * (Stealth)), from its recorded faces and the roller's modifier. The card is the roller's own and
 * names no DC.
 */
export function basicActionCheckRollRecord(input: {
  occurrenceId: string
  /** The card's id where the occurrence cards more than one check. */
  rollId?: string
  d20: Omit<ReturnType<typeof basicActionCheckApplicationOutputDtoSchema.parse>['d20'], 'dc'>
  actionLabel: string
  checkLabel: string
  rollerLabel: string
  ruleset: RollRecordDto['ruleset']
  createdAt: string
}): RollRecordDto {
  const { d20 } = input
  const faces = [...d20.rawFaces]
  const modifier =
    d20.modifier === 0 ? '' : d20.modifier > 0 ? `+${d20.modifier}` : `${d20.modifier}`
  const evaluated = evaluateRollExpression(
    parseRollExpression(`1d20${modifier}`),
    { nextInt: () => faces.shift()! - 1 },
    d20.rollMode
  )
  if (evaluated.evidence.total !== d20.total)
    throw new Error('The basic action roll record does not match its check.')
  return rollRecordDtoSchema.parse({
    id: input.rollId ?? ruleCheckRollId(input.occurrenceId, 0),
    ...evaluated,
    characterId: null,
    characterLabel: input.rollerLabel,
    source: {
      kind: 'SKILL_CHECK',
      label: `${input.actionLabel}: ${input.checkLabel}`.slice(0, 80)
    },
    ruleset: input.ruleset,
    createdAt: input.createdAt
  })
}

/**
 * The roll-log record of the damage an action requested, total only: the persisted evidence keeps
 * the amount, not its dice faces, so the card shows the label and the total (no terms).
 */
export function actionDamageRollRecord(input: {
  occurrenceId: string
  checkIndex: number
  total: number
  actionLabel: string
  damageTypeLabel: string | null
  rollerLabel: string
  ruleset: RollRecordDto['ruleset']
  createdAt: string
}): RollRecordDto {
  return rollRecordDtoSchema.parse({
    id: ruleCheckRollId(input.occurrenceId, input.checkIndex),
    normalizedExpression: String(input.total),
    evidence: {
      terms: [],
      modifier: input.total,
      mode: 'NORMAL',
      subtotal: input.total,
      transform: { kind: 'NONE' },
      total: input.total
    },
    characterId: null,
    characterLabel: input.rollerLabel,
    source: {
      kind: 'DAMAGE',
      label:
        `${input.actionLabel}${input.damageTypeLabel ? `: ${input.damageTypeLabel}` : ''} damage`.slice(
          0,
          80
        )
    },
    ruleset: input.ruleset,
    createdAt: input.createdAt
  })
}
