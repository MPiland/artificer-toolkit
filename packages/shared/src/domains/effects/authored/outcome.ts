import type { ApplyGrantAuthored } from './applyGrant.js'
import type { ConditionAuthored } from './condition.js'
import type { DamageAuthored } from './damage.js'
import type { HitPointMaximumReductionAuthored } from './hitPointMaximumReduction.js'
import type { ScalarReductionAuthored } from './scalarReduction.js'
import type { ForcedMovementAuthored } from './forcedMovement.js'
import type { FollowUpSaveAuthored } from './followUpSave.js'
import type { FollowUpCheckAuthored } from './followUpCheck.js'
import type { HealAuthored } from './heal.js'
import type { ManifestAuthored } from './manifest.js'
import type { ManualAdjudicationAuthored } from './manualAdjudication.js'
import type { MovementRuleAuthored } from './movementRule.js'
import type { ActionEconomyRuleAuthored } from './actionEconomyRule.js'
import type { ReviveAuthored } from './revive.js'
import type { StabilizeAuthored } from './stabilize.js'
import type { KillAuthored } from './kill.js'
import type { TeleportAuthored } from './teleport.js'
import type { ArmorClassFloorAuthored } from './armorClassFloor.js'
import type { RestoreResourceAuthored } from './restoreResource.js'
import type { TelepathicLinkAuthored } from './telepathicLink.js'
import type { PlantPortalAuthored } from './plantPortal.js'
import type { TreeStrideAuthored } from './treeStride.js'
import type { ClosedRuleAuthored } from './closedRule.js'
import type { ActorRelationshipAuthored } from './actorRelationship.js'
import type { ConcealFromObserversAuthored } from './concealFromObservers.js'
import type { RemoveFromPlayAuthored } from './removeFromPlay.js'
import type { DetectConcealedAuthored } from './detectConcealed.js'
import type { CancelTriggeringEventAuthored } from './cancelTriggeringEvent.js'
import type { SourceImmunityAuthored } from './sourceImmunity.js'
import type { ReleaseChosenItemAuthored } from './releaseChosenItem.js'
import type { EndEffectsAuthored } from './endEffects.js'
import type { DegradeEquipmentAuthored } from './degradeEquipment.js'

export type OutcomeRowMetadataAuthored = {
  label?: string
  description?: string
}

export type OutcomeAuthored =
  | DamageAuthored
  | HitPointMaximumReductionAuthored
  | ScalarReductionAuthored
  | ConditionAuthored
  | HealAuthored
  | ApplyGrantAuthored
  | ForcedMovementAuthored
  | TeleportAuthored
  | ManifestAuthored
  | FollowUpSaveAuthored
  | FollowUpCheckAuthored
  | MovementRuleAuthored
  | ActionEconomyRuleAuthored
  | ReviveAuthored
  | StabilizeAuthored
  | KillAuthored
  | ArmorClassFloorAuthored
  | RestoreResourceAuthored
  | TelepathicLinkAuthored
  | PlantPortalAuthored
  | TreeStrideAuthored
  | ActorRelationshipAuthored
  | ConcealFromObserversAuthored
  | RemoveFromPlayAuthored
  | DetectConcealedAuthored
  | CancelTriggeringEventAuthored
  | SourceImmunityAuthored
  | ReleaseChosenItemAuthored
  | EndEffectsAuthored
  | DegradeEquipmentAuthored
  | ClosedRuleAuthored
  | ManualAdjudicationAuthored

export type NonManifestOutcomeAuthored = Exclude<OutcomeAuthored, ManifestAuthored>
