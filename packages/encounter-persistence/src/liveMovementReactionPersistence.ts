import { effectiveHitPointMaximum } from '@artificer-toolkit/rules-runtime/character/activeEffectGrantTotals'
import { checksumRunActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import type { LiveSessionMovementSettlement } from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import {
  encounterAllowanceUsed,
  withEncounterAllowanceUsed,
  featureChargeUsed,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { attackedHostileCreature } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SpatialSceneToken } from '@artificer-toolkit/shared/vtt'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { deleteGrants, spendEffectUses } from './consumedGrantPersistence.js'
import { listActiveRuleEffects } from './effectStore.js'
import { engageIdleTurnActor } from './idleTurnMark.js'
import { spendTurnUses } from './turnMovement.js'
import { writeRunActor } from './documents.js'
import {
  persistEncounterMeleeRetaliation,
  readMeleeRetaliationScene
} from './meleeRetaliationPersistence.js'
import {
  prepareEncounterActionMaintenance,
  persistEncounterActionEffects
} from './actionEffectPersistence.js'
import {
  readLiveCharacterMaximumHitPoints,
  readLiveCharacterStreamVersion,
  readLiveMovementTargetState,
  movementPersistedTransitionState
} from './liveMovementTargetState.js'

/** The parent checks private authority, captured revisions, and exact movement receipt order. */
export async function persistLiveMovementReaction(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    step: Extract<LiveSessionMovementSettlement, { kind: 'REACTION' }>
    occurrenceId: string
    sourceCommandId: string
    occurredAt: string
    authorizedCharacterIds: ReadonlySet<string>
  },
  callbacks: {
    applyMechanics(
      input: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
    readCampaignCharacterState: Parameters<typeof readLiveMovementTargetState>[4]
    readSceneTokens(sceneId: string): Promise<readonly SpatialSceneToken[]>
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
    (source.kind === 'CHARACTER' && !input.authorizedCharacterIds.has(source.sourceId)) ||
    (target.kind === 'CHARACTER' && !input.authorizedCharacterIds.has(target.sourceId))
  )
    throw new Error('Live movement reaction actor or receipt scope mismatch.')
  // The movement admission's revision fence pins these to the room's captured Characters.
  const sourceBeforeVersion =
    source.kind === 'CHARACTER'
      ? await readLiveCharacterStreamVersion(ctx, state, source.sourceId)
      : null
  const targetBeforeVersion =
    target.kind === 'CHARACTER'
      ? await readLiveCharacterStreamVersion(ctx, state, target.sourceId)
      : null
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
    target: { kind: 'ACTOR' as const, actorId: target.id },
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
  const maintenance = await prepareEncounterActionMaintenance(ctx, effectInput)
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
      sourceBeforeVersion !== expectedStreamVersion ||
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
  // The reactor's own batch carries its spend and the conditions its ended effects released.
  const sourceMechanics =
    resource || batch.sourceApplications.length
      ? await callbacks.applyMechanics({
          ...common,
          targetActorId: source.id,
          commandId: deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: input.occurrenceId,
            sourceCommandId: input.sourceCommandId,
            phase: 'MOVEMENT_REACTION_RESOURCE',
            ordinal: receipt.ordinal,
            targetCharacterId: source.kind === 'CHARACTER' ? source.sourceId : source.id
          }),
          applications: batch.sourceApplications.map((application) => ({
            ...application,
            targetActorId: source.id
          })),
          effectiveMaximumHitPoints:
            source.kind === 'CHARACTER'
              ? await readLiveCharacterMaximumHitPoints(ctx, state, source.sourceId)
              : effectiveHitPointMaximum(
                  source.maxHitPoints,
                  await listActiveRuleEffects(
                    ctx,
                    { kind: 'ENCOUNTER_ACTOR', encounterId: state.id, targetActorId: source.id },
                    { ownerVerified: true }
                  )
                ),
          forceVersionAdvance: false,
          ...(resource ? { characterResourceConsumption: resource } : {})
        })
      : null
  const mechanics = await callbacks.applyMechanics({
    ...common,
    targetActorId: target.id,
    commandId:
      target.kind === 'CHARACTER'
        ? deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: input.occurrenceId,
            sourceCommandId: input.sourceCommandId,
            phase: 'MOVEMENT_REACTION_OUTCOME',
            ordinal: receipt.ordinal,
            targetCharacterId: target.sourceId
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
    checksumCanonicalJson(sourceMechanics?.receiptApplications ?? []) !==
      checksumCanonicalJson(batch.sourceApplications) ||
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
  const spent = {
    definitionId: allowance.definitionId,
    refreshBoundary: receipt.option.policy.allowanceRefreshBoundary
  }
  if (
    allowance.definitionId !== receipt.option.policy.allowanceDefinitionId ||
    allowance.maximum !== receipt.option.policy.allowanceMaximum ||
    encounterAllowanceUsed(nextSource, spent, state.turnSequence) !== allowance.beforeUsed ||
    allowance.afterUsed !== allowance.beforeUsed + 1 ||
    allowance.afterUsed > allowance.maximum
  )
    throw new Error('Live movement reaction allowance changed.')
  nextSource = encounterRunActorStateSchema.parse({
    ...nextSource,
    resources: withEncounterAllowanceUsed(
      nextSource,
      spent,
      state.turnSequence,
      allowance.afterUsed
    )
  })
  if (attackedHostileCreature({ d20s: [batch.d20, batch.nestedD20], source, target }))
    nextSource = engageIdleTurnActor(nextSource)
  for (const [before, after] of [
    [beforeSource, nextSource],
    [mechanics.updatedActor, nextTarget]
  ] as const) {
    if (checksumCanonicalJson(before) === checksumCanonicalJson(after)) continue
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', state.id).eq('id', before.id))
      .unique()
    if (!row || row.stateChecksum !== checksumRunActorPlayState(before))
      throw new Error('Live movement reaction actor changed before settlement.')
    await writeRunActor(ctx, row._id, after)
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
        checksumCanonicalJson(
          movementPersistedTransitionState(
            await readLiveMovementTargetState(
              ctx,
              state,
              actor,
              transition.before.maximumHitPoints,
              callbacks.readCampaignCharacterState
            )
          )
        )
    )
      throw new Error('Live movement reaction cleanup owner state changed.')
  }
  const actors = await persistEncounterActionEffects(ctx, {
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
        checksumCanonicalJson(
          movementPersistedTransitionState(
            await readLiveMovementTargetState(
              ctx,
              state,
              actor,
              transition.after.maximumHitPoints,
              callbacks.readCampaignCharacterState
            )
          )
        )
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
    ...(source.kind === 'CHARACTER' && sourceBeforeVersion !== null && sourceVersion !== null
      ? [
          {
            characterId: source.sourceId,
            beforeStreamVersion: sourceBeforeVersion,
            afterStreamVersion: sourceVersion
          }
        ]
      : []),
    ...(target.kind === 'CHARACTER' &&
    targetBeforeVersion !== null &&
    mechanics.characterStreamVersion !== null
      ? [
          {
            characterId: target.sourceId,
            beforeStreamVersion: targetBeforeVersion,
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
  await deleteGrants(ctx, step.consumedGrants)
  await spendEffectUses(ctx, step.spentUseGrants)
  await spendTurnUses(ctx, { state, actorId: source.id, keys: step.turnUses })
  if (!batch.meleeRetaliation) return actors
  // The zones the opportunity attack's melee hit set off burn the reactor, with the mover where
  // the attack caught it (D153).
  const scene = await readMeleeRetaliationScene(
    ctx,
    { state, attackerActorId: source.id, hitActorId: target.id },
    callbacks.readSceneTokens
  )
  const retaliated = await persistEncounterMeleeRetaliation(
    ctx,
    {
      state,
      initialActors: input.actors,
      attacker: actors.find((actor) => actor.id === source.id)!,
      scene: scene && {
        ...scene,
        hit: { ...scene.hit, position: receipt.option.candidate.contact }
      },
      evidence: batch.meleeRetaliation,
      occurrenceId: input.occurrenceId,
      sourceCommandId: input.sourceCommandId,
      occurredAt: input.occurredAt
    },
    { applyMechanics: callbacks.applyMechanics }
  )
  return actors.map((actor) => (actor.id === source.id ? retaliated.actor : actor))
}
