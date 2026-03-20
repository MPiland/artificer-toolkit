import type { ApplyGrantAuthored } from './applyGrant.js'
import type { ConditionAuthored } from './condition.js'
import type { DamageAuthored } from './damage.js'
import type { HealAuthored } from './heal.js'
import type { ManifestAuthored } from './manifest.js'
import type { RuleAuthored } from './rule.js'
import type { TeleportAuthored } from './teleport.js'

export type OutcomeAuthored =
  | DamageAuthored
  | ConditionAuthored
  | HealAuthored
  | ApplyGrantAuthored
  | TeleportAuthored
  | ManifestAuthored
  | RuleAuthored
