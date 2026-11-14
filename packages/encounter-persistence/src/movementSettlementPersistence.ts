import type { LiveSessionMovementSettlement } from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SceneStoredGeometrySave } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import {
  movementDamageSaveChildren,
  type MovementConcentrationEndDto,
  type MovementConcentrationExecutionDto,
  type MovementRepeatSaveExecutionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionMovementConcentration'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { retainedMovementSpatialExecutions } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementResult'
import { spatialMovementEffectBeforeTransition } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementEffects'
import {
  movementCommandCharacterAggregateVersions,
  type MovementCommandTransition
} from '@artificer-toolkit/rules-runtime/encounterMovementChangedAggregates'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import { createSpatialRuleEffectStore } from './spatialEffectStore.js'
import { readMovementResolution } from './sceneGeometryDocuments.js'
import { consumeNativeActionEconomy } from './actionEconomyPersistence.js'
import type { endHolderStateGrants } from './concentrationEnd.js'
import { deleteGrants } from './consumedGrantPersistence.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { sourceEncounterIdForDefinition } from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import {
  readLiveCharacterMaximumHitPoints,
  readLiveCharacterStreamVersion
} from './liveMovementTargetState.js'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type { EncounterPersistenceTransaction } from './ports.js'
import type { persistLiveMovementSpatial } from './liveMovementSpatialPersistence.js'
import type {
  persistLiveMovementAreaDeparture,
  persistLiveMovementDamageEnd,
  persistLiveMovementMoveEnd
} from './escapedEffectEndPersistence.js'
import type {
  persistLiveMovementConcentration,
  persistLiveMovementConcentrationEnd,
  persistLiveMovementRepeatSave
} from './liveMovementConcentrationPersistence.js'

/** A contact's Concentration ends and damage saves, which a response may append to but never rewrite. */
type ContactChildren = {
  concentrationEnds?: MovementConcentrationEndDto[]
  concentrationChecks?: MovementConcentrationExecutionDto[]
  repeatSaves?: MovementRepeatSaveExecutionDto[]
}

function contactEvidence<T extends ContactChildren>(value: T) {
  const {
    concentrationChecks: _checks,
    concentrationEnds: _ends,
    repeatSaves: _saves,
    ...contact
  } = value
  return contact
}

/** Checksums of values a commit never mutates, each computed once per object. */
const checksums = new WeakMap<object, string>()
function checksumOnce(value: object): string {
  let checksum = checksums.get(value)
  if (checksum === undefined) {
    checksum = checksumCanonicalJson(value)
    checksums.set(value, checksum)
  }
  return checksum
}

/** A retained contact's evidence, without its children, checksummed once. */
const evidenceChecksums = new WeakMap<object, string>()
function evidenceChecksum(value: object & ContactChildren): string {
  let checksum = evidenceChecksums.get(value)
  if (checksum === undefined) {
    checksum = checksumCanonicalJson(contactEvidence(value))
    evidenceChecksums.set(value, checksum)
  }
  return checksum
}

/** Element-wise equality of two checksummed lists, which is canonical equality of the lists. */
function sameChecksums<T extends object>(
  left: readonly T[],
  right: readonly T[],
  checksum: (value: T) => string
) {
  return (
    left.length === right.length &&
    left.every((value, index) => checksum(value) === checksum(right[index]!))
  )
}

type MovementOutcome = Exclude<SceneSpatialPreparation['outcome'], { kind: 'UNINTERRUPTED' }>

function appliedSpatialPrefix(outcome: MovementOutcome) {
  if (outcome.kind === 'TERMINAL')
    return outcome.result.status === 'BATCH_COMPLETE' ? outcome.result : null
  const { context } = readEncounterMovementPendingContext(outcome.pendingSnapshot)
  const prefix =
    context.kind === 'ENCOUNTER_MOVEMENT_REACTION'
      ? context.appliedSpatialPrefix
      : context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'
        ? context.movement.appliedSpatialPrefix
        : context.kind === 'ENCOUNTER_CONTEST_CHECK'
          ? context.origin.movementContinuation.appliedSpatialPrefix
          : null
  if (
    prefix &&
    (prefix.status !== 'BATCH_COMPLETE' || prefix.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
  )
    throw new Error('Movement spatial history is unavailable.')
  return prefix
}

/** The children a response appended to one retained list; it may never rewrite those already there. */
function appendedChildren<T extends object>(previous: readonly T[] = [], next: readonly T[] = []) {
  if (
    next.length < previous.length ||
    !sameChecksums(previous, next.slice(0, previous.length), checksumOnce)
  )
    throw new Error('Movement response changed its retained Concentration history.')
  return next.slice(previous.length)
}

type DamagingContact = ContactChildren & {
  candidate: { candidate: { sourceActorId: string | null } }
}

/** A contact's damage saves in chain order, each with the zone source that dealt its damage. */
function contactDamageSaves(contact: DamagingContact, children: ContactChildren = contact) {
  return movementDamageSaveChildren(children).map((save) => ({
    ...save,
    damagerActorId: contact.candidate.candidate.sourceActorId
  }))
}

/** A response may append children to its latest damage, but never rewrite committed contacts. */
function retainedContactChildren<T extends DamagingContact>(
  prior: readonly T[],
  next: readonly T[]
) {
  if (
    next.length < prior.length ||
    !sameChecksums(prior, next.slice(0, prior.length), evidenceChecksum)
  )
    throw new Error('Movement response changed its retained contact history.')
  const ends: MovementConcentrationEndDto[] = []
  const saves = prior.flatMap((entry, index) => {
    const appended = next[index]!
    ends.push(...appendedChildren(entry.concentrationEnds, appended.concentrationEnds))
    return contactDamageSaves(entry, {
      concentrationChecks: appendedChildren(
        entry.concentrationChecks,
        appended.concentrationChecks
      ),
      repeatSaves: appendedChildren(entry.repeatSaves, appended.repeatSaves)
    })
  })
  return { ends, saves }
}

type MovementSettlementCallbacks = {
  persistSpatial: (
    input: Parameters<typeof persistLiveMovementSpatial>[1]
  ) => ReturnType<typeof persistLiveMovementSpatial>
  persistConcentration: (
    input: Parameters<typeof persistLiveMovementConcentration>[1]
  ) => ReturnType<typeof persistLiveMovementConcentration>
  persistRepeatSave: (
    input: Parameters<typeof persistLiveMovementRepeatSave>[1]
  ) => ReturnType<typeof persistLiveMovementRepeatSave>
  persistConcentrationEnd: (
    input: Parameters<typeof persistLiveMovementConcentrationEnd>[1]
  ) => ReturnType<typeof persistLiveMovementConcentrationEnd>
  persistAreaDeparture: (
    input: Parameters<typeof persistLiveMovementAreaDeparture>[1]
  ) => ReturnType<typeof persistLiveMovementAreaDeparture>
  persistMoveEnd: (
    input: Parameters<typeof persistLiveMovementMoveEnd>[1]
  ) => ReturnType<typeof persistLiveMovementMoveEnd>
  persistDamageEnd: (
    input: Parameters<typeof persistLiveMovementDamageEnd>[1]
  ) => ReturnType<typeof persistLiveMovementDamageEnd>
  endHolderGrants: (input: Parameters<typeof endHolderStateGrants>[1]) => Promise<void>
  /** Versions a Character the passage's effect lands on, as every Character-owned effect does. */
  applyMechanics: Parameters<typeof persistLiveMovementSpatial>[2]['applyMechanics']
}

/** Refuses an effect a PASSAGE step carries unless it is held by the blocker and sourced by the passage. */
export function assertPassageEffectMatches(
  effect: ActiveRuleEffectRecord,
  expected: {
    blocker: EncounterRunActorState | undefined
    encounterId: string
    gameSystemId: string
    sourceActorId: string
    occurrenceId: string
    commandId: string
  }
) {
  const origin = effect.definition.origin
  if (
    !expected.blocker ||
    checksumCanonicalJson(effect.owner) !==
      checksumCanonicalJson(turnEffectOwner(expected.blocker, expected.encounterId)) ||
    origin.kind !== 'ENCOUNTER' ||
    origin.sourceAggregateId !== expected.encounterId ||
    origin.sourceActorId !== expected.sourceActorId ||
    origin.sourceOccurrenceId !== expected.occurrenceId ||
    origin.rootCommandId !== expected.commandId ||
    effect.definition.frozenGraph.source.gameSystemId !== expected.gameSystemId ||
    effect.maintainedEffectStateId !== null ||
    effect.sourceEncounterId !==
      (effect.owner.kind === 'CHARACTER'
        ? sourceEncounterIdForDefinition(effect.definition, null)
        : null)
  )
    throw new Error('Movement passage effect does not match its blocker and source.')
}
/** Settles retained movement contacts and their children in the parent's transaction. */
export function persistMovementSettlements(
  ctx: EncounterPersistenceTransaction,
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    authorizedCharacterIds: ReadonlySet<string>
    save: SceneStoredGeometrySave
    preparation: SceneSpatialPreparation
    settlements: LiveSessionMovementSettlement[]
    userId: string
  },
  callbacks: MovementSettlementCallbacks
) {
  const { save, ...rest } = input
  return persistMovementContacts(
    ctx,
    {
      ...rest,
      move: {
        sceneId: save.sceneId,
        commandId: save.commandId,
        resolution: readMovementResolution(save)
      }
    },
    callbacks
  )
}

/**
 * Settles the contacts of one move: the voluntary move a saved geometry command carries, whose
 * `resolution` is the response it answers, or a forced one an action carries (`resolution` null),
 * which settles in that action's own commit (D170).
 */
export async function persistMovementContacts(
  ctx: EncounterPersistenceTransaction,
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    authorizedCharacterIds: ReadonlySet<string>
    move: {
      sceneId: string
      commandId: string
      resolution: ReturnType<typeof readMovementResolution>
    }
    preparation: Pick<SceneSpatialPreparation, 'occurrenceId' | 'occurredAt' | 'outcome'>
    settlements: LiveSessionMovementSettlement[]
    userId: string
  },
  callbacks: MovementSettlementCallbacks
) {
  const { move: save, preparation, userId } = input
  const { resolution } = save
  if (preparation.outcome.kind === 'UNINTERRUPTED')
    throw new Error('Live movement settlement is unavailable.')
  const priorOutcome: MovementOutcome | null = resolution
    ? { kind: 'PENDING', pendingSnapshot: resolution.snapshot, movementIntent: null }
    : null
  const priorPrefix = priorOutcome ? appliedSpatialPrefix(priorOutcome) : null
  const appliedPrefix = appliedSpatialPrefix(preparation.outcome)
  // A dice pause may retain evaluated contacts that have not changed gameplay state yet.
  const nextSpatial = retainedMovementSpatialExecutions(preparation.outcome)
  const priorSpatial = priorOutcome ? retainedMovementSpatialExecutions(priorOutcome) : []
  const priorSpatialCount = priorPrefix?.executions.length ?? 0
  retainedContactChildren(priorSpatial, nextSpatial)
  const retainedSpatial = retainedContactChildren(priorPrefix?.executions ?? [], nextSpatial)
  // The damage saves awaiting settlement, in the chain order their contact owed them.
  const saves = [...retainedSpatial.saves]
  // A contact's end settles before its saves, so at most one end is ever awaiting settlement.
  const ends = [...retainedSpatial.ends]
  if ((appliedPrefix?.executions.length ?? 0) < priorSpatialCount)
    throw new Error('Movement response lost its applied spatial prefix.')
  const spatial = (appliedPrefix?.executions ?? []).slice(priorSpatialCount)
  const resolutionCommands =
    preparation.outcome.kind === 'PENDING'
      ? readEncounterMovementPendingContext(preparation.outcome.pendingSnapshot).root
          .resolutionCommands
      : preparation.outcome.resolutionCommands
  if (
    resolution &&
    (!resolutionCommands ||
      resolutionCommands.length !== resolution.root.resolutionCommands.length + 1 ||
      checksumCanonicalJson(resolutionCommands.slice(0, -1)) !==
        checksumCanonicalJson(resolution.root.resolutionCommands))
  )
    throw new Error('Movement response history does not extend its issued decision.')
  const responseCommand = resolutionCommands?.at(-1)
  if (
    resolution &&
    (!responseCommand ||
      responseCommand.commandId !== save.commandId ||
      responseCommand.commandFingerprint !== checksumCanonicalJson(resolution.command) ||
      responseCommand.actorUserId !== userId ||
      responseCommand.expectedOccurrenceVersion !== resolution.command.expectedOccurrenceVersion ||
      responseCommand.correlationId !== resolution.command.correlationId)
  )
    throw new Error('Movement response command identity is inconsistent.')
  const passage =
    responseCommand && 'passageContest' in responseCommand
      ? responseCommand.passageContest
      : undefined
  let passageSettled = false
  const damagedActorIds = new Set<string>()
  const mechanicsChanged = input.settlements.some((step) =>
    step.kind === 'CONCENTRATION'
      ? step.execution.result.applicationOutputs.cleanup !== null
      : step.kind !== 'REPEAT_SAVE' || step.execution.release !== null
  )
  const effectOriginals = new Map<string, EncounterSpatialRuleEffectRecord>()
  if (spatial.length) {
    const effects = await createSpatialRuleEffectStore(ctx).scope({
      encounterId: input.state.id,
      sceneId: save.sceneId
    })
    if (!effects) throw new Error('Movement spatial scope changed.')
    for (const entry of spatial) {
      const effectId = entry.candidate.effect.effectId
      if (effectOriginals.has(effectId)) continue
      const transition = priorPrefix?.spatialEffectTransitions.find(
        (entry) => entry.effectId === effectId
      )
      const currentEffect = await effects.get(effectId)
      const effect = transition
        ? spatialMovementEffectBeforeTransition({
            current: currentEffect,
            consumed: priorPrefix?.consumedSpatialEffects?.find((entry) => entry.id === effectId),
            effectId,
            transition: transition.transition,
            encounterId: input.state.id,
            sceneId: save.sceneId,
            allowUnapplied: false
          })
        : currentEffect
      if (!effect) throw new Error('Movement spatial effect changed.')
      effectOriginals.set(effectId, effect)
    }
  }
  const transitions: MovementCommandTransition[] = []
  let actors = input.actors
  let spatialIndex = 0
  const departures =
    preparation.outcome.kind === 'TERMINAL' ? (preparation.outcome.areaDepartures ?? []) : []
  const moveEnds =
    preparation.outcome.kind === 'TERMINAL' ? (preparation.outcome.moveEnds ?? []) : []
  const damageEnds =
    preparation.outcome.kind === 'TERMINAL' ? (preparation.outcome.damageEnds ?? []) : []
  let departureIndex = 0
  let moveEndIndex = 0
  let damageEndIndex = 0
  let distance = -1
  const appliedEffectIds = new Set(
    priorPrefix?.spatialEffectTransitions.map((entry) => entry.effectId) ?? []
  )
  const common = {
    state: input.state,
    occurrenceId: preparation.occurrenceId,
    sourceCommandId: save.commandId,
    occurredAt: preparation.occurredAt
  }
  for (const step of input.settlements) {
    if (
      step.kind !== 'CONCENTRATION' &&
      step.kind !== 'CONCENTRATION_END' &&
      step.kind !== 'REPEAT_SAVE' &&
      (saves.length || ends.length)
    )
      throw new Error('Movement Concentration must settle before the next contact.')
    if (
      step.kind !== 'AREA_DEPARTURE' &&
      step.kind !== 'MOVE_END' &&
      step.kind !== 'DAMAGE_END' &&
      (departureIndex || moveEndIndex || damageEndIndex)
    )
      throw new Error('Movement releases settle after every contact.')
    if (step.kind === 'SPATIAL') {
      const expected = spatial.slice(spatialIndex, spatialIndex + step.executions.length)
      if (
        expected.length !== step.executions.length ||
        expected.some(
          (execution, index) =>
            evidenceChecksum(execution) !== checksumCanonicalJson(step.executions[index])
        )
      )
        throw new Error('Movement spatial settlement differs from its retained receipt.')
      for (const execution of expected) {
        const nextDistance = execution.candidate.candidate.pathDistance
        if (nextDistance + 1e-8 < distance) throw new Error('Movement contacts are out of order.')
        distance = nextDistance
        damagedActorIds.add(execution.candidate.candidate.targetActorId)
      }
      const committed = await callbacks.persistSpatial({
        ...common,
        actors,
        step,
        sceneId: save.sceneId,
        effectOriginals,
        appliedEffectIds
      })
      actors = committed.actors
      transitions.push({ kind: 'SPATIAL_PREFIX', result: committed })
      spatialIndex += expected.length
      saves.push(...expected.flatMap((entry) => contactDamageSaves(entry)))
      ends.push(...expected.flatMap((entry) => entry.concentrationEnds ?? []))
    } else if (step.kind === 'PASSAGE') {
      if (
        !resolution ||
        !passage ||
        passageSettled ||
        spatialIndex ||
        step.actorId !== passage.audit.sourceActorId ||
        checksumCanonicalJson(step.consumption) !== checksumCanonicalJson(passage.actionEconomy)
      )
        throw new Error('Movement passage allowance differs from its retained contest.')
      const actor = actors.find((entry) => entry.id === step.actorId)
      if (!actor) throw new Error('Movement passage actor is unavailable.')
      const next = await consumeNativeActionEconomy(ctx, {
        actor,
        consumption: step.consumption,
        overridden: false
      })
      await deleteGrants(ctx, step.consumedGrants)
      actors = actors.map((entry) => (entry.id === next.id ? next : entry))
      const blocker = actors.find((entry) => entry.id === passage.audit.blockerActorId)
      if (step.createdEffects.length && (passage.outcome !== 'SUCCESS' || !blocker))
        throw new Error('Movement passage effects need a won contest and its blocker.')
      if (blocker?.kind === 'CHARACTER' && step.createdEffects.length) {
        const beforeStreamVersion = await readLiveCharacterStreamVersion(
          ctx,
          input.state,
          blocker.sourceId
        )
        const mechanics = await callbacks.applyMechanics({
          encounterId: input.state.id,
          targetActorId: blocker.id,
          expectedEncounterVersion: input.state.version,
          occurrenceId: preparation.occurrenceId,
          sourceCommandId: save.commandId,
          commandId: deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: preparation.occurrenceId,
            sourceCommandId: save.commandId,
            phase: 'MOVEMENT_PASSAGE_EFFECT',
            ordinal: 0,
            targetCharacterId: blocker.sourceId
          }),
          occurredAt: preparation.occurredAt,
          applications: [],
          effectiveMaximumHitPoints: await readLiveCharacterMaximumHitPoints(
            ctx,
            input.state,
            blocker.sourceId
          ),
          forceVersionAdvance: true
        })
        if (mechanics.characterStreamVersion === null)
          throw new Error('Movement passage effect did not version its Character.')
        actors = actors.map((entry) => (entry.id === blocker.id ? mechanics.updatedActor : entry))
        transitions.push({
          kind: 'PASSAGE',
          characterTransitions: [
            {
              characterId: blocker.sourceId,
              beforeStreamVersion,
              afterStreamVersion: mechanics.characterStreamVersion
            }
          ]
        })
      }
      const effectStore = createActiveRuleEffectStore(ctx)
      for (const effect of step.createdEffects) {
        assertPassageEffectMatches(effect, {
          blocker,
          encounterId: input.state.id,
          gameSystemId: input.state.gameSystemId,
          sourceActorId: step.actorId,
          occurrenceId: preparation.occurrenceId,
          commandId: save.commandId
        })
        const created = await effectStore.create({
          id: effect.id,
          owner: effect.owner,
          definition: effect.definition,
          lifecycle: effect.lifecycle,
          maintainedEffectStateId: null,
          occurredAt: preparation.occurredAt
        })
        if (checksumCanonicalJson(created) !== checksumCanonicalJson(effect))
          throw new Error('Movement passage effect changed before settlement.')
      }
      passageSettled = true
    } else if (step.kind === 'AREA_DEPARTURE') {
      const expected = departures[departureIndex]
      if (!expected || checksumCanonicalJson(expected) !== checksumCanonicalJson(step.departure))
        throw new Error('Movement area departure differs from its retained move.')
      const committed = await callbacks.persistAreaDeparture({
        state: input.state,
        actors,
        step,
        occurredAt: preparation.occurredAt
      })
      actors = committed.actors
      transitions.push({
        kind: 'AREA_DEPARTURE',
        characterTransitions: committed.characterTransitions
      })
      departureIndex++
    } else if (step.kind === 'MOVE_END') {
      const expected = moveEnds[moveEndIndex]
      if (!expected || checksumCanonicalJson(expected) !== checksumCanonicalJson(step.moveEnd))
        throw new Error('Movement move end differs from its retained move.')
      const committed = await callbacks.persistMoveEnd({
        state: input.state,
        actors,
        step,
        occurredAt: preparation.occurredAt
      })
      actors = committed.actors
      transitions.push({
        kind: 'MOVE_END',
        characterTransitions: committed.characterTransitions
      })
      moveEndIndex++
    } else if (step.kind === 'DAMAGE_END') {
      const expected = damageEnds[damageEndIndex]
      if (!expected || checksumCanonicalJson(expected) !== checksumCanonicalJson(step.damageEnd))
        throw new Error('Movement damage end differs from its retained move.')
      const committed = await callbacks.persistDamageEnd({
        state: input.state,
        actors,
        step,
        executions: appliedPrefix?.executions ?? [],
        occurrenceId: preparation.occurrenceId,
        occurredAt: preparation.occurredAt
      })
      actors = committed.actors
      transitions.push({
        kind: 'DAMAGE_END',
        characterTransitions: committed.characterTransitions
      })
      damageEndIndex++
    } else if (step.kind === 'CONCENTRATION_END') {
      const expected = ends.shift()
      if (!expected || checksumOnce(expected) !== checksumCanonicalJson(step.execution))
        throw new Error('Movement Concentration end differs from its retained contact.')
      actors = await callbacks.persistConcentrationEnd({
        ...common,
        state: { ...input.state, version: input.state.version + 1 },
        actors,
        execution: step.execution,
        parentOccurrenceId: preparation.occurrenceId,
        userId,
        authorizedCharacterIds: input.authorizedCharacterIds
      })
      transitions.push({ kind: 'CONCENTRATION_END', execution: step.execution })
    } else {
      if (ends.length) throw new Error('Movement Concentration end must settle before its checks.')
      const expected = saves.shift()
      if (
        expected?.kind !== step.kind ||
        checksumOnce(expected.execution) !== checksumCanonicalJson(step.execution)
      )
        throw new Error('Movement Concentration differs from its retained contact.')
      const child = {
        ...common,
        state: {
          ...input.state,
          version:
            input.state.version +
            (preparation.outcome.kind === 'TERMINAL' || mechanicsChanged ? 1 : 0)
        },
        actors,
        parentOccurrenceId: preparation.occurrenceId,
        userId,
        authorizedCharacterIds: input.authorizedCharacterIds
      }
      if (step.kind === 'REPEAT_SAVE') {
        actors = await callbacks.persistRepeatSave({
          ...child,
          execution: step.execution,
          damagerActorId: expected.damagerActorId
        })
        transitions.push({ kind: 'REPEAT_SAVE', execution: step.execution })
      } else {
        actors = await callbacks.persistConcentration({ ...child, execution: step.execution })
        transitions.push({ kind: 'CONCENTRATION', execution: step.execution })
      }
    }
  }
  if (
    spatialIndex !== spatial.length ||
    departureIndex !== departures.length ||
    moveEndIndex !== moveEnds.length ||
    damageEndIndex !== damageEnds.length ||
    saves.length ||
    ends.length ||
    Boolean(passage) !== passageSettled
  )
    throw new Error('Movement settlement is incomplete.')
  // The planner does not see a mover knocked unconscious mid-pass, so the grants of each actor the
  // pass damaged end once it has settled, from that holder's committed state.
  if (mechanicsChanged && input.state.automationMode !== 'MANUAL')
    for (const actor of actors.filter(({ id }) => damagedActorIds.has(id)))
      await callbacks.endHolderGrants({
        state: input.state,
        actor,
        occurrenceId: preparation.occurrenceId,
        userId
      })
  return {
    mechanicsChanged,
    actors,
    characterTransitions: movementCommandCharacterAggregateVersions(transitions).map((span) => ({
      characterId: span.aggregateId,
      beforeStreamVersion: span.beforeVersion,
      afterStreamVersion: span.version
    }))
  }
}

/**
 * What a GM revert needs of the zone contacts a forced move settled (D170): the hit points they
 * changed, or a refusal when they also set off anything beyond damage (a Concentration check, a
 * spent zone, a condition), which a revert cannot put back.
 */
export function forcedMovementZoneRecord(settlements: readonly LiveSessionMovementSettlement[]) {
  const executions = settlements.flatMap((settlement) =>
    settlement.kind === 'SPATIAL' ? settlement.executions : []
  )
  const refused =
    settlements.some(
      (settlement) =>
        settlement.kind !== 'SPATIAL' ||
        settlement.transitions.some(({ transition }) => transition.kind !== 'UNCHANGED')
    ) ||
    executions.some(({ applications }) =>
      applications.some((application) => application.kind !== 'DAMAGE')
    )
  return {
    zoneDamage: executions.map(({ candidate, targetTransition }) => ({
      targetActorId: candidate.candidate.targetActorId,
      before: targetTransition.before,
      after: targetTransition.after
    })),
    ...(refused ? { zoneUndoRefused: true as const } : {})
  }
}
