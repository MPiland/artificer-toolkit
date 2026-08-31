export const BOUNDED_USAGE_RECONCILIATION_POLICY = {
  CLAMP_USED_TO_MAXIMUM: 'CLAMP_USED_TO_MAXIMUM'
} as const

export type BoundedUsageReconciliationPolicy =
  (typeof BOUNDED_USAGE_RECONCILIATION_POLICY)[keyof typeof BOUNDED_USAGE_RECONCILIATION_POLICY]

export interface BoundedUsageTrackInput {
  previousMaximum: number
  nextMaximum: number
  previousUsed: number
  policy: BoundedUsageReconciliationPolicy
}

export interface BoundedUsageTrackResult {
  policy: BoundedUsageReconciliationPolicy
  previousMaximum: number
  nextMaximum: number
  previousUsed: number
  used: number
  remaining: number
  reconciled: boolean
  reason: 'UNCHANGED' | 'USED_CLAMPED_TO_MAXIMUM'
}

function requireNonnegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Bounded usage track ${name} must be a nonnegative safe integer.`)
  }
}

/**
 * Reconciles a finite usage value against a System-selected maximum policy.
 * The calling aggregate owns persistence and decides whether this primitive applies.
 */
export function reconcileBoundedUsageTrack(
  input: Readonly<BoundedUsageTrackInput>
): BoundedUsageTrackResult {
  requireNonnegativeSafeInteger(input.previousMaximum, 'previous maximum')
  requireNonnegativeSafeInteger(input.nextMaximum, 'next maximum')
  requireNonnegativeSafeInteger(input.previousUsed, 'previous used')

  switch (input.policy) {
    case BOUNDED_USAGE_RECONCILIATION_POLICY.CLAMP_USED_TO_MAXIMUM: {
      const used = Math.min(input.previousUsed, input.nextMaximum)
      const reconciled = used !== input.previousUsed
      return {
        policy: input.policy,
        previousMaximum: input.previousMaximum,
        nextMaximum: input.nextMaximum,
        previousUsed: input.previousUsed,
        used,
        remaining: input.nextMaximum - used,
        reconciled,
        reason: reconciled ? 'USED_CLAMPED_TO_MAXIMUM' : 'UNCHANGED'
      }
    }
  }
}
