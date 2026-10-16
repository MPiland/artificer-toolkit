/** The D&D operation a Misty Step or Dimension Door `TELEPORT` outcome compiles to. */
export const DND5E_TELEPORT_ALLOWANCE_PROPOSAL_OPERATION_KEY = 'dnd5e.teleport-allowance-proposal'

export const TELEPORT_DESTINATION_KINDS = ['VISIBLE', 'SPECIFIED_POINT'] as const

export type TeleportDestinationKind = (typeof TELEPORT_DESTINATION_KINDS)[number]

export function isTeleportDestinationKind(value: unknown): value is TeleportDestinationKind {
  return TELEPORT_DESTINATION_KINDS.some((kind) => kind === value)
}

/**
 * The one-shot teleport a committed action execution granted, read from its stored trace: how far
 * the caster may move and whether the destination must be seen. Null when the execution was not a
 * teleport spell.
 */
export function executionTeleportAllowance(execution: {
  evidence: {
    trace: readonly {
      operation: { key: string }
      outputs: Readonly<Record<string, unknown>>
    }[]
  }
}): { maxFeet: number; destinationKind: TeleportDestinationKind } | null {
  const entry = execution.evidence.trace.find(
    ({ operation }) => operation.key === DND5E_TELEPORT_ALLOWANCE_PROPOSAL_OPERATION_KEY
  )
  if (!entry) return null
  const { maxFeet, destinationKind } = entry.outputs
  if (typeof maxFeet !== 'number' || !isTeleportDestinationKind(destinationKind))
    throw new Error('The stored teleport allowance trace is invalid.')
  return { maxFeet, destinationKind }
}
