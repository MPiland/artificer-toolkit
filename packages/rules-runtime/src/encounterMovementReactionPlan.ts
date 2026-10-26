import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { serverRuleExecutionApplicationOutputsDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import { movementReactionActionExecutionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMovementReactionReceipts'
import {
  requireTestRollMode,
  resolveEncounterActionPhaseExecution
} from './encounterActionPhaseExecution.js'
import {
  encounterAllowanceUsed,
  withEncounterAllowanceUsed,
  featureChargeUsed,
  withFeatureChargeUsed
} from './encounterActorState.js'
import { withDecoyStrikeApplied } from './encounterAttackDecoys.js'
import { advanceNativeActionGraphs, executeNativeActionGraphs } from './encounterActionExecution.js'
import { bindEncounterMovementReactionInterruption } from './encounterMovementReactionExecution.js'
import type { resolveNativeMovementLegendaryResistance } from './encounterMovementLegendaryResistance.js'
import { prepareEncounterMovementReactionAction } from './encounterMovementReactionPreparation.js'
import { prepareEncounterActionMaintenance } from './encounterActionMaintenance.js'
import {
  projectEncounterMovementMaintenance,
  type MovementCharacterRow,
  type MovementMaintenanceOwner,
  type MovementMaintenanceProjection
} from './encounterMovementMaintenance.js'
import {
  projectEncounterActionTarget,
  type ProjectableCharacterFacts
} from './encounterActionProjection.js'
import { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import {
  planNativeEncounterActionMechanics,
  finishNativeActionMechanicsSettlement,
  type NativeEncounterActionMechanicsInput
} from './encounterActionMechanicsPlan.js'
import { planEncounterMovementReactionEffects } from './encounterMovementReactionEffects.js'

type PreparedMechanics<TFacts extends ProjectableCharacterFacts> = Awaited<
  ReturnType<typeof prepareEncounterActionMechanics<TFacts>>
>
type PreparedMaintenance<TRow extends MovementCharacterRow> = NonNullable<
  Awaited<
    ReturnType<
      typeof prepareEncounterActionMaintenance<{
        characterVersions: { characterId: string; beforeStreamVersion: number }[]
        owners: MovementMaintenanceOwner<TRow>[]
      }>
    >
  >
>
type PreparedReaction<
  TFacts extends ProjectableCharacterFacts,
  TRow extends MovementCharacterRow
> = Awaited<
  ReturnType<
    typeof prepareEncounterMovementReactionAction<
      TFacts,
      PreparedMechanics<TFacts>,
      MovementMaintenanceProjection<TRow>,
      PreparedMaintenance<TRow> | null
    >
  >
>
type CompletedReaction = Awaited<ReturnType<typeof executeNativeActionGraphs>> & {
  kind: 'COMPLETE'
  resistance?: Awaited<ReturnType<typeof resolveNativeMovementLegendaryResistance>> | null
}
type SettledMechanics = ReturnType<typeof finishNativeActionMechanicsSettlement>

export type MovementReactionSettlementInput<
  TFacts extends ProjectableCharacterFacts,
  TRow extends MovementCharacterRow
> = {
  prepared: PreparedReaction<TFacts, TRow>
  occurrenceId: string
  commandId: string
  ordinal: number
  occurredAt: string
  execution:
    | CompletedReaction
    | Extract<Awaited<ReturnType<typeof advanceNativeActionGraphs>>, { kind: 'PENDING' }>
}

function verifyCompletedMovementReactionPlan<
  TFacts extends ProjectableCharacterFacts,
  TRow extends MovementCharacterRow
>(input: { prepared: PreparedReaction<TFacts, TRow>; execution: CompletedReaction }) {
  const initial =
    input.prepared.executionPlan.kind === 'SINGLE_GRAPH'
      ? input.prepared.executionPlan.published
      : input.prepared.executionPlan.test.published
  const bound = input.prepared.prepared.adapter.bindFacts({
    ...input.prepared.prepared.binding,
    published: initial
  })
  if (
    input.execution.initialFactsChecksum !== checksumRuleDocument(bound.facts) ||
    input.execution.initialPublished.id !== initial.id ||
    input.execution.initialPublished.checksum !== initial.checksum
  )
    throw new Error('The movement reaction initial action evidence is stale.')
  if (input.prepared.executionPlan.kind === 'SINGLE_GRAPH') {
    if (
      input.execution.published.id !== initial.id ||
      input.execution.published.checksum !== initial.checksum ||
      input.execution.execution.evidence.source.definitionId !== initial.id ||
      input.execution.execution.evidence.source.checksum !== initial.checksum ||
      input.execution.phaseReceipts !== undefined
    )
      throw new Error('The movement reaction initial action evidence is stale.')
    return
  }
  const phases = input.execution.phaseReceipts
  const test = phases?.[0]
  if (
    !test ||
    test.phase !== 'TEST' ||
    test.boundFactsChecksum !== input.execution.initialFactsChecksum ||
    test.specializedChecksum !== initial.checksum ||
    test.execution.evidence.source.definitionId !== initial.id ||
    test.execution.evidence.source.checksum !== initial.checksum
  )
    throw new Error('The movement reaction TEST evidence is stale.')
  const resolution = resolveEncounterActionPhaseExecution({
    plan: input.prepared.executionPlan,
    phase: 'TEST',
    execution: test.execution,
    adapter: input.prepared.prepared.adapter,
    facts: bound.facts,
    testRollMode: requireTestRollMode(input.execution.d20),
    absorbedByDecoy: input.prepared.prepared.binding.absorbedByDecoy,
    ...(input.execution.resistance
      ? { effectivePath: input.execution.resistance.effectivePath }
      : {})
  })
  const terminal = phases.at(-1)
  const terminalExecution = terminal
    ? bindEncounterMovementReactionInterruption(
        terminal.execution,
        phases,
        input.prepared.action.movementInterruption,
        input.execution.resistance?.effectivePath
      )
    : null
  if (
    resolution.kind === 'OUTCOME' &&
    (phases.length !== 2 ||
      !terminal ||
      terminal.phase !== 'OUTCOME' ||
      terminal.specializedChecksum !== resolution.outcome.published.checksum ||
      input.execution.published.id !== resolution.outcome.published.id ||
      input.execution.published.checksum !== resolution.outcome.published.checksum ||
      terminal.execution.evidence.source.definitionId !== resolution.outcome.published.id ||
      terminal.execution.evidence.source.checksum !== resolution.outcome.published.checksum ||
      terminal.boundFactsChecksum !==
        checksumRuleDocument(
          input.prepared.prepared.adapter.bindFacts({
            ...input.prepared.prepared.binding,
            published: resolution.outcome.published
          }).facts
        ) ||
      checksumRuleDocument(terminalExecution) !== checksumRuleDocument(input.execution.execution))
  )
    throw new Error('The movement reaction OUTCOME evidence is stale.')
  if (
    resolution.kind === 'TEST_ONLY' &&
    (phases.length !== 1 ||
      input.execution.published.id !== initial.id ||
      input.execution.published.checksum !== initial.checksum ||
      checksumRuleDocument(terminalExecution) !== checksumRuleDocument(input.execution.execution))
  )
    throw new Error('The movement reaction TEST evidence is stale.')
  if (resolution.kind !== 'OUTCOME' && resolution.kind !== 'TEST_ONLY')
    throw new Error('The movement reaction TEST did not select one terminal outcome.')
}

function requireCompletedMovementReaction<
  TFacts extends ProjectableCharacterFacts,
  TRow extends MovementCharacterRow
>(input: MovementReactionSettlementInput<TFacts, TRow>) {
  const { prepared } = input
  if (input.execution.kind !== 'COMPLETE')
    throw new Error('Native movement reactions require completed action evidence.')
  if (prepared.executionPlan.kind !== 'SINGLE_GRAPH' && !input.execution.phaseReceipts)
    throw new Error('Native movement reactions require the complete action phase coordinator.')
  verifyCompletedMovementReactionPlan({ prepared, execution: input.execution })
  if (
    prepared.prepared.adapter.interpretSpatial?.({
      execution: input.execution.execution,
      occurrenceId: input.occurrenceId,
      published: input.execution.published,
      targetActorId: prepared.prepared.target.id
    }).length
  )
    throw new Error('Native action execution requires the complete contextual action coordinator.')
  return input.execution
}

function reactionMechanicsInput<
  TFacts extends ProjectableCharacterFacts,
  TRow extends MovementCharacterRow
>(
  input: MovementReactionSettlementInput<TFacts, TRow>,
  effects: ReturnType<typeof planEncounterMovementReactionEffects>
): NativeEncounterActionMechanicsInput & {
  prepared: PreparedMechanics<TFacts>
} {
  const execution = requireCompletedMovementReaction(input)
  const { prepared } = input
  const { ended } = effects
  return {
    prepared: prepared.prepared,
    encounterId: prepared.prepared.state.id,
    expectedEncounterVersion: prepared.prepared.state.version,
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.commandId,
    commandId: input.commandId,
    occurredAt: input.occurredAt,
    applications: [...execution.applications, ...effects.effects.relationshipConditionApplications],
    forceTargetVersionAdvance:
      prepared.prepared.target.kind === 'CHARACTER' && effects.createdEffects.length > 0,
    sourceReleases: ended.sourceReleases,
    damageReleases: ended.damageReleases,
    eventPhases: {
      resource: 'MOVEMENT_REACTION_RESOURCE',
      outcome: 'MOVEMENT_REACTION_OUTCOME'
    },
    ordinal: input.ordinal
  }
}

function movementReactionActors<
  TFacts extends ProjectableCharacterFacts,
  TRow extends MovementCharacterRow
>(
  input: MovementReactionSettlementInput<TFacts, TRow>,
  settled: ReturnType<typeof planNativeEncounterActionMechanics> | SettledMechanics
) {
  const { prepared } = input
  const execution = requireCompletedMovementReaction(input)
  const allowance = {
    definitionId: prepared.allowance.definitionId,
    refreshBoundary: prepared.option.policy.allowanceRefreshBoundary
  }
  const { turnSequence } = prepared.prepared.state

  if (
    encounterAllowanceUsed(settled.settledSource, allowance, turnSequence) !==
      prepared.allowance.beforeUsed ||
    prepared.allowance.afterUsed !== prepared.allowance.beforeUsed + 1 ||
    prepared.allowance.afterUsed > prepared.allowance.maximum
  )
    throw new Error('The movement reaction allowance changed before settlement.')
  const sourceActor = encounterRunActorStateSchema.parse({
    ...settled.settledSource,
    resources: withEncounterAllowanceUsed(
      settled.settledSource,
      allowance,
      turnSequence,
      prepared.allowance.afterUsed
    )
  })
  const charge = execution.resistance?.chargeProposal ?? null
  let targetActor = settled.mechanics.updatedActor
  if (charge) {
    if (
      targetActor.kind !== 'CREATURE' ||
      targetActor.id !== charge.ownerActorId ||
      featureChargeUsed(targetActor, charge.ownerFeatureId) !== charge.beforeUsed ||
      charge.afterUsed !== charge.beforeUsed + charge.cost ||
      charge.afterRemaining !== charge.beforeRemaining - charge.cost
    )
      throw new Error('The Legendary Resistance charge changed before settlement.')
    targetActor = encounterRunActorStateSchema.parse({
      ...targetActor,
      resources: withFeatureChargeUsed(targetActor, charge.ownerFeatureId, charge.afterUsed)
    })
  }
  return { sourceActor, targetActor, charge }
}

function movementReactionSettlement<
  TFacts extends ProjectableCharacterFacts,
  TRow extends MovementCharacterRow
>(
  input: MovementReactionSettlementInput<TFacts, TRow>,
  settled: ReturnType<typeof planNativeEncounterActionMechanics> | SettledMechanics,
  effects: ReturnType<typeof planEncounterMovementReactionEffects>,
  maintenance: ReturnType<typeof projectEncounterMovementMaintenance<TRow, TFacts>> | null
) {
  const { prepared } = input
  if (prepared.prepared.characterActionState?.itemConsumption)
    throw new Error('A movement reaction cannot use up a single-use item.')
  const execution = requireCompletedMovementReaction(input)
  const actors = movementReactionActors(input, settled)
  const sourceActor = maintenance?.targets.get(actors.sourceActor.id)?.actor ?? actors.sourceActor
  const targetActor = maintenance?.targets.get(actors.targetActor.id)?.actor ?? actors.targetActor
  const charge = actors.charge
  const source = prepared.prepared.source
  const sourceCharacterStreamVersion =
    settled.sourceCharacterStreamVersion ??
    (source.kind === 'CHARACTER_ACTION'
      ? (maintenance?.transition.characterOwnerTransitions.find(
          (value) => value.characterId === source.characterId
        )?.afterStreamVersion ?? null)
      : null)
  const application = serverRuleExecutionApplicationOutputsDtoSchema.parse(
    prepared.prepared.target.kind === 'CHARACTER'
      ? {
          kind: 'CHARACTER_MECHANICS_BATCH',
          schemaVersion: 1,
          occurrenceId: input.occurrenceId,
          sourceActorId: prepared.prepared.actor.id,
          sourceCharacterId:
            prepared.prepared.source.kind === 'CHARACTER_ACTION'
              ? prepared.prepared.source.characterId
              : null,
          targetActorId: prepared.prepared.target.id,
          sourceCharacterStreamVersion,
          targetCharacterStreamVersion: settled.mechanics.characterStreamVersion,
          resourceConsumption: settled.resourceReceipt,
          spellCastConsumption: null,
          featureResourceConsumption: settled.featureResourceReceipt,
          targetFeatureResourceConsumption: null,
          actionEconomyTransition: null,
          activeEffectTransitions: effects.activeEffectTransitions.map(
            ({ targetActorId: _targetActorId, ...transition }) => ({
              ...transition,
              characterId: prepared.prepared.target.sourceId,
              sourceEncounterId: prepared.prepared.state.id,
              maintainedEffectStateId: transition.maintainedEffectStateId ?? null
            })
          ),
          stateEffectTransitions: effects.stateEffectTransitions,
          maintenanceTransition: maintenance?.transition ?? null,
          d20: execution.d20,
          nestedD20: execution.nestedD20,
          targetTransition: settled.mechanics.targetTransition,
          applications: settled.mechanics.receiptApplications,
          sourceApplications: settled.sourceApplications
        }
      : {
          kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
          schemaVersion: 1,
          occurrenceId: input.occurrenceId,
          sourceActorId: prepared.prepared.actor.id,
          targetActorId: prepared.prepared.target.id,
          ...(maintenance || settled.sourceApplications.length
            ? {
                sourceCharacterId:
                  prepared.prepared.source.kind === 'CHARACTER_ACTION'
                    ? prepared.prepared.source.characterId
                    : null
              }
            : {}),
          ...(maintenance ? { maintenanceTransition: maintenance.transition } : {}),
          sourceCharacterStreamVersion,
          resourceConsumption: settled.resourceReceipt,
          featureResourceConsumption: settled.featureResourceReceipt,
          targetFeatureResourceConsumption: charge,
          actionEconomyTransition: null,
          legendaryResistance: execution.resistance
            ? {
                ...execution.resistance.legendaryResistance,
                ownerFeatureId: execution.resistance.audit.resistance.ownerFeatureId,
                chargeId: execution.resistance.audit.resistance.chargeId,
                featureCost: execution.resistance.audit.resistance.featureCost,
                originalExecution: execution.resistance.execution,
                originalExecutionChecksum: execution.resistance.audit.originalExecutionChecksum
              }
            : null,
          d20: execution.d20,
          nestedD20: execution.nestedD20,
          activeEffectTransitions: effects.activeEffectTransitions,
          grantEffectTransitions: effects.grantEffectTransitions,
          stateEffectTransitions: effects.stateEffectTransitions,
          targetTransition: settled.mechanics.targetTransition,
          applications: settled.mechanics.receiptApplications,
          sourceApplications: settled.sourceApplications
        }
  )
  const characterTransitions = [
    ...(prepared.prepared.source.kind === 'CHARACTER_ACTION' &&
    sourceCharacterStreamVersion !== null
      ? [
          {
            characterId: prepared.prepared.source.characterId,
            beforeStreamVersion: prepared.prepared.source.characterStreamVersion,
            afterStreamVersion: sourceCharacterStreamVersion
          }
        ]
      : []),
    ...(prepared.prepared.target.kind === 'CHARACTER' &&
    settled.mechanics.characterStreamVersion !== null
      ? [
          {
            characterId: prepared.prepared.target.sourceId,
            beforeStreamVersion:
              prepared.prepared.targetFacts.characterFacts?.active.play.streamVersion ??
              (() => {
                throw new Error('Encounter Character reaction target is unavailable.')
              })(),
            afterStreamVersion: settled.mechanics.characterStreamVersion
          }
        ]
      : []),
    ...(maintenance?.transition.characterOwnerTransitions ?? [])
  ]
  const uniqueTransitions = new Map<string, (typeof characterTransitions)[number]>()
  for (const transition of characterTransitions) {
    const prior = uniqueTransitions.get(transition.characterId)
    if (prior && checksumCanonicalJson(prior) !== checksumCanonicalJson(transition))
      throw new Error('Movement maintenance Character transitions disagree.')
    uniqueTransitions.set(transition.characterId, transition)
  }
  const reactionExecution = movementReactionActionExecutionDtoSchema.parse({
    ordinal: input.ordinal,
    sourceCommandId: input.commandId,
    option: prepared.option,
    allowance: prepared.allowance,
    execution: execution.execution,
    initialFactsChecksum: execution.initialFactsChecksum,
    ...(execution.phaseReceipts ? { phaseReceipts: execution.phaseReceipts } : {}),
    application,
    ...(prepared.prepared.target.kind === 'CHARACTER'
      ? { targetCharacterId: prepared.prepared.target.sourceId }
      : {}),
    ...(maintenance ? { maintenanceOwnerTransitions: maintenance.ownerTransitions } : {}),
    legendaryResistance: execution.resistance?.legendaryResistance ?? null,
    characterTransitions: [...uniqueTransitions.values()].sort((left, right) =>
      left.characterId.localeCompare(right.characterId)
    )
  })
  return { application, reactionExecution, sourceActor, targetActor }
}

/** Predicts one completed reaction using the same resource, allowance and receipt calculation. */
export function planEncounterMovementReactionAction<
  TFacts extends ProjectableCharacterFacts,
  TRow extends MovementCharacterRow
>(
  input: MovementReactionSettlementInput<TFacts, TRow>,
  userId: string,
  readCharacter: (row: TRow) => CharacterAuthored
) {
  const execution = requireCompletedMovementReaction(input)
  const effects = planEncounterMovementReactionEffects({ ...input, execution })
  const settled = planNativeEncounterActionMechanics(reactionMechanicsInput(input, effects), userId)
  const actors = movementReactionActors(input, settled)
  const { prepared } = input.prepared
  const projectedTargets = new Map(prepared.movementTargets)
  for (const [target, actor, plan] of [
    [prepared.sourceFacts, actors.sourceActor, settled.sourceResourcePlan],
    [prepared.targetFacts, actors.targetActor, settled.targetPlan]
  ] as const) {
    projectedTargets.set(
      actor.id,
      projectEncounterActionTarget({
        target:
          actor.id === prepared.target.id
            ? {
                ...target,
                activeEffects: [
                  ...withDecoyStrikeApplied(target.activeEffects, effects.ended.decoyStrike),
                  ...effects.createdEffects
                ]
              }
            : target,
        actor,
        plan,
        campaignId: prepared.state.campaignId,
        gameSystemId: prepared.state.gameSystemId,
        occurredAt: input.occurredAt
      })
    )
  }
  const maintenance =
    input.prepared.maintenance && effects.maintainedState
      ? projectEncounterMovementMaintenance(
          {
            maintenance: input.prepared.maintenance,
            state: effects.maintainedState,
            createdEffects: effects.createdEffects,
            targets: projectedTargets,
            projection: input.prepared.maintenanceProjection,
            campaignId: prepared.state.campaignId,
            gameSystemId: prepared.state.gameSystemId,
            occurredAt: input.occurredAt
          },
          readCharacter
        )
      : null
  const result = movementReactionSettlement(input, settled, effects, maintenance)
  return {
    ...result,
    effects,
    consumedGrants: effects.ended.consumedGrants,
    spentUseGrants: effects.ended.decoyStrike.spentUseGrants,
    sourceResourcePlan: settled.sourceResourcePlan,
    targetPlan: settled.targetPlan,
    projectedTargets: maintenance?.targets ?? projectedTargets,
    maintenance,
    maintenanceProjection: maintenance?.projection ?? input.prepared.maintenanceProjection
  }
}
