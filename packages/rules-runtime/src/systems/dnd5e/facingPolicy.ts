import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  classifySquareGridFootprintFacingArcs,
  enumerateSquareGridFootprint,
  type SceneGrid,
  type SceneToken,
  type SquareGridFacingArc
} from '@artificer-toolkit/shared/vtt'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { DND5E_FACING_POLICY_MODULE } from './policyModuleRegistration.js'

export { DND5E_FACING_POLICY_MODULE } from './policyModuleRegistration.js'

export type Dnd5eFacingTokenFact = Pick<
  SceneToken,
  'height' | 'id' | 'position' | 'rotationDegrees' | 'width'
>

export interface Dnd5eFacingPolicyResult {
  readonly sourceToTarget: { readonly arc: SquareGridFacingArc } | null
  readonly targetToSource: { readonly arc: SquareGridFacingArc } | null
}

function resolveFacingDefinition(input: {
  automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL'
  gameSystemId: string
  optionalCombatSnapshot: unknown
  optionalCombatSnapshotChecksum: string | null | undefined
}): EncounterOptionalCombatSnapshotDto['definitions'][number] | null {
  if (
    input.gameSystemId !== DND5E_SYSTEM_ID ||
    input.optionalCombatSnapshot === null ||
    input.optionalCombatSnapshotChecksum === null
  ) {
    return null
  }
  const parsed = encounterOptionalCombatSnapshotDtoSchema.safeParse(input.optionalCombatSnapshot)
  if (
    !parsed.success ||
    parsed.data.gameSystemId !== input.gameSystemId ||
    checksumCanonicalJson(parsed.data) !== input.optionalCombatSnapshotChecksum
  ) {
    return null
  }
  const matches = activeOptionalCombatDefinitions({
    automationMode: input.automationMode,
    snapshot: parsed.data
  }).filter(
    (definition) =>
      definition.document.kind === 'FACING' &&
      definition.contractVersion === DND5E_FACING_POLICY_MODULE.contractVersion &&
      checksumRuleDocument(definition.document) === definition.definitionChecksum &&
      definition.document.module.policyModuleKey === DND5E_FACING_POLICY_MODULE.key &&
      definition.document.module.contractVersion === DND5E_FACING_POLICY_MODULE.contractVersion
  )
  return matches.length === 1 ? matches[0]! : null
}

function validTokenFact(token: Dnd5eFacingTokenFact): boolean {
  const tokenId = postgresUuidSchema.safeParse(token.id)
  return tokenId.success && tokenId.data === token.id && Number.isFinite(token.rotationDegrees)
}

/**
 * Resolves only the two orientation relationships from locked square-grid facts and
 * the exact frozen Encounter FACING definition. It returns no labels, IDs, or Scene data.
 */
export function resolveDnd5eFacingArcs(input: {
  readonly automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL'
  readonly gameSystemId: string
  readonly grid: SceneGrid | null
  readonly optionalCombatSnapshot: unknown
  readonly optionalCombatSnapshotChecksum: string | null | undefined
  readonly sourceToken: Dnd5eFacingTokenFact | null
  readonly targetToken: Dnd5eFacingTokenFact | null
}): Dnd5eFacingPolicyResult {
  const empty = { sourceToTarget: null, targetToSource: null } as const
  const sourceFootprint =
    input.grid === null || input.sourceToken === null
      ? null
      : enumerateSquareGridFootprint(input.grid, input.sourceToken)
  const targetFootprint =
    input.grid === null || input.targetToken === null
      ? null
      : enumerateSquareGridFootprint(input.grid, input.targetToken)
  if (
    input.automationMode === 'MANUAL' ||
    input.grid === null ||
    input.sourceToken === null ||
    input.targetToken === null ||
    !validTokenFact(input.sourceToken) ||
    !validTokenFact(input.targetToken) ||
    input.sourceToken.id === input.targetToken.id ||
    sourceFootprint === null ||
    targetFootprint === null ||
    input.grid.kind !== 'SQUARE' ||
    resolveFacingDefinition(input) === null
  ) {
    return empty
  }

  const arcs = classifySquareGridFootprintFacingArcs({
    grid: input.grid,
    source: { footprint: sourceFootprint, rotationDegrees: input.sourceToken.rotationDegrees },
    target: { footprint: targetFootprint, rotationDegrees: input.targetToken.rotationDegrees }
  })
  if (arcs === null) return empty
  return {
    sourceToTarget: arcs.sourceToTarget === null ? null : { arc: arcs.sourceToTarget },
    targetToSource: arcs.targetToSource === null ? null : { arc: arcs.targetToSource }
  }
}
