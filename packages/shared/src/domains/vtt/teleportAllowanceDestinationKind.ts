/** Whether a teleport's destination must be seen (Misty Step) or may be any point in range (Dimension Door). */
export const TELEPORT_ALLOWANCE_DESTINATION_KINDS = ['VISIBLE', 'SPECIFIED_POINT'] as const

export type TeleportAllowanceDestinationKind = (typeof TELEPORT_ALLOWANCE_DESTINATION_KINDS)[number]

export function isTeleportAllowanceDestinationKind(
  value: unknown
): value is TeleportAllowanceDestinationKind {
  return TELEPORT_ALLOWANCE_DESTINATION_KINDS.some((kind) => kind === value)
}
