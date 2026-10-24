import { type ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { cleavingChildCommandIdentity } from '@artificer-toolkit/rules-runtime/encounterCleavingIdentity'
import { concentrationCommandId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { readPendingSnapshot } from './pendingSnapshots.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'

type PendingContext = ServerRuleExecutionPendingSnapshotDto['applicationContext']

/**
 * The native coordinator that owns a rule occurrence, in native resume precedence. `commands.ts`
 * dispatches on it and the Session room routes pending occurrences by it.
 */
type NativeEncounterOccurrenceOwner =
  | 'CONTEST'
  | 'CONCENTRATION'
  | 'CLEAVING'
  | 'BASIC_ACTION'
  | 'ESCAPE'
  | 'ACTION'
  | 'TURN'
  | 'MOVEMENT'
  | 'OTHER'

export function isNativeConcentrationOccurrence(
  occurrence: Pick<EncounterDocument<'encounterRuleOccurrences'>, 'id' | 'rootCommandId'>
) {
  return occurrence.rootCommandId === concentrationCommandId(occurrence.id)
}

export function isNativeActionOccurrence(input: {
  context: Pick<PendingContext, 'kind'> | null
  rootCommandType: string | null
}) {
  return (
    input.rootCommandType === 'RESOLVE_ACTION' ||
    input.context?.kind === 'ENCOUNTER_ACTION' ||
    input.context?.kind === 'ENCOUNTER_AREA_ACTION'
  )
}

/** The pending contexts the Session room resumes through Scene geometry. */
export function isEncounterMovementContext(
  context: NativeEncounterOccurrenceFacts['context'] | undefined
) {
  return (
    context?.kind === 'ENCOUNTER_SPATIAL_MOVEMENT' ||
    context?.kind === 'ENCOUNTER_MOVEMENT_REACTION' ||
    context?.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' ||
    (context?.kind === 'ENCOUNTER_CONTEST_CHECK' && !!context.origin?.movementContinuation)
  )
}

/**
 * The decision the Encounter waits on that holds its Scene's moves and doors (D26): a movement
 * decision, or a reaction decision inside an attack or before a cast.
 */
export async function readSceneHoldingDecision(
  ctx: EncounterReadContext,
  encounterId: string
): Promise<'MOVEMENT' | 'REACTION' | null> {
  const [pending] = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) =>
      q.eq('encounterId', encounterId).eq('state', 'PENDING')
    )
    .take(1)
  const snapshot = pending ? await readPendingSnapshot(ctx, pending) : null
  const context = snapshot?.applicationContext
  if (context && isEncounterMovementContext(context)) return 'MOVEMENT'
  return context?.kind === 'ENCOUNTER_ACTION' &&
    (context.pause?.kind === 'REACTION' || context.pause?.kind === 'CAST_REACTION')
    ? 'REACTION'
    : null
}

/** Structural facts only, so the precedence stays one pure decision. */
export type NativeEncounterOccurrenceFacts = {
  occurrence: Pick<EncounterDocument<'encounterRuleOccurrences'>, 'id' | 'rootCommandId'>
  context:
    | (Pick<PendingContext, 'kind'> & {
        contest?: { origin: { kind: string; actionKind?: string } } | null
        origin?: { kind: string; movementContinuation?: unknown }
      })
    | null
  rootCommandType: string | null
  completedContest: boolean
}

export function classifyNativeEncounterOccurrence({
  occurrence,
  context,
  rootCommandType,
  completedContest
}: NativeEncounterOccurrenceFacts): NativeEncounterOccurrenceOwner {
  // The contests one planner settles: Disarm, a basic action its target contests, and an escape
  // its holder contests.
  const contestOrigin = context?.kind === 'ENCOUNTER_ACTION' ? context.contest?.origin : null
  if (
    contestOrigin?.actionKind === 'DISARM' ||
    contestOrigin?.kind === 'BASIC_ACTION' ||
    contestOrigin?.kind === 'ESCAPE' ||
    completedContest
  )
    return 'CONTEST'
  if (isNativeConcentrationOccurrence(occurrence)) return 'CONCENTRATION'
  if (
    context?.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING' ||
    occurrence.rootCommandId === cleavingChildCommandIdentity(occurrence.id)
  )
    return 'CLEAVING'
  // A d20 window belongs to the check whose d20 opened it.
  const check = context?.kind === 'ENCOUNTER_D20_WINDOW' ? context.source.context : context
  if (check?.kind === 'ENCOUNTER_CONCEALMENT_CHECK' || check?.kind === 'ENCOUNTER_CHECK_ACTION')
    return 'BASIC_ACTION'
  if (check?.kind === 'ENCOUNTER_ESCAPE_CHECK' || rootCommandType === 'ESCAPE') return 'ESCAPE'
  if (isNativeActionOccurrence({ context, rootCommandType })) return 'ACTION'
  if (
    context?.kind === 'ENCOUNTER_TURN_RECHARGE' ||
    context?.kind === 'ENCOUNTER_TURN_DEATH_SAVE' ||
    context?.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
    context?.kind === 'ENCOUNTER_TURN_ZONE_EFFECTS' ||
    context?.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' ||
    context?.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE' ||
    context?.kind === 'ENCOUNTER_INITIATIVE' ||
    context?.kind === 'ENCOUNTER_INITIATIVE_DECLARATION'
  )
    return 'TURN'
  if (isEncounterMovementContext(context)) return 'MOVEMENT'
  return 'OTHER'
}

export async function readNativeEncounterOccurrenceOwner(
  ctx: EncounterReadContext,
  run: EncounterDocument<'encounterRuns'>,
  occurrenceId: string
): Promise<NativeEncounterOccurrenceOwner> {
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', occurrenceId))
    .unique()
  if (!occurrence) return 'OTHER'
  const context = (await readPendingSnapshot(ctx, occurrence))?.applicationContext ?? null
  const rootReceipt = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', run.campaignId).eq('commandId', occurrence.rootCommandId)
    )
    .unique()
  const rootCommandType = rootReceipt?.commandType ?? null
  return classifyNativeEncounterOccurrence({
    occurrence,
    context,
    rootCommandType,
    completedContest:
      occurrence.state === 'COMPLETED' &&
      (rootCommandType === 'RESOLVE_ACTION' || rootCommandType === 'ESCAPE') &&
      (await isCompletedNativeContest(ctx, run, occurrence))
  })
}
async function isCompletedNativeContest(
  ctx: EncounterReadContext,
  run: EncounterDocument<'encounterRuns'>,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>
) {
  const ruleReceipt = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_encounterId_commandId', (q) =>
      q.eq('encounterId', run.id).eq('commandId', occurrence.rootCommandId)
    )
    .unique()
  if (!ruleReceipt) return false
  const payload = storedRuleExecutionResultDtoSchema.parse(JSON.parse(ruleReceipt.resultJson))
  return payload.status === 'COMPLETE' && payload.applicationOutputs.kind === 'CONTESTED_ACTION'
}
