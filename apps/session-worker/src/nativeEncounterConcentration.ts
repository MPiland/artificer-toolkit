import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { EncounterMaintainedEffectStateRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
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
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import { nextRollInt } from '@artificer-toolkit/rules-runtime/random'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
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
  /** The roller's auto-roll preference; the initiator rolls Concentration in this slice. */
  autoRoll: boolean
  resume?: {
    snapshot: ServerKernelRuleExecutionPendingSnapshotDto
    context: NativeConcentrationContext
    response: ResolveRuleOccurrenceInputDto
    applicationIndex: number
  }
}) {
  let state = input.state
  let projection = {
    actors: input.settlement.actors,
    projectedTargets: input.settlement.projectedTargets,
    activeEffectsByActorId: input.settlement.activeEffectsByActorId,
    maintenanceOwners: input.settlement.maintenanceOwners
  }
  const completed: Array<{
    result: ReturnType<typeof completeNativeConcentrationResult>
    commandId: string
    fingerprint: string
    correlationId: string
    metadata: ReturnType<typeof serverRuleExecutionReceiptCommandMetadataDtoSchema.parse>
  }> = []
  const cleanups: Array<{
    state: EncounterMaintainedEffectStateRecord
    removed: Parameters<typeof projectNativeLiveMaintenanceOwners>[0]['maintenance']['removed']
    characterVersions: Parameters<
      typeof projectNativeLiveMaintenanceOwners
    >[0]['maintenance']['characterVersions']
  }> = []
  let pending: ServerKernelRuleExecutionPendingSnapshotDto | null = null
  let resumed: {
    result: ReturnType<typeof completeNativeConcentrationResult>
    failed: boolean
    selectedNatural: number
  } | null = null
  if (input.resume && (!input.applications.length || input.state.automationMode === 'MANUAL'))
    throw new Error('The concentration response is unavailable.')
  if (!input.applications.length || input.state.automationMode === 'MANUAL')
    return { ...projection, completed, cleanups, pending, resumed, nextState: state }

  const { capture } = input
  const slots = new Map<string, EncounterMaintainedEffectStateRecord | null>()
  const definitions = new Map<
    string,
    Extract<LiveSessionEncounterRulesResponse, { kind: 'DEFINITION' }>['definition']
  >()
  let vocabulary:
    | Extract<LiveSessionEncounterRulesResponse, { kind: 'SYSTEM_VOCABULARY' }>['snapshot']
    | undefined
  async function current(targetActorId: string) {
    if (!slots.has(targetActorId)) {
      const created = input.settlement.maintainedState
      if (
        created?.ownerActorId === targetActorId &&
        created.maintenanceDefinitionId === DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
      )
        slots.set(targetActorId, created)
      else {
        const response = await capture({
          kind: 'MAINTENANCE_SLOT',
          actorId: targetActorId,
          definitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
        })
        if (response.kind !== 'MAINTENANCE_SLOT')
          throw new Error('Concentration slot is unavailable.')
        slots.set(targetActorId, response.state)
      }
    }
    return prepareEncounterConcentrationState({
      state,
      targetActorId,
      maintained: slots.get(targetActorId)!,
      loadTarget: () => projection.projectedTargets.get(targetActorId),
      readDefinition: async (definitionId) => {
        if (!definitions.has(definitionId)) {
          const response = await capture({ kind: 'DEFINITION', definitionId })
          if (response.kind !== 'DEFINITION')
            throw new Error('Concentration definition is unavailable.')
          definitions.set(definitionId, response.definition)
        }
        return definitions.get(definitionId)!
      },
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
      finalizedDamageEnvelopeChecksum: envelope
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
    if (started && !input.autoRoll) {
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
      ? resume.response.resolution
      : { kind: 'SYSTEM_ROLL' as const, requestId: continuation.request.requestId }
    if (resolution.kind !== 'ENTER_DICE' && resolution.kind !== 'SYSTEM_ROLL')
      throw new Error('The concentration evidence request is unavailable.')
    const evidence = await evaluateNativeConcentrationEvidence({
      context,
      continuation,
      resolution,
      expectedOccurrenceId: occurrenceId,
      runtime: input.runtime,
      random: input.random ?? nextRollInt
    })
    let cleanup: Parameters<typeof completeNativeConcentrationResult>[0]['cleanup'] = null
    if (evidence.failed) {
      const created = input.settlement.maintainedState?.id === maintainedStateId
      const slot = created
        ? {
            state: loaded.maintained,
            dependents: input.settlement.createdEffects.filter(
              (effect) => effect.maintainedEffectStateId === maintainedStateId
            )
          }
        : await readNativeLiveMaintenanceSlot({
            encounterId: input.state.id,
            actorId: application.targetActorId,
            definitionId: loaded.maintained.maintenanceDefinitionId,
            capture
          })
      if (
        !slot.state ||
        checksumCanonicalJson(slot.state) !== checksumCanonicalJson(loaded.maintained)
      )
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
                actorId: application.targetActorId,
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
          projection.maintenanceOwners.find(
            (entry) => checksumCanonicalJson(entry.owner) === key
          ) ?? captured.find((entry) => checksumCanonicalJson(entry.owner) === key)
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
        const character = target?.characterFacts
        let row = prior?.character ?? null
        if (character) {
          const active: typeof character.active &
            Partial<NonNullable<NativeLiveMaintenanceOwner['character']>> = character.active
          row = {
            ...row,
            ...active,
            documentJson:
              active.documentJson ??
              row?.documentJson ??
              canonicalizeRuleDocument(character.character),
            sheetState: active.sheetState ?? row?.sheetState,
            updatedAt: active.updatedAt ?? row?.updatedAt ?? input.occurredAt
          }
        }
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
                  beforeStreamVersion: owner.character.streamVersion
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
      projection = { ...reconciled, maintenanceOwners: [...retainedOwners.values()] }
      slots.set(application.targetActorId, null)
      cleanups.push({ state: slot.state, removed: slot.dependents, characterVersions })
      cleanup = {
        maintainedStateId: slot.state.id,
        removedDependentEffectIds: slot.dependents.map((effect) => effect.id),
        characterOwnerTransitions: characterVersions.map((entry) => ({
          ...entry,
          afterStreamVersion: entry.beforeStreamVersion + 1
        }))
      }
    }
    const result = completeNativeConcentrationResult({
      context,
      continuation,
      ...evidence,
      cleanup,
      occurrenceVersion: resume ? resume.response.expectedOccurrenceVersion + 1 : 1,
      initialFactsChecksum: checksumRuleDocument(facts)
    })
    if (isResumed)
      resumed = { result, failed: evidence.failed, selectedNatural: evidence.selectedNatural }
    else
      completed.push({
        result,
        commandId: concentrationCommandId(occurrenceId),
        correlationId,
        fingerprint: checksumRuleDocument({
          parentOccurrenceId: input.parentOccurrenceId,
          application,
          contextChecksum: context.contextChecksum
        }),
        metadata: serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
          schemaVersion: 1,
          transition: 'START',
          definitionId: loaded.published.id,
          expectedAggregateVersion: state.version,
          factsChecksum: checksumRuleDocument(facts),
          optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
        })
      })
    correlationId = occurrenceId
    if (isResumed && evidence.failed)
      state = encounterRunStateSchema.parse({
        ...state,
        version: state.version + 1,
        updatedAt: input.occurredAt
      })
    if (evidence.failed)
      remaining = remaining.filter((entry) => entry.maintainedStateId !== maintainedStateId)
  }
  return { ...projection, completed, cleanups, pending, resumed, nextState: state }
}
