import {
  checksumCanonicalJson,
  createCampaignRepository,
  type CampaignPlaySettingsRecord,
  type DBLike
} from '@artificer-toolkit/db'
import {
  encounterInitiativePolicySnapshotDtoSchema,
  type EncounterInitiativePolicySnapshotDto
} from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import {
  resolveCurrentInitiativePolicySources,
  resolveEffectiveInitiativePolicySources
} from '../rules/initiativePolicySourceAccess.js'

import { EncounterValidationError } from './encounterErrors.js'

type InitiativeSelection = Pick<
  CampaignPlaySettingsRecord,
  'initiativePolicyDefinitionId' | 'initiativeTieDefinitionId'
>

function exactGraphSnapshot(input: {
  resolved: Awaited<ReturnType<typeof resolveCurrentInitiativePolicySources>>['evaluationGraph']
}) {
  return {
    definitionId: input.resolved.current.id,
    contentSourceId: input.resolved.current.contentSourceId,
    definitionVersion: input.resolved.current.version,
    definitionChecksum: input.resolved.current.checksum,
    contractVersion: input.resolved.current.contractVersion,
    label: input.resolved.current.label,
    document: input.resolved.document
  }
}

export async function resolveEncounterInitiativePolicySnapshot(input: {
  db: DBLike
  campaignId: string
  gameSystemId: string
  settings: InitiativeSelection | null
}): Promise<{
  snapshot: EncounterInitiativePolicySnapshotDto
  checksum: string
} | null> {
  const resolved = await resolveEffectiveInitiativePolicySources({
    db: input.db,
    gameSystemId: input.gameSystemId,
    configuredPolicyDefinitionId: input.settings?.initiativePolicyDefinitionId ?? null,
    configuredTieDefinitionId: input.settings?.initiativeTieDefinitionId ?? null
  }).catch((error: unknown) => {
    throw new EncounterValidationError(
      error instanceof Error ? error.message : 'Initiative policy is invalid.'
    )
  })
  if (resolved === null) return null
  const { policy: currentPolicy, policyDocument } = resolved
  const snapshot = encounterInitiativePolicySnapshotDtoSchema.parse({
    schemaVersion: 1,
    gameSystemId: input.gameSystemId,
    policy: {
      definitionId: currentPolicy.id,
      contentSourceId: currentPolicy.contentSourceId,
      definitionVersion: currentPolicy.version,
      definitionChecksum: currentPolicy.checksum,
      contractVersion: currentPolicy.contractVersion,
      label: currentPolicy.label,
      document: policyDocument
    },
    evaluationGraph: exactGraphSnapshot({
      resolved: resolved.evaluationGraph
    }),
    orderChoiceGraph: exactGraphSnapshot({
      resolved: resolved.orderChoiceGraph
    }),
    tieResolver: exactGraphSnapshot({
      resolved: resolved.selectedTie
    })
  })
  const unavailableSourceIds = await createCampaignRepository(
    input.db
  ).listContentSourceIdsNotEnabledForCampaign({
    campaignId: input.campaignId,
    contentSourceIds: resolved.contentSourceIds
  })
  if (unavailableSourceIds.length > 0) {
    throw new EncounterValidationError(
      'Initiative policy sources are not enabled for this Campaign.'
    )
  }
  return { snapshot, checksum: checksumCanonicalJson(snapshot) }
}
