import type { ApplyGrantAuthored } from './applyGrant.js'
import type { CommandManifestAuthored } from './commandManifest.js'
import type { ConditionAuthored } from './condition.js'
import type { DamageAuthored } from './damage.js'
import type { HitPointMaximumReductionAuthored } from './hitPointMaximumReduction.js'
import type { ScalarReductionAuthored } from './scalarReduction.js'
import type { ForcedMovementAuthored } from './forcedMovement.js'
import type { FollowUpSaveAuthored } from './followUpSave.js'
import type { FollowUpCheckAuthored } from './followUpCheck.js'
import type { HealAuthored } from './heal.js'
import type { ManifestAuthored } from './manifest.js'
import type { MoveManifestAuthored } from './moveManifest.js'
import type { ManualAdjudicationAuthored } from './manualAdjudication.js'
import type { MovementRuleAuthored } from './movementRule.js'
import type { ActionEconomyRuleAuthored } from './actionEconomyRule.js'
import type { StabilizeAuthored } from './stabilize.js'
import type { TeleportAuthored } from './teleport.js'
import type { ArmorClassFloorAuthored } from './armorClassFloor.js'
import type { TelepathicLinkAuthored } from './telepathicLink.js'
import type { PlantPortalAuthored } from './plantPortal.js'
import type { TreeStrideAuthored } from './treeStride.js'
import type { ClosedRuleAuthored } from './closedRule.js'
import type { ActorRelationshipAuthored } from './actorRelationship.js'
import type { ConcealFromObserversAuthored } from './concealFromObservers.js'
import type { DetectConcealedAuthored } from './detectConcealed.js'
import type { CancelTriggeringEventAuthored } from './cancelTriggeringEvent.js'

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
  | MoveManifestAuthored
  | CommandManifestAuthored
  | FollowUpSaveAuthored
  | FollowUpCheckAuthored
  | MovementRuleAuthored
  | ActionEconomyRuleAuthored
  | StabilizeAuthored
  | ArmorClassFloorAuthored
  | TelepathicLinkAuthored
  | PlantPortalAuthored
  | TreeStrideAuthored
  | ActorRelationshipAuthored
  | ConcealFromObserversAuthored
  | DetectConcealedAuthored
  | CancelTriggeringEventAuthored
  | ClosedRuleAuthored
  | ManualAdjudicationAuthored

export type NonManifestOutcomeAuthored = Exclude<OutcomeAuthored, ManifestAuthored>
