import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeSql } from './helpers/normalize-sql.js'

const read = (path: string) => normalizeSql(readFileSync(join(process.cwd(), path), 'utf8'))
const canonical = read('packages/db/src/domains/campaigns/tables/campaigns.sql')
const migration = read('supabase/migrations/20260825061000_campaign_catalogue_content_binding.sql')
const bootstrap = read('packages/db/src/domains/bootstrap/generated/create_database.bundle.sql')
const lifecycle = read('packages/db/src/repositories/campaignLifecycle.ts')

describe('Campaign catalogue binding schema', () => {
  it('keeps primary and additional catalogues constrained to the Campaign System', () => {
    expect(canonical).toContain('primary_rules_catalogue_id uuid NOT NULL')
    expect(canonical).toContain('campaign_additional_rules_catalogues')
    expect(canonical).toContain('FOREIGN KEY (primary_rules_catalogue_id, game_system_id)')
    expect(canonical).toContain('FOREIGN KEY (rules_catalogue_id, game_system_id)')
    expect(canonical).toContain(
      'Campaign primary Rules Catalogue must not be stored as an additional catalogue.'
    )
    expect(canonical).toContain('FOR UPDATE')
    expect(canonical).toContain('Campaign may enable at most 31 additional Rules Catalogues.')
    expect(canonical).toContain('Campaign additional Rules Catalogue ownership is immutable.')
    expect(canonical).toContain(
      'ALTER TABLE public.campaign_additional_rules_catalogues ENABLE ROW LEVEL SECURITY;'
    )
    expect(canonical).toContain(
      'ALTER TABLE public.campaign_additional_rules_catalogues FORCE ROW LEVEL SECURITY;'
    )
    expect(canonical).toContain(
      'REVOKE ALL ON TABLE public.campaign_additional_rules_catalogues FROM anon, authenticated;'
    )
    expect(canonical).toContain('BEFORE UPDATE OF primary_rules_catalogue_id')
    expect(migration).toContain('BEFORE INSERT OR UPDATE OR DELETE')
    expect(migration).toContain('Campaign may enable at most 31 additional Rules Catalogues.')
    expect(migration).toContain('Campaign additional Rules Catalogue ownership is immutable.')
    expect(migration).toContain(
      'ALTER TABLE public.campaign_additional_rules_catalogues ENABLE ROW LEVEL SECURITY;'
    )
    expect(migration).toContain(
      'ALTER TABLE public.campaign_additional_rules_catalogues FORCE ROW LEVEL SECURITY;'
    )
    expect(migration).toContain(
      'REVOKE ALL ON TABLE public.campaign_additional_rules_catalogues FROM anon, authenticated;'
    )
    expect(canonical).not.toMatch(/COALESCE\(NEW\.campaign_id, OLD\.campaign_id\)/)
    expect(migration).not.toMatch(/COALESCE\(NEW\.campaign_id, OLD\.campaign_id\)/)
    expect(canonical).not.toMatch(/TG_OP\s*=\s*'INSERT'\s+OR.*OLD\./s)
    expect(migration).not.toMatch(/TG_OP\s*=\s*'INSERT'\s+OR.*OLD\./s)
    expect(canonical).toMatch(/IF TG_OP = 'DELETE' THEN\s+RETURN OLD;/)
    expect(migration).toMatch(/IF TG_OP = 'DELETE' THEN RETURN OLD;/)
    expect(canonical.indexOf("IF TG_OP = 'DELETE'")).toBeLessThan(
      canonical.indexOf('NEW.campaign_id')
    )
    expect(migration.indexOf("IF TG_OP = 'DELETE'")).toBeLessThan(
      migration.indexOf('NEW.campaign_id')
    )
    expect(canonical).toMatch(
      /IF TG_OP = 'UPDATE' THEN\s+RAISE EXCEPTION 'Campaign additional Rules Catalogue ownership is immutable.'/
    )
    expect(migration).toMatch(
      /IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Campaign additional Rules Catalogue ownership is immutable.'/
    )
    expect(bootstrap).toContain('Campaign additional Rules Catalogue ownership is immutable.')
    expect(bootstrap).toContain(
      'ALTER TABLE public.campaign_additional_rules_catalogues ENABLE ROW LEVEL SECURITY;'
    )
    expect(bootstrap).toContain(
      'ALTER TABLE public.campaign_additional_rules_catalogues FORCE ROW LEVEL SECURITY;'
    )
    expect(bootstrap).toContain(
      'REVOKE ALL ON TABLE public.campaign_additional_rules_catalogues FROM anon, authenticated;'
    )
    expect(bootstrap).not.toMatch(/COALESCE\(NEW\.campaign_id, OLD\.campaign_id\)/)
    expect(lifecycle).toContain('input.additionalRulesCatalogueIds.length > 31')
  })

  it('fails closed for incompatible deterministic identities and ambiguous backfills', () => {
    expect(migration).toContain(
      'Deterministic D&D 2014 Rules Catalogue ID is already bound incompatibly.'
    )
    expect(migration).toContain(
      'Deterministic SRD 5.1 Content Source ID is already bound incompatibly.'
    )
    expect(migration).toContain(
      'Cannot backfill Campaign with more than one Character primary Rules Catalogue.'
    )
    expect(migration).not.toMatch(/\bmin\s*\(/i)
    expect(migration).toContain('AND NOT EXISTS (')
    expect(migration).toContain(
      'SELECT DISTINCT assignment.campaign_id, character.system_id, character.primary_rules_catalogue_id'
    )
  })

  it('hydrates sorted additional catalogues for a locked Campaign copy source', () => {
    expect(lifecycle).toContain('ORDER BY rules_catalogue_id')
    expect(lifecycle).toContain(
      'additional_rules_catalogue_ids: await listAdditionalRulesCatalogueIds'
    )
  })
})
