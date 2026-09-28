import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { turnPendingActorId } from '@artificer-toolkit/rules-runtime/encounterTurnPending'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { requireEncounterActorControl } from './actorController'

/**
 * A player answers only the turn decisions that belong to an actor they control: its initiative
 * declaration, its turn-effect saves, a granted Creature's Recharge dice and Legendary Action
 * choice (with a target they can see) and dice, and the saves a Legendary Action forces on it.
 * A replay returns only to the user who answered, and a declaration replay also requires current
 * control. Every other turn step is the GM's.
 */
export async function requireTurnResponseController(
  ctx: QueryCtx,
  input: {
    campaign: Doc<'campaigns'>
    membership: Doc<'campaignMemberships'>
    state: EncounterRunState
    occurrence: Doc<'encounterRuleOccurrences'>
    receipt: Doc<'encounterRuleReceipts'> | null
    command: ResolveRuleOccurrenceInputDto
    fingerprint: string
  }
) {
  const { campaign, membership, state, occurrence, receipt, command, fingerprint } = input
  if (membership.role === 'OWNER') return
  const snapshot = occurrence.pendingSnapshotJson
    ? serverRuleExecutionPendingSnapshotDtoSchema.parse(JSON.parse(occurrence.pendingSnapshotJson))
    : null
  if (snapshot && checksumCanonicalJson(snapshot) !== occurrence.pendingSnapshotChecksum)
    throw new Error('Rule occurrence is unavailable.')
  const context = snapshot?.applicationContext
  const root =
    context?.kind === 'ENCOUNTER_INITIATIVE_DECLARATION' ||
    context?.kind === 'ENCOUNTER_INITIATIVE' ||
    context?.kind === 'ENCOUNTER_TURN_RECHARGE' ||
    context?.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
    context?.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' ||
    context?.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
      ? context.root
      : null
  const metadata = receipt
    ? serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
        JSON.parse(receipt.commandMetadataJson)
      )
    : null
  const history = (
    root?.resolutionCommands ??
    (metadata?.transition === 'TURN_EFFECTS' ? metadata.resolutionCommands : [])
  ).find((entry) => entry.commandId === command.commandId)
  if (history) {
    if (history.actorUserId !== membership.userId || history.commandFingerprint !== fingerprint)
      throw new Error('Campaign not found.')
    if (history.kind !== 'INITIATIVE_DECLARATION') return
  }
  const resolution = command.resolution
  const actorId = history
    ? history.initiativeActorId
    : context?.kind === 'ENCOUNTER_INITIATIVE_DECLARATION' &&
        resolution.kind === 'INITIATIVE_DECLARATION' &&
        context.request.requestId === resolution.requestId
      ? context.request.actorId
      : snapshot?.snapshotKind === 'KERNEL_EVIDENCE' &&
          (resolution.kind === 'ENTER_DICE' ||
            resolution.kind === 'ENTER_INTEGER' ||
            resolution.kind === 'SYSTEM_ROLL') &&
          snapshot.request.requestId === resolution.requestId
        ? turnPendingActorId(snapshot)
        : context?.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' &&
            snapshot &&
            (resolution.kind === 'DECLINE' || resolution.kind === 'LEGENDARY_OPTION')
          ? turnPendingActorId(snapshot)
          : null
  const actor = actorId ? await readRunActor(ctx, state, actorId) : null
  if (!actor) throw new Error('Campaign not found.')
  await requireEncounterActorControl(ctx, { campaign, membership, actor })
  // A player picks a Legendary Action's target among the actors they can see.
  if (
    resolution.kind === 'LEGENDARY_OPTION' &&
    !(await readRunActor(ctx, state, resolution.targetActorId)).public
  )
    throw new Error('Campaign not found.')
}
