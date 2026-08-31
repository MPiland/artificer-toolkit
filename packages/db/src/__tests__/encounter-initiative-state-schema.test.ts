import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeSql } from './helpers/normalize-sql.js'

const root = process.cwd().endsWith('packages\\db')
  ? join(process.cwd(), '..', '..')
  : process.cwd()
const sources = [
  join(root, 'packages/db/src/domains/encounters/tables/encounters.sql'),
  join(root, 'supabase/migrations/20260828020000_initiative_policy_foundation.sql')
].map((path) => normalizeSql(readFileSync(path, 'utf8')))
const repositorySource = readFileSync(
  join(root, 'packages/db/src/repositories/encounter.ts'),
  'utf8'
)

describe('normalized encounter initiative state persistence', () => {
  it.each(sources)(
    'keeps round, participant, and side state aggregate-owned and server-only',
    (source) => {
      expect(source).toContain('encounter_initiative_rounds')
      expect(source).toContain('encounter_initiative_participants')
      expect(source).toContain('encounter_initiative_sides')
      expect(source).toContain(
        "procedure IN ('ACTOR_ROLL', 'ACTOR_SCORE', 'SIDE_ROLL', 'DECLARED_ACTION_ROLL', 'MANUAL')"
      )
      expect(source).toContain(
        "status IN ('UNRESOLVED', 'PENDING', 'EVALUATED', 'READY', 'ACTIVE', 'ACTED')"
      )
      expect(source).toContain(
        "status IN ('UNRESOLVED', 'PENDING', 'EVALUATED', 'READY', 'ACTIVE', 'COMPLETED')"
      )
      expect(source).toContain('FOREIGN KEY (evaluation_occurrence_id, encounter_id)')
      expect(source).toContain(
        'REFERENCES public.encounter_rule_occurrences (id, encounter_id) ON DELETE RESTRICT'
      )
      expect(source).toContain('FORCE ROW LEVEL SECURITY')
      expect(source).toContain('turn_order_ordinal')
      expect(source).toContain('declaration jsonb')
      expect(source).toContain('declaration_checksum text')
      expect(source).toContain('CHECK ((declaration IS NULL) = (declaration_checksum IS NULL))')
      expect(source).toContain(
        "CHECK (declaration_checksum IS NULL OR declaration_checksum ~ '^[a-f0-9]{64}$')"
      )
      expect(source).toContain('side_order_ordinal')
      expect(source).not.toContain('isfinite(initiative_score)')
      expect(source).toContain("initiative_score NOT IN ('NaN'::DOUBLE PRECISION")
      expect(source).toContain("procedure text NOT NULL DEFAULT 'SIDE_ROLL'")
      expect(source).toContain('FOREIGN KEY (encounter_id, round, procedure)')
    }
  )

  it.each(sources)('does not derive current order from aggregate actor fields', (source) => {
    const participantStart = source.indexOf(
      'CREATE TABLE IF NOT EXISTS public.encounter_initiative_participants'
    )
    const participantTable = source.slice(
      participantStart,
      source.indexOf('ALTER TABLE public.encounter_initiative_participants', participantStart)
    )
    expect(participantTable).not.toContain('manual_order')
    expect(participantTable).not.toContain('initiative integer')
  })

  it('derives round policy authority and enforces forward-only CAS updates', () => {
    expect(repositorySource).toContain('encounterInitiativePolicySnapshotDtoSchema.parse')
    expect(repositorySource).toContain('checksumCanonicalJson(initiativePolicySnapshot)')
    expect(repositorySource).toContain(
      'AND next_turn_order_ordinal <= ${parsed.nextTurnOrderOrdinal}'
    )
    expect(repositorySource).toContain('OR turn_order_ordinal = ${parsed.turnOrderOrdinal}')
    expect(repositorySource).toContain("OR (status = 'ACTIVE' AND ${parsed.status} = 'ACTED')")
    expect(repositorySource).toContain("OR (status = 'ACTIVE' AND ${parsed.status} = 'COMPLETED')")
  })

  it('keeps declaration persistence aligned with the participant table', () => {
    expect(repositorySource).toContain('declaration: row.declaration == null ? null')
    expect(repositorySource).not.toContain('JSON.parse(String(row.declaration))')
    expect(repositorySource).toContain('declaration_checksum = ${parsed.declarationChecksum}')
  })
})
