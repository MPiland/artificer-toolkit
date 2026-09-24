import {
  encounterActiveEffectPlan,
  prepareNativeActionEffectsPlan
} from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import { projectNativeActionEffectTransitions } from '@artificer-toolkit/rules-runtime/encounterActionEffectReceipts'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { MutationCtx } from '../_generated/server'
import { createActiveRuleEffectStore } from '../rules/effectStore'
import { advanceNativeActionGraphs } from '@artificer-toolkit/rules-runtime/encounterActionExecution'
import { prepareNativeEncounterActionMechanics } from './actionMechanicsPreparation'

type PreparedMechanics = Awaited<ReturnType<typeof prepareNativeEncounterActionMechanics>>
type CompleteExecution = Extract<
  Awaited<ReturnType<typeof advanceNativeActionGraphs>>,
  { kind: 'COMPLETE' }
>

export type NativePreparedActionEffects = ReturnType<typeof prepareNativeActionEffectsPlan>

/** Reads every current owner needed by relationship restrictions; it performs no writes. */
export async function prepareNativeActionEffects(
  ctx: MutationCtx,
  input: {
    prepared: PreparedMechanics
    execution: CompleteExecution
    occurrenceId: string
    commandId: string
  }
): Promise<NativePreparedActionEffects> {
  const activeEffectsByActorId = new Map<string, readonly ActiveRuleEffectRecord[]>()
  const plan = encounterActiveEffectPlan(input.prepared, input.execution)
  if (plan?.actorRelationshipContribution) {
    const store = createActiveRuleEffectStore(ctx)
    for (const actor of input.prepared.actors) {
      const effects = await store.list(
        actor.kind === 'CHARACTER'
          ? actor.sourceId
            ? { kind: 'CHARACTER' as const, characterId: actor.sourceId }
            : (() => {
                throw new Error('Encounter Character active-effect owner is incomplete.')
              })()
          : {
              kind: 'ENCOUNTER_ACTOR' as const,
              encounterId: input.prepared.state.id,
              targetActorId: actor.id
            }
      )
      activeEffectsByActorId.set(actor.id, effects)
    }
  } else {
    for (const [actorId, target] of input.prepared.movementTargets)
      activeEffectsByActorId.set(actorId, target.activeEffects)
  }
  return prepareNativeActionEffectsPlan({ ...input, activeEffectsByActorId })
}

function owner(prepared: PreparedMechanics) {
  if (prepared.target.kind === 'CHARACTER') {
    if (!prepared.target.sourceId)
      throw new Error('Encounter Character effect owner is incomplete.')
    return { kind: 'CHARACTER' as const, characterId: prepared.target.sourceId }
  }
  return {
    kind: 'ENCOUNTER_ACTOR' as const,
    encounterId: prepared.state.id,
    targetActorId: prepared.target.id
  }
}

/** Creates only the effects prepared under the current Encounter transaction. */
export async function persistNativeActionEffects(
  ctx: MutationCtx,
  input: {
    prepared: PreparedMechanics
    preparedEffects: NativePreparedActionEffects
    maintainedEffectStateId?: string
  }
) {
  const store = createActiveRuleEffectStore(ctx)
  const targetOwner = owner(input.prepared)
  const state = input.preparedEffects.stateEffect
    ? await store.create({
        id: crypto.randomUUID(),
        owner: targetOwner,
        definition: input.preparedEffects.stateEffect.definition,
        lifecycle: input.preparedEffects.stateEffect.lifecycle
      })
    : null
  const recurring = input.preparedEffects.recurringEffect
    ? await store.create({
        id: crypto.randomUUID(),
        owner: targetOwner,
        definition: input.preparedEffects.recurringEffect.definition,
        lifecycle: input.preparedEffects.recurringEffect.lifecycle,
        maintainedEffectStateId: input.maintainedEffectStateId
      })
    : null
  return projectNativeActionEffectTransitions({
    state,
    recurring,
    targetActorId: input.prepared.target.id
  })
}
