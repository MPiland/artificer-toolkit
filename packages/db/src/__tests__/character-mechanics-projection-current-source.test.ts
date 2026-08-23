import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(
    process.cwd(),
    'packages/db/src/domains/subjects/repositories/characterMechanicsProjection.ts'
  ),
  'utf8'
)

function sourceBetween(start: string, end: string): string {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex)
  expect(startIndex).toBeGreaterThanOrEqual(0)
  expect(endIndex).toBeGreaterThan(startIndex)
  return source.slice(startIndex, endIndex)
}

describe('Character mechanics projection exact authored-pin contract', () => {
  const query = sourceBetween(
    'function createAuthoredVersionValidationQuery(',
    'async function validateExactAuthoredVersionVector('
  )
  const validator = sourceBetween(
    'async function validateExactAuthoredVersionVector(',
    'async function lockExistingProjection('
  )
  const vocabularySnapshotLock = sourceBetween(
    'async function lockVocabularySnapshot(',
    'async function validateRuleRevision('
  )

  it('locks the exact immutable vocabulary snapshot for shared validation', () => {
    expect(vocabularySnapshotLock).toContain('where id = ${snapshotId}')
    expect(vocabularySnapshotLock).toContain('for share')
    expect(vocabularySnapshotLock).not.toContain('for update')
  })

  it('locks exact root/version rows in deterministic batched order without blocking pointer updates', () => {
    expect(query).toContain('where (version.id, ${sql.ref(table.rootIdColumn)}) in (')
    expect(query).toContain('order by root.id, version.id')
    expect(query).toContain('for key share of root')
    expect(query).toContain('for share of version')
    expect(query).not.toContain('root.status as root_status')
    expect(query).not.toContain('root.active_version_id as root_active_version_id')
    expect(validator).toContain('const subjectKinds = [...entriesBySubjectKind.keys()].sort()')
    expect(validator).toContain('for (const subjectKind of subjectKinds)')
    expect(validator).toContain('left.subjectId.localeCompare(right.subjectId)')
    expect(validator).toContain('left.versionId.localeCompare(right.versionId)')
    expect(validator).toContain(
      'createAuthoredVersionValidationQuery(subjectKind, entries).execute(db)'
    )
    expect(validator.match(/\.execute\(db\)/g)).toHaveLength(1)
  })

  it('requires exact root, version, checksum, and Character System identity', () => {
    expect(validator).toContain('version.subject_kind !== entry.subjectKind')
    expect(validator).toContain('version.id !== entry.versionId')
    expect(validator).toContain('version.root_system_id !== systemId')
    expect(validator).toContain('version.version !== entry.version')
    expect(validator).toContain('version.authored_checksum !== entry.checksum')
    expect(validator).not.toContain('version.root_status')
    expect(validator).not.toContain('version.root_active_version_id')
  })

  it('uses the same exact-pin validator in all four repository lanes', () => {
    const advance = sourceBetween(
      'async advanceLiveCommandState(input)',
      'async publish(input, options)'
    )
    const publish = sourceBetween('async publish(input, options)', 'async requireCurrent(input)')
    const fullRead = sourceBetween(
      'async requireCurrent(input)',
      'async requireCurrentMetadata(input)'
    )
    const metadataRead = source.slice(source.indexOf('async requireCurrentMetadata(input)'))

    for (const lane of [advance, publish, fullRead, metadataRead]) {
      expect(lane).toContain('validateExactAuthoredVersionVector(')
    }
    expect(source.match(/validateExactAuthoredVersionVector\(/g)).toHaveLength(5)
    expect(source).not.toContain('requireActiveAuthoredVersions')
  })

  it('bounds authored-root dependency discovery to supplied Character IDs', () => {
    const discovery = sourceBetween(
      'async listCharacterIdsByAuthoredRoot(input)',
      'async advanceLiveCommandState(input)'
    )

    expect(discovery).toContain(
      'const characterIds = [...new Set(input.candidateCharacterIds)].sort()'
    )
    expect(discovery).toContain('where projection.character_id in (')
    expect(discovery).toContain('projection.authored_version_vector @>')
    expect(discovery).toContain('subjectKind: input.subjectKind')
    expect(discovery).toContain('subjectId: input.subjectId')
    expect(discovery).toContain('order by projection.character_id')
  })

  it('keeps Character, authored-source, and projection locks in command order', () => {
    const advance = sourceBetween(
      'async advanceLiveCommandState(input)',
      'async publish(input, options)'
    )
    const publish = sourceBetween('async publish(input, options)', 'async requireCurrent(input)')
    const fullRead = sourceBetween(
      'async requireCurrent(input)',
      'async requireCurrentMetadata(input)'
    )
    const metadataRead = source.slice(source.indexOf('async requireCurrentMetadata(input)'))

    expect(advance).toContain('return withTransaction(db, async (trx) => {')
    expect(advance.indexOf('lockCharacter(trx')).toBeLessThan(
      advance.indexOf('validateExactAuthoredVersionVector(')
    )
    expect(advance.indexOf('validateExactAuthoredVersionVector(')).toBeLessThan(
      advance.indexOf('update public.character_mechanics_projections')
    )

    expect(publish.indexOf('lockCharacter(trx')).toBeLessThan(
      publish.indexOf('validateExactAuthoredVersionVector(')
    )
    expect(publish.indexOf('validateExactAuthoredVersionVector(')).toBeLessThan(
      publish.indexOf('lockExistingProjection(trx')
    )

    expect(fullRead).toContain('return withTransaction(db, async (trx) => {')
    expect(fullRead).toContain('readProjection(trx, input.characterId)')
    expect(fullRead).toContain('current.characterSystemId')
    expect(fullRead).not.toContain('current.projection.commandState.systemId')
    expect(metadataRead).toContain('return withTransaction(db, async (trx) => {')
    expect(metadataRead).toContain('readProjectionMetadata(trx, input.characterId)')
    expect(metadataRead).toContain('current.characterSystemId')
    expect(metadataRead).not.toContain('current.projection.commandState.systemId')
  })
})
