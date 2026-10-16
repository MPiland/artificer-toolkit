import { DND5E_DISARM_OPERATION_KEY } from '@artificer-toolkit/schema/shared/optionalCombat'
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
  | 'DISARM'
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
    (context?.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' && !!context.movementContinuation)
  )
}

/**
 * The decision the Encounter waits on that holds its Scene's moves and doors (D26): a movement
 * decision, or a reaction decision inside an attack.
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
  return context?.kind === 'ENCOUNTER_ACTION' && context.reactionChoice ? 'REACTION' : null
}

/** Structural facts only, so the precedence stays one pure decision. */
export type NativeEncounterOccurrenceFacts = {
  occurrence: Pick<EncounterDocument<'encounterRuleOccurrences'>, 'id' | 'rootCommandId'>
  context:
    | (Pick<PendingContext, 'kind'> & {
        contest?: { actionKind: string } | null
        movementContinuation?: unknown
      })
    | null
  rootCommandType: string | null
  completedDisarm: boolean
}

export function classifyNativeEncounterOccurrence({
  occurrence,
  context,
  rootCommandType,
  completedDisarm
}: NativeEncounterOccurrenceFacts): NativeEncounterOccurrenceOwner {
  if (
    (context?.kind === 'ENCOUNTER_ACTION' && context.contest?.actionKind === 'DISARM') ||
    completedDisarm
  )
    return 'DISARM'
  if (isNativeConcentrationOccurrence(occurrence)) return 'CONCENTRATION'
  if (
    context?.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING' ||
    occurrence.rootCommandId === cleavingChildCommandIdentity(occurrence.id)
  )
    return 'CLEAVING'
  if (
    context?.kind === 'ENCOUNTER_BASIC_ACTION_CHECK' ||
    context?.kind === 'ENCOUNTER_CONCEALMENT_CHECK'
  )
    return 'BASIC_ACTION'
  if (context?.kind === 'ENCOUNTER_ESCAPE_CHECK' || rootCommandType === 'ESCAPE_RELATIONSHIP')
    return 'ESCAPE'
  if (isNativeActionOccurrence({ context, rootCommandType })) return 'ACTION'
  if (
    context?.kind === 'ENCOUNTER_TURN_RECHARGE' ||
    context?.kind === 'ENCOUNTER_TURN_DEATH_SAVE' ||
    context?.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
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
    completedDisarm:
      occurrence.state === 'COMPLETED' &&
      rootCommandType === 'RESOLVE_ACTION' &&
      (await isCompletedNativeDisarm(ctx, run, occurrence))
  })
}
async function isCompletedNativeDisarm(
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
  return (
    payload.status === 'COMPLETE' &&
    payload.applicationOutputs.kind === 'CONTESTED_ACTION' &&
    payload.applicationOutputs.policy.moduleKey === DND5E_DISARM_OPERATION_KEY
  )
}
