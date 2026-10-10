import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { ReusableDefinitionRootRecord } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { CampaignSceneState, SceneGrid, SceneToken } from '@artificer-toolkit/shared/vtt'

import { snapshotStatBlock } from './encounterProjection.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import {
  ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID,
  ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID
} from './encounterRollModeReasons.js'
import type { EncounterRelationshipD20Contributor } from './encounterRelationshipActionFacts.js'
import {
  resolveEncounterActorPairPerception,
  type EncounterPerceptionActor
} from './encounterTurnEffectPerception.js'

/**
 * Whether one actor sees another. A Character's pinned Senses are complete, so its answer is
 * definitive. A Creature's authored free-text Senses ("darkvision 60 ft.") are not modeled, so a
 * Creature that has them and does not see by the modeled facts may still see: UNKNOWN.
 */
export type EncounterAttackSight = 'SEES' | 'UNSEEN' | 'UNKNOWN'

export type EncounterAttackPerception = {
  targetSeesAttacker: EncounterAttackSight
  attackerSeesTarget: EncounterAttackSight
}

type AttackPerceptionActor = EncounterPerceptionActor & Pick<MovementTarget, 'conditionDefinitions'>

/** The perception Scene of an attack: its tokens, effective grid, and spatial effects. */
export type EncounterAttackPerceptionPlacement = {
  scene: Pick<
    CampaignSceneState,
    | 'ambientIllumination'
    | 'barriers'
    | 'darknessZones'
    | 'doorStates'
    | 'grid'
    | 'lights'
    | 'tokens'
  >
  sceneGrid: SceneGrid
  attackerToken: SceneToken
  targetToken: SceneToken
  spatialEffects: readonly EncounterSpatialRuleEffectRecord[]
}

/** Resolves both directions of sight between an attacker and its target (SRD unseen attacker/target). */
export async function resolveEncounterAttackPerception(input: {
  gameSystemId: string
  attacker: AttackPerceptionActor
  target: AttackPerceptionActor
  /** Null outside a Scene: conditions and Senses still decide on the neutral environment. */
  placement: EncounterAttackPerceptionPlacement | null
  loadDefinition: (
    id: string
  ) => Promise<Pick<
    ReusableDefinitionRootRecord,
    'definitionFamilyKey' | 'gameSystemId' | 'current'
  > | null>
  loadSystem: () => Promise<SystemAuthoredDto>
}): Promise<EncounterAttackPerception> {
  const { placement } = input
  const sight = async (
    observer: AttackPerceptionActor,
    subject: AttackPerceptionActor,
    tokens: { observerToken: SceneToken; subjectToken: SceneToken } | null
  ): Promise<EncounterAttackSight> => {
    const result = await resolveEncounterActorPairPerception({
      gameSystemId: input.gameSystemId,
      requirement: 'SEE',
      observer,
      subject,
      observerConditionDefinitions: observer.conditionDefinitions,
      subjectConditionDefinitions: subject.conditionDefinitions,
      placement: placement && tokens ? { ...placement, ...tokens } : null,
      loadDefinition: input.loadDefinition,
      loadSystem: input.loadSystem
    })
    if (result.satisfied) return 'SEES'
    return (snapshotStatBlock(observer.actor)?.senses.length ?? 0) > 0 ? 'UNKNOWN' : 'UNSEEN'
  }
  const [targetSeesAttacker, attackerSeesTarget] = await Promise.all([
    sight(
      input.target,
      input.attacker,
      placement && { observerToken: placement.targetToken, subjectToken: placement.attackerToken }
    ),
    sight(
      input.attacker,
      input.target,
      placement && { observerToken: placement.attackerToken, subjectToken: placement.targetToken }
    )
  ])
  return { targetSeesAttacker, attackerSeesTarget }
}

/** The attack-roll contributors the SRD gives unseen attackers (advantage) and unseen targets (disadvantage). */
export function encounterAttackPerceptionContributors(
  perception: EncounterAttackPerception
): readonly EncounterRelationshipD20Contributor[] {
  return [
    ...(perception.targetSeesAttacker === 'UNSEEN'
      ? [
          {
            sourceId: ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID,
            grantId: null,
            domainKey: ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID,
            influence: 'ADVANTAGE' as const
          }
        ]
      : []),
    ...(perception.attackerSeesTarget === 'UNSEEN'
      ? [
          {
            sourceId: ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID,
            grantId: null,
            domainKey: ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID,
            influence: 'DISADVANTAGE' as const
          }
        ]
      : [])
  ]
}
