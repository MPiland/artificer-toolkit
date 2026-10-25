import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  liveSessionEncounterActionPendingInputSchema,
  liveSessionEncounterActionCommitInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import {
  buildEncounterActionPendingSnapshot,
  buildEncounterHeldActionPendingSnapshot
} from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import { encounterActionSourceLabel } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { planNativeLiveEncounterAction } from './nativeEncounterRules.js'

/** The sealed pending contract the room persists before acknowledging an assisted action. */
export function buildNativeLiveEncounterActionPendingInput(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: Extract<
    Awaited<ReturnType<typeof planNativeLiveEncounterAction>>,
    { kind: 'PENDING' | 'CAST_PENDING' | 'GATE_PENDING' | 'RETARGET_PENDING' }
  >
) {
  const pinned = {
    optionalCombatSnapshotChecksum: plan.prepared.state.optionalCombatSnapshotChecksum,
    commandJson: JSON.stringify(plan.command),
    commandFingerprint: plan.fingerprint,
    initiatorUserId: plan.initiatorUserId,
    currentnessChecksum: plan.currentnessChecksum
  }
  return liveSessionEncounterActionPendingInputSchema.parse({
    ...scope,
    command: plan.command,
    response: plan.response,
    revisions: plan.revisions,
    maintenanceOwners: plan.dependencies.flatMap(({ request }) =>
      request.kind === 'MAINTENANCE_OWNER' ? [request] : []
    ),
    snapshot:
      plan.kind === 'PENDING'
        ? buildEncounterActionPendingSnapshot({
            ...pinned,
            execution: plan.execution,
            sourceActorId: plan.prepared.actor.id,
            targetActorId: plan.prepared.target.id,
            failedCounters: plan.failedCounters,
            passedIncomingGate: plan.passedIncomingGate
          })
        : buildEncounterHeldActionPendingSnapshot({
            ...pinned,
            continuation: plan.continuation,
            pause: plan.pause,
            rollerActorId: plan.rollerActorId,
            ...(plan.kind === 'CAST_PENDING'
              ? { failedCounters: plan.failedCounters, passedIncomingGate: plan.passedIncomingGate }
              : {})
          })
  })
}

/** The completed action and child contracts the room persists in one transaction. */
export function buildNativeLiveEncounterActionCommitInput(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: Extract<Awaited<ReturnType<typeof planNativeLiveEncounterAction>>, { kind: 'PLANNED' }>
) {
  const owners = new Map(
    plan.dependencies.flatMap(({ request }) =>
      request.kind === 'MAINTENANCE_OWNER'
        ? [[checksumRuleDocument(request), request] as const]
        : []
    )
  )
  return liveSessionEncounterActionCommitInputSchema.parse({
    ...scope,
    command: plan.command,
    response: plan.response,
    revisions: plan.revisions,
    maintenanceOwners: [...owners.values()],
    occurredAt: plan.occurredAt,
    initialDefinitionId: plan.execution.initialPublished.id,
    execution: plan.storedExecution,
    rules: plan.nextRules,
    resourceConsumption: plan.prepared.characterActionState?.resourceConsumption ?? null,
    itemConsumption: plan.prepared.characterActionState?.itemConsumption ?? null,
    spellConsumption: plan.prepared.characterActionState?.spellConsumption ?? null,
    reactionSpellConsumption:
      plan.reactionUse?.prepared.characterActionState?.spellConsumption ?? null,
    failedCounters: plan.failedSpends.map(({ receipt, spellConsumption }) => ({
      receipt,
      spellConsumption
    })),
    label: encounterActionSourceLabel(plan.prepared.source),
    ruleOverrides: plan.ruleOverrides,
    createdEffects: plan.settlement.createdEffects,
    maintainedState: plan.settlement.maintainedState,
    concentration: plan.concentration.completed,
    pendingConcentration: plan.concentration.pending,
    concentrationEnds: plan.concentration.concentrationEnds,
    endedGrants: plan.concentration.endedGrants,
    cleaving: plan.cleaving,
    spellCheck: plan.spellCheck ?? undefined,
    consumedGrants: [...plan.consumedGrants, ...plan.reactionConsumedGrants],
    spentUseGrants: plan.spentUseGrants,
    turnUses: plan.turnUses,
    forcedMovements: plan.forcedMovements
  })
}
