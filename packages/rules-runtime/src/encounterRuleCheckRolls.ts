import { v5 as uuidv5 } from 'uuid'
import { rollRecordDtoSchema, type RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type { concentrationCheckApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import type { ServerRuleExecutionD20EvidenceDto } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'

const ruleCheckRollNamespace = '6b1f0c7e-3d2a-4f5b-9c8e-1a2b3c4d5e6f'

/** One settled rule check's log identity: its occurrence plus the check's index within it. */
function ruleCheckRollId(occurrenceId: string, checkIndex: number) {
  return uuidv5(`${occurrenceId}:${checkIndex}:rule-check-roll`, ruleCheckRollNamespace)
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
 */
export function actionD20RollRecord(input: {
  occurrenceId: string
  checkIndex: number
  d20: ServerRuleExecutionD20EvidenceDto
  actionLabel: string
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
    throw new Error('The action roll record does not match its evidence.')
  const isSave = d20.resultPath.startsWith('ON_SAVE_')
  return rollRecordDtoSchema.parse({
    id: ruleCheckRollId(input.occurrenceId, input.checkIndex),
    ...evaluated,
    characterId: null,
    characterLabel: input.rollerLabel,
    source: {
      kind: isSave ? 'SAVING_THROW' : 'ATTACK',
      label: (isSave ? `${input.actionLabel} save` : input.actionLabel).slice(0, 80)
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
