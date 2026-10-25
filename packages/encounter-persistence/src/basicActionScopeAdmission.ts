import type { LiveSessionEncounterBasicActionCommand } from '@artificer-toolkit/schema/api/liveSessionCommandScopes'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  readBasicActionAdmission,
  readEndHeldGrantAdmission,
  readEscapeAdmission,
  readMoveHeldEffectAdmission,
  readChangeFacingAdmission,
  readReleaseRelationshipAdmission
} from './basicActionAdmission.js'
import {
  readBasicActionCheckResponseAdmission,
  readCheckActionResponseAdmission,
  readEscapeCheckResponseAdmission
} from './basicActionCheckAdmission.js'
import { readPendingSnapshot } from './pendingSnapshots.js'
import type { EncounterReadTransaction } from './ports.js'

/**
 * Admits whichever command the BASIC_ACTION capture scope carries: a basic action, an Escape, the
 * end of a held grant, the move of a held effect, a facing change, a relationship's release, or the d20 answer to the check either one pended (told apart by the pending occurrence's context).
 */
export async function readBasicActionScopeAdmission(
  ctx: EncounterReadTransaction,
  input: Omit<LiveSessionEncounterRulesInput, 'request'> & {
    command: LiveSessionEncounterBasicActionCommand
  }
) {
  const { command } = input
  if (command.type === 'RESOLVE_ACTION') return readBasicActionAdmission(ctx, { ...input, command })
  if (command.type === 'ESCAPE') return readEscapeAdmission(ctx, { ...input, command })
  if (command.type === 'END_HELD_GRANT')
    return readEndHeldGrantAdmission(ctx, { ...input, command })
  if (command.type === 'MOVE_HELD_EFFECT')
    return readMoveHeldEffectAdmission(ctx, { ...input, command })
  if (command.type === 'CHANGE_FACING') return readChangeFacingAdmission(ctx, { ...input, command })
  if (command.type === 'RELEASE_RELATIONSHIP')
    return readReleaseRelationshipAdmission(ctx, { ...input, command })
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', command.occurrenceId.toLowerCase()))
    .unique()
  const context = occurrence
    ? (await readPendingSnapshot(ctx, occurrence))?.applicationContext
    : null
  // A d20 window is answered under the check whose d20 opened it.
  const check = context?.kind === 'ENCOUNTER_D20_WINDOW' ? context.source.context : context
  const admit =
    check?.kind === 'ENCOUNTER_CHECK_ACTION'
      ? readCheckActionResponseAdmission
      : check?.kind === 'ENCOUNTER_ESCAPE_CHECK'
        ? readEscapeCheckResponseAdmission
        : readBasicActionCheckResponseAdmission
  return admit(ctx, { ...input, response: command })
}
