import type { CharacterBuildState } from '../character/buildState.js'
import type { EngineCharacterOutput } from './contracts/engineState.js'

/**
 * A compiled prerequisite — attached to feats and multiclass requirements.
 *
 * NOTE: CompiledPrerequisite does not yet exist on CompiledFeat — it needs to be
 * added to the feat authored type and compiler in a follow-up. This type serves as
 * the contract seam so command handlers can reference it now.
 */
export interface CompiledPrerequisite {
  /** Human-readable description for display */
  description: string
  /** Type of prerequisite */
  kind: 'ABILITY_SCORE' | 'CLASS_LEVEL' | 'PROFICIENCY' | 'FEAT' | 'OTHER'
  /** For ABILITY_SCORE: which ability code */
  abilityCode?: string
  /** For ABILITY_SCORE: minimum score required */
  minimumScore?: number
  /** For CLASS_LEVEL: which class and minimum level */
  classId?: string
  minimumLevel?: number
  /** For FEAT: feat id required */
  featId?: string
}

export interface PrerequisiteResult {
  passed: boolean
  failedRequirements: Array<{
    description: string
    required: string
    actual: string
  }>
}

/**
 * Entry prerequisite evaluation — checked at acquisition time by command handlers.
 *
 * Called before FeatChosenEvent or ClassLevelGainedEvent (for multiclass) is emitted.
 * If failed, the command returns an error and no event is emitted.
 *
 * Pure function — takes already-derived engine output so stat resolution
 * doesn't need to be re-run inside the evaluator.
 */
export function evaluateEntryPrerequisite(
  prerequisite: CompiledPrerequisite,
  _buildState: CharacterBuildState,
  engineOutput: EngineCharacterOutput
): PrerequisiteResult {
  switch (prerequisite.kind) {
    case 'ABILITY_SCORE': {
      const code = prerequisite.abilityCode
      const min = prerequisite.minimumScore ?? 0
      if (!code) return { passed: true, failedRequirements: [] }
      const actual = engineOutput.derivedStats.abilityScores[code] ?? 0
      if (actual >= min) return { passed: true, failedRequirements: [] }
      return {
        passed: false,
        failedRequirements: [
          {
            description: prerequisite.description,
            required: String(min),
            actual: String(actual)
          }
        ]
      }
    }
    case 'CLASS_LEVEL': {
      // TODO: check against buildState.classes
      return { passed: true, failedRequirements: [] }
    }
    case 'PROFICIENCY': {
      // TODO: check against engineOutput.proficiencies
      return { passed: true, failedRequirements: [] }
    }
    case 'FEAT': {
      // TODO: check against buildState.featRefs
      return { passed: true, failedRequirements: [] }
    }
    default:
      return { passed: true, failedRequirements: [] }
  }
}

/**
 * Ongoing restriction evaluation — evaluated by engine/read models.
 *
 * Returns null for all restrictions in Phase 6.5 (D&D 5e has essentially no
 * ongoing build-time restrictions). This seam exists for future multi-system support.
 */
export function evaluateOngoingRestriction(
  _restriction: unknown,
  _buildState: CharacterBuildState,
  _engineOutput: EngineCharacterOutput
): null {
  return null
}
