import type { EncounterSettledAppRollDto } from '@artificer-toolkit/schema/api/encounterData'
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
  concentrationSaveApplications,
  createNativeConcentrationContext,
  evaluateNativeConcentrationEvidence,
  prepareEncounterConcentrationState,
  type NativeConcentrationContext,
  type NativeDamageSaveContext
} from '@artificer-toolkit/rules-runtime/encounterConcentration'
import {
  completeEffectRepeatSaveResult,
  createEffectRepeatSaveContext,
  effectRepeatSaveApplications,
  effectRepeatSaveExecutionInput,
  effectRepeatSaveMade,
  effectRepeatTrigger,
  evaluateEffectRepeatSaveEvidence
} from '@artificer-toolkit/rules-runtime/encounterEffectRepeatSave'
import {
  executeTargetBoundActiveRuleEffectWithPause,
  verifyTargetBoundActiveRuleEffectContinuation
} from '@artificer-toolkit/rules-runtime/targetBoundActiveRuleEffectExecutor'
import {
  encounterActorsAfterEscape,
  encounterEscapeEndedConditionIds
} from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import {
  compareDamageSaveApplications,
  damageSaveApplicationsAfterRelease,
  isMaintainedDamageApplication,
  type DamageSaveApplicationDto
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import {
  concentrationCommandId,
  concentrationOccurrenceId,
  damageSaveContextBoundApplication
} from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import {
  completeMassiveDamageSaveResult,
  createMassiveDamageSaveContext,
  encounterMassiveDamageRule,
  evaluateMassiveDamageSaveEvidence,
  massiveDamageSaveApplications
} from '@artificer-toolkit/rules-runtime/encounterMassiveDamage'
import { requireInstalledConcentrationMaintenanceDefinitionId } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import {
  deadCharacterIdsOfTargets,
  isEncounterActorDefeated
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { encounterConcentrationEndReason } from '@artificer-toolkit/rules-runtime/encounterConcentrationEnd'
import { encounterSavingThrowAddedDice } from '@artificer-toolkit/rules-runtime/encounterActiveGrants'
import { savingThrowSpentEffects } from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import { abilityScoreCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import {
  grantsEndedByHolderState,
  grantsEndedBySourceState,
  sourceBoundGrants,
  stateBoundGrants
} from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { encounterItemInstanceIdsOnActor } from '@artificer-toolkit/rules-runtime/encounterChosenItem'
import { nextRollInt } from '@artificer-toolkit/rules-runtime/random'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  readNativeLiveMaintenanceOwners,
  readNativeLiveMaintenanceSlot
} from './nativeEncounterMaintenance.js'
import { bindEncounterD20Evidence } from './nativeD20Evidence.js'
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
  /**
   * Opts the chain into the effect repeat saves the damage owes (D167); `damagerActorId` is who dealt
   * it. A resumed chain takes this from its sealed context, so callers pass it only on the first plan.
   */
  repeatSaves?: { damagerActorId: string | null }
  resume?: {
    snapshot: ServerKernelRuleExecutionPendingSnapshotDto
    context: NativeDamageSaveContext
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
  // A lost Concentration, or an effect a made repeat save released (D23): the commit advances the Run.
  let mutated = false
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
    mutated: boolean
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
      readVocabulary
    })
  }
  async function readVocabulary() {
    if (!vocabulary) {
      const response = await capture({ kind: 'SYSTEM_VOCABULARY' })
      if (response.kind !== 'SYSTEM_VOCABULARY')
        throw new Error('Concentration vocabulary is unavailable.')
      vocabulary = response.snapshot
    }
    return vocabulary
  }

  /** Drops one Concentration slot and its dependents from the projection; the receipt cleanup it returns is persisted as a lost check or a CONCENTRATION_END. */
  async function loseConcentration(maintained: EncounterMaintainedEffectStateRecord) {
    const created = input.settlement.maintainedState?.id === maintained.id
    const slot = created
      ? {
          state: maintained,
          dependents: input.settlement.createdEffects.filter(
            (effect) => effect.maintainedEffectStateId === maintained.id
          ),
          zoneIds: []
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
      removedZoneIds: slot.zoneIds,
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
    // Why each changed actor can no longer act, for the grants it applied to others.
    const sourceReasons = new Map<
      string,
      Awaited<ReturnType<typeof encounterConcentrationEndReason>>
    >()
    for (const target of heldTargets) {
      const actor = projection.actors.find((value) => value.id === target.actor.id)
      if (!actor) throw new Error('Concentration actor is unavailable.')
      const maintained = await slotFor(actor.id)
      const stateBound = stateBoundGrants(target.activeEffects)
      const sourcesGrants = [...projection.activeEffectsByActorId.values()].some((effects) =>
        sourceBoundGrants(effects).some(
          ({ definition }) =>
            definition.origin.kind === 'ENCOUNTER' && definition.origin.sourceActorId === actor.id
        )
      )
      if (!maintained && !stateBound.length && !sourcesGrants) continue
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
      sourceReasons.set(actor.id, reason)
      endedGrants.push(
        ...grantsEndedByHolderState(stateBound, {
          reason,
          conditionIds: target.state.conditions,
          itemInstanceIdsOnActor: encounterItemInstanceIdsOnActor(
            target.actor,
            target.characterFacts?.character.state.equipment.equipped
          )
        })
      )
    }
    // Grants on other actors end with their source, in the same commit as its incapacitation.
    const endedIds = new Set(endedGrants.map(({ id }) => id))
    for (const effects of projection.activeEffectsByActorId.values())
      for (const grant of grantsEndedBySourceState(effects, sourceReasons))
        if (!endedIds.has(grant.id)) endedGrants.push(grant)
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
  // Who dealt the damage when its chain can hold effect repeat and massive-damage saves; a resumed
  // chain keeps its own.
  const repeatSaveDamager = input.resume
    ? input.resume.context.repeatSaveDamagerActorId
    : input.repeatSaves?.damagerActorId
  const dispositions = new Map(projection.actors.map(({ id, disposition }) => [id, disposition]))
  const massiveRule = encounterMassiveDamageRule(state)
  const holders = new Map(
    [...new Set(selectedApplications.map(({ targetActorId }) => targetActorId))].map((actorId) => {
      const actor = projection.actors.find(({ id }) => id === actorId)
      const target = projection.projectedTargets.get(actorId)
      return [
        actorId,
        {
          defeated:
            !actor ||
            isEncounterActorDefeated(actor, deadCharacterIdsOfTargets(target ? [target] : [])),
          effects: projection.activeEffectsByActorId.get(actorId) ?? [],
          maximumHitPoints: target?.effectiveMaximumHitPoints ?? 0
        }
      ] as const
    })
  )
  const boundItems: DamageSaveApplicationDto[] =
    repeatSaveDamager === undefined
      ? []
      : [
          ...effectRepeatSaveApplications({
            applications: selectedApplications,
            parentOccurrenceId: input.parentOccurrenceId,
            damagerActorId: repeatSaveDamager,
            dispositions,
            holders
          }),
          ...massiveDamageSaveApplications({
            rule: massiveRule,
            applications: selectedApplications,
            holders
          })
        ]
  let remaining: DamageSaveApplicationDto[] = [
    ...concentrationSaveApplications({
      gameSystemId: state.gameSystemId,
      applications: selectedApplications,
      maintainedStateIds: bindings,
      damagerActorId: repeatSaveDamager ?? null,
      dispositions
    }),
    ...boundItems
  ].sort(compareDamageSaveApplications)
  if (input.resume) {
    const answered = damageSaveContextBoundApplication(input.resume.context)
    remaining = remaining.filter((entry) => compareDamageSaveApplications(entry, answered) >= 0)
    if (!remaining[0] || compareDamageSaveApplications(remaining[0], answered) !== 0)
      throw new Error('The concentration damage does not match its finalized parent receipt.')
  }
  const envelope = checksumRuleDocument(input.applications)
  if (
    input.resume &&
    (envelope !== input.resume.context.finalizedDamageEnvelopeChecksum ||
      checksumRuleDocument(remaining.slice(1)) !==
        checksumRuleDocument(input.resume.context.remaining))
  )
    throw new Error('The concentration damage does not match its finalized parent receipt.')
  const chainHasEffects = remaining.some((entry) => !isMaintainedDamageApplication(entry))
  let correlationId = input.parentOccurrenceId
  const spentDiceIds = new Set<string>()

  /** Pauses for or settles one effect's repeat save, whose success ends the effect (D167). */
  async function settleEffectRepeatSave(
    item: Extract<DamageSaveApplicationDto, { activeEffectId: string }>
  ) {
    const { activeEffectId, ...application } = item
    const holder = projection.actors.find(({ id }) => id === application.targetActorId)
    const target = projection.projectedTargets.get(application.targetActorId)
    const heldEffects = projection.activeEffectsByActorId.get(application.targetActorId) ?? []
    const effect = heldEffects.find(({ id }) => id === activeEffectId)
    const trigger =
      effect &&
      effectRepeatTrigger(effect, {
        damagerActorId: application.damagerActorId ?? repeatSaveDamager ?? null,
        dispositions,
        damageTypeId: application.damageTypeId
      })
    if (!holder || !target || !effect || !trigger)
      throw new Error('The repeat save effect changed before its check.')
    // A die an earlier check of this batch spent (D156) is gone for this one.
    const unspent = spentDiceIds.size
      ? {
          ...target,
          targetDerivedFacts: {
            ...target.targetDerivedFacts,
            savingThrowAddedDice: encounterSavingThrowAddedDice(
              state.gameSystemId,
              target.activeEffects.filter(({ id }) => !spentDiceIds.has(id))
            )
          }
        }
      : target
    const occurrenceId = concentrationOccurrenceId(input.parentOccurrenceId, item)
    const resume = resumed === null ? input.resume : undefined
    const sealed = resume?.context
    if (sealed && sealed.source !== 'EFFECT_REPEAT_SAVE')
      throw new Error('The repeat save occurrence is stale.')
    const effectInput = effectRepeatSaveExecutionInput({
      effect,
      target: unspent,
      occurrenceId,
      rollInfluence: trigger.rollInfluence,
      runtime: input.runtime
    })
    const started = sealed ? null : await executeTargetBoundActiveRuleEffectWithPause(effectInput)
    const paused = started && 'continuation' in started ? started : null
    if (started && !paused) throw new Error('The repeat save did not request bounded d20 evidence.')
    const d20Policy = paused?.evidencePolicy ?? sealed?.d20Policy
    const abilityId = d20Policy?.savingThrowAbilityDefinitionId
    const vocabularySnapshot = await readVocabulary()
    if (
      !d20Policy ||
      !abilityId ||
      !vocabularySnapshot ||
      !('damageTypes' in vocabularySnapshot.document)
    )
      throw new Error('The repeat save evidence policy is unavailable.')
    const context = createEffectRepeatSaveContext({
      effect,
      target: unspent,
      systemVocabularySnapshot: {
        id: vocabularySnapshot.snapshotId,
        version: vocabularySnapshot.snapshotVersion,
        checksum: vocabularySnapshot.checksum
      },
      damageTypes: vocabularySnapshot.document.damageTypes,
      d20Policy,
      rollInfluence: trigger.rollInfluence,
      parentOccurrenceId: input.parentOccurrenceId,
      parentCommandFingerprint: input.parentCommandFingerprint,
      application,
      remaining,
      finalizedDamageEnvelopeChecksum: envelope,
      sourceLabels: input.sourceLabels,
      damagerActorId: repeatSaveDamager ?? null
    })
    if (paused && !input.autoRollByActorId[application.targetActorId]) {
      pending = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
        ...paused.continuation,
        snapshotKind: 'KERNEL_EVIDENCE',
        applicationContext: context,
        optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum
      })
      return 'PAUSED' as const
    }
    const continuation = (() => {
      if (resume) {
        const {
          snapshotKind: _snapshotKind,
          applicationContext: sealedContext,
          optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
          phaseReceipts: _phaseReceipts,
          deferredCleaving: _deferredCleaving,
          ...stored
        } = resume.snapshot
        if (
          checksumRuleDocument(sealedContext) !== checksumRuleDocument(resume.context) ||
          checksumRuleDocument(context) !== checksumRuleDocument(resume.context) ||
          stored.occurrenceId !== occurrenceId
        )
          throw new Error('The repeat save occurrence is stale.')
        verifyTargetBoundActiveRuleEffectContinuation({
          ...effectInput,
          continuation: stored,
          expectedEvidencePolicy: d20Policy
        })
        return stored
      }
      if (!paused) throw new Error('The repeat save did not request bounded d20 evidence.')
      return paused.continuation
    })()
    const resolution = bindEncounterD20Evidence({
      response: resume ? { resolution: resume.response.resolution, appRoll: resume.appRoll } : null,
      autoRollRequestId: continuation.request.requestId,
      refusal: 'The repeat save evidence request is unavailable.'
    })
    const evidence = await evaluateEffectRepeatSaveEvidence({
      effectInput,
      context,
      continuation,
      resolution,
      expectedOccurrenceId: occurrenceId,
      random: input.random ?? nextRollInt
    })
    for (const die of savingThrowSpentEffects(
      unspent.activeEffects,
      abilityScoreCapabilityRegistry.require(state.gameSystemId).abilityCode(abilityId)
    )) {
      spentDiceIds.add(die.id)
      endedGrants.push(die)
    }
    const made = effectRepeatSaveMade(evidence)
    const result = completeEffectRepeatSaveResult({
      context,
      continuation,
      evidence,
      removedConditionIds: made ? encounterEscapeEndedConditionIds(heldEffects, effect.id) : null,
      occurrenceVersion: resume ? resume.response.expectedOccurrenceVersion + 1 : 1,
      initialFactsChecksum: checksumRuleDocument(continuation.facts)
    })
    if (made) {
      mutated = true
      const remainingEffects = heldEffects.filter(({ id }) => id !== effect.id)
      projection = {
        ...projection,
        actors: encounterActorsAfterEscape({
          encounterId: state.id,
          actors: projection.actors,
          holderId: holder.id,
          holderEffects: heldEffects,
          activeEffectId: effect.id
        }),
        activeEffectsByActorId: new Map(projection.activeEffectsByActorId).set(
          holder.id,
          remainingEffects
        ),
        projectedTargets: new Map(projection.projectedTargets).set(holder.id, {
          ...target,
          activeEffects: remainingEffects
        })
      }
      remaining = damageSaveApplicationsAfterRelease(remaining, effect.id)
    }
    if (resume) resumed = { result, mutated: made, selectedNatural: evidence.d20.selectedNatural }
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
        definitionId: effect.definition.frozenGraph.source.definitionId,
        factsChecksum: checksumRuleDocument(continuation.facts)
      })
    correlationId = occurrenceId
    return 'SETTLED' as const
  }

  /**
   * Pauses for or settles one massive-damage save (ATTACK-16) against the rule's own save graph. It
   * records its outcome and changes nothing else.
   */
  async function settleMassiveDamageSave(
    item: Extract<DamageSaveApplicationDto, { optionalCombatDefinitionId: string }>
  ) {
    const { optionalCombatDefinitionId, ...application } = item
    const target = projection.projectedTargets.get(application.targetActorId)
    if (!massiveRule || massiveRule.pin.definitionId !== optionalCombatDefinitionId || !target)
      throw new Error('The massive-damage rule changed before its save.')
    // A die an earlier check of this batch spent (D156) is gone for this one.
    const unspent = spentDiceIds.size
      ? {
          ...target,
          targetDerivedFacts: {
            ...target.targetDerivedFacts,
            savingThrowAddedDice: encounterSavingThrowAddedDice(
              state.gameSystemId,
              target.activeEffects.filter(({ id }) => !spentDiceIds.has(id))
            )
          }
        }
      : target
    const vocabularySnapshot = await readVocabulary()
    if (!('damageTypes' in vocabularySnapshot.document))
      throw new Error('The massive-damage save vocabulary is unavailable.')
    const { context, facts } = createMassiveDamageSaveContext({
      gameSystemId: state.gameSystemId,
      rule: massiveRule,
      target: unspent,
      maximumHitPoints: target.effectiveMaximumHitPoints,
      systemVocabularySnapshot: {
        id: vocabularySnapshot.snapshotId,
        version: vocabularySnapshot.snapshotVersion,
        checksum: vocabularySnapshot.checksum
      },
      damageTypes: vocabularySnapshot.document.damageTypes,
      parentOccurrenceId: input.parentOccurrenceId,
      parentCommandFingerprint: input.parentCommandFingerprint,
      application,
      remaining,
      finalizedDamageEnvelopeChecksum: envelope,
      sourceLabels: input.sourceLabels,
      damagerActorId: repeatSaveDamager ?? null
    })
    const { published } = massiveRule
    const occurrenceId = concentrationOccurrenceId(input.parentOccurrenceId, item)
    const resume = resumed === null ? input.resume : undefined
    if (resume && resume.context.source !== 'MASSIVE_DAMAGE')
      throw new Error('The massive-damage save occurrence is stale.')
    const started = resume
      ? null
      : await input.runtime.executeResolved({
          command: { definitionId: published.id, occurrenceId, facts },
          published
        })
    if (started && started.status !== 'PAUSED')
      throw new Error('The massive-damage save did not request bounded d20 evidence.')
    if (started && !input.autoRollByActorId[application.targetActorId]) {
      pending = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
        ...started.continuation,
        snapshotKind: 'KERNEL_EVIDENCE',
        applicationContext: context,
        optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum
      })
      return 'PAUSED' as const
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
          stored.graph.source.definitionId !== published.id ||
          stored.graph.source.checksum !== published.checksum ||
          checksumRuleDocument(stored.facts) !== checksumRuleDocument(facts) ||
          stored.occurrenceId !== occurrenceId
        )
          throw new Error('The massive-damage save occurrence is stale.')
        return stored
      }
      if (!started) throw new Error('The massive-damage save did not request bounded d20 evidence.')
      return started.continuation
    })()
    const resolution = bindEncounterD20Evidence({
      response: resume ? { resolution: resume.response.resolution, appRoll: resume.appRoll } : null,
      autoRollRequestId: continuation.request.requestId,
      refusal: 'The massive-damage save request is unavailable.'
    })
    const evidence = await evaluateMassiveDamageSaveEvidence({
      gameSystemId: state.gameSystemId,
      runtime: input.runtime,
      random: input.random ?? nextRollInt,
      context,
      rule: massiveRule,
      continuation,
      resolution,
      expectedOccurrenceId: occurrenceId
    })
    for (const die of savingThrowSpentEffects(
      unspent.activeEffects,
      abilityScoreCapabilityRegistry
        .require(state.gameSystemId)
        .abilityCode(context.save.savingThrowAbilityDefinitionId)
    )) {
      spentDiceIds.add(die.id)
      endedGrants.push(die)
    }
    const result = completeMassiveDamageSaveResult({
      context,
      continuation,
      evidence,
      occurrenceVersion: resume ? resume.response.expectedOccurrenceVersion + 1 : 1,
      initialFactsChecksum: checksumRuleDocument(facts)
    })
    if (resume) resumed = { result, mutated: false, selectedNatural: evidence.selectedNatural }
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
        definitionId: published.id,
        factsChecksum: checksumRuleDocument(facts)
      })
    correlationId = occurrenceId
    return 'SETTLED' as const
  }

  while (remaining.length) {
    const item = remaining[0]!
    remaining = remaining.slice(1)
    if ('activeEffectId' in item) {
      if ((await settleEffectRepeatSave(item)) === 'PAUSED') break
      continue
    }
    if ('optionalCombatDefinitionId' in item) {
      if ((await settleMassiveDamageSave(item)) === 'PAUSED') break
      continue
    }
    const { maintainedStateId, ...application } = item
    const loaded = await current(application.targetActorId)
    if (!loaded || loaded.maintained.id !== maintainedStateId)
      throw new Error('The concentration state changed before its check.')
    // A die an earlier check of this batch spent (D156) is gone for this one.
    const unspent = spentDiceIds.size
      ? {
          ...loaded,
          target: {
            ...loaded.target,
            targetDerivedFacts: {
              ...loaded.target.targetDerivedFacts,
              savingThrowAddedDice: encounterSavingThrowAddedDice(
                state.gameSystemId,
                loaded.target.activeEffects.filter(({ id }) => !spentDiceIds.has(id))
              )
            }
          }
        }
      : loaded
    const { context, facts } = createNativeConcentrationContext({
      gameSystemId: state.gameSystemId,
      current: unspent,
      parentOccurrenceId: input.parentOccurrenceId,
      parentCommandFingerprint: input.parentCommandFingerprint,
      application,
      remaining,
      finalizedDamageEnvelopeChecksum: envelope,
      sourceLabels: input.sourceLabels,
      repeatSaveDamagerActorId: chainHasEffects ? repeatSaveDamager : undefined
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
    const resolution = bindEncounterD20Evidence({
      response: resume ? { resolution: resume.response.resolution, appRoll: resume.appRoll } : null,
      autoRollRequestId: continuation.request.requestId,
      refusal: 'The concentration evidence request is unavailable.'
    })
    const evidence = await evaluateNativeConcentrationEvidence({
      gameSystemId: loaded.published.gameSystemId,
      context,
      continuation,
      resolution,
      expectedOccurrenceId: occurrenceId,
      runtime: input.runtime,
      random: input.random ?? nextRollInt
    })
    if (evidence.failed) mutated = true
    for (const die of savingThrowSpentEffects(
      unspent.target.activeEffects,
      abilityScoreCapabilityRegistry
        .require(state.gameSystemId)
        .abilityCode(context.save.savingThrowAbilityDefinitionId)
    )) {
      spentDiceIds.add(die.id)
      endedGrants.push(die)
    }
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
        mutated: evidence.failed,
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
      remaining = remaining.filter(
        (entry) =>
          !isMaintainedDamageApplication(entry) || entry.maintainedStateId !== maintainedStateId
      )
  }
  // A response commit advances the Encounter once when any check it settled failed (D23); a
  // parent's own commit owns its version.
  const nextState =
    input.resume && mutated
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
