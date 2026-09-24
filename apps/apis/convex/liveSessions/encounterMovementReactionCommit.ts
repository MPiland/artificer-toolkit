import type { LiveSessionMovementSettlement } from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import {
  encounterRuleUsageUsed,
  withEncounterRuleUsageUsed,
  featureChargeUsed,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import { applyLiveEncounterMechanicsBatch } from './encounterActionMechanics'
import {
  prepareLiveEncounterActionMaintenance,
  persistLiveEncounterActionEffects
} from './encounterActionEffectsCommit'
import {
  readLiveMovementTargetState,
  movementPersistedTransitionState
} from './encounterMovementTargetState'

/** The parent checks private authority, captured revisions, and exact movement receipt order. */
export async function persistLiveMovementReaction(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    step: Extract<LiveSessionMovementSettlement, { kind: 'REACTION' }>
    occurrenceId: string
    sourceCommandId: string
    occurredAt: string
    authorizedCharacterIds: ReadonlySet<string>
  }
) {
  const { state, step } = input
  const receipt = step.execution
  const batch = receipt.application
  const source = input.actors.find((actor) => actor.id === receipt.option.candidate.reactorActorId)
  const target = input.actors.find((actor) => actor.id === receipt.option.candidate.movingActorId)
  if (
    !source ||
    !target ||
    source.id === target.id ||
    source.encounterId !== state.id ||
    target.encounterId !== state.id ||
    source.systemId !== state.gameSystemId ||
    target.systemId !== state.gameSystemId ||
    !state.actorIds.includes(source.id) ||
    !state.actorIds.includes(target.id) ||
    receipt.sourceCommandId !== input.sourceCommandId ||
    receipt.execution.evidence.source.gameSystemId !== state.gameSystemId ||
    (batch.kind !== 'CHARACTER_MECHANICS_BATCH' &&
      batch.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH') ||
    batch.occurrenceId !== input.occurrenceId ||
    batch.sourceActorId !== source.id ||
    batch.targetActorId !== target.id ||
    (target.kind === 'CHARACTER') !== (batch.kind === 'CHARACTER_MECHANICS_BATCH') ||
    (target.kind === 'CHARACTER' && receipt.targetCharacterId !== target.sourceId) ||
    (source.kind === 'CHARACTER' &&
      (!source.sourceId || !input.authorizedCharacterIds.has(source.sourceId))) ||
    (target.kind === 'CHARACTER' &&
      (!target.sourceId || !input.authorizedCharacterIds.has(target.sourceId)))
  )
    throw new Error('Live movement reaction actor or receipt scope mismatch.')
  if (
    ('sourceCharacterId' in batch &&
      batch.sourceCharacterId !== (source.kind === 'CHARACTER' ? source.sourceId : null)) ||
    (batch.kind === 'CHARACTER_MECHANICS_BATCH' &&
      (batch.spellCastConsumption !== null || batch.targetFeatureResourceConsumption !== null))
  )
    throw new Error('Live movement reaction Character scope mismatch.')

  const command = {
    encounterId: state.id,
    actorId: source.id,
    targetActorId: target.id,
    actionId: receipt.option.actionId,
    commandId: input.sourceCommandId
  }
  const effectInput = {
    state,
    command,
    execution: { occurrenceId: input.occurrenceId, applicationOutputs: batch },
    maintainedState: step.maintainedState,
    createdEffects: step.createdEffects,
    authorizedCharacterIds: input.authorizedCharacterIds
  }
  const maintenance = await prepareLiveEncounterActionMaintenance(ctx, effectInput)
  const resource = step.resourceConsumption
  if (resource) {
    const {
      owner: _owner,
      usageId: _usageId,
      characterId,
      expectedStreamVersion,
      ...recorded
    } = resource
    if (
      source.kind !== 'CHARACTER' ||
      source.sourceId !== characterId ||
      source.sourceRevision !== expectedStreamVersion ||
      checksumCanonicalJson(recorded) !== checksumCanonicalJson(batch.resourceConsumption)
    )
      throw new Error('Live movement reaction resource scope mismatch.')
  } else if (batch.resourceConsumption !== null)
    throw new Error('Live movement reaction resource is missing.')
  const common = {
    encounterId: state.id,
    expectedEncounterVersion: state.version,
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.sourceCommandId,
    occurredAt: input.occurredAt
  }
  const sourceMechanics = resource
    ? await applyLiveEncounterMechanicsBatch(ctx, {
        ...common,
        targetActorId: source.id,
        commandId: deriveEncounterCharacterMechanicsEventCommandId({
          occurrenceId: input.occurrenceId,
          sourceCommandId: input.sourceCommandId,
          phase: 'MOVEMENT_REACTION_RESOURCE',
          ordinal: receipt.ordinal,
          targetCharacterId: resource.characterId
        }),
        applications: [],
        effectiveMaximumHitPoints: source.maxHitPoints,
        forceVersionAdvance: false,
        characterResourceConsumption: resource
      })
    : null
  const mechanics = await applyLiveEncounterMechanicsBatch(ctx, {
    ...common,
    targetActorId: target.id,
    commandId:
      target.kind === 'CHARACTER'
        ? deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: input.occurrenceId,
            sourceCommandId: input.sourceCommandId,
            phase: 'MOVEMENT_REACTION_OUTCOME',
            ordinal: receipt.ordinal,
            targetCharacterId: target.sourceId!
          })
        : input.sourceCommandId,
    applications: batch.applications.map((application) => ({
      ...application,
      targetActorId: target.id
    })),
    effectiveMaximumHitPoints: batch.targetTransition.before.maximumHitPoints,
    effectiveScalarValues: batch.targetTransition.before.scalarValues,
    forceVersionAdvance: target.kind === 'CHARACTER' && step.createdEffects.length > 0
  })
  if (
    checksumCanonicalJson(mechanics.receiptApplications) !==
      checksumCanonicalJson(batch.applications) ||
    checksumCanonicalJson(mechanics.targetTransition) !==
      checksumCanonicalJson(batch.targetTransition) ||
    (batch.kind === 'CHARACTER_MECHANICS_BATCH' &&
      batch.targetCharacterStreamVersion !== mechanics.characterStreamVersion)
  )
    throw new Error('Live movement reaction mechanics receipt mismatch.')
  const beforeSource = sourceMechanics?.updatedActor ?? source
  let nextSource = beforeSource
  let nextTarget = mechanics.updatedActor
  for (const [actor, charge, assign] of [
    [
      nextSource,
      batch.featureResourceConsumption,
      (value: EncounterRunActorState) => {
        nextSource = value
      }
    ],
    [
      nextTarget,
      batch.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
        ? batch.targetFeatureResourceConsumption
        : null,
      (value: EncounterRunActorState) => {
        nextTarget = value
      }
    ]
  ] as const) {
    if (!charge) continue
    if (
      actor.kind !== 'CREATURE' ||
      charge.ownerActorId !== actor.id ||
      featureChargeUsed(actor, charge.ownerFeatureId) !== charge.beforeUsed ||
      charge.afterUsed !== charge.beforeUsed + charge.cost ||
      charge.afterRemaining !== charge.beforeRemaining - charge.cost
    )
      throw new Error('Live movement reaction feature resource changed.')
    assign(
      encounterRunActorStateSchema.parse({
        ...actor,
        resources: withFeatureChargeUsed(actor, charge.ownerFeatureId, charge.afterUsed)
      })
    )
  }
  const allowance = receipt.allowance
  if (
    allowance.definitionId !== receipt.option.policy.allowanceDefinitionId ||
    allowance.maximum !== receipt.option.policy.allowanceMaximum ||
    encounterRuleUsageUsed(nextSource, allowance.definitionId) !== allowance.beforeUsed ||
    allowance.afterUsed !== allowance.beforeUsed + 1 ||
    allowance.afterUsed > allowance.maximum
  )
    throw new Error('Live movement reaction allowance changed.')
  nextSource = encounterRunActorStateSchema.parse({
    ...nextSource,
    resources: withEncounterRuleUsageUsed(nextSource, allowance.definitionId, allowance.afterUsed)
  })
  for (const [before, after] of [
    [beforeSource, nextSource],
    [mechanics.updatedActor, nextTarget]
  ] as const) {
    if (checksumCanonicalJson(before) === checksumCanonicalJson(after)) continue
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', state.id).eq('id', before.id))
      .unique()
    if (!row || row.stateChecksum !== checksumCanonicalJson(before))
      throw new Error('Live movement reaction actor changed before settlement.')
    await ctx.db.patch(row._id, {
      stateJson: JSON.stringify(after),
      stateChecksum: checksumCanonicalJson(after)
    })
  }
  const beforeCleanup = input.actors.map((actor) =>
    actor.id === source.id ? nextSource : actor.id === target.id ? nextTarget : actor
  )
  const ownerActorIds = [
    ...new Set(
      (maintenance?.removed ?? []).flatMap(({ owner }) =>
        owner.kind === 'ENCOUNTER_ACTOR'
          ? [owner.targetActorId]
          : beforeCleanup
              .filter((actor) => actor.kind === 'CHARACTER' && actor.sourceId === owner.characterId)
              .map((actor) => actor.id)
      )
    )
  ].sort()
  const ownerTransitions = receipt.maintenanceOwnerTransitions ?? []
  if (
    checksumCanonicalJson(ownerActorIds) !==
    checksumCanonicalJson(ownerTransitions.map((entry) => entry.targetActorId))
  )
    throw new Error('Live movement reaction cleanup owner receipt is incomplete.')
  for (const transition of ownerTransitions) {
    const actor = beforeCleanup.find((entry) => entry.id === transition.targetActorId)
    if (
      !actor ||
      transition.characterId !== (actor.kind === 'CHARACTER' ? actor.sourceId : null) ||
      checksumCanonicalJson(movementPersistedTransitionState(transition.before)) !==
        checksumCanonicalJson(await readLiveMovementTargetState(ctx, state, actor))
    )
      throw new Error('Live movement reaction cleanup owner state changed.')
  }
  const actors = await persistLiveEncounterActionEffects(ctx, {
    ...effectInput,
    maintenance,
    actors: beforeCleanup,
    occurredAt: input.occurredAt
  })
  for (const transition of ownerTransitions) {
    const actor = actors.find((entry) => entry.id === transition.targetActorId)
    if (
      !actor ||
      checksumCanonicalJson(movementPersistedTransitionState(transition.after)) !==
        checksumCanonicalJson(await readLiveMovementTargetState(ctx, state, actor))
    )
      throw new Error('Live movement reaction cleanup differs from its receipt.')
  }
  const sourceVersion =
    sourceMechanics?.characterStreamVersion ??
    (source.kind === 'CHARACTER'
      ? (batch.maintenanceTransition?.characterOwnerTransitions.find(
          (span) => span.characterId === source.sourceId
        )?.afterStreamVersion ?? null)
      : null)
  if (batch.sourceCharacterStreamVersion !== sourceVersion)
    throw new Error('Live movement reaction source Character receipt mismatch.')
  const spans = new Map<string, (typeof receipt.characterTransitions)[number]>()
  for (const span of [
    ...(source.kind === 'CHARACTER' && sourceVersion !== null
      ? [
          {
            characterId: source.sourceId!,
            beforeStreamVersion: source.sourceRevision!,
            afterStreamVersion: sourceVersion
          }
        ]
      : []),
    ...(target.kind === 'CHARACTER' && mechanics.characterStreamVersion !== null
      ? [
          {
            characterId: target.sourceId!,
            beforeStreamVersion: target.sourceRevision!,
            afterStreamVersion: mechanics.characterStreamVersion
          }
        ]
      : []),
    ...(batch.maintenanceTransition?.characterOwnerTransitions ?? [])
  ]) {
    if (!input.authorizedCharacterIds.has(span.characterId))
      throw new Error('Live movement reaction Character transition is outside the captured scope.')
    const prior = spans.get(span.characterId)
    if (prior && checksumCanonicalJson(prior) !== checksumCanonicalJson(span))
      throw new Error('Live movement reaction Character transitions disagree.')
    spans.set(span.characterId, span)
  }
  if (
    checksumCanonicalJson(
      [...spans.values()].sort((a, b) => a.characterId.localeCompare(b.characterId))
    ) !== checksumCanonicalJson(receipt.characterTransitions)
  )
    throw new Error('Live movement reaction Character transition receipt is incomplete.')
  return actors
}
