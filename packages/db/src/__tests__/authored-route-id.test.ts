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

  it('does not update existing route identity rows during ensure reads', () => {
    const source = readFileSync(join(process.cwd(), 'packages/db/src/domains/subjects/repositories/authoredRouteId.ts'), 'utf8')
    const ensure = source.slice(
      source.indexOf('async ensure(params:'),
      source.indexOf('async ensureMany')
    )

    expect(ensure).toContain('do nothing')
    expect(ensure).not.toContain('do update')
  })

  it('keeps direct client access closed for authored route identities', () => {
    const routeMigration = readFileSync(join(process.cwd(), 'supabase/migrations/20260510123258_authored_route_ids.sql'), 'utf8')
    const hardeningMigration = readFileSync(join(process.cwd(), 'supabase/migrations/20260521183629_harden_public_api_access.sql'), 'utf8')
    const remoteReset = readFileSync(join(process.cwd(), 'packages/db/src/scripts/resetRemotePublicSchema.ts'), 'utf8')

    expect(routeMigration).toContain('DROP POLICY IF EXISTS "Route identities can be updated for visible subjects"')
    expect(routeMigration).not.toContain('CREATE POLICY "Route identities can be updated for visible subjects"')
    expect(routeMigration).not.toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public.authored_route_ids TO authenticated')
    expect(hardeningMigration).toContain('REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
    expect(hardeningMigration).toContain('ON ALL TABLES IN SCHEMA public')
    expect(hardeningMigration).toContain('FROM anon, authenticated')
    expect(hardeningMigration).toContain('REVOKE EXECUTE')
    expect(hardeningMigration).toContain('ON ALL ROUTINES IN SCHEMA public')
    expect(hardeningMigration).toContain('FROM public, anon, authenticated')
    expect(hardeningMigration).toContain('GRANT USAGE ON SCHEMA public TO supabase_auth_admin')
    expect(hardeningMigration).toContain('GRANT EXECUTE ON FUNCTION public.set_admin_claims(jsonb) TO supabase_auth_admin')
    expect(hardeningMigration).toContain('CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR ALL TO anon, authenticated')
    expect(hardeningMigration).toContain('USING (false) WITH CHECK (false)')
    expect(remoteReset).toContain('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, service_role')
    expect(remoteReset).toContain('GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role')
    expect(remoteReset).toContain('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role')
    expect(remoteReset).not.toContain('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role')
    expect(remoteReset).not.toContain('GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role')
    expect(remoteReset).not.toContain('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role')
  })

  it('enables RLS for the character event log', () => {
    const source = readFileSync(join(process.cwd(), 'packages/db/src/domains/subjects/tables/character_events.sql'), 'utf8')
    const hardeningMigration = readFileSync(join(process.cwd(), 'supabase/migrations/20260521183629_harden_public_api_access.sql'), 'utf8')

    expect(source).toContain('ALTER TABLE public.character_events ENABLE ROW LEVEL SECURITY')
    expect(hardeningMigration).toContain('ALTER TABLE public.character_events ENABLE ROW LEVEL SECURITY')
  })

  it('keeps authored detail UUID fallbacks behind the user-scoped route-id resolver', () => {
    const source = readFileSync(join(process.cwd(), 'packages/functions/src/services/authoredContent/authoredDomainService.ts'), 'utf8')
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
