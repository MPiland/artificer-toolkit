import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { readPendingSnapshot } from './pendingSnapshots.js'
import type { EncounterReadContext, EncounterWriteContext } from './store.js'

type ReactionChildLink = {
  campaignId: string
  encounterId: string
  /** The root command of the action the reaction was chosen against. */
  parentCommandId: string
  childCommandId: string
}

/**
 * The pending action a reaction's child action answers (D219), or null when no pending action of
 * this Run records that child. The record is the proof: the pending action's own context names the
 * child command of each reaction chosen against it, so an open offer alone admits nothing.
 */
export async function readReactionChildParent(ctx: EncounterReadContext, input: ReactionChildLink) {
  const parent = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (query) =>
      query.eq('campaignId', input.campaignId).eq('rootCommandId', input.parentCommandId)
    )
    .unique()
  if (parent?.encounterId !== input.encounterId || parent.state !== 'PENDING') return null
  const snapshot = await readPendingSnapshot(ctx, parent)
  const recorded =
    snapshot?.snapshotKind === 'KERNEL_EVIDENCE' &&
    snapshot.applicationContext.kind === 'ENCOUNTER_ACTION' &&
    snapshot.applicationContext.reactionChildren?.some(
      ({ commandId }) => commandId === input.childCommandId
    )
  return recorded ? parent : null
}

/**
 * Moves the pending action a committed reaction child answers to the Run version the child
 * produced. A pending action is pinned to one Run version, so its later answers and its own commit
 * are fenced on the Run as the child left it.
 */
export async function repinReactionChildParent(
  ctx: EncounterWriteContext,
  input: ReactionChildLink & { version: number }
) {
  const parent = await readReactionChildParent(ctx, input)
  if (!parent) throw new Error('The reaction’s pending action is gone.')
  await ctx.db.patch(parent._id, { expectedEncounterVersion: input.version })
}

/**
 * How many reaction children of one root command committed between two Run versions, both
 * exclusive. A root's commit follows its own expected version by one version for each of them, and a
 * replay of the root counts them from the Run's commands instead of keeping a counter.
 */
export async function countCommittedReactionChildren(
  ctx: EncounterReadContext,
  input: { encounterId: string; rootCommandId: string; afterVersion: number; beforeVersion: number }
) {
  const commands = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_encounterId_version', (query) =>
      query
        .eq('encounterId', input.encounterId)
        .gt('version', input.afterVersion)
        .lt('version', input.beforeVersion)
    )
    .take(MAX_ENCOUNTER_ACTORS + 1)
  return commands.filter((row) => {
    if (row.commandType !== 'RESOLVE_ACTION') return false
    const { systemTrigger } = resolveEncounterActionInputDtoSchema.parse(
      JSON.parse(row.commandJson)
    )
    return (
      systemTrigger?.trigger === 'REACTION' &&
      systemTrigger.parentCommandId.toLowerCase() === input.rootCommandId
    )
  }).length
}
