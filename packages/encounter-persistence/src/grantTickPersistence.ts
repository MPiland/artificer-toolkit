import {
  encounterActorIdleTurnMark,
  withEncounterActorIdleTurnMark
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  planEncounterGrantTicks,
  planIdleTurnCheck,
  planReinstatedConcentrations,
  planResumedCarriedEffects
} from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { encounterActorGrantModifiers } from '@artificer-toolkit/rules-runtime/encounterMovementPassagePolicy'
import type { CharacterRuleEvaluationResult } from '@artificer-toolkit/rules-runtime/character/characterRuleEvaluation'
import { requireInstalledConcentrationMaintenanceDefinitionId } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import {
  turnEffectOwner,
  type TurnEffectBoundary
} from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { readRunActors, readRunState, replaceRunActor } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { reconcileNativeMaintenanceOwners } from './maintenanceOwnerPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'

/**
 * Counts down every timed effect anchored to this turn boundary that stores no recurrence stage
 * (Modifier Grants, Color Spray's blindness), whoever holds it. They run no graph, so unlike the
 * turn-effect phase this writes no receipt; an expired effect's holder is reconciled like any ended
 * effect's (Aid ending lowers current HP, a held condition is released).
 */
export async function persistEncounterGrantTicks(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    stage: TurnEffectBoundary['stage']
    turnActorId: string | null
    occurredAt: string
  }
) {
  if (input.turnActorId === null) return
  const { state, stage, turnActorId } = input
  const store = createActiveRuleEffectStore(ctx)
  const actors = await readRunActors(ctx, state)
  const holders = await Promise.all(
    actors.map(async (actor) => ({
      actor,
      effects: await store.list(turnEffectOwner(actor, state.id))
    }))
  )
  const expired: ActiveRuleEffectRecord[] = []
  for (const tick of planEncounterGrantTicks({
    encounterId: state.id,
    stage,
    turnActorId,
    holders
  })) {
    const { effect, owner } = tick
    if (tick.kind === 'EXPIRE') {
      await store.deleteCas({
        id: effect.id,
        owner,
        expectedVersion: effect.version,
        removal: 'ENDED'
      })
      expired.push(effect)
    } else
      await store.updateLifecycleCas({
        id: effect.id,
        owner,
        expectedVersion: effect.version,
        lifecycle: { ...effect.lifecycle, remainingTicks: tick.remainingTicks }
      })
  }
  await reconcileExpiredGrants(ctx, { state, expired, actors, occurredAt: input.occurredAt })
}

/**
 * D151, SPELLS-5.13: a Run's START resumes its Characters' carried-over effects from the Campaign
 * clock, in the START's own transaction and before its turn is planned, so the first turn already
 * counts them down. Only a PREPARED Run resumes, and the clock is read only when an effect waits on
 * it. An effect whose expiry the clock has reached ends like an expired grant. A Character caster in
 * the Run then gets back the Concentration its surviving carried grants are stamped with (D151,
 * SPELLS-5.12), and those grants relink to it.
 */
export async function persistCarriedEffectResumes(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    encounterId: string
    readClockMinute(): Promise<number | null>
    /** Reads the System's Concentration definition, only when a carried caster reinstates it. */
    readDefinition(definitionId: string): Promise<ReusableDefinitionCurrentDto | null>
    occurredAt: string
  }
) {
  const row = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!row) throw new Error('Encounter Run is unavailable.')
  const state = readRunState(row)
  if (state.status !== 'PREPARED') return
  const store = createActiveRuleEffectStore(ctx)
  const actors = await readRunActors(ctx, state)
  const holders = await Promise.all(
    actors
      .filter((actor) => actor.kind === 'CHARACTER')
      .map(async (actor) => {
        const owner = turnEffectOwner(actor, state.id)
        return { owner, effects: await store.list(owner) }
      })
  )
  const waiting = holders.some(({ effects }) =>
    effects.some(({ lifecycle }) => typeof lifecycle.expiresAtCampaignMinute === 'number')
  )
  const clockMinute = waiting ? await input.readClockMinute() : null
  const expired: ActiveRuleEffectRecord[] = []
  const resumed: ActiveRuleEffectRecord[] = []
  for (const { owner, effects } of holders) {
    const plans = new Map(
      planResumedCarriedEffects({ effects, clockMinute }).map((plan) => [plan.effect.id, plan])
    )
    for (const effect of effects) {
      const resume = plans.get(effect.id)
      if (!resume) resumed.push(effect)
      else if (resume.kind === 'EXPIRE') {
        await store.deleteCas({
          id: effect.id,
          owner,
          expectedVersion: effect.version,
          // It lapsed on the Campaign clock before this Run: nothing is left to count down.
          removal: 'REMOVED'
        })
        expired.push(effect)
      } else
        resumed.push(
          await store.updateLifecycleCas({
            id: effect.id,
            owner,
            expectedVersion: effect.version,
            lifecycle: resume.lifecycle
          })
        )
    }
  }
  await reconcileExpiredGrants(ctx, { state, expired, actors, occurredAt: input.occurredAt })
  const definitionId = requireInstalledConcentrationMaintenanceDefinitionId(state.gameSystemId)
  for (const { casterActorId, descriptor, effects } of await planReinstatedConcentrations({
    gameSystemId: state.gameSystemId,
    actors,
    effects: resumed,
    readDefinition: () => input.readDefinition(definitionId)
  })) {
    const reinstated = await store.createMaintainedState({
      id: crypto.randomUUID(),
      encounterId: state.id,
      ownerActorId: casterActorId,
      descriptor,
      occurredAt: input.occurredAt
    })
    for (const effect of effects) {
      if (effect.owner.kind !== 'CHARACTER') throw new Error('Only a Character grant is carried.')
      await store.relinkCarriedCas({
        id: effect.id,
        characterId: effect.owner.characterId,
        expectedVersion: effect.version,
        state: reinstated
      })
    }
  }
}

/** The rules a Character's idle-turn exemptions are read from. */
export type EncounterIdleTurnCharacterRules = {
  output: Pick<CharacterRuleEvaluationResult['output'], 'grantFold'>
}

/**
 * Ends the idle-bound grants of the outgoing turn actor when its turn passed with no attack roll
 * against a hostile creature and no damage (SRD Rage), and resets its mark. Runs after everything
 * else the turn's end commits, such as a Legendary Action's damage, so that damage counts. An actor
 * with no mark holds no such grant, so its effects are never read; only an armed actor's feature
 * grants are read, for the effects they keep from ending (Persistent Rage).
 */
export async function persistEncounterIdleTurnCheck(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    campaign: EncounterDocument<'campaigns'>
    turnActorId: string | null
    occurredAt: string
  },
  readCharacterRules: (
    campaign: EncounterDocument<'campaigns'>,
    characterId: string
  ) => Promise<EncounterIdleTurnCharacterRules | null>
) {
  if (input.turnActorId === null) return
  const { state } = input
  const actors = await readRunActors(ctx, state)
  const actor = actors.find(({ id }) => id === input.turnActorId)
  const mark = actor && encounterActorIdleTurnMark(actor)
  if (!actor || mark === null) return
  const owner = turnEffectOwner(actor, state.id)
  const store = createActiveRuleEffectStore(ctx)
  const characterRules =
    mark === 'ARMED' && actor.kind === 'CHARACTER' && actor.form === null
      ? await readCharacterRules(input.campaign, actor.sourceId)
      : null
  const { ended, nextMark } = planIdleTurnCheck({
    encounterId: state.id,
    actor,
    effects: await store.list(owner),
    featureModifiers:
      mark === 'ARMED' ? encounterActorGrantModifiers(actor, characterRules?.output ?? null) : []
  })
  for (const effect of ended)
    await store.deleteCas({
      id: effect.id,
      owner,
      expectedVersion: effect.version,
      removal: 'ENDED'
    })
  const marked = encounterRunActorStateSchema.parse({
    ...actor,
    resources: withEncounterActorIdleTurnMark(actor, nextMark)
  })
  await replaceRunActor(ctx, actor, marked)
  await reconcileExpiredGrants(ctx, {
    state,
    expired: ended,
    actors: actors.map((current) => (current.id === marked.id ? marked : current)),
    occurredAt: input.occurredAt
  })
}

/** Reconciles the holders of grants that just ended like any ended effect's (Aid ending lowers current HP). */
async function reconcileExpiredGrants(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    expired: ActiveRuleEffectRecord[]
    actors: EncounterRunActorState[]
    occurredAt: string
  }
) {
  const { expired } = input
  if (expired.length === 0) return
  const characterIds = new Set(
    expired.flatMap(({ owner }) => (owner.kind === 'CHARACTER' ? [owner.characterId] : []))
  )
  const characterVersions = await Promise.all(
    [...characterIds].map(async (characterId) => {
      const row = await ctx.ports.readCharacterRow(characterId)
      if (!row) throw new Error('Grant holder Character is unavailable.')
      return { characterId, beforeStreamVersion: row.play.streamVersion }
    })
  )
  await reconcileNativeMaintenanceOwners(ctx, {
    encounterId: input.state.id,
    maintenance: { removed: expired, characterVersions },
    actors: input.actors,
    occurredAt: input.occurredAt
  })
}
