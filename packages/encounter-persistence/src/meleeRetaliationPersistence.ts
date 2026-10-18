import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { MeleeRetaliationEvidenceDto } from '@artificer-toolkit/schema/shared/ruleExecutionEffectEvidence'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import {
  selectMeleeRetaliationContacts,
  type MeleeRetaliationToken
} from '@artificer-toolkit/rules-runtime/encounterMeleeRetaliation'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { SpatialSceneToken } from '@artificer-toolkit/shared/vtt'
import { readEncounterActorTokenBindings } from './actorTokenBindings.js'
import { readLiveCharacterStreamVersion } from './liveMovementTargetState.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { createSpatialRuleEffectStore } from './spatialEffectStore.js'

/** The Scene a melee hit landed in and the two tokens where it landed. */
export type MeleeRetaliationScene = {
  sceneId: string
  attacker: MeleeRetaliationToken
  hit: MeleeRetaliationToken
}

/**
 * The attacker's and the hit creature's current tokens on the Encounter's bound Scene, for an
 * attack whose command pins no Scene tokens of its own (an opportunity attack or a Legendary
 * Action). Null when either creature has no token there.
 */
export async function readMeleeRetaliationScene(
  ctx: EncounterCharacterWriteTransaction,
  input: { state: EncounterRunState; attackerActorId: string; hitActorId: string },
  readSceneTokens: (sceneId: string) => Promise<readonly SpatialSceneToken[]>
): Promise<MeleeRetaliationScene | null> {
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', input.state.id))
    .unique()
  if (!binding) return null
  const bindings = await readEncounterActorTokenBindings(ctx, input.state, binding.sceneId)
  const tokens = await readSceneTokens(binding.sceneId)
  const tokenOf = (actorId: string) => {
    const tokenId = bindings.find((entry) => entry.actorId === actorId)?.tokenId
    const token = tokens.find(({ id }) => id === tokenId)
    return token ? { ...token, tokenId: token.id, actorId } : null
  }
  const attacker = tokenOf(input.attackerActorId)
  const hit = tokenOf(input.hitActorId)
  return attacker && hit ? { sceneId: binding.sceneId, attacker, hit } : null
}

/**
 * Applies the zones a melee hit set off against its attacker (D153) as the attacker's one mechanics
 * batch, after the attack's own writes. The zones are derived again from the locked Scene and the
 * attack's tokens, so a plan made against an edited zone or a moved token is refused. Returns the
 * attacker as the batch left it, or unchanged when the zones changed nothing.
 */
export async function persistEncounterMeleeRetaliation(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    /** The Run's actors before the action, as the plan selected against them. */
    initialActors: readonly EncounterRunActorState[]
    attacker: EncounterRunActorState
    scene: MeleeRetaliationScene | null
    evidence: MeleeRetaliationEvidenceDto
    occurrenceId: string
    sourceCommandId: string
    occurredAt: string
  },
  callbacks: {
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
  }
): Promise<EncounterRunActorState> {
  const { state, attacker, scene, evidence } = input
  const stale = () => new Error('Melee retaliation selection is stale.')
  const scope =
    scene &&
    (await createSpatialRuleEffectStore(ctx).scope({
      encounterId: state.id,
      sceneId: scene.sceneId
    }))
  if (!scene || !scope || scene.attacker.actorId !== attacker.id) throw stale()
  const selected = selectMeleeRetaliationContacts({
    actors: input.initialActors,
    attacker: scene.attacker,
    hit: scene.hit,
    effects: await scope.list()
  })
  const { executions } = evidence
  if (
    !selected ||
    selected.selectionChecksum !== evidence.selectionChecksum ||
    executions.length !== selected.contacts.length ||
    executions.some(
      ({ candidate }, ordinal) =>
        checksumRuleDocument(candidate.candidate) !==
        checksumRuleDocument(selected.contacts[ordinal])
    )
  )
    throw stale()
  const beforeStreamVersion =
    attacker.kind === 'CHARACTER'
      ? await readLiveCharacterStreamVersion(ctx, state, attacker.sourceId)
      : null
  if (
    executions.some(({ candidate: { target } }) =>
      attacker.kind === 'CHARACTER'
        ? target.kind !== 'CHARACTER' ||
          target.characterId !== attacker.sourceId ||
          target.streamVersion !== beforeStreamVersion
        : target.kind !== 'ENCOUNTER_ACTOR'
    )
  )
    throw new Error('Melee retaliation attacker pin is stale.')
  const first = executions[0]!
  const last = executions.at(-1)!
  const before = first.targetTransition.before
  if (checksumRuleDocument(before) === checksumRuleDocument(last.targetTransition.after))
    return attacker
  const applications = executions.flatMap((execution) =>
    execution.applications.map((application) => ({ ...application, targetActorId: attacker.id }))
  )
  const applied = await callbacks.applyMechanics({
    encounterId: state.id,
    targetActorId: attacker.id,
    expectedEncounterVersion: state.version,
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.sourceCommandId,
    commandId:
      attacker.kind === 'CHARACTER'
        ? deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: input.occurrenceId,
            sourceCommandId: input.sourceCommandId,
            phase: 'MELEE_RETALIATION',
            ordinal: 0,
            targetCharacterId: attacker.sourceId
          })
        : input.sourceCommandId,
    occurredAt: input.occurredAt,
    applications,
    effectiveMaximumHitPoints: before.maximumHitPoints,
    effectiveScalarValues: before.scalarValues,
    forceVersionAdvance: attacker.kind === 'CHARACTER'
  })
  if (
    checksumRuleDocument(applied.targetTransition.before) !== checksumRuleDocument(before) ||
    checksumRuleDocument(applied.targetTransition.after) !==
      checksumRuleDocument(last.targetTransition.after) ||
    checksumRuleDocument(applied.receiptApplications) !==
      checksumRuleDocument(
        applications.map(({ targetActorId: _id, ...application }, index) => ({
          ...application,
          ordinal: index
        }))
      ) ||
    (beforeStreamVersion === null
      ? applied.characterStreamVersion !== null
      : applied.characterStreamVersion !== beforeStreamVersion + 1)
  )
    throw new Error('Melee retaliation settlement differs from its plan.')
  return applied.updatedActor
}
