export const AUTHORED_RECORD_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE'
} as const

export type AuthoredRecordStatus = keyof typeof AUTHORED_RECORD_STATUS

export function resolveAuthoredRecordStatus(
  status: AuthoredRecordStatus | undefined,
  fallback: AuthoredRecordStatus = AUTHORED_RECORD_STATUS.DRAFT
): AuthoredRecordStatus {
  return status ?? fallback
}
