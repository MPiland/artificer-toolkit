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
import { preparedSpellCastLevel } from '@artificer-toolkit/rules-runtime/encounterPreparedSpellCast'
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
    currentnessChecksum: plan.currentnessChecksum,
    reactionChildren: plan.reactionChildren,
    retargeted: plan.retargeted,
    castLevel: preparedSpellCastLevel(plan.prepared),
    castSlotKey: plan.prepared.characterActionState?.spellConsumption?.slotKey ?? null
  }
  return liveSessionEncounterActionPendingInputSchema.parse({
    ...scope,
    command: plan.command,
    response: plan.response,
    resume: plan.resume ?? undefined,
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
            passedIncomingGate: plan.passedIncomingGate
          })
        : buildEncounterHeldActionPendingSnapshot({
            ...pinned,
            continuation: plan.continuation,
            pause: plan.pause,
            rollerActorId: plan.rollerActorId,
            ...(plan.kind === 'CAST_PENDING' ? { passedIncomingGate: plan.passedIncomingGate } : {})
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
    resume: plan.resume ?? undefined,
    revisions: plan.revisions,
    maintenanceOwners: [...owners.values()],
    occurredAt: plan.occurredAt,
    initialDefinitionId: plan.execution.initialPublished.id,
    execution: plan.storedExecution,
    rules: plan.nextRules,
    resourceConsumption: plan.prepared.characterActionState?.resourceConsumption ?? null,
    itemConsumption: plan.prepared.characterActionState?.itemConsumption ?? null,
    spellConsumption: plan.prepared.characterActionState?.spellConsumption ?? null,
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
    consumedGrants: plan.consumedGrants,
    spentUseGrants: plan.spentUseGrants,
    turnUses: plan.turnUses,
    forcedMovements: plan.forcedMovements,
    reactionOffers: plan.reactionOffers
  })
}

type ProbePlan = Parameters<typeof buildNativeLiveEncounterActionPendingInput>[1]
type Missing = ProbePlan extends infer M
  ? M extends unknown
    ? 'retargeted' extends keyof M
      ? never
      : M
    : never
  : never
type Lack<K extends string> = 'retargeted' extends keyof Extract<ProbePlan, { kind: K }> ? 0 : 1
type Idx<K extends string> = string extends keyof Extract<ProbePlan, { kind: K }> ? 'index' : 'none'
export const probeA: [Lack<'PENDING'>, Lack<'CAST_PENDING'>, Lack<'GATE_PENDING'>, Lack<'RETARGET_PENDING'>] = 'a'
export const probeB: [Idx<'PENDING'>, Idx<'CAST_PENDING'>, Idx<'GATE_PENDING'>, Idx<'RETARGET_PENDING'>] = 'b'
export const probeKind: number = null as unknown as Missing['kind']
export const probeExecution: number = null as unknown as ProbePlan['kind']
