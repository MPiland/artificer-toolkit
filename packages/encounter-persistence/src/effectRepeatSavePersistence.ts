import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { effectRepeatSaveApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import type { NativeEffectRepeatSaveContext } from '@artificer-toolkit/rules-runtime/encounterEffectRepeatSave'
import {
  compareDamageSaveApplications,
  type ConcentrationDamageApplicationDto,
  type DamageSaveApplicationDto
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import { isEncounterActorDefeated } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { effectRepeatSaveApplications } from '@artificer-toolkit/rules-runtime/encounterEffectRepeatSave'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
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
 * Binds a damaging command's finalized damage to the repeat saves its damaged holders' effects owe
 * (D167), read from the committed rows. The same derivation the room planned from, so a stale or
 * invented chain is rejected by comparison.
 */
export async function bindEncounterEffectRepeatSaves(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: { id: string }
    actors: readonly EncounterRunActorState[]
    applications: readonly ConcentrationDamageApplicationDto[]
    parentOccurrenceId: string
    damagerActorId: string | null
  }
) {
  const store = createActiveRuleEffectStore(ctx)
  const holders = new Map<
    string,
    { defeated: boolean; effects: Awaited<ReturnType<typeof store.list>> }
  >()
  for (const actorId of new Set(input.applications.map(({ targetActorId }) => targetActorId))) {
    const actor = input.actors.find(({ id }) => id === actorId)
    if (!actor) continue
    holders.set(actorId, {
      defeated: isEncounterActorDefeated(actor, await readDeadCharacterIds(ctx, [actor])),
      effects: await store.list(turnEffectOwner(actor, input.state.id))
    })
  }
  return effectRepeatSaveApplications({
    applications: input.applications,
    parentOccurrenceId: input.parentOccurrenceId,
    damagerActorId: input.damagerActorId,
    dispositions: new Map(input.actors.map(({ id, disposition }) => [id, disposition])),
    holders
  })
}

/**
 * The one damage-save chain a damaging command owes (D167): the Concentration checks its caller
 * bound plus the effect repeat saves its finalized damage meets, in canonical order. Every damage
 * source persists through this, so each derives the chain the room planned.
 */
export async function bindEncounterDamageSaveChain(
  ctx: EncounterCharacterWriteTransaction,
  input: Parameters<typeof bindEncounterEffectRepeatSaves>[1] & {
    concentration: readonly DamageSaveApplicationDto[]
  }
) {
  const { concentration, ...repeat } = input
  return [...concentration, ...(await bindEncounterEffectRepeatSaves(ctx, repeat))].sort(
    compareDamageSaveApplications
  )
}
