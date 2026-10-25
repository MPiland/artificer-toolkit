import type { FacingArc, FacingArcRange } from '@artificer-toolkit/shared/vtt/facingArc'
import {
  classifySquareGridFacingArc,
  classifySquareGridFootprintFacingArcs,
  enumerateSquareGridFootprint
} from '@artificer-toolkit/shared/vtt'
import type { EncounterActionSceneContext } from './encounterActionTargetPolicy.js'
import type { FacingRule, OptionalCombatPolicyInput } from './optionalCombatPolicyCapability.js'
import { optionalCombatPolicyCapabilityRegistry } from './platformEncounterPolicy.js'

/** The Encounter's active Facing rule (ATTACK-12); null when its System has none or facing is off. */
export function encounterFacingRule(state: OptionalCombatPolicyInput): FacingRule | null {
  return optionalCombatPolicyCapabilityRegistry.find(state.gameSystemId)?.facingRule(state) ?? null
}

/** Whether a token may face `degrees` under the Encounter's Facing rule: on, and one of its steps. */
export function admitsEncounterFacing(state: OptionalCombatPolicyInput, degrees: number): boolean {
  const rule = encounterFacingRule(state)
  return rule !== null && degrees % rule.facingStepDegrees === 0
}

/**
 * The arc of each token's facing the other stands in. A square grid measures from the closest
 * occupied cells, so a large token's contact point decides; elsewhere the token centres do.
 */
export function encounterFacingArcs(
  arcs: readonly FacingArcRange[],
  scene: EncounterActionSceneContext
): { sourceToTarget: FacingArc | null; targetToSource: FacingArc | null } | null {
  const { grid, sourceToken, targetToken } = scene
  if (grid.kind === 'SQUARE') {
    const source = enumerateSquareGridFootprint(grid, sourceToken)
    const target = enumerateSquareGridFootprint(grid, targetToken)
    return source && target
      ? classifySquareGridFootprintFacingArcs({
          arcs,
          grid,
          source: { footprint: source, rotationDegrees: sourceToken.rotationDegrees },
          target: { footprint: target, rotationDegrees: targetToken.rotationDegrees }
        })
      : null
  }
  return {
    sourceToTarget: classifySquareGridFacingArc({
      arcs,
      subject: targetToken.position,
      target: sourceToken
    }),
    targetToSource: classifySquareGridFacingArc({
      arcs,
      subject: sourceToken.position,
      target: targetToken
    })
  }
}
