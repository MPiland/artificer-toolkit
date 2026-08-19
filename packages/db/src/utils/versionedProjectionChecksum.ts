import type { CharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { CampaignCharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/campaignCharacterMechanics'
import type { CompiledAuthoredProjection } from '@artificer-toolkit/schema/projections/authoredContent'
import type { EncounterCurrentProjection } from '@artificer-toolkit/schema/projections/encounter'
import type { SceneCurrentProjection } from '@artificer-toolkit/schema/projections/scene'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'

import { checksumCanonicalJson } from './canonicalJson.js'

type CompiledAuthoredProjectionChecksumInput = Pick<
  CompiledAuthoredProjection,
  | 'authoredChecksum'
  | 'authoredDependencies'
  | 'authoredVersion'
  | 'authoredVersionId'
  | 'compilerVersion'
  | 'projection'
  | 'projectionSchemaVersion'
  | 'subjectId'
  | 'subjectKind'
  | 'vocabularySnapshotChecksum'
  | 'vocabularySnapshotId'
  | 'vocabularySnapshotVersion'
> & {
  projectionChecksum?: string
}

export function checksumCompiledAuthoredProjection(
  projection: CompiledAuthoredProjectionChecksumInput
): string {
  const { projectionChecksum: _projectionChecksum, ...checksummed } = projection
  return checksumCanonicalJson(checksummed)
}

export function checksumSystemVocabularySnapshot(
  snapshot: Omit<SystemVocabularySnapshot, 'checksum'> & { checksum?: string }
): string {
  const { checksum: _checksum, ...checksummed } = snapshot
  return checksumCanonicalJson(checksummed)
}

export function checksumCharacterMechanicsProjection(
  projection: CharacterMechanicsProjection
): string {
  const { projectionChecksum: _projectionChecksum, ...checksummed } = projection
  return checksumCanonicalJson(checksummed)
}

type CampaignCharacterMechanicsProjectionChecksumInput = Omit<
  CampaignCharacterMechanicsProjection,
  'projectionChecksum'
> & {
  projectionChecksum?: string
}

export function checksumCampaignCharacterMechanicsProjection(
  projection: CampaignCharacterMechanicsProjectionChecksumInput
): string {
  const { projectionChecksum: _projectionChecksum, ...checksummed } = projection
  return checksumCanonicalJson(checksummed)
}

export function checksumCharacterMechanicsCommandLane(
  projection: Pick<
    CharacterMechanicsProjection,
    | 'authoredVersionVector'
    | 'characterId'
    | 'characterStreamVersion'
    | 'commandStateChecksum'
    | 'evaluatorVersion'
    | 'modelContractVersion'
    | 'projectionSchemaVersion'
    | 'ruleRevisionChecksum'
    | 'ruleRevisionId'
    | 'systemVocabularySnapshotChecksum'
    | 'systemVocabularySnapshotId'
    | 'systemVocabularySnapshotVersion'
  >
): string {
  const {
    authoredVersionVector,
    characterId,
    characterStreamVersion,
    commandStateChecksum,
    evaluatorVersion,
    modelContractVersion,
    projectionSchemaVersion,
    ruleRevisionChecksum,
    ruleRevisionId,
    systemVocabularySnapshotChecksum,
    systemVocabularySnapshotId,
    systemVocabularySnapshotVersion
  } = projection
  return checksumCanonicalJson({
    authoredVersionVector,
    characterId,
    characterStreamVersion,
    commandStateChecksum,
    evaluatorVersion,
    modelContractVersion,
    projectionSchemaVersion,
    ruleRevisionChecksum,
    ruleRevisionId,
    systemVocabularySnapshotChecksum,
    systemVocabularySnapshotId,
    systemVocabularySnapshotVersion
  })
}

export function checksumCharacterMechanicsCommandState(
  commandState: CharacterMechanicsProjection['commandState']
): string {
  return checksumCanonicalJson(commandState)
}

export function checksumEncounterCurrentProjection(
  projection: EncounterCurrentProjection
): string {
  const { projectionChecksum: _projectionChecksum, ...checksummed } = projection
  return checksumCanonicalJson(checksummed)
}

export function checksumSceneCurrentProjection(projection: SceneCurrentProjection): string {
  const { projectionChecksum: _projectionChecksum, ...checksummed } = projection
  return checksumCanonicalJson(checksummed)
}
