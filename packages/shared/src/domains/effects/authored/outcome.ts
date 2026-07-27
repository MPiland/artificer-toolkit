import type { ApplyGrantAuthored } from './applyGrant.js'
import type { CommandManifestAuthored } from './commandManifest.js'
import type { ConditionAuthored } from './condition.js'
import type { DamageAuthored } from './damage.js'
import type { ForcedMovementAuthored } from './forcedMovement.js'
import type { HealAuthored } from './heal.js'
import type { ManifestAuthored } from './manifest.js'
import type { MoveManifestAuthored } from './moveManifest.js'
import type { ManualAdjudicationAuthored } from './manualAdjudication.js'
import type { TeleportAuthored } from './teleport.js'

export type OutcomeRowMetadataAuthored = {
  label?: string
  description?: string
}

export type OutcomeAuthored =
  | DamageAuthored
  | ConditionAuthored
  | HealAuthored
  | ApplyGrantAuthored
  | ForcedMovementAuthored
  | TeleportAuthored
  | ManifestAuthored
  | MoveManifestAuthored
  | CommandManifestAuthored
  | ManualAdjudicationAuthored

export type NonManifestOutcomeAuthored = Exclude<OutcomeAuthored, ManifestAuthored>
