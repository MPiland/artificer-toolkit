import type { LiveSessionEncounterBasicActionCommand } from '@artificer-toolkit/schema/api/liveSessionCommandScopes'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { readBasicActionAdmission, readEscapeAdmission } from './basicActionAdmission.js'
import {
  readBasicActionCheckResponseAdmission,
  readEscapeCheckResponseAdmission
} from './basicActionCheckAdmission.js'
import { readPendingSnapshot } from './pendingSnapshots.js'
import type { EncounterReadTransaction } from './ports.js'

/**
 * Admits whichever command the BASIC_ACTION capture scope carries: a basic action, an Escape, or
 * the d20 answer to the check either one pended (told apart by the pending occurrence's context).
 */
export async function readBasicActionScopeAdmission(
  ctx: EncounterReadTransaction,
  input: Omit<LiveSessionEncounterRulesInput, 'request'> & {
    command: LiveSessionEncounterBasicActionCommand
  }
) {
  const { command } = input
  if (command.type === 'RESOLVE_ACTION')
    return readBasicActionAdmission(ctx, { ...input, command })
  if (command.type === 'ESCAPE_RELATIONSHIP') return readEscapeAdmission(ctx, { ...input, command })
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', command.occurrenceId.toLowerCase()))
    .unique()
  const context = occurrence
    ? (await readPendingSnapshot(ctx, occurrence))?.applicationContext
    : null
  const admit =
    context?.kind === 'ENCOUNTER_ESCAPE_CHECK'
      ? readEscapeCheckResponseAdmission
      : readBasicActionCheckResponseAdmission
  return admit(ctx, { ...input, response: command })
}
