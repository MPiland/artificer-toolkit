import { liveRoomDefinitionSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import { reusableDefinitionCurrentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_DARKVISION_SENSE_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { RoomCharacterInputs } from './roomInputsFixture.js'

/** The platform Sense definition a room reads for the SRD Sense `senseId` that Features grant. */
export function srdSenseDefinition(senseId: string) {
  const seed = SRD_SENSE_DEFINITIONS.find(({ id }) => id === senseId)
  if (!seed) throw new Error('Missing SRD Sense definition.')
  return liveRoomDefinitionSchema.parse({
    id: seed.id,
    sourceKind: 'PLATFORM',
    definition: reusableDefinitionCurrentDtoSchema.parse({
      id: seed.id,
      gameSystemId: srdSystemRecord.id,
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitionFamilyKey: 'sense',
      label: seed.label,
      description: seed.description,
      document: seed.document,
      checksum: seed.checksum,
      contractVersion: 1,
      version: 1,
      publishedAt: '2026-09-30T00:00:00.000Z',
      publishedBy: crypto.randomUUID()
    })
  })
}

/** The Darkvision definition a room reads for the Race `darkvision` grants. */
export const darkvisionDefinition = srdSenseDefinition(SRD_DARKVISION_SENSE_ID)

/** The SRD System and its vocabulary snapshot as a room reads them for the Campaign. */
export function srdSystemRoomInputs(campaignId: string): RoomCharacterInputs['system'] {
  const systemId = srdSystemRecord.id
  const system = systemAuthoredDtoSchema.parse(srdSystemRecord)
  const vocabularyIdentity = {
    snapshotId: crypto.randomUUID(),
    systemId,
    snapshotVersion: 1,
    schemaVersion: 1,
    document: system
  }
  return {
    kind: 'SYSTEM',
    revisions: [
      { scope: 'SYSTEM', id: systemId, revision: null },
      { scope: 'CAMPAIGN', id: campaignId, revision: null },
      { scope: 'PLAY', id: campaignId, revision: null }
    ],
    system,
    vocabulary: systemVocabularySnapshotSchema.parse({
      ...vocabularyIdentity,
      checksum: checksumCanonicalJson(vocabularyIdentity)
    })
  }
}
