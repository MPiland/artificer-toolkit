import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/ruleExecutionProtocol'
import type { TurnResolutionCommandDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnCommands'
import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules'
import { readLatestAttempt } from './evidenceRolls.js'
import type { EncounterReadTransaction } from './ports.js'

/** One answer a member gave a rule request, as the journal retains it. */
export type RuleEvidenceAnswer = { requestId: string; occurrenceVersion: number; userId: string }

/** One settled die: the request it answered and the value it settled with. */
export type SettledDie = { requestId: string; value: number }

/**
 * The app-roll answers of one kind a turn's journaled resolution commands carry: `SYSTEM_ROLL` for
 * the turn-start Recharge and death save, `LEGENDARY_SYSTEM_ROLL` for Legendary Actions,
 * `INITIATIVE_SYSTEM_ROLL` for the initiative dice of a declaration.
 */
export function turnSystemRollAnswers(
  commands: readonly TurnResolutionCommandDto[],
  kind: 'SYSTEM_ROLL' | 'LEGENDARY_SYSTEM_ROLL' | 'INITIATIVE_SYSTEM_ROLL'
): RuleEvidenceAnswer[] {
  return commands.flatMap((command) =>
    command.kind === kind && 'requestId' in command
      ? [
          {
            requestId: command.requestId,
            occurrenceVersion: command.expectedOccurrenceVersion,
            userId: command.actorUserId
          }
        ]
      : []
  )
}

/**
 * The `SYSTEM_ROLL` answers an action occurrence has taken: the journaled evidence receipts of its
 * earlier phases, plus the response that completes it (not yet journaled).
 */
export async function actionSystemRollAnswers(
  ctx: EncounterReadTransaction,
  input: {
    occurrenceId: string
    response: ResolveRuleOccurrenceInputDto | null | undefined
    responderUserId: string
  }
): Promise<RuleEvidenceAnswer[]> {
  const rows = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_occurrenceId', (q) => q.eq('occurrenceId', input.occurrenceId))
    .take(RULE_GRAPH_LIMITS.NODES * 20 + 1)
  if (rows.length > RULE_GRAPH_LIMITS.NODES * 20)
    throw new Error('Action evidence receipts exceed their bound.')
  const answers = rows.flatMap((row) => {
    const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
      JSON.parse(row.commandMetadataJson)
    )
    return metadata.transition === 'ACTION_EVIDENCE' && metadata.resolutionKind === 'SYSTEM_ROLL'
      ? [
          {
            requestId: metadata.requestId,
            occurrenceVersion: metadata.expectedOccurrenceVersion,
            userId: row.actorUserId
          }
        ]
      : []
  })
  const { response } = input
  if (response?.resolution.kind === 'SYSTEM_ROLL')
    answers.push({
      requestId: response.resolution.requestId,
      occurrenceVersion: response.expectedOccurrenceVersion,
      userId: input.responderUserId
    })
  return answers
}

/** The request a completed execution settled with `value`, from its retained evidence trace. */
export function settledDie(
  execution: ServerCompletedRuleExecutionDto,
  value: number
): SettledDie | null {
  for (const entry of execution.evidence.trace)
    if (entry.evidence?.value === value) return { requestId: entry.evidence.requestId, value }
  return null
}

/**
 * Which settled dice the app already carded. A die a `SYSTEM_ROLL` answer settled was carded as its
 * app attempt, so the commit must not card it again; every other die (auto-rolled or entered) is
 * the commit's to card. Each answer is joined to its latest attempt and covers at most one die of
 * the same request and value, because one occurrence can ask the same request more than once.
 * Returns the indexes into `dice`; a null entry is a die that was never asked for.
 */
export async function readAppCardedDice(
  ctx: EncounterReadTransaction,
  input: {
    occurrenceId: string
    answers: readonly RuleEvidenceAnswer[]
    dice: readonly (SettledDie | null)[]
  }
): Promise<ReadonlySet<number>> {
  const carded = new Set<number>()
  for (const answer of input.answers) {
    const attempt = await readLatestAttempt(ctx, {
      occurrenceId: input.occurrenceId,
      occurrenceVersion: answer.occurrenceVersion,
      requestId: answer.requestId,
      userId: answer.userId
    })
    if (!attempt) continue
    const index = input.dice.findIndex(
      (die, position) =>
        !carded.has(position) && die?.requestId === answer.requestId && die.value === attempt.value
    )
    if (index >= 0) carded.add(index)
  }
  return carded
}
