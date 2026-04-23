import {
  AUTHORED_RECORD_STATUS,
  resolveAuthoredRecordStatus,
  type AuthoredRecordStatus
} from '@artificer-toolkit/shared'

export function normalizeSubjectStatus(
  status: AuthoredRecordStatus | undefined
): AuthoredRecordStatus {
  return resolveAuthoredRecordStatus(status, AUTHORED_RECORD_STATUS.DRAFT)
}

export function hydrateSubjectStatus(
  status: string | null | undefined
): AuthoredRecordStatus {
  return status === AUTHORED_RECORD_STATUS.ACTIVE
    ? AUTHORED_RECORD_STATUS.ACTIVE
    : AUTHORED_RECORD_STATUS.DRAFT
}
