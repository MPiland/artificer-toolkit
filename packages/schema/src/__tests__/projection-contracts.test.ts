import { describe, expect, it } from 'vitest'

import {
  authoredSubjectKindSchema,
  authoredVersionVectorSchema,
  characterMechanicsProjectionSchema,
  campaignCharacterMechanicsProjectionSchema,
  compiledAuthoredProjectionSchema
} from '../projections/index.js'

const checksum = 'a'.repeat(64)

describe('versioned projection contracts', () => {
  it('rejects unknown fields at projection boundaries', () => {
    const result = compiledAuthoredProjectionSchema.safeParse({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      authoredVersionId: 'spell-version-1',
      authoredVersion: 1,
      authoredChecksum: checksum,
      projectionSchemaVersion: 1,
      compilerVersion: 'compiler-1',
      vocabularySnapshotId: 'system-snapshot-1',
      vocabularySnapshotVersion: 1,
      vocabularySnapshotChecksum: checksum,
      authoredDependencies: [],
      projectionChecksum: checksum,
      projection: {},
      unexpected: true
    })

    expect(result.success).toBe(false)
  })

  it('keeps Campaign Character mechanics overlays server-only and strictly shaped', () => {
    expect(
      campaignCharacterMechanicsProjectionSchema.safeParse({
        campaignId: 'campaign-1',
        characterId: 'character-1',
        characterStreamVersion: 1,
        baseMechanicsProjectionChecksum: checksum,
        mechanicalContextChecksum: checksum,
        projectionSchemaVersion: 1,
        projectionChecksum: checksum,
        rulePolicyInput: {},
        rulePolicyOutput: {},
        presentationCache: {}
      }).success
    ).toBe(false)
  })

  it('rejects invalid checksum, version, subject, and authored vector values', () => {
    expect(authoredSubjectKindSchema.safeParse('CHARACTER').success).toBe(false)
    expect(
      authoredVersionVectorSchema.safeParse([
        {
          subjectKind: 'SPELL',
          subjectId: 'spell-1',
          versionId: 'spell-version-1',
          version: 1,
          checksum
        },
        {
          subjectKind: 'SPELL',
          subjectId: 'spell-1',
          versionId: 'spell-version-2',
          version: 2,
          checksum
        }
      ]).success
    ).toBe(false)
    expect(
      compiledAuthoredProjectionSchema.safeParse({
        subjectKind: 'RACE',
        subjectId: 'subrace-1',
        authoredVersionId: 'subrace-version-1',
        authoredVersion: 1,
        authoredChecksum: checksum,
        projectionSchemaVersion: 1,
        compilerVersion: 'compiler-1',
        vocabularySnapshotId: 'system-snapshot-1',
        vocabularySnapshotVersion: 1,
        vocabularySnapshotChecksum: checksum,
        authoredDependencies: [
          {
            subjectKind: 'RACE',
            subjectId: 'race-1',
            versionId: 'race-version-1',
            version: 1,
            checksum
          },
          {
            subjectKind: 'RACE',
            subjectId: 'race-1',
            versionId: 'race-version-2',
            version: 2,
            checksum
          }
        ],
        projectionChecksum: checksum,
        projection: {}
      }).success
    ).toBe(false)
    expect(
      compiledAuthoredProjectionSchema.safeParse({
        subjectKind: 'SPELL',
        subjectId: 'spell-1',
        authoredVersionId: 'spell-version-1',
        authoredVersion: 0,
        authoredChecksum: 'not-a-checksum',
        projectionSchemaVersion: 1,
        compilerVersion: 'compiler-1',
        vocabularySnapshotId: 'system-snapshot-1',
        vocabularySnapshotVersion: 1,
        vocabularySnapshotChecksum: checksum,
        authoredDependencies: [],
        projectionChecksum: checksum,
        projection: {}
      }).success
    ).toBe(false)

    expect(
      characterMechanicsProjectionSchema.safeParse({
        characterId: 'character-1',
        projectionSchemaVersion: 1,
        projectionChecksum: checksum,
        characterStreamVersion: 1,
        authoredVersionVector: [
          {
            subjectKind: 'SPELL',
            subjectId: 'spell-1',
            versionId: 'spell-version-1',
            version: 1,
            checksum
          },
          {
            subjectKind: 'SPELL',
            subjectId: 'spell-1',
            versionId: 'spell-version-2',
            version: 2,
            checksum
          }
        ],
        systemVocabularySnapshotId: 'system-snapshot-1',
        systemVocabularySnapshotVersion: 1,
        systemVocabularySnapshotChecksum: checksum,
        ruleRevisionId: 'dnd5e-2014',
        ruleRevisionChecksum: checksum,
        evaluatorVersion: 'evaluator-1',
        modelContractVersion: 1,
        rulePolicyInput: {},
        rulePolicyOutput: {},
        ruleRegistry: {}
      }).success
    ).toBe(false)
  })
})
