import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'

type RaiseContext = Pick<EncounterWriteTransaction, 'db'>

/**
 * The Run the next child of a committed command may run on: null when the Run is gone or already
 * waits on a decision, since a Run holds one PENDING decision. Every child moves the Run, so each
 * one reads it again.
 */
export async function readRoomRaisableRun(ctx: RaiseContext, encounterId: string) {
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', encounterId))
    .unique()
  const waiting = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (query) =>
      query.eq('encounterId', encounterId).eq('state', 'PENDING')
    )
    .first()
  return run && !waiting ? run : null
}

/**
 * The Run a turn may end on after a committed command: one a child may run on that also holds no
 * action or move behind a reaction child (D219). A held one is suspended until the room has settled
 * its child's commit, and it resumes in the turn it began in.
 */
export async function readRoomTurnEndableRun(ctx: RaiseContext, encounterId: string) {
  const run = await readRoomRaisableRun(ctx, encounterId)
  const held = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (query) =>
      query.eq('encounterId', encounterId).eq('state', 'SUSPENDED')
    )
    .first()
  return held ? null : run
}

/**
 * Raises one rule-raised root after a committed command. `command` builds it against the Run as it
 * stands, or returns null when this child has nothing to raise there. Answers `WAITING` when no
 * child can run on the Run now, so the caller decides whether its remaining children are skipped one
 * by one or left for the command that settles the decision.
 */
export async function raiseRoomChild(input: {
  ctx: RaiseContext
  encounterId: string
  command(
    run: NonNullable<Awaited<ReturnType<typeof readRoomRaisableRun>>>
  ): Promise<ResolveEncounterActionInputDto | null>
  execute(command: ResolveEncounterActionInputDto): Promise<unknown>
}): Promise<'RAISED' | 'SKIPPED' | 'WAITING'> {
  const run = await readRoomRaisableRun(input.ctx, input.encounterId)
  if (!run) return 'WAITING'
  const command = await input.command(run)
  if (!command) return 'SKIPPED'
  await input.execute(command)
  return 'RAISED'
}
