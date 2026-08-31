import { checksumCanonicalJson, createCampaignRepository, type DBLike } from '@artificer-toolkit/db'
import {
  encounterOptionalCombatSnapshotDtoSchema,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { resolveCurrentOptionalCombatSources } from '../rules/optionalCombatSourceAccess.js'

import { EncounterValidationError } from './encounterErrors.js'

export async function resolveEncounterOptionalCombatSnapshot(input: {
  db: DBLike
  campaignId: string
  gameSystemId: string
  definitionIds: readonly string[]
}): Promise<{ snapshot: EncounterOptionalCombatSnapshotDto; checksum: string }> {
  const resolved = await resolveCurrentOptionalCombatSources({
    db: input.db,
    gameSystemId: input.gameSystemId,
    definitionIds: input.definitionIds
  }).catch((error: unknown) => {
    throw new EncounterValidationError(
      error instanceof Error ? error.message : 'Optional combat policy is invalid.'
    )
  })
  const unavailableSourceIds = await createCampaignRepository(
    input.db
  ).listContentSourceIdsNotEnabledForCampaign({
    campaignId: input.campaignId,
    contentSourceIds: [
      ...new Set(resolved.map((definition) => definition.current.contentSourceId))
    ].sort((left, right) => left.localeCompare(right))
  })
  if (unavailableSourceIds.length > 0) {
    throw new EncounterValidationError(
      'Optional combat definition sources are not enabled for this Campaign.'
    )
  }
  const snapshot = encounterOptionalCombatSnapshotDtoSchema.parse({
    schemaVersion: 1,
    gameSystemId: input.gameSystemId,
    definitions: resolved.map(({ current, document }) => ({
      definitionId: current.id,
      contentSourceId: current.contentSourceId,
      definitionVersion: current.version,
      definitionChecksum: current.checksum,
      contractVersion: current.contractVersion,
      label: current.label,
      document
    }))
  })
  return { snapshot, checksum: checksumCanonicalJson(snapshot) }
}
