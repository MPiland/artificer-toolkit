const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const publicIdPattern = /^[0-9a-z]+$/i

interface AuthoredRouteSubject {
  id: string
  publicId: string
  label: string
}

interface ParsedAuthoredRouteHandle {
  id: string
  isLegacy: boolean
}

export function normalizeAuthoredRouteSlug(label: string | null | undefined) {
  const slug = (label ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')

  return slug || 'item'
}

export function buildAuthoredRouteHandle(publicId: string, label: string | null | undefined) {
  return {
    publicId: publicId.toLowerCase(),
    slug: normalizeAuthoredRouteSlug(label)
  }
}

export function parseAuthoredRouteHandle(handle: string): ParsedAuthoredRouteHandle | null {
  if (!handle) return null
  if (!isLegacyAuthoredRouteId(handle) && !publicIdPattern.test(handle)) return null

  return {
    id: handle.toLowerCase(),
    isLegacy: isLegacyAuthoredRouteId(handle)
  }
}

export function parseAuthoredRouteId(handle: string) {
  return parseAuthoredRouteHandle(handle)?.id ?? handle
}

function isLegacyAuthoredRouteId(value: string) {
  return uuidPattern.test(value)
}

export function isCanonicalAuthoredRouteHandle(
  publicId: string,
  slug: string,
  subject: AuthoredRouteSubject | null
) {
  if (!subject) return false
  const expected = buildAuthoredRouteHandle(subject.publicId, subject.label)

  return publicId === expected.publicId && slug === expected.slug
}

function getAuthoredRouteSubjectLabel(
  active: { item?: { label?: string } | null } | null | undefined,
  draft: { label?: string } | null | undefined
) {
  return draft?.label ?? active?.item?.label ?? null
}

export function getAuthoredRouteSubject(
  fallbackId: string,
  active: { publicId?: string; item?: { id?: string; label?: string } | null } | null | undefined,
  draft: { publicId?: string; subjectId?: string; label?: string } | null | undefined
): AuthoredRouteSubject | null {
  const label = getAuthoredRouteSubjectLabel(active, draft)
  const publicId = draft?.publicId ?? active?.publicId ?? fallbackId
  const id = draft?.subjectId ?? active?.item?.id ?? fallbackId

  return label
    ? {
        id,
        publicId,
        label
      }
    : null
}
