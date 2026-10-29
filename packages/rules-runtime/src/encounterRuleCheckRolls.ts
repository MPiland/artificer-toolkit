import { v5 as uuidv5 } from 'uuid'
import {
  rollRecordDtoSchema,
  type RollRecordDto,
  type RollRuleCheckDto
} from '@artificer-toolkit/schema/api/rolls'
import type { ruleCheckD20EvidenceDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import type { damageSaveCheckApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionDamageSaveOutputs'
import type { ServerRuleExecutionD20EvidenceDto } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import {
  d20AddedDiceTotal,
  type D20RolledAddedDieDto
} from '@artificer-toolkit/schema/shared/d20AddedDice'
import type { D20MinimumRollDto } from '@artificer-toolkit/schema/shared/d20MinimumRoll'
import type { DamageSaveSource } from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'
import { rollModeCapabilityRegistry } from './platformPolicyModules.js'

function rollModeEntry(gameSystemId: string, rollMode: string) {
  const { mode, label } = rollModeCapabilityRegistry.d20Roll({ gameSystemId, rollMode })
  return { code: mode, label }
}

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
 * A d20 roll's evaluation with the test's added dice (D156) appended as further terms, in the
 * receipt's order: an added die adds its faces, a subtracted one (Bane) is marked and subtracts.
 */
export function withAddedDiceTerms(
  evaluated: ReturnType<typeof evaluateRollExpression>,
  addedDice: readonly D20RolledAddedDieDto[] | undefined
): ReturnType<typeof evaluateRollExpression> {
  if (!addedDice?.length) return evaluated
  const added = d20AddedDiceTotal(addedDice)
  const terms = addedDice.map(({ count, faces, sign, rolledFaces }) => {
    const sum = rolledFaces.reduce((total, face) => total + face, 0)
    return sign === 'ADD'
      ? { count, die: faces, rolls: [...rolledFaces], subtotal: sum }
      : { count, die: faces, rolls: [...rolledFaces], subtotal: -sum, subtracted: true as const }
  })
  const expression = addedDice
    .map(({ count, faces, sign }) => ` ${sign === 'ADD' ? '+' : '-'} ${count}d${faces}`)
    .join('')
  return {
    normalizedExpression: `${evaluated.normalizedExpression}${expression}`,
    evidence: {
      ...evaluated.evidence,
      terms: [...evaluated.evidence.terms, ...terms],
      subtotal: evaluated.evidence.subtotal + added,
      total: evaluated.evidence.total + added
    }
  }
}

/**
 * A d20 check's evaluation with the floor its roller's effects put on the kept d20 (Glibness's 15):
 * the d20 term's subtotal is the floor and the totals count it, while its rolls keep the face
 * rolled. `ruleCheck` is set only when the floor raised the roll, so the card can say why.
 */
export function withMinimumRoll(
  evaluated: ReturnType<typeof evaluateRollExpression>,
  minimumRoll: D20MinimumRollDto | undefined
): {
  evaluated: ReturnType<typeof evaluateRollExpression>
  ruleCheck?: Extract<RollRuleCheckDto, { kind: 'D20_MINIMUM_ROLL' }>
} {
  const [d20Term, ...rest] = evaluated.evidence.terms
  const raised = minimumRoll === undefined ? 0 : minimumRoll.amount - (d20Term?.subtotal ?? 0)
  if (!minimumRoll || !d20Term || raised <= 0) return { evaluated }
  return {
    evaluated: {
      ...evaluated,
      evidence: {
        ...evaluated.evidence,
        terms: [{ ...d20Term, subtotal: minimumRoll.amount }, ...rest],
        subtotal: evaluated.evidence.subtotal + raised,
        total: evaluated.evidence.total + raised
      }
    },
    ruleCheck: { kind: 'D20_MINIMUM_ROLL', amount: minimumRoll.amount, label: minimumRoll.label }
  }
}

/**
 * The roll-log record of one settled damage-triggered save: its dice as roll evidence. A
 * Concentration check adds the actor, the damage that triggered it, the DC and whether
 * Concentration was kept; an effect repeat save is a plain saving-throw card.
 */
const DAMAGE_SAVE_ROLL_LABELS: Record<DamageSaveSource, string> = {
  CONCENTRATION: 'Concentration',
  EFFECT_REPEAT_SAVE: 'Repeat save',
  MASSIVE_DAMAGE: 'Massive damage'
}

export function concentrationCheckRollRecord(input: {
  output: ReturnType<typeof damageSaveCheckApplicationOutputDtoSchema.parse>
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
  const evaluated = withAddedDiceTerms(
    evaluateRollExpression(
      parseRollExpression(`1d20${modifier}`),
      { nextInt: () => faces.shift()! - 1 },
      rollModeCapabilityRegistry.d20Roll({
        gameSystemId: input.ruleset.systemId,
        rollMode: d20.rollMode
      })
    ),
    d20.addedDice
  )
  if (evaluated.evidence.total !== d20.total)
    throw new Error('The Concentration roll record does not match its check.')
  return rollRecordDtoSchema.parse({
    id: ruleCheckRollId(output.occurrenceId, 0),
    ...evaluated,
    characterId: null,
    characterLabel: input.actorLabel,
    source: {
      kind: 'SAVING_THROW',
      label: DAMAGE_SAVE_ROLL_LABELS[output.source]
    },
    ruleset: input.ruleset,
    createdAt: input.createdAt,
    ...(output.source === 'CONCENTRATION'
      ? {
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
        }
      : {})
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
  /** Labels of the conditions that made this save fail automatically, when `d20` carries any. */
  autoFailLabels?: readonly string[]
}): RollRecordDto {
  const { d20 } = input
  const faces = [...d20.rawFaces]
  const modifier =
    d20.modifier === 0 ? '' : d20.modifier > 0 ? `+${d20.modifier}` : `${d20.modifier}`
  const evaluated = withAddedDiceTerms(
    evaluateRollExpression(
      parseRollExpression(`1d20${modifier}`),
      { nextInt: () => faces.shift()! - 1 },
      rollModeCapabilityRegistry.d20Roll({
        gameSystemId: input.ruleset.systemId,
        rollMode: d20.rollMode
      })
    ),
    d20.addedDice
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
    ...(d20.foldedBonuses ? { foldedBonuses: d20.foldedBonuses } : {}),
    ...(adjustment
      ? {
          ruleCheck: {
            kind: 'D20_MODE_ADJUSTED',
            rolledMode: rollModeEntry(input.ruleset.systemId, adjustment.rolledMode),
            appliedMode: rollModeEntry(input.ruleset.systemId, d20.rollMode),
            cancelledRollIndexes: adjustment.cancelledRollIndexes,
            addedRollIndexes: adjustment.addedRollIndexes,
            caption: input.reader === 'GM' ? adjustment.gmReason : adjustment.playerCaption
          }
        }
      : input.autoFailLabels?.length
        ? { ruleCheck: { kind: 'SAVE_AUTO_FAIL', labels: [...input.autoFailLabels] } }
        : {})
  })
}

/**
 * The roll-log record of a dying Character's death save: one d20, no modifier (D96), plus the
 * Encounter save's added dice (D156). The Encounter turn-start save is the actor's (no Character
 * id); a Sheet save names its Character and keys the record by its command.
 */
export function deathSaveRollRecord(input: {
  occurrenceId: string
  rawDie: number
  addedDice?: readonly D20RolledAddedDieDto[]
  characterId?: string
  rollerLabel: string
  ruleset: RollRecordDto['ruleset']
  createdAt: string
}): RollRecordDto {
  const evaluated = withAddedDiceTerms(
    evaluateRollExpression(parseRollExpression('1d20'), { nextInt: () => input.rawDie - 1 }),
    input.addedDice
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
  const evaluated = evaluateRollExpression(parseRollExpression('1d6'), {
    nextInt: () => input.rawDie - 1
  })
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

/** The roll-log record of one roll on an authored table (ATTACK-15), labelled by its table. */
export function tableRollRecord(input: {
  occurrenceId: string
  dieFaces: number
  rawDie: number
  tableLabel: string
  rollerLabel: string
  ruleset: RollRecordDto['ruleset']
  createdAt: string
}): RollRecordDto {
  const evaluated = evaluateRollExpression(parseRollExpression(`1d${input.dieFaces}`), {
    nextInt: () => input.rawDie - 1
  })
  return rollRecordDtoSchema.parse({
    id: ruleCheckRollId(input.occurrenceId, 0),
    ...evaluated,
    characterId: null,
    characterLabel: input.rollerLabel,
    source: { kind: 'TABLE', label: input.tableLabel.slice(0, 80) },
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
  /** The System roll mode of a d20 initiative; absent when the roll has no mode of its own. */
  rollMode?: string
  nextInt: (size: number) => number
  characterId: string | null
  rollerLabel: string
  ruleset: RollRecordDto['ruleset']
  createdAt: string
}): RollRecordDto {
  const evaluated = evaluateRollExpression(
    parseRollExpression(input.expression),
    { nextInt: input.nextInt },
    input.rollMode === undefined
      ? undefined
      : rollModeCapabilityRegistry.d20Roll({
          gameSystemId: input.ruleset.systemId,
          rollMode: input.rollMode
        })
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
 * (Stealth)), or of a GM-declared save such as a morale save, from its recorded faces and the
 * roller's modifier. The card is the roller's own; a check with a DC (a morale save) names it.
 */
export function basicActionCheckRollRecord(input: {
  occurrenceId: string
  /** The card's id where the occurrence cards more than one check. */
  rollId?: string
  sourceKind?: 'SAVING_THROW' | 'SKILL_CHECK'
  d20: Omit<ReturnType<typeof ruleCheckD20EvidenceDtoSchema.parse>, 'dc'>
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
  const { evaluated, ruleCheck } = withMinimumRoll(
    withAddedDiceTerms(
      evaluateRollExpression(
        parseRollExpression(`1d20${modifier}`),
        { nextInt: () => faces.shift()! - 1 },
        rollModeCapabilityRegistry.d20Roll({
          gameSystemId: input.ruleset.systemId,
          rollMode: d20.rollMode
        })
      ),
      d20.addedDice
    ),
    d20.minimumRoll
  )
  if (evaluated.evidence.total !== d20.total)
    throw new Error('The basic action roll record does not match its check.')
  return rollRecordDtoSchema.parse({
    id: input.rollId ?? ruleCheckRollId(input.occurrenceId, 0),
    ...evaluated,
    ...(ruleCheck && { ruleCheck }),
    characterId: null,
    characterLabel: input.rollerLabel,
    source: {
      kind: input.sourceKind ?? 'SKILL_CHECK',
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
      keep: 'FIRST',
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
