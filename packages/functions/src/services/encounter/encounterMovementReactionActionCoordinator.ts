import {
  createEncounterRepository,
  createReusableDefinitionRepository,
  createSystemVocabularySnapshotRepository,
  type DBLike,
  type EncounterRecord,
  type EncounterSpatialRuleEffectRecord
} from '@artificer-toolkit/db'
import type { MovementReactionChoiceOptionDto } from '@artificer-toolkit/schema/shared/reaction'
import type { CampaignSceneState, SpatialMovementKind } from '@artificer-toolkit/shared/vtt'

import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import { encounterSceneGridPolicyRegistry } from '../rules/sceneGridPolicyRegistry.js'
import { discoverEncounterFeatureActionCapabilities } from '../rules/encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { evaluateEncounterActorRuleSnapshot } from './encounterActorRuleEvaluation.js'
import {
  lockEncounterActiveEffectTargets,
  type LockedEncounterActiveEffectTargets
} from './encounterActiveEffectTargetState.js'
import { EncounterValidationError } from './encounterErrors.js'
import { lockEncounterMovementReactionPerceptionResolver } from './encounterMovementReactionPerception.js'
import { revalidateEncounterMovementReactionOption } from './encounterMovementReactionDiscovery.js'
import {
  prepareEncounterMovementReactionSettlement,
  type PreparedEncounterMovementReactionSettlement
} from './encounterMovementReactionActionSettlement.js'

/**
 * Re-locks and prepares the exact issued action without rediscovering movement.
 * Both the initial choice and a later evidence response use this same path.
 */
export async function prepareCurrentEncounterMovementReactionAction(input: {
  trx: DBLike
  actorUserId: string
  encounter: EncounterRecord
  scene: CampaignSceneState
  actorIdByTokenId: ReadonlyMap<string, string>
  movingTokenId: string
  movementKind: SpatialMovementKind
  occurrenceId: string
  option: MovementReactionChoiceOptionDto
  runtime: RulesRuntimeService
  attunementSlotOverride: number | null
  spatialScope: {
    list(): Promise<readonly EncounterSpatialRuleEffectRecord[]>
  }
  lockedTargets?: LockedEncounterActiveEffectTargets
}): Promise<PreparedEncounterMovementReactionSettlement> {
  let actorSnapshot: Awaited<ReturnType<typeof evaluateEncounterActorRuleSnapshot>> | null = null
  const getEncounterActorSnapshot = async () => {
    actorSnapshot ??= await evaluateEncounterActorRuleSnapshot({
      db: input.trx,
      encounter: input.encounter
    })
    return {
      rules: actorSnapshot.snapshot.output,
      encounter: actorSnapshot.reconciledEncounter
    }
  }
  const targets =
    input.lockedTargets ??
    (await lockEncounterActiveEffectTargets({
      trx: input.trx,
      encounter: input.encounter,
      actors: input.encounter.actors,
      attunementSlotOverride: input.attunementSlotOverride,
      getEncounterActorSnapshot
    }))
  const vocabulary = await createSystemVocabularySnapshotRepository(input.trx).findActive(
    input.encounter.gameSystemId
  )
  if (!vocabulary) {
    throw new EncounterValidationError('Encounter System vocabulary is unavailable.')
  }
  const encounterFeatureCapabilities = input.encounter.actors.flatMap((actor) =>
    discoverEncounterFeatureActionCapabilities({
      actor,
      conditionDefinitionIds: vocabulary.document.conditionTypes.map((condition) => condition.id),
      abilityDefinitions:
        'schemaVersion' in vocabulary.document && vocabulary.document.schemaVersion === 2
          ? vocabulary.document.abilities.map((ability) => ({
              id: ability.id,
              code: ability.code
            }))
          : []
    })
  )
  const resolvePerception = await lockEncounterMovementReactionPerceptionResolver({
    trx: input.trx,
    encounter: input.encounter,
    movingTokenId: input.movingTokenId,
    scene: input.scene,
    actorIdByTokenId: input.actorIdByTokenId,
    sceneGrid: encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
      encounter: input.encounter,
      sceneGrid: input.scene.grid
    }),
    lockedCharacters: targets.lockedCharacters,
    spatialScope: input.spatialScope
  })
  const revalidated = await revalidateEncounterMovementReactionOption({
    encounter: input.encounter,
    automationMode: input.encounter.automationMode === 'AUTOMATIC' ? 'AUTOMATIC' : 'ASSISTED',
    movementKind: input.movementKind,
    occurrenceId: input.occurrenceId,
    option: input.option,
    tokens: input.scene.tokens,
    actorIdByTokenId: input.actorIdByTokenId,
    lockedCharacters: targets.lockedCharacters,
    activeEffectsByActorId: targets.activeEffectsByActorId,
    encounterFeatureCapabilities,
    definitions: createReusableDefinitionRepository(input.trx),
    runtime: input.runtime,
    lockRelationship: async ({ reactorActorId, movingActorId }) =>
      createEncounterRepository(input.trx).lockActorRelationship({
        encounterId: input.encounter.id,
        firstActorId: reactorActorId,
        secondActorId: movingActorId
      }),
    resolvePerception
  })
  const currentActorSnapshot = await getEncounterActorSnapshot()
  const prepared = await prepareEncounterMovementReactionSettlement({
    db: input.trx,
    actorUserId: input.actorUserId,
    automationMode: input.encounter.automationMode === 'AUTOMATIC' ? 'AUTOMATIC' : 'ASSISTED',
    encounter: currentActorSnapshot.encounter,
    option: input.option,
    actionSource: revalidated.action,
    targets
  })
  return {
    ...prepared,
    movementInterruption: input.option.binding.movementInterruption
  }
}
