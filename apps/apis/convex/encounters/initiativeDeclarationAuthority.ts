import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readCampaignAssignedCharacter } from '../campaigns/assignedCharacter'
import { readRunActor } from './documents'

/** A declaration and its replay belong to the Character's current Campaign controller. */
export async function requireInitiativeDeclarationController(
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
  if (command.resolution.kind !== 'INITIATIVE_DECLARATION') throw new Error('Campaign not found.')
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
  const actorId =
    history?.kind === 'INITIATIVE_DECLARATION' &&
    history.actorUserId === membership.userId &&
    history.commandFingerprint === fingerprint
      ? history.initiativeActorId
      : !history &&
          context?.kind === 'ENCOUNTER_INITIATIVE_DECLARATION' &&
          context.request.requestId === command.resolution.requestId
        ? context.request.actorId
        : null
  const assigned = await readCampaignAssignedCharacter(ctx, campaign, membership)
  const actor = actorId ? await readRunActor(ctx, state, actorId) : null
  if (!assigned || actor?.kind !== 'CHARACTER' || actor.sourceId !== assigned.id)
    throw new Error('Campaign not found.')
}
