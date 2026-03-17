import type { ContentRef } from './snapshot.js'
import type { CharacterBuildState } from '../character/buildState.js'
import type { CharacterAssemblyRegistry } from './registry.js'
import type { RulesSystem } from './contracts/rulesSystem.js'

/**
 * A group of pending or completed choices for a single feature acquisition.
 *
 * The engine uses this to drive:
 * - CharacterDecisionsView (API read model — "what choices remain?")
 * - Command handler validation ("is this feature choice allowed?")
 *
 * Using the same function for both prevents the API and validation from diverging.
 */
export interface PendingChoiceGroup {
  featureId: string
  /** Stable key identifying this choice within the feature (e.g. "fighting-style", "skill-1") */
  choiceKey: string
  requiredCount: number
  selectedCount: number
  remainingCount: number
  /** Options the character is allowed to pick (filtered by prerequisites) */
  allowedOptions: ContentRef[]
  /** Options already selected */
  selectedOptions: ContentRef[]
  status: 'COMPLETE' | 'INCOMPLETE' | 'INVALID'
}

/**
 * Resolves all pending and completed choices for a character.
 *
 * Iterates the active feature graph from CharacterBuildState.
 * Supports cascading choices: a subclass selection that unlocks further features
 * with their own options is handled by recursing until no new unresolved choices appear.
 *
 * Pure function — safe to call from both read models and command handlers.
 *
 * NOTE: Full implementation requires compiled feature option data to be present in
 * the registry. This foundation stub returns empty — implementation pending compiled
 * feature option shapes being finalized.
 */
export function resolvePendingChoices(
  _buildState: CharacterBuildState,
  _registry: CharacterAssemblyRegistry,
  _rules: RulesSystem
): PendingChoiceGroup[] {
  // TODO: Phase 6.5 full implementation — walk buildState.featureSelections,
  // identify features with CHOSEN-mode grants, compare against selections,
  // return pending groups with allowedOptions filtered by prerequisites.
  return []
}

/**
 * View of all decisions (pending + complete) for a character.
 * Used as the API response for the character decisions endpoint.
 */
export interface CharacterDecisionsView {
  pendingFeatureChoices: PendingChoiceGroup[]
  completedChoices: PendingChoiceGroup[]
  /** Issues that block character completion (e.g. missing required choices) */
  blockingIssues: Array<{ code: string; message: string; choiceKey?: string }>
  isComplete: boolean
}
