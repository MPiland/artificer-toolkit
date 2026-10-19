import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { systemTriggerCommandId } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { readEncounterActorDefeated } from './characterStates.js'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readRunActor } from './documents.js'
import { rejectDomain } from './domainRejections.js'
import type { EncounterDocument } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

/**
 * A rule-raised root (SYSTEM admission) needs no controller and no turn: it is proved by the committed
 * parent command that raised it. The id must be the one derived from that parent and holder, the
 * parent's receipt must belong to this Run, and a fresh root runs on the version the parent produced
 * for a holder that is still at 0 hit points. A resume skips the version and defeat tests, as the
 * answers arrive in later commands.
 */
export async function requireSystemTriggerAdmission(
  ctx: EncounterReadTransaction,
  input: {
    run: EncounterDocument<'encounterRuns'>
    state: EncounterRunState
    command: ResolveEncounterActionInputDto & { systemTrigger: { parentCommandId: string } }
    fresh: boolean
  }
) {
  const { run, command } = input
  const parentCommandId = command.systemTrigger.parentCommandId.toLowerCase()
  // An answer that settles an action records only its rule receipt, never a Run command.
  const parent =
    (await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (query) =>
        query.eq('campaignId', run.campaignId).eq('commandId', parentCommandId)
      )
      .unique()) ??
    (await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_campaignId_commandId', (query) =>
        query.eq('campaignId', run.campaignId).eq('commandId', parentCommandId)
      )
      .unique())
  if (
    command.target.kind !== 'CASTER_CENTERED' ||
    command.commandId.toLowerCase() !==
      systemTriggerCommandId(parentCommandId, command.actorId.toLowerCase(), command.actionId) ||
    parent?.encounterId !== run.id
  )
    rejectDomain('COMMAND_ID_REUSED', 'The rule-raised action has no committed parent.')
  if (!input.fresh) return
  const parentVersion = 'encounterVersion' in parent! ? parent.encounterVersion : parent!.version
  if (parentVersion !== input.state.version || command.expectedVersion !== parentVersion)
    rejectDomain('VERSION_STALE')
  const holder = await readRunActor(ctx, input.state, command.actorId.toLowerCase())
  if (!(await readEncounterActorDefeated(ctx, holder))) rejectDomain('ACTOR_DEFEATED')
}
