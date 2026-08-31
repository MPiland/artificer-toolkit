import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { normalizeSql } from './helpers/normalize-sql.js'

const root = process.cwd()
const characterSql = normalizeSql(
  readFileSync(join(root, 'packages/db/src/domains/subjects/tables/character_events.sql'), 'utf8')
)
const encounterSql = normalizeSql(
  readFileSync(join(root, 'packages/db/src/domains/encounters/tables/encounters.sql'), 'utf8')
)
const migration = normalizeSql(
  readFileSync(
    join(root, 'supabase/migrations/20260825050112_rule_execution_occurrences.sql'),
    'utf8'
  )
)
const bootstrap = normalizeSql(
  readFileSync(
    join(root, 'packages/db/src/domains/bootstrap/generated/create_database.bundle.sql'),
    'utf8'
  )
)
const repository = readFileSync(
  join(root, 'packages/db/src/repositories/ruleOccurrences.ts'),
  'utf8'
)

describe('aggregate-owned rule occurrence persistence', () => {
  it('retains exactly one mutable occurrence table per aggregate and no global workflow table', () => {
    expect(characterSql).toContain('character_rule_occurrences')
    expect(encounterSql).toContain('encounter_rule_occurrences')
    expect(migration).toContain('character_rule_occurrences')
    expect(migration).toContain('encounter_rule_occurrences')
    for (const sql of [characterSql, encounterSql, migration]) {
      expect(sql).not.toContain('rule_execution_workflows')
      expect(sql).toContain("state IN ('PENDING', 'COMPLETED')")
      expect(sql).toContain("state = 'PENDING' AND pending_snapshot IS NOT NULL")
      expect(sql).toContain('pending_snapshot_checksum IS NOT NULL')
      expect(sql).toContain("state = 'COMPLETED' AND pending_snapshot IS NULL")
      expect(sql).toContain('pending_snapshot_checksum IS NULL')
      expect(sql).toContain("pending_snapshot_checksum ~ '^[0-9a-f]{64}$'")
    }
  })

  it.each([
    ['canonical Character SQL', characterSql, 'character_id', 'character_rule_occurrences'],
    ['canonical Encounter SQL', encounterSql, 'encounter_id', 'encounter_rule_occurrences'],
    ['migration Character receipts', migration, 'character_id', 'character_rule_occurrences'],
    ['migration Encounter receipts', migration, 'encounter_id', 'encounter_rule_occurrences']
  ])(
    '%s gives its receipts an aggregate-local occurrence FK and denies browser access',
    (_label, sql, aggregateColumn, occurrenceTable) => {
      expect(sql).toContain('occurrence_id uuid')
      expect(sql).toContain(`FOREIGN KEY (occurrence_id, ${aggregateColumn})`)
      expect(sql).toContain(`REFERENCES public.${occurrenceTable} (id, ${aggregateColumn})`)
      expect(sql).toContain('FORCE ROW LEVEL SECURITY')
      expect(sql).toContain('REVOKE ALL ON TABLE')
    }
  )

  it('uses receipt lookup before occurrence locking and clears snapshots only on completion', () => {
    expect(repository).toContain('async findReceipt')
    expect(repository).toContain('async lockOccurrence')
    expect(repository).toContain('async lockPendingEncounter')
    expect(repository.indexOf('async findReceipt')).toBeLessThan(
      repository.indexOf('async lockOccurrence')
    )
    expect(repository).toContain("state = 'COMPLETED', version = version + 1")
    expect(repository).toContain('pending_snapshot = NULL')
    expect(repository).toContain('pending_snapshot_checksum = NULL')
    expect(repository).toContain('Rule occurrence pending snapshot checksum is invalid.')
    expect(repository).toContain('expected_stream_version = ${input.expectedAggregateVersion}')
    expect(repository).toContain('expected_encounter_version = ${input.expectedAggregateVersion}')
    expect(repository).toContain('character_id = ${aggregateId} FOR UPDATE')
    expect(repository).toContain('encounter_id = ${aggregateId} FOR UPDATE')
    expect(repository).toContain("WHERE encounter_id = ${encounterId} AND state = 'PENDING'")
    expect(repository).toContain('character_id = ${input.aggregateId}')
    expect(repository).toContain('encounter_id = ${input.aggregateId}')
    expect(repository).not.toContain('commandPayload')
    expect(repository).toContain('commandMetadata')
  })

  it.each([
    ['canonical Encounter SQL', encounterSql],
    ['occurrence migration', migration],
    ['generated bootstrap SQL', bootstrap]
  ])('%s permits at most one pending occurrence per Encounter', (_label, sql) => {
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS encounter_rule_occurrences_one_pending_idx'
    )
    expect(sql).toContain('ON public.encounter_rule_occurrences (encounter_id)')
    expect(sql).toContain("WHERE state = 'PENDING'")
  })
})
