import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getSrdAuthoredRouteNumber } from '../domains/subjects/repositories/authoredRouteId.js'

describe('authored route ids', () => {
  it('derives deterministic route numbers from stable SRD UUID segments', () => {
    expect(getSrdAuthoredRouteNumber('00000000-0000-0000-0020-000100000000')).toBe(3_200_001)
  })

  it('returns null for IDs outside the stable SRD UUID range', () => {
    expect(getSrdAuthoredRouteNumber('spell-1')).toBeNull()
  })

  it('keeps user-scoped access checks on public-id and UUID route resolution', () => {
    const source = readFileSync(join(process.cwd(), 'packages/db/src/domains/subjects/repositories/authoredRouteId.ts'), 'utf8')
    const publicIdResolver = source.slice(
      source.indexOf('async resolveByPublicIdForUser'),
      source.indexOf('async resolveBySubjectForUser')
    )
    const subjectResolver = source.slice(source.indexOf('async resolveBySubjectForUser'))

    expect(publicIdResolver).toContain('public.can_access_authored_route_id(subject_kind, subject_id)')
    expect(subjectResolver).toContain('public.can_access_authored_route_id(subject_kind, subject_id)')
    expect(subjectResolver).toContain('async canAccessSubjectForUser')
  })

  it('keeps authored detail UUID fallbacks behind the user-scoped route-id resolver', () => {
    const source = readFileSync(join(process.cwd(), 'apps/apis/src/trpc/authoredDomains.ts'), 'utf8')
    const resolver = source.slice(
      source.indexOf('async function resolveAuthoredRouteSubjectId'),
      source.indexOf('export async function saveAuthoredDomainDraft')
    )

    expect(resolver).toContain('uuidPattern.test(routeId)')
    expect(resolver).toContain('resolveBySubjectForUser')
    expect(resolver).toContain('canAccessSubjectForUser')
    expect(resolver).toContain('resolveByPublicIdForUser')
    expect(resolver).toContain('return routeIdentity?.subjectId ?? null')
    expect(resolver).not.toContain('return routeId.toLowerCase()')
  })
})
