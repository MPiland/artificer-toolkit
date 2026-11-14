import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { effectRepeatSaveApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionDamageSaveOutputs'
import type { NativeEffectRepeatSaveContext } from '@artificer-toolkit/rules-runtime/encounterEffectRepeatSave'
import type { ConcentrationDamageApplicationDto } from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import { isEncounterActorDefeated } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import {
  planDamageSaveChain,
  type DamageSaveEffectHolder
} from '@artificer-toolkit/rules-runtime/encounterDamageSaveChain'
import { encounterMassiveDamageRule } from '@artificer-toolkit/rules-runtime/encounterMassiveDamage'
import type { OptionalCombatPolicyInput } from '@artificer-toolkit/rules-runtime/optionalCombatPolicyCapability'
import { requireInstalledConcentrationMaintenanceDefinitionId } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readEncounterActorMaximumHitPoints } from './characterMaximumHitPoints.js'
import { readDeadCharacterIds } from './characterStates.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { endEncounterEscapedEffect } from './escapedEffectEndPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import type { EncounterWriteContext } from './store.js'

type EffectRepeatSaveOutput = ReturnType<typeof effectRepeatSaveApplicationOutputDtoSchema.parse>

/**
 * The committed effect row a repeat save was started from (D167): it must still be on its holder at
 * the pinned version, or the save checks an effect that changed or ended.
 */
export async function readEffectRepeatSaveRow(
  ctx: EncounterWriteContext,
  input: {
    encounterId: string
    holder: EncounterRunActorState
    pin: NativeEffectRepeatSaveContext['activeEffect']
  }
) {
  const effect = (
    await createActiveRuleEffectStore(ctx).list(turnEffectOwner(input.holder, input.encounterId))
  ).find(({ id }) => id === input.pin.id)
  if (
    !effect ||
    effect.version !== input.pin.version ||
    effect.lifecycleChecksum !== input.pin.lifecycleChecksum
  )
    throw new Error('Live Session repeat save effect changed.')
  return effect
}

/**
 * Ends the effect a made repeat save released, through the shared effect-release seam, and requires
 * the conditions it stripped to be the ones the save's receipt names. A failed save changes nothing.
 */
export async function releaseEffectRepeatSave(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    encounterId: string
    actors: EncounterRunActorState[]
    output: EffectRepeatSaveOutput
    occurredAt: string
  }
) {
  const { output } = input
  if (!output.released) return input.actors
  const ended = await endEncounterEscapedEffect(ctx, {
    encounterId: input.encounterId,
    actors: input.actors,
    holderActorId: output.application.targetActorId,
    activeEffectId: output.released.activeEffectId,
    occurredAt: input.occurredAt
  })
  if (
    !ended ||
    checksumCanonicalJson(ended.endedConditionIds) !==
      checksumCanonicalJson(output.released.removedConditionIds)
  )
    throw new Error('Live Session repeat save release differs from its plan.')
  return ended.actors
}

/**
 * Binds a damaging command's finalized damage to the one damage-save chain it owes (D95, D167,
 * ATTACK-16): each damaged holder's Concentration checks, effect repeat saves and massive-damage
 * saves, in canonical order, read from the committed rows. It plans through the same
 * `planDamageSaveChain` the room planned from, so a stale or invented chain is rejected by
 * comparison. Every damage root persists through this.
 */
export async function bindEncounterDamageSaveChain(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: OptionalCombatPolicyInput & { id: string }
    actors: readonly EncounterRunActorState[]
    applications: readonly ConcentrationDamageApplicationDto[]
    parentOccurrenceId: string
    damagerActorId: string | null
  }
) {
  const store = createActiveRuleEffectStore(ctx)
  const massiveRule = encounterMassiveDamageRule(input.state)
  const maintainedStates = new Map<string, { id: string; createdAt: string }[]>()
  const holders = new Map<string, DamageSaveEffectHolder>()
  for (const actorId of new Set(input.applications.map(({ targetActorId }) => targetActorId))) {
    maintainedStates.set(
      actorId,
      await store.findMaintainedStates({
        encounterId: input.state.id,
        ownerActorId: actorId,
        maintenanceDefinitionId: requireInstalledConcentrationMaintenanceDefinitionId(
          input.state.gameSystemId
        )
      })
    )
    const actor = input.actors.find(({ id }) => id === actorId)
    if (!actor) continue
    holders.set(actorId, {
      defeated: isEncounterActorDefeated(actor, await readDeadCharacterIds(ctx, [actor])),
      effects: await store.list(turnEffectOwner(actor, input.state.id)),
      maximumHitPoints: massiveRule
        ? ((await readEncounterActorMaximumHitPoints(ctx, {
            encounterId: input.state.id,
            actor
          })) ?? 0)
        : 0
    })
  }
  return planDamageSaveChain({
    gameSystemId: input.state.gameSystemId,
    applications: input.applications,
    maintainedStates,
    parentOccurrenceId: input.parentOccurrenceId,
    damagerActorId: input.damagerActorId,
    dispositions: new Map(input.actors.map(({ id, disposition }) => [id, disposition])),
    effectSaves: { massiveRule, holders }
  })
}
