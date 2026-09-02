import {
  createSystemVocabularySnapshotRepository,
  type DBLike,
  type EncounterActorRecord
} from '@artificer-toolkit/db'
import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { CompiledActionEntryPoint } from '@artificer-toolkit/schema/projections/characterMechanics'
import { sizeCodeSchema } from '@artificer-toolkit/schema/shared/enums'

import { discoverEncounterFeatureActionCapabilities } from '../rules/encounterFeatureActionCapabilityDiscoveryRegistry.js'
import {
  snapshotCreatureEquipmentLoadout,
  snapshotCreatureEquipmentSources
} from '../rules/encounterCreatureEquipmentSources.js'
import type { LockedEncounterActiveEffectTargets } from './encounterActiveEffectTargetState.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import { lockedRelationshipActionFacts } from './encounterRelationshipActionFacts.js'

type CompiledCharacterActionEntry = Extract<
  CompiledActionEntryPoint,
  { compilation: { kind: 'COMPILED' } }
>

type D20Contributor = {
  readonly sourceId: string
  readonly grantId: string | null
  readonly domainKey: string | null
  readonly influence: 'ADVANTAGE' | 'DISADVANTAGE'
}
type AttackContributors = Readonly<
  Record<'MELEE' | 'RANGED' | 'SPELL' | 'UNARMED', readonly D20Contributor[]>
>

type AttackPolicyFacts = {
  readonly modifier: number | null
  readonly rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE' | null
  readonly baseContributors: AttackContributors | null
  readonly relationshipContributors: readonly D20Contributor[]
}

export type EncounterOptionalContestActionSource =
  | {
      readonly kind: 'CHARACTER_ACTION'
      readonly actorId: string
      readonly characterId: string
      readonly characterStreamVersion: number
      readonly candidate: CharacterActionCandidate
      readonly entry: CompiledCharacterActionEntry
      readonly equipment: {
        readonly category: string | null
        readonly id: string
        readonly properties: readonly string[]
        readonly state: 'EQUIPPED'
      } | null
      readonly triggerCode: string | null
      readonly attack: AttackPolicyFacts
      readonly size: string | null
    }
  | {
      readonly kind: 'ENCOUNTER_FEATURE'
      readonly actorId: string
      readonly capability: Awaited<
        ReturnType<typeof discoverEncounterFeatureActionCapabilities>
      >[number]
      readonly equipment: {
        readonly category: string | null
        readonly id: string
        readonly properties: readonly string[]
        readonly state: 'HELD'
      } | null
      readonly triggerCode: string | null
      readonly attack: AttackPolicyFacts
      readonly size: string | null
    }

function canonicalAttackContributors(
  attacks: CharacterRulePolicyOutput['rollContributorEvidence']['attacks']
): AttackContributors {
  return {
    MELEE: attacks.MELEE.map(({ sourceId, grantId, domainKey, influence }) => ({
      sourceId,
      grantId,
      domainKey,
      influence
    })),
    RANGED: attacks.RANGED.map(({ sourceId, grantId, domainKey, influence }) => ({
      sourceId,
      grantId,
      domainKey,
      influence
    })),
    SPELL: attacks.SPELL.map(({ sourceId, grantId, domainKey, influence }) => ({
      sourceId,
      grantId,
      domainKey,
      influence
    })),
    UNARMED: attacks.UNARMED.map(({ sourceId, grantId, domainKey, influence }) => ({
      sourceId,
      grantId,
      domainKey,
      influence
    }))
  }
}

function requireCommittedCharacterAction(input: {
  actionId: string
  actor: EncounterActorRecord
  targetActorId: string
  targets: LockedEncounterActiveEffectTargets
}): Extract<EncounterOptionalContestActionSource, { kind: 'CHARACTER_ACTION' }> {
  if (input.actor.kind !== 'CHARACTER' || !input.actor.sourceId) {
    throw new EncounterValidationError('Optional combat action source must be a Character.')
  }
  const character = input.targets.lockedCharacters.get(input.actor.sourceId)
  if (
    !character ||
    character.actor.id !== input.actor.id ||
    character.streamVersion !== character.mechanics.characterStreamVersion
  ) {
    throw new EncounterConflictError('Optional combat Character source is stale.')
  }
  const entry = character.mechanics.compiledActionEntryPoints.find(
    (candidate) => candidate.actionId === input.actionId
  )
  if (!entry || entry.compilation.kind !== 'COMPILED') {
    throw new EncounterConflictError('Optional combat Character action is unavailable.')
  }
  const compiled = entry as CompiledCharacterActionEntry
  const candidate = character.mechanics.rulePolicyInput.actionCandidates.find(
    (value) => value.actionId === input.actionId && value.effectId === compiled.effectId
  )
  if (!candidate) throw new EncounterConflictError('Optional combat Character action is stale.')
  const policy =
    character.effectiveRulePolicyOutput ??
    (character.overlay.kind === 'MATERIALIZED' ? character.overlay.rulePolicyOutput : null) ??
    character.mechanics.rulePolicyOutput
  const decision = policy.actionDecisions.filter(
    (value) =>
      value.status === 'AVAILABLE' &&
      value.actionId === candidate.actionId &&
      value.effectId === candidate.effectId
  )
  if (decision.length !== 1) {
    throw new EncounterConflictError('Optional combat Character action policy is stale.')
  }
  const equipment = candidate.equipment
  return {
    kind: 'CHARACTER_ACTION',
    actorId: input.actor.id,
    characterId: character.id,
    characterStreamVersion: character.streamVersion,
    candidate,
    entry: compiled,
    equipment:
      equipment?.equipmentId && equipment.equipped
        ? {
            id: equipment.itemInstanceId,
            category: equipment.category ?? null,
            properties: equipment.properties ?? [],
            state: 'EQUIPPED'
          }
        : null,
    triggerCode: candidate.mechanicFacts.invocation.triggerCode ?? null,
    attack: {
      modifier: decision[0]!.mechanic.attackBonus,
      rollMode: decision[0]!.mechanic.attackRollMode,
      baseContributors: canonicalAttackContributors(policy.rollContributorEvidence.attacks),
      relationshipContributors: lockedRelationshipActionFacts({
        actionEffectId: candidate.effectId,
        sourceActorId: input.actor.id,
        targetActorId: input.targetActorId,
        targets: input.targets
      })
    },
    size: character.mechanics.initiativeActorFacts.effectiveSize
  }
}

/**
 * Resolves only the selected action and its exact Equipment binding. It is
 * deliberately read-only: target facts, contest policy, occurrence lifecycle,
 * and outcome application belong to their target adapter/coordinator.
 */
export async function resolveEncounterOptionalContestActionSource(input: {
  actionId: string
  actor: EncounterActorRecord
  db: DBLike
  targetActorId: string
  targets: LockedEncounterActiveEffectTargets
}): Promise<EncounterOptionalContestActionSource | null> {
  if (input.actor.kind === 'CHARACTER') return requireCommittedCharacterAction(input)
  if (input.actor.kind !== 'CREATURE' || !input.actor.systemId) return null
  const vocabulary = await createSystemVocabularySnapshotRepository(input.db).findActive(
    input.actor.systemId
  )
  if (!vocabulary) throw new EncounterValidationError('Creature System vocabulary is unavailable.')
  const capability = discoverEncounterFeatureActionCapabilities({
    actor: input.actor,
    conditionDefinitionIds: vocabulary.document.conditionTypes.map((condition) => condition.id),
    abilityDefinitions:
      'schemaVersion' in vocabulary.document && vocabulary.document.schemaVersion === 2
        ? vocabulary.document.abilities.map((ability) => ({ id: ability.id, code: ability.code }))
        : []
  }).find((candidate) => candidate.actionId === input.actionId)
  if (!capability) throw new EncounterConflictError('Optional combat Creature action is stale.')
  const binding = capability.equipmentBinding ?? null
  const loadout = binding
    ? snapshotCreatureEquipmentLoadout(input.actor).find(
        (entry) => entry.id === binding.loadoutEntryId && entry.useState === 'HELD'
      )
    : null
  const source = binding
    ? snapshotCreatureEquipmentSources(input.actor).find(
        (candidate) =>
          candidate.loadoutEntryId === binding.loadoutEntryId &&
          candidate.equipmentId === binding.equipmentId &&
          candidate.sourceRevision === binding.sourceRevision &&
          candidate.sourceVersionId === binding.sourceVersionId &&
          candidate.sourceChecksum === binding.sourceChecksum
      )
    : null
  const payload =
    typeof input.actor.snapshot === 'object' &&
    input.actor.snapshot !== null &&
    !Array.isArray(input.actor.snapshot) &&
    typeof input.actor.snapshot.payload === 'object' &&
    input.actor.snapshot.payload !== null &&
    !Array.isArray(input.actor.snapshot.payload)
      ? input.actor.snapshot.payload
      : null
  const size = sizeCodeSchema.safeParse(payload?.size)
  return {
    kind: 'ENCOUNTER_FEATURE',
    actorId: input.actor.id,
    capability,
    equipment:
      loadout && source
        ? {
            id: source.loadoutEntryId,
            category: source.compiled.category,
            properties: source.compiled.properties,
            state: 'HELD'
          }
        : null,
    triggerCode: capability.compiledEffect.invocation.triggerCode ?? null,
    attack: {
      modifier: capability.attackMechanic?.attackBonus ?? null,
      rollMode: capability.attackMechanic?.rollMode ?? null,
      baseContributors:
        capability.attackMechanic?.rollMode === 'NORMAL'
          ? { MELEE: [], RANGED: [], SPELL: [], UNARMED: [] }
          : null,
      relationshipContributors: lockedRelationshipActionFacts({
        actionEffectId: capability.effectId,
        sourceActorId: input.actor.id,
        targetActorId: input.targetActorId,
        targets: input.targets
      })
    },
    size: size.success ? size.data : null
  }
}
