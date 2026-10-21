/** Code-owned D&D test operation identities shared by policy graphs. */
export const DND5E_ATTACK_TEST_OPERATION_KEY = 'dnd5e.attack-test-resolution'
export const DND5E_SAVE_TEST_OPERATION_KEY = 'dnd5e.save-test-resolution'

/** The key of a direct proposal's form inside a test graph: `dnd5e.<x>` becomes `dnd5e.test-<x>`. */
export function dnd5ePathGatedOperationKey(directOperationKey: string): string {
  return directOperationKey.replace(/^dnd5e\./, 'dnd5e.test-')
}

/**
 * A committed execution's trace entry for one outcome's proposal: the direct proposal, or its
 * path-gated form once the test resolved to the path it is authored on. Undefined when neither ran.
 */
export function dnd5eResolvedProposalTrace<
  Entry extends { operation: { key: string }; outputs: Readonly<Record<string, unknown>> }
>(trace: readonly Entry[], directOperationKey: string): Entry | undefined {
  const pathGatedKey = dnd5ePathGatedOperationKey(directOperationKey)
  return trace.find(
    ({ operation, outputs }) =>
      operation.key === directOperationKey ||
      (operation.key === pathGatedKey && outputs.authorized === true)
  )
}
