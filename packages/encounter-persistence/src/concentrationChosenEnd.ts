import { encounterConcentrationDroppedOutsideInputSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { carriedConcentration } from '@artificer-toolkit/rules-runtime/activeGrantListings'
import { CharacterSheetCommandError } from '@artificer-toolkit/rules-runtime/character/sheetCommandError'
import { planConcentrationCarriedGrantEnds } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { requireInstalledConcentrationMaintenanceDefinitionId } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { persistNativeConcentrationEnd } from './actionChildPersistence.js'
import { recordConcentrationCaster } from './actionEffectPersistence.js'
import { endCarriedGrantsOfConcentratingCasters } from './characterRunEffects.js'
import {
  applyLiveConcentrationCleanup,
  deriveLiveConcentrationCleanup
} from './concentrationCleanupPersistence.js'
import { postConcentrationEndMessage } from './concentrationEnd.js'
import { rejectDomain } from './domainRejections.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type {
  EncounterCharacterEffectsTransaction,
  EncounterCharacterWriteTransaction,
  EncounterWritePorts
} from './ports.js'
import { appendSystemRunEntry } from './systemRunEntries.js'

/**
 * SPELLS-5.11: outside any ACTIVE Run, the caster ends the Concentration whose grants a finished Run
 * carried onto the Campaign clock. Every grant stamped with the caster ends; the caster's own is
 * deleted here for the Sheet write to settle, and each other holder's stream moves once. Throws when
 * nothing is carried and the Sheet held no Concentration summon (D190) for the same command to end.
 * The caster's `concentrationCasterCharacterId` stamp lets a later checkpoint finish any holder this
 * call skipped.
 *
 * A holder in an ACTIVE Run belongs to that Run's room (Q1): this call skips it, and the same user
 * action ends it through the room (`endOutsideCasterConcentration`) with the same command id. A
 * caller that skips the room leaves those grants to the next checkpoint (the safety net).
 */
export async function endCarriedConcentrationOutsideRuns(
  ctx: EncounterCharacterEffectsTransaction,
  input: {
    casterCharacterId: string
    /** The Campaign's Characters that an ACTIVE Run's room holds. */
    fightingCharacterIds: ReadonlySet<string>
    occurredAt: string
    /** The command also ends a Concentration summon the Sheet holds. */
    endsSpellSummon: boolean
  }
): Promise<void> {
  const store = createActiveRuleEffectStore(ctx)
  const { casterCharacterId } = input
  const carried = planConcentrationCarriedGrantEnds({
    casterCharacterId,
    effects: await store.listCarriedByCaster(casterCharacterId)
  })
  if (carried.length === 0) {
    if (input.endsSpellSummon) return
    throw new CharacterSheetCommandError('This Character is not concentrating.')
  }
  for (const effect of carried)
    if (effect.owner.kind === 'CHARACTER' && effect.owner.characterId === casterCharacterId)
      await store.deleteCas({
        id: effect.id,
        owner: effect.owner,
        expectedVersion: effect.version,
        // Outside a Run no turn counts down, so nothing an effect would leave behind is left.
        removal: 'REMOVED'
      })
  await endCarriedGrantsOfConcentratingCasters(ctx, {
    encounterId: null,
    casterCharacterIds: [casterCharacterId],
    includesHolder: (characterId) =>
      characterId !== casterCharacterId && !input.fightingCharacterIds.has(characterId),
    occurredAt: input.occurredAt
  })
}

/**
 * SPELLS-5.11 (Q1): a caster outside this ACTIVE Run, whose Concentration grants a finished Run
 * carried, ends it while a Character the Run holds still carries one. The room ends the grants on
 * the Run's Characters at once; the caster joins the Run's caster set so the next checkpoint ends
 * the stamped grants on Characters outside any ACTIVE Run. Throws when the caster has none.
 *
 * When grants ended, the end is also a GM-only Encounter history entry, keyed on the command id
 * ("<caster> dropped Concentration: <label> ends on <holders>"). Writing it advances the Run's
 * version, so an in-flight Encounter command from another client reads the Run as changed.
 */
export async function endOutsideCasterConcentration(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    /** Every Run actor. */
    actors: EncounterRunActorState[]
    casterCharacterId: string
    commandId: string
    userId: string
    occurredAt: string
  }
): Promise<void> {
  const store = createActiveRuleEffectStore(ctx)
  const { casterCharacterId } = input
  const carried = planConcentrationCarriedGrantEnds({
    casterCharacterId,
    effects: await store.listCarriedByCaster(casterCharacterId)
  })
  if (carried.length === 0) throw new Error('This Character is not concentrating.')
  const heldCharacterIds = new Set(
    input.actors.flatMap((actor) =>
      actor.kind === 'CHARACTER' && actor.frozenState === null ? [actor.sourceId] : []
    )
  )
  const ended = await endCarriedGrantsOfConcentratingCasters(ctx, {
    encounterId: input.state.id,
    casterCharacterIds: [casterCharacterId],
    includesHolder: (characterId) => heldCharacterIds.has(characterId),
    occurredAt: input.occurredAt
  })
  await recordConcentrationCaster(ctx, input.state.id, casterCharacterId)
  if (ended.length === 0) return
  const caster = await ctx.ports.readCharacterRow(casterCharacterId)
  if (!caster) throw new Error('Concentration caster is unavailable.')
  const holderIds = new Set(
    ended.flatMap((effect) => (effect.owner.kind === 'CHARACTER' ? [effect.owner.characterId] : []))
  )
  const holders = input.actors
    .filter((actor) => actor.kind === 'CHARACTER' && holderIds.has(actor.sourceId))
    .map((actor) => actor.label)
  const concentration = carriedConcentration(ended)
  const notice = `${caster.label} dropped Concentration: ${
    concentration?.label ?? 'an unnamed source'
  } ends on ${holders.join(', ')}`
  await appendSystemRunEntry(ctx, {
    encounterId: input.state.id,
    userId: input.userId,
    occurredAt: input.occurredAt,
    command: encounterConcentrationDroppedOutsideInputSchema.parse({
      type: 'CONCENTRATION_DROPPED_OUTSIDE',
      commandId: input.commandId,
      encounterId: input.state.id,
      casterCharacterId
    }),
    label: notice
  })
}

/**
 * SPELLS-5.11: the holder ends their own Concentration by choice, with no action and no check.
 * Every grant the Run's slot maintains ends with it, and a Character's carried-over grants held by
 * the Run's Characters end too (D99); the caster joins the Run's caster set so the completing
 * checkpoint ends the ones outside the Run. The end is a child receipt of the command like any D95
 * end, keyed on the command id. Throws when the actor has nothing to end. A holder of more than one
 * Concentration names the state to end (SPELLS-12.3); only that state's dependents end, and a
 * carried-over Concentration stays.
 */
export async function endChosenConcentration(
  ctx: EncounterCharacterWriteTransaction & {
    ports: EncounterCharacterWriteTransaction['ports'] &
      Pick<EncounterWritePorts, 'postRulesChatMessage'>
  },
  input: {
    state: EncounterRunState
    /** Every Run actor as the command left it. */
    actors: EncounterRunActorState[]
    holder: EncounterRunActorState
    /** The held Concentration state to end; required while the holder keeps more than one. */
    stateId?: string
    commandId: string
    userId: string
    occurredAt: string
    /** Characters whose stream version the command already advanced in this transaction. */
    advancedCharacterIds?: ReadonlySet<string>
  }
) {
  const { state, holder } = input
  // A manual Encounter records no Concentration (D95 ends none either), so there is nothing to end.
  if (state.automationMode === 'MANUAL')
    throw new Error('Concentration is not tracked in a manual Encounter.')
  // Ending Concentration ends its placed zones, which a pending prompt may be resolving (D138): it
  // waits for the prompt like every other zone-ending command, whichever path ends it.
  if (
    await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (query) =>
        query.eq('encounterId', state.id).eq('state', 'PENDING')
      )
      .first()
  )
    rejectDomain('PENDING_DECISION')
  const store = createActiveRuleEffectStore(ctx)
  const slots = await store.findMaintainedStates({
    encounterId: state.id,
    ownerActorId: holder.id,
    maintenanceDefinitionId: requireInstalledConcentrationMaintenanceDefinitionId(
      state.gameSystemId
    )
  })
  if (!input.stateId && slots.length > 1)
    throw new Error(`${holder.label} holds more than one Concentration: choose which to end.`)
  const slot = input.stateId ? slots.find(({ id }) => id === input.stateId) : slots[0]
  if (input.stateId && !slot) throw new Error(`${holder.label} is not holding that Concentration.`)
  const authorizedCharacterIds = new Set(
    input.actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : []))
  )
  const carried =
    holder.kind === 'CHARACTER' && !input.stateId
      ? await endCarriedGrantsOfConcentratingCasters(ctx, {
          encounterId: state.id,
          casterCharacterIds: [holder.sourceId],
          includesHolder: (characterId) => authorizedCharacterIds.has(characterId),
          advancedCharacterIds: input.advancedCharacterIds,
          occurredAt: input.occurredAt
        })
      : []
  if (holder.kind === 'CHARACTER' && !input.stateId)
    await recordConcentrationCaster(ctx, state.id, holder.sourceId)
  if (!slot) {
    if (carried.length === 0) throw new Error(`${holder.label} is not concentrating.`)
    // Carried grants have no slot, so no receipt: the command keys the chat line.
    await postConcentrationEndMessage(ctx, {
      state,
      actor: holder,
      reason: 'CHOSEN',
      occurrenceId: input.commandId,
      userId: input.userId
    })
    return
  }
  const advancedCharacterIds = new Set(input.advancedCharacterIds)
  for (const effect of carried)
    if (effect.owner.kind === 'CHARACTER') advancedCharacterIds.add(effect.owner.characterId)
  const { cleanup } = await deriveLiveConcentrationCleanup(ctx, {
    state,
    slot,
    authorizedCharacterIds,
    advancedCharacterIds
  })
  await applyLiveConcentrationCleanup(ctx, {
    state,
    actors: input.actors,
    slot,
    cleanup,
    authorizedCharacterIds,
    advancedCharacterIds,
    occurredAt: input.occurredAt
  })
  const occurrenceId = await persistNativeConcentrationEnd(ctx, {
    state,
    parentOccurrenceId: input.commandId,
    end: { ownerActorId: holder.id, maintainedStateId: slot.id, reason: 'CHOSEN', cleanup },
    userId: input.userId,
    correlationId: input.commandId,
    occurredAt: input.occurredAt
  })
  await postConcentrationEndMessage(ctx, {
    state,
    actor: holder,
    reason: 'CHOSEN',
    occurrenceId,
    userId: input.userId
  })
}
