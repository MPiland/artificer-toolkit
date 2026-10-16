import type { EncounterSettledAppRollDto } from '@artificer-toolkit/schema/api/encounterData'
import { withEncounterAppRoll } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type {
  ActiveRuleEffectRecord,
  EncounterMaintainedEffectStateRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerKernelRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import {
  completeNativeConcentrationResult,
  createNativeConcentrationContext,
  evaluateNativeConcentrationEvidence,
  prepareEncounterConcentrationState,
  type NativeConcentrationContext
} from '@artificer-toolkit/rules-runtime/encounterConcentration'
import {
  concentrationCommandId,
  concentrationOccurrenceId
} from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { requireInstalledConcentrationMaintenanceDefinitionId } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { deadCharacterIdsOfTargets } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { encounterConcentrationEndReason } from '@artificer-toolkit/rules-runtime/encounterConcentrationEnd'
import {
  grantsEndedByHolderState,
  stateBoundGrants
} from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { nextRollInt } from '@artificer-toolkit/rules-runtime/random'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  readNativeLiveMaintenanceOwners,
  readNativeLiveMaintenanceSlot
} from './nativeEncounterMaintenance.js'
import {
  projectNativeLiveMaintenanceOwners,
  type NativeLiveMaintenanceOwner,
  type planNativeLiveEncounterSettlement
} from './nativeEncounterSettlement.js'

/** Plans receipt-only children against the state after the parent action's mechanics and maintenance. */
export async function planNativeLiveConcentration(input: {
  state: EncounterRunState
  parentOccurrenceId: string
  parentCommandFingerprint: string
  applications: readonly NativeConcentrationContext['application'][]
  sourceLabels: NativeConcentrationContext['sourceLabels']
  occurredAt: string
  settlement: Pick<
    ReturnType<typeof planNativeLiveEncounterSettlement>,
    | 'actors'
    | 'projectedTargets'
    | 'activeEffectsByActorId'
    | 'maintenanceOwners'
    | 'maintainedState'
    | 'createdEffects'
  >
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
  runtime: RulesRuntimeService
  random?: (maximum: number) => number
  /** Each concentrating actor's roller preference (ADR 0034 decision 3). */
  autoRollByActorId: Readonly<Record<string, boolean>>
  resume?: {
    snapshot: ServerKernelRuleExecutionPendingSnapshotDto
    context: NativeConcentrationContext
    response: ResolveRuleOccurrenceInputDto
    /** The app roll Convex recorded for a `SYSTEM_ROLL` answer; null for any other answer. */
    appRoll: EncounterSettledAppRollDto | null
    applicationIndex: number
  }
}) {
  const state = input.state
  let projection = {
    actors: input.settlement.actors,
    projectedTargets: input.settlement.projectedTargets,
    activeEffectsByActorId: input.settlement.activeEffectsByActorId,
    maintenanceOwners: input.settlement.maintenanceOwners
  }
  const settled: Array<{
    result: ReturnType<typeof completeNativeConcentrationResult>
    commandId: string
    fingerprint: string
    correlationId: string
    definitionId: string
    factsChecksum: string
  }> = []
  let failed = false
  const concentrationEnds: Array<{
    ownerActorId: string
    maintainedStateId: string
    reason: NonNullable<Awaited<ReturnType<typeof encounterConcentrationEndReason>>>
    cleanup: Awaited<ReturnType<typeof loseConcentration>>
  }> = []
  // Grants their holder's incapacitation ends (D95), found by the same detection as Concentration.
  const endedGrants: ActiveRuleEffectRecord[] = []
  let pending: ServerKernelRuleExecutionPendingSnapshotDto | null = null
  let resumed: {
    result: ReturnType<typeof completeNativeConcentrationResult>
    failed: boolean
    selectedNatural: number
  } | null = null
  if (input.resume && (!input.applications.length || input.state.automationMode === 'MANUAL'))
    throw new Error('The concentration response is unavailable.')
  // A MANUAL Run keeps its Concentration slots: nothing is rolled or ended automatically.
  if (input.state.automationMode === 'MANUAL')
    return {
      ...projection,
      completed: [],
      concentrationEnds,
      endedGrants,
      pending,
      resumed,
      nextState: state
    }

  const { capture } = input
  const slots = new Map<string, EncounterMaintainedEffectStateRecord | null>()
  const definitions = new Map<
    string,
    Extract<LiveSessionEncounterRulesResponse, { kind: 'DEFINITION' }>['definition']
  >()
  let vocabulary:
    | Extract<LiveSessionEncounterRulesResponse, { kind: 'SYSTEM_VOCABULARY' }>['snapshot']
    | undefined
  const maintenanceDefinitionId = requireInstalledConcentrationMaintenanceDefinitionId(
    state.gameSystemId
  )
  async function slotFor(targetActorId: string) {
    if (!slots.has(targetActorId)) {
      const created = input.settlement.maintainedState
      if (
        created?.ownerActorId === targetActorId &&
        created.maintenanceDefinitionId === maintenanceDefinitionId
      )
        slots.set(targetActorId, created)
      else {
        const response = await capture({
          kind: 'MAINTENANCE_SLOT',
          actorId: targetActorId,
          definitionId: maintenanceDefinitionId
        })
        if (response.kind !== 'MAINTENANCE_SLOT')
          throw new Error('Concentration slot is unavailable.')
        slots.set(targetActorId, response.state)
      }
    }
    return slots.get(targetActorId)!
  }
  async function readDefinition(definitionId: string) {
    if (!definitions.has(definitionId)) {
      const response = await capture({ kind: 'DEFINITION', definitionId })
      if (response.kind !== 'DEFINITION')
        throw new Error('Concentration definition is unavailable.')
      definitions.set(definitionId, response.definition)
    }
    return definitions.get(definitionId)!
  }
  async function current(targetActorId: string) {
    return prepareEncounterConcentrationState({
      state,
      targetActorId,
      maintained: await slotFor(targetActorId),
      loadTarget: () => projection.projectedTargets.get(targetActorId),
      readDefinition,
      readVocabulary: async () => {
        if (!vocabulary) {
          const response = await capture({ kind: 'SYSTEM_VOCABULARY' })
          if (response.kind !== 'SYSTEM_VOCABULARY')
            throw new Error('Concentration vocabulary is unavailable.')
          vocabulary = response.snapshot
        }
        return vocabulary
      }
    })
  }

  /** Drops one Concentration slot and its dependents from the projection; the receipt cleanup it returns is persisted as a lost check or a CONCENTRATION_END. */
  async function loseConcentration(maintained: EncounterMaintainedEffectStateRecord) {
    const created = input.settlement.maintainedState?.id === maintained.id
    const slot = created
      ? {
          state: maintained,
          dependents: input.settlement.createdEffects.filter(
            (effect) => effect.maintainedEffectStateId === maintained.id
          )
        }
      : await readNativeLiveMaintenanceSlot({
          encounterId: input.state.id,
          actorId: maintained.ownerActorId,
          definitionId: maintained.maintenanceDefinitionId,
          capture
        })
    if (!slot.state || checksumCanonicalJson(slot.state) !== checksumCanonicalJson(maintained))
      throw new Error('The concentration state changed before cleanup.')
    const captured = created
      ? []
      : (
          await readNativeLiveMaintenanceOwners({
            gameSystemId: input.state.gameSystemId,
            actors: projection.actors,
            activeEffectsByActorId: projection.activeEffectsByActorId,
            removed: slot.dependents,
            slot: {
              actorId: maintained.ownerActorId,
              definitionId: slot.state.maintenanceDefinitionId,
              stateId: slot.state.id
            },
            capture
          })
        ).owners
    const owners: NativeLiveMaintenanceOwner[] = []
    const uniqueOwners = new Map(
      slot.dependents.map((effect) => [checksumCanonicalJson(effect.owner), effect.owner])
    )
    for (const [key, owner] of uniqueOwners) {
      const prior =
        projection.maintenanceOwners.find((entry) => checksumCanonicalJson(entry.owner) === key) ??
        captured.find((entry) => checksumCanonicalJson(entry.owner) === key)
      const target = [...projection.projectedTargets.values()].find((value) =>
        owner.kind === 'CHARACTER'
          ? value.actor.kind === 'CHARACTER' && value.actor.sourceId === owner.characterId
          : value.actor.id === owner.targetActorId
      )
      const actor = projection.actors.find((value) =>
        owner.kind === 'CHARACTER'
          ? value.kind === 'CHARACTER' && value.sourceId === owner.characterId
          : value.id === owner.targetActorId
      )
      const effects = actor ? projection.activeEffectsByActorId.get(actor.id) : prior?.effects
      if (!effects) throw new Error('Concentration effect owner is unavailable.')
      const row = target?.characterFacts?.active ?? prior?.character ?? null
      if (owner.kind === 'CHARACTER' && (!row || row.id !== owner.characterId))
        throw new Error('Concentration Character owner is unavailable.')
      owners.push({ owner, effects: [...effects], character: row })
    }
    const characterVersions = owners
      .flatMap((owner) =>
        owner.character
          ? [
              {
                characterId: owner.character.id,
                beforeStreamVersion: owner.character.play.streamVersion
              }
            ]
          : []
      )
      .sort((left, right) => left.characterId.localeCompare(right.characterId))
    const reconciled = projectNativeLiveMaintenanceOwners({
      ...projection,
      maintenance: { owners, removed: slot.dependents, characterVersions },
      createdEffects: [],
      campaignId: input.state.campaignId,
      gameSystemId: input.state.gameSystemId,
      occurredAt: input.occurredAt
    })
    const retainedOwners = new Map(
      projection.maintenanceOwners.map((owner) => [checksumCanonicalJson(owner.owner), owner])
    )
    for (const owner of reconciled.maintenanceOwners)
      retainedOwners.set(checksumCanonicalJson(owner.owner), owner)
    projection = {
      ...reconciled,
      maintenanceOwners: [...retainedOwners.values()]
    }
    slots.set(maintained.ownerActorId, null)
    return {
      maintainedStateId: slot.state.id,
      removedDependentEffectIds: slot.dependents.map((effect) => effect.id),
      characterOwnerTransitions: characterVersions.map((entry) => ({
        ...entry,
        afterStreamVersion: entry.beforeStreamVersion + 1
      }))
    }
  }

  if (!input.resume) {
    const definitionSource = {
      requireCurrent: async (definitionId: string) => {
        const definition = await readDefinition(definitionId)
        if (!definition) throw new Error('Concentration capability definition is unavailable.')
        return definition
      }
    }
    const heldTargets = [...projection.projectedTargets.values()].sort((left, right) =>
      left.actor.id.localeCompare(right.actor.id)
    )
    for (const target of heldTargets) {
      const actor = projection.actors.find((value) => value.id === target.actor.id)
      if (!actor) throw new Error('Concentration actor is unavailable.')
      const maintained = await slotFor(actor.id)
      const stateBound = stateBoundGrants(target.activeEffects)
      if (!maintained && !stateBound.length) continue
      const reason = await encounterConcentrationEndReason({
        actor,
        deadCharacterIds: deadCharacterIdsOfTargets([target]),
        conditionIds: target.state.conditions,
        activeEffects: target.activeEffects,
        gameSystemId: state.gameSystemId,
        definitions: definitionSource
      })
      if (reason && maintained)
        concentrationEnds.push({
          ownerActorId: actor.id,
          maintainedStateId: maintained.id,
          reason,
          cleanup: await loseConcentration(maintained)
        })
      endedGrants.push(
        ...grantsEndedByHolderState(stateBound, { reason, conditionIds: target.state.conditions })
      )
    }
  }
  if (!input.applications.length)
    return {
      ...projection,
      completed: [],
      concentrationEnds,
      endedGrants,
      pending,
      resumed,
      nextState: state
    }

  const bindings = new Map<string, string>()
  const selectedApplications = input.resume
    ? input.applications.slice(input.resume.applicationIndex)
    : input.applications
  for (const targetActorId of new Set(selectedApplications.map((entry) => entry.targetActorId))) {
    const loaded = await current(targetActorId)
    if (loaded) bindings.set(targetActorId, loaded.maintained.id)
  }
  let remaining = selectedApplications.flatMap((application) => {
    const maintainedStateId = bindings.get(application.targetActorId)
    return maintainedStateId ? [{ ...application, maintainedStateId }] : []
  })
  const envelope = checksumRuleDocument(input.applications)
  if (
    input.resume &&
    (envelope !== input.resume.context.finalizedDamageEnvelopeChecksum ||
      checksumRuleDocument(remaining.slice(1)) !==
        checksumRuleDocument(input.resume.context.remaining))
  )
    throw new Error('The concentration damage does not match its finalized parent receipt.')
  let correlationId = input.parentOccurrenceId
  while (remaining.length) {
    const { maintainedStateId, ...application } = remaining[0]!
    remaining = remaining.slice(1)
    const loaded = await current(application.targetActorId)
    if (!loaded || loaded.maintained.id !== maintainedStateId)
      throw new Error('The concentration state changed before its check.')
    const { context, facts } = createNativeConcentrationContext({
      current: loaded,
      parentOccurrenceId: input.parentOccurrenceId,
      parentCommandFingerprint: input.parentCommandFingerprint,
      application,
      remaining,
      finalizedDamageEnvelopeChecksum: envelope,
      sourceLabels: input.sourceLabels
    })
    const occurrenceId = concentrationOccurrenceId(input.parentOccurrenceId, application)
    const resume = resumed === null ? input.resume : undefined
    const isResumed = resume !== undefined
    const started = isResumed
      ? null
      : await input.runtime.executeResolved({
          command: { definitionId: loaded.published.id, occurrenceId, facts },
          published: loaded.published
        })
    if (started && started.status !== 'PAUSED')
      throw new Error('Concentration did not request bounded d20 evidence.')
    if (started && !input.autoRollByActorId[context.application.targetActorId]) {
      pending = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
        ...started.continuation,
        snapshotKind: 'KERNEL_EVIDENCE',
        applicationContext: context,
        optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum
      })
      break
    }
    const continuation = (() => {
      if (resume) {
        const {
          snapshotKind: _snapshotKind,
          applicationContext: sealed,
          optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
          phaseReceipts: _phaseReceipts,
          deferredCleaving: _deferredCleaving,
          ...stored
        } = resume.snapshot
        if (
          checksumRuleDocument(sealed) !== checksumRuleDocument(resume.context) ||
          checksumRuleDocument(context) !== checksumRuleDocument(resume.context) ||
          stored.graph.source.definitionId !== loaded.published.id ||
          stored.graph.source.checksum !== loaded.published.checksum ||
          checksumRuleDocument(stored.facts) !== checksumRuleDocument(facts) ||
          stored.occurrenceId !== occurrenceId
        )
          throw new Error('The concentration occurrence is stale.')
        return stored
      }
      if (!started) throw new Error('Concentration did not request bounded d20 evidence.')
      return started.continuation
    })()
    const resolution = resume
      ? withEncounterAppRoll(resume.response.resolution, resume.appRoll)
      : {
          kind: 'AUTO_ROLL' as const,
          requestId: continuation.request.requestId
        }
    if (
      resolution.kind !== 'ENTER_DICE' &&
      resolution.kind !== 'SYSTEM_ROLL' &&
      resolution.kind !== 'AUTO_ROLL'
    )
      throw new Error('The concentration evidence request is unavailable.')
    const evidence = await evaluateNativeConcentrationEvidence({
      context,
      continuation,
      resolution,
      expectedOccurrenceId: occurrenceId,
      runtime: input.runtime,
      random: input.random ?? nextRollInt
    })
    if (evidence.failed) failed = true
    const cleanup = evidence.failed ? await loseConcentration(loaded.maintained) : null
    const result = completeNativeConcentrationResult({
      context,
      continuation,
      ...evidence,
      cleanup,
      occurrenceVersion: resume ? resume.response.expectedOccurrenceVersion + 1 : 1,
      initialFactsChecksum: checksumRuleDocument(facts)
    })
    if (isResumed)
      resumed = {
        result,
        failed: evidence.failed,
        selectedNatural: evidence.selectedNatural
      }
    else
      settled.push({
        result,
        commandId: concentrationCommandId(occurrenceId),
        correlationId,
        fingerprint: checksumRuleDocument({
          parentOccurrenceId: input.parentOccurrenceId,
          application,
          contextChecksum: context.contextChecksum
        }),
        definitionId: loaded.published.id,
        factsChecksum: checksumRuleDocument(facts)
      })
    correlationId = occurrenceId
    if (evidence.failed)
      remaining = remaining.filter((entry) => entry.maintainedStateId !== maintainedStateId)
  }
  // A response commit advances the Encounter once when any check it settled failed (D23); a
  // parent's own commit owns its version.
  const nextState =
    input.resume && failed
      ? encounterRunStateSchema.parse({
          ...state,
          version: state.version + 1,
          updatedAt: input.occurredAt
        })
      : state
  const completed = settled.map(({ definitionId, factsChecksum, ...check }) => ({
    ...check,
    metadata: serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
      schemaVersion: 1,
      transition: 'START',
      definitionId,
      expectedAggregateVersion: nextState.version,
      factsChecksum,
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
    })
  }))
  return {
    ...projection,
    completed,
    concentrationEnds,
    endedGrants,
    pending,
    resumed,
    nextState
  }
}
