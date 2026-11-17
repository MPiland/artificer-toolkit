import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import {
  DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
  DND5E_SAVE_DC_FACT_KEY,
  MAX_CONDITIONS_PER_PATH,
  UUID,
  type Dnd5eCompiledEffectActionSource
} from './effectActionContracts.js'
import { dnd5eRepeatSave } from './effectActionFollowUp.js'
import { maintenancePlan } from './effectActionLifetime.js'
import { modifierGrantEntryPlan } from './effectActionModifierGrants.js'
import {
  directRepeatSaveEntries,
  repeatCadenceSupported,
  repeatSaveEscalations,
  repeatSaveFailureDamageRows,
  repeatSaveHeldTurns,
  sourceTurnStartSave
} from './effectActionNestedSave.js'
import { dnd5eResultGate } from './effectActionOperationRegistry.js'
import { canonicalRepeatTriggers } from './effectActionRepeatCarrier.js'

/**
 * The effect a failed save's delayed FOLLOW_UP_SAVE holds, planned from the entries of the result
 * block that applies the held condition (or timed grant) and authors the repeat. Its delayed save
 * becomes a separate active-effect graph, and the turn-effect kernel counts the grant form down with
 * its repeat save, so the grant tick planner leaves it alone. A cast with no first save of its own
 * (Power Word Stun, `ACTIVATED`) applies its condition at cast on the ON_USE path and only the
 * condition form repeats, against the DC the cast settles. A placed zone plans the one condition
 * its failed save holds the same way (D146). Null for any other shape.
 */
export function repeatSaveEffectPlan(
  action: Dnd5eCompiledEffectActionSource,
  entries: CompiledEffectGroup['entries'],
  triggerCode: 'SAVING_THROW' | 'ACTIVATED' = 'SAVING_THROW',
  /** The identity the plan is compiled under: the lead result block's, unless its owner has another (a zone's). */
  compiledEntryId?: string
): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
  const { saveEntry, leadEntries } = directRepeatSaveEntries(entries)
  const leadEntry = leadEntries[0]
  const pathCode = triggerCode === 'ACTIVATED' ? 'ON_USE' : 'ON_SAVE_FAIL'
  if (
    // A cast with no save of its own applies only what its save repeats (Power Word Stun).
    (triggerCode === 'ACTIVATED' && leadEntries.length + 1 !== entries.length) ||
    !leadEntry ||
    !saveEntry ||
    !('outcome' in leadEntry) ||
    !('outcome' in saveEntry) ||
    saveEntry.resolutionKind !== 'DIRECT' ||
    saveEntry.groupKind !== 'SEQUENTIAL' ||
    saveEntry.pathCode !== pathCode ||
    saveEntry.outcome.effectKind !== 'FOLLOW_UP_SAVE' ||
    // One held grant, or the conditions of one result: the same path, block and duration.
    leadEntries.some(
      (entry) =>
        !('outcome' in entry) ||
        entry.resolutionKind !== 'DIRECT' ||
        entry.groupKind !== 'SEQUENTIAL' ||
        entry.pathCode !== pathCode ||
        entry.resultBlockId !== saveEntry.resultBlockId ||
        JSON.stringify(entry.duration) !== JSON.stringify(leadEntry.duration) ||
        (leadEntries.length > 1 && entry.outcome.effectKind !== 'CONDITION') ||
        (triggerCode === 'ACTIVATED' && entry.outcome.effectKind !== 'CONDITION')
    ) ||
    leadEntries.length > MAX_CONDITIONS_PER_PATH ||
    (triggerCode === 'ACTIVATED' && leadEntries.length !== 1)
  ) {
    return null
  }
  const entryId = compiledEntryId ?? leadEntry.resultBlockId
  const lead = leadEntry.outcome
  const save = saveEntry.outcome
  const leadConditions = leadEntries.flatMap((entry) =>
    'outcome' in entry && entry.outcome.effectKind === 'CONDITION' ? [entry.outcome] : []
  )
  if (new Set(leadConditions.map(({ conditionId }) => conditionId)).size !== leadConditions.length)
    return null
  const heldConditionIds = leadConditions.map(({ conditionId }) => conditionId)
  const escalations = repeatSaveEscalations({
    save,
    heldConditionIds,
    singleCondition: lead.effectKind === 'CONDITION' && leadEntries.length === 1,
    timed: Boolean(leadEntry.duration),
    knownConditionIds: action.conditionDefinitionIds ?? []
  })
  if (!escalations) return null
  // A failure that ends the effect counts one turn, whatever the held condition's duration.
  const { escalation, heldEscalation, completion } = escalations
  const sourceTurn =
    lead.effectKind === 'CONDITION' && !leadEntry.duration ? sourceTurnStartSave(save) : null
  const initialRemaining = repeatSaveHeldTurns({
    save,
    escalated: escalation !== null,
    sourceTurn: sourceTurn !== null,
    duration: leadEntry.duration
  })
  const repeatSave = dnd5eRepeatSave({
    abilityDefinitionId: save.savingThrow.abilityDefinitionId,
    savingThrow: save.savingThrow,
    requestNodeId: 'repeat-save-d20',
    heldConditionIds,
    escalationConditionId: (escalation ?? heldEscalation)?.conditionId,
    escalationHeld: heldEscalation !== null,
    durationCompleteConditionId: completion?.conditionId,
    repeatRollInfluence: save.repeatRollInfluence,
    repeatAttemptGate: save.repeatAttemptGate,
    triggersOnly: save.timing === 'ON_TRIGGERS_ONLY'
  })
  const grantPlan =
    lead.effectKind === 'APPLY_GRANT'
      ? modifierGrantEntryPlan({
          action,
          entry: leadEntry,
          resultGated: false,
          untilEndEvent: false
        })
      : null
  const grantContribution = grantPlan?.modifierGrantContribution
  // The test template is compiled once for every cast level; the effect's plan picks the row.
  const failsWithDamage = repeatSaveFailureDamageRows(save) !== null
  const contribution =
    leadConditions.length > 0 &&
    leadConditions.every(
      ({ conditionId }) =>
        UUID.test(conditionId) && (action.conditionDefinitionIds ?? []).includes(conditionId)
    )
      ? {
          // The effect owns a held escalation from the start, so whatever ends it early (its
          // Concentration) releases the escalation too; until the tally settles it is not present.
          conditionContributions: [
            ...leadConditions,
            ...(heldEscalation ? [heldEscalation] : [])
          ].map(({ conditionId, recordsSource, fleesSource }) => ({
            conditionId,
            recordsSource,
            fleesSource
          }))
        }
      : grantPlan && grantContribution
        ? {
            tickAnchor: grantPlan.tickAnchor,
            modifierGrantContribution: { ...grantContribution, countedByTurnEffects: true }
          }
        : null
  if (
    !contribution ||
    !UUID.test(entryId) ||
    initialRemaining === null ||
    (!sourceTurn && !repeatCadenceSupported(save, escalation !== null)) ||
    !repeatSave ||
    save.onSuccess.kind !== 'END' ||
    (escalation === null &&
      heldEscalation === null &&
      !sourceTurn &&
      !failsWithDamage &&
      save.onFailure.kind !== 'CONTINUE') ||
    (save.repeatAttemptGate && save.repeatRollInfluence)
  ) {
    return null
  }
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: entryId,
    frozenGraphNodeId: 'repeat-save-test',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: 'END_OF_TURN',
    initialRemaining,
    ...sourceTurn,
    ...contribution,
    // A held grant is made only on the save result it is authored on; held conditions are the graph's.
    ...(lead.effectKind !== 'CONDITION' &&
      leadEntry.pathCode !== 'ON_USE' && { resultGate: dnd5eResultGate(leadEntry.pathCode) }),
    ...(save.repeatTriggers?.length && {
      lifecycle: { endTriggers: [], repeatTriggers: canonicalRepeatTriggers(save.repeatTriggers) }
    }),
    adapterFacts: repeatSave.adapterFacts,
    ...(save.attempts.kind === 'THRESHOLDS' && {
      saveThresholds: {
        successesToEnd: save.attempts.successesToEnd,
        failuresToResolve: save.attempts.failuresToResolve,
        consecutive: save.attempts.consecutive
      }
    }),
    // A cast with no save of its own rolls no d20 to carry the DC, so the cast's own graph settles it.
    ...(triggerCode === 'ACTIVATED' ? { castFactKeys: [DND5E_SAVE_DC_FACT_KEY] } : {}),
    castSaveDcFactKey: triggerCode === 'ACTIVATED' ? null : repeatSave.castSaveDcFactKey,
    perceptionContributions: [],
    maintenance: maintenancePlan(action, leadEntry),
    marginRiders: []
  }
}
