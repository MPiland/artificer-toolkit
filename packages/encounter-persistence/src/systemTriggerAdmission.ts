import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { systemTriggerCommandId } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import {
  encounterMassiveDamageRule,
  massiveDamageRulePinned
} from '@artificer-toolkit/rules-runtime/encounterMassiveDamage'
import { parseEncounterRuleActionId } from '@artificer-toolkit/rules-runtime/encounterRuleAction'
import { readEncounterActorDefeated } from './characterStates.js'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readRunActor } from './documents.js'
import { rejectDomain } from './domainRejections.js'
import type { EncounterDocument } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

// Answers and rule-raised roots since the command that opened the window; more is not one chain.
const RULE_TRIGGER_SCAN_LIMIT = 64

/**
 * The earliest Run version whose failed rule saves may still raise their rule's action: that of the
 * Run's last command that is neither an answer, a void, nor a rule-raised root. Answers and voids
 * settle the decisions its damage owed, and raised roots run after them, so none opens a new window;
 * any other command does. Null when no such command is within the scan.
 */
export async function ruleTriggerWindowStart(ctx: EncounterReadTransaction, encounterId: string) {
  const recent = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_encounterId_version', (query) => query.eq('encounterId', encounterId))
    .order('desc')
    .take(RULE_TRIGGER_SCAN_LIMIT)
  const opener = recent.find(
    (row) =>
      row.commandType !== 'RESOLVE_RULE_OCCURRENCE' &&
      row.commandType !== 'VOID_RULE_OCCURRENCE' &&
      !(
        row.commandType === 'RESOLVE_ACTION' &&
        resolveEncounterActionInputDtoSchema.parse(JSON.parse(row.commandJson)).systemTrigger
      )
  )
  return opener?.version ?? null
}

/**
 * The failed rule save a rule receipt records, with its holder and the action the rule raises for
 * it: today a massive-damage save whose pinned rule names a `failedSaveEffectId`. Null otherwise.
 */
export function ruleFailedSaveAction(
  state: EncounterRunState,
  receipt: Pick<EncounterDocument<'encounterRuleReceipts'>, 'resultJson'>
) {
  const result = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  const output = result.status === 'COMPLETE' ? result.applicationOutputs : null
  const rule = encounterMassiveDamageRule(state)
  if (
    output?.kind !== 'DAMAGE_SAVE_CHECK' ||
    output.source !== 'MASSIVE_DAMAGE' ||
    output.outcome !== 'SAVE_FAILURE' ||
    !massiveDamageRulePinned(rule, output) ||
    rule.failedSaveEffectId === null
  )
    return null
  return {
    holderActorId: output.application.targetActorId,
    definitionId: rule.pin.definitionId,
    effectId: rule.failedSaveEffectId
  }
}

/**
 * A rule-raised root (SYSTEM admission) needs no controller and no turn: it is proved by the committed
 * parent command that raised it. The id must be the one derived from that parent and holder, the
 * parent's receipt must belong to this Run, and a fresh root runs on the version the parent produced
 * for a holder that is still at 0 hit points. A start-of-turn root instead targets its holder, is
 * raised by the command that began the holder's turn, and runs while it is the holder's turn. A rule
 * root targets its holder too, and names the rule action the parent receipt's failed save raises for
 * that holder; it runs while the holder stands, within the window the save fell in, so the rule
 * actions of several saves one command failed each run. A resume skips the version and holder tests,
 * as the answers arrive in later commands.
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
  const { run, command, state } = input
  const parentCommandId = command.systemTrigger.parentCommandId.toLowerCase()
  const holderActorId = command.actorId.toLowerCase()
  const { trigger } = command.systemTrigger
  const readReceipt = () =>
    ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_campaignId_commandId', (query) =>
        query.eq('campaignId', run.campaignId).eq('commandId', parentCommandId)
      )
      .unique()
  // A rule root's parent is the failed save's receipt itself; an answer that settles an action
  // records only its rule receipt, never a Run command.
  const ruleParent = trigger === 'RULE' ? await readReceipt() : null
  const parent =
    trigger === 'RULE'
      ? ruleParent
      : ((await ctx.db
          .query('encounterRunCommands')
          .withIndex('by_campaignId_commandId', (query) =>
            query.eq('campaignId', run.campaignId).eq('commandId', parentCommandId)
          )
          .unique()) ?? (await readReceipt()))
  const failedSave = ruleParent ? ruleFailedSaveAction(state, ruleParent) : null
  const ruleAction = parseEncounterRuleActionId(command.actorId, command.actionId)
  const selfTargeted =
    command.target.kind === 'ACTOR' && command.target.actorId.toLowerCase() === holderActorId
  if (
    (trigger === 'START_OF_TURN'
      ? !selfTargeted ||
        !(
          parent &&
          'commandType' in parent &&
          ['START', 'ADVANCE_TURN'].includes(parent.commandType)
        )
      : trigger === 'RULE'
        ? !selfTargeted ||
          failedSave?.holderActorId !== holderActorId ||
          ruleAction?.definitionId !== failedSave.definitionId ||
          ruleAction.effectId !== failedSave.effectId
        : command.target.kind !== 'CASTER_CENTERED') ||
    command.commandId.toLowerCase() !==
      systemTriggerCommandId(parentCommandId, holderActorId, command.actionId) ||
    parent?.encounterId !== run.id
  )
    rejectDomain('COMMAND_ID_REUSED', 'The rule-raised action has no committed parent.')
  if (!input.fresh) return
  if (ruleParent) {
    const windowStart = await ruleTriggerWindowStart(ctx, run.id)
    const { encounterVersion } = ruleParent
    if (windowStart === null || encounterVersion < windowStart || encounterVersion > state.version)
      rejectDomain('VERSION_STALE')
    if (await readEncounterActorDefeated(ctx, await readRunActor(ctx, state, holderActorId)))
      rejectDomain('ACTOR_DEFEATED')
    return
  }
  const parentVersion = 'encounterVersion' in parent! ? parent.encounterVersion : parent!.version
  if (parentVersion !== state.version || command.expectedVersion !== parentVersion)
    rejectDomain('VERSION_STALE')
  if (trigger === 'START_OF_TURN') {
    if (state.currentActorId !== holderActorId) rejectDomain('NOT_CURRENT_ACTOR')
    return
  }
  const holder = await readRunActor(ctx, state, holderActorId)
  if (!(await readEncounterActorDefeated(ctx, holder))) rejectDomain('ACTOR_DEFEATED')
}
