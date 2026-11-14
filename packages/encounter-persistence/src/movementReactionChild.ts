import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { appendEncounterMovementReactionResolutionCommand } from '@artificer-toolkit/rules-runtime/encounterMovementReactionContinuation'
import {
  movementReactionChildCommandId,
  reactionChildMoveCommandId
} from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readMovementResponseAuthority } from './movementResolutionDocuments.js'
import { readPendingSnapshot, writePendingSnapshot } from './pendingSnapshots.js'
import type { EncounterPersistenceTransaction } from './ports.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'
import { requireUnusedEvidenceCommandId } from './timelineEntries.js'

/**
 * Records the reaction a reactor's controller chose at a paused Scene move's contact (D219): the
 * choice is one more entry of the move's history, and the move's choice names the one command that
 * may run the chosen action as the reactor's own against the mover. The move stays paused at its
 * contact and the Run does not change; the room resumes the move once that child commits. Returns
 * what the child command is built from.
 */
export async function recordMovementReactionChild(
  ctx: EncounterPersistenceTransaction,
  command: ResolveRuleOccurrenceInputDto
) {
  const { resolution } = command
  if (resolution.kind !== 'OPTION') throw new Error('A move’s reaction child takes an option.')
  const { userId, campaign, occurrence, snapshot } = await readMovementResponseAuthority(
    ctx,
    command
  )
  const context = snapshot.applicationContext
  if (
    snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
    context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    context.phase.kind !== 'CHOICE' ||
    context.phase.reactionChildren?.length
  )
    throw new Error('The move is not awaiting a reaction choice.')
  const option = context.reactionTimeline[0]?.group.options.find(
    ({ optionId }) => optionId === resolution.optionId
  )
  if (!option) throw new Error('The selected movement reaction option was not issued.')
  await requireUnusedEvidenceCommandId(ctx, campaign.id, command.commandId)
  const { root } = context
  const resolutionCommands = appendEncounterMovementReactionResolutionCommand({
    history: root.resolutionCommands,
    command: {
      commandId: command.commandId,
      commandFingerprint: checksumCanonicalJson(command),
      actorUserId: userId,
      correlationId: command.correlationId ?? null,
      expectedOccurrenceVersion: command.expectedOccurrenceVersion,
      kind: 'OPTION',
      optionId: option.optionId
    },
    selection: { kind: 'OPTION', optionId: option.optionId },
    actorUserId: userId,
    proposedOccurrenceVersion: occurrence.version + 1
  })
  const child = {
    parentCommandId: root.commandId,
    holderActorId: option.candidate.reactorActorId,
    actionId: option.actionId,
    moveOccurrenceVersion: occurrence.version
  }
  await ctx.db.patch(occurrence._id, {
    version: occurrence.version + 1,
    pendingSnapshotChecksum: await writePendingSnapshot(ctx, occurrence, {
      ...snapshot,
      applicationContext: {
        ...context,
        root: { ...root, resolutionCommands },
        phase: {
          kind: 'CHOICE',
          reactionChildren: [
            {
              commandId: movementReactionChildCommandId({
                ...child,
                occurrenceVersion: child.moveOccurrenceVersion
              })
            }
          ]
        }
      }
    }),
    updatedAt: new Date().toISOString()
  })
  return { ...child, targetActorId: option.candidate.movingActorId }
}

/**
 * The resume the room issues for a Run's paused Scene move once the reaction child its choice
 * records has committed (D219), or null when the Run's pending decision is anything else or the
 * child is still to commit. Its command id names the move's version, so a retry replays and a
 * reaction chosen again after a release resumes under a fresh id.
 */
export async function readMovementReactionChildResume(
  ctx: EncounterReadContext,
  run: Pick<EncounterDocument<'encounterRuns'>, 'id' | 'campaignId' | 'version'>
): Promise<ResolveRuleOccurrenceInputDto | null> {
  const [occurrence] = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (query) =>
      query.eq('encounterId', run.id).eq('state', 'PENDING')
    )
    .take(1)
  const context = occurrence && (await readPendingSnapshot(ctx, occurrence))?.applicationContext
  const childCommandId =
    context?.kind === 'ENCOUNTER_MOVEMENT_REACTION' && context.phase.kind === 'CHOICE'
      ? context.phase.reactionChildren?.[0]?.commandId
      : undefined
  if (!occurrence || context?.kind !== 'ENCOUNTER_MOVEMENT_REACTION' || !childCommandId) return null
  const committed = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (query) =>
      query.eq('campaignId', run.campaignId).eq('commandId', childCommandId)
    )
    .unique()
  if (!committed) return null
  const resolution = { kind: 'REACTION_CHILD_RESUME' as const, childCommandId }
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    encounterId: run.id,
    commandId: reactionChildMoveCommandId({
      ...resolution,
      parentCommandId: context.root.commandId,
      occurrenceVersion: occurrence.version
    }),
    expectedVersion: run.version,
    correlationId: null,
    occurrenceId: occurrence.id,
    expectedOccurrenceVersion: occurrence.version,
    resolution
  }
}

/**
 * Moves a held Scene move to the Scene version its committed reaction child left (D219), before the
 * room's resume reads it. A paused move is pinned to one Scene version, and a child that changed the
 * Scene committed past it; the move's own token must still stand at the contact, which the resume
 * checks. The move's history and version do not change.
 */
export async function repinMovementReactionChildScene(
  ctx: EncounterPersistenceTransaction,
  resume: ResolveRuleOccurrenceInputDto,
  sceneVersion: number
) {
  const { occurrence, snapshot } = await readMovementResponseAuthority(ctx, resume)
  const context = snapshot.applicationContext
  if (
    snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
    context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    context.root.currentSceneVersion === sceneVersion
  )
    return
  await ctx.db.patch(occurrence._id, {
    pendingSnapshotChecksum: await writePendingSnapshot(ctx, occurrence, {
      ...snapshot,
      applicationContext: {
        ...context,
        root: { ...context.root, currentSceneVersion: sceneVersion }
      }
    })
  })
}
