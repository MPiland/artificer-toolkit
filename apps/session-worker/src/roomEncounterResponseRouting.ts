import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { readNativeEncounterOccurrenceOwner } from '@artificer-toolkit/encounter-persistence/occurrenceOwner'
import { readPendingRunDecision } from '@artificer-toolkit/encounter-persistence/pendingReads'
import type { EncounterReadTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type { EncounterDocument } from '@artificer-toolkit/encounter-persistence/store'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import {
  classifyRuleOccurrenceVoid,
  voidDeclineCommandId
} from '@artificer-toolkit/encounter-persistence/occurrenceVoid'
import type {
  ResolveRuleOccurrenceInputDto,
  VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import type { RoomEncounterStore } from './roomEncounterStore.js'

/** Retained evidence selects only implemented planners; each planner admits the caller again. */
export async function readRoomEncounterResponseRoute(
  store: RoomEncounterStore,
  command: Pick<ResolveRuleOccurrenceInputDto, 'encounterId' | 'occurrenceId'>
) {
  const run = await store.store
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', command.encounterId.toLowerCase()))
    .unique()
  const occurrence = await store.store
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (query) => query.eq('id', command.occurrenceId.toLowerCase()))
    .unique()
  if (
    !run ||
    !occurrence ||
    occurrence.encounterId !== run.id ||
    occurrence.campaignId !== run.campaignId
  )
    return null
  const owner = await readNativeEncounterOccurrenceOwner({ db: store.store }, run, occurrence.id)
  if (
    owner === 'TURN' ||
    owner === 'CONCENTRATION' ||
    owner === 'CLEAVING' ||
    owner === 'BASIC_ACTION' ||
    owner === 'ACTION' ||
    owner === 'DISARM' ||
    owner === 'MOVEMENT'
  )
    return owner
  const receipt = await store.store
    .query('encounterRuleReceipts')
    .withIndex('by_encounterId_commandId', (query) =>
      query.eq('encounterId', run.id).eq('commandId', occurrence.rootCommandId)
    )
    .unique()
  if (!receipt) return null
  const { transition } = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
    JSON.parse(receipt.commandMetadataJson)
  )
  if (transition === 'TURN_EFFECTS') return 'TURN' as const
  return transition === 'SPATIAL_MOVEMENT' ? ('MOVEMENT' as const) : null
}

/**
 * A decision is answered only while it is the Run's one pending occurrence, and a player answers
 * only their own (D78); the planner then admits the answer itself.
 */
export async function requireEncounterDecisionResponder(
  ctx: EncounterReadTransaction,
  run: EncounterDocument<'encounterRuns'>,
  userId: string,
  command: ResolveRuleOccurrenceInputDto | VoidRuleOccurrenceInputDto
) {
  const occurrenceId = command.occurrenceId.toLowerCase()
  const pending = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (query) =>
      query.eq('encounterId', run.id).eq('state', 'PENDING')
    )
    .take(2)
  if (pending.length !== 1 || pending[0]!.id !== occurrenceId)
    rejectDomain('VERSION_STALE', 'Rule occurrence is unavailable.')
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(run.campaignId, userId)
  if (
    membership.role !== 'OWNER' &&
    (await readPendingRunDecision(ctx, run, campaign, membership))?.occurrenceId !== occurrenceId
  )
    rejectDomain('NOT_ACTOR_CONTROLLER', "This decision isn't yours to answer.")
  return membership
}

/** A decision no room planner owns is refused as Convex refused it (D78). */
export async function refuseUnroutedEncounterDecision(
  ctx: EncounterReadTransaction,
  run: EncounterDocument<'encounterRuns'>,
  userId: string,
  command: ResolveRuleOccurrenceInputDto | VoidRuleOccurrenceInputDto
): Promise<never> {
  const membership = await requireEncounterDecisionResponder(ctx, run, userId, command)
  if (membership.role !== 'OWNER' && command.type === 'VOID_RULE_OCCURRENCE')
    rejectDomain('GM_ONLY')
  throw new Error('Rule occurrence is unavailable.')
}

/** Cancellation and refusal need no rules; declining voids require an implemented response path. */
export async function roomOwnsEncounterVoid(
  store: RoomEncounterStore,
  command: VoidRuleOccurrenceInputDto
) {
  const run = await store.store
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', command.encounterId.toLowerCase()))
    .unique()
  if (!run) return false
  const prior = await store.store
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (query) =>
      query.eq('campaignId', run.campaignId).eq('commandId', command.commandId.toLowerCase())
    )
    .unique()
  if (prior?.commandType === 'VOID_RULE_OCCURRENCE' && prior.encounterId === run.id) return true
  const occurrence = await store.store
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (query) => query.eq('id', command.occurrenceId.toLowerCase()))
    .unique()
  if (!occurrence || occurrence.encounterId !== run.id || occurrence.campaignId !== run.campaignId)
    return false
  if (occurrence.state === 'PENDING') {
    const snapshot = await readPendingSnapshot({ db: store.store }, occurrence)
    if (!snapshot) return false
    if (classifyRuleOccurrenceVoid(snapshot.applicationContext).kind !== 'DECLINE') return true
  } else {
    const declineId = voidDeclineCommandId(command.commandId.toLowerCase())
    const decline = await store.store
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (query) =>
        query.eq('campaignId', run.campaignId).eq('commandId', declineId)
      )
      .unique()
    if (!decline || decline.encounterId !== run.id) return false
  }
  const route = await readRoomEncounterResponseRoute(store, command)
  return route === 'TURN' || route === 'CLEAVING'
}
