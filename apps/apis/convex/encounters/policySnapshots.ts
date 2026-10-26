import { encounterInitiativePolicySnapshotDtoSchema } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import { encounterOptionalCombatSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/optionalCombat'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import {
  readSettings,
  resolveEncounterOptionalCombatSources,
  resolvePlaySettingsSources
} from '../campaigns/playSettings'

function pinDefinition<TDocument>(current: ReusableDefinitionCurrentDto, document: TDocument) {
  return {
    definitionId: current.id,
    contentSourceId: current.contentSourceId,
    definitionVersion: current.version,
    definitionChecksum: current.checksum,
    contractVersion: current.contractVersion,
    label: current.label,
    document
  }
}

/** The Run command authorizes its Campaign before freezing these current policy sources. */
export async function snapshotEncounterPolicies(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  userId: string
) {
  const { settings } = await readSettings(ctx, campaign.id)
  const { initiative, optionalCombat } = await resolvePlaySettingsSources(
    ctx,
    campaign,
    userId,
    settings
  )
  const initiativePolicySnapshot =
    initiative === null
      ? null
      : encounterInitiativePolicySnapshotDtoSchema.parse({
          schemaVersion: 1,
          gameSystemId: campaign.gameSystemId,
          policy: pinDefinition(initiative.policy, initiative.policyDocument),
          evaluationGraph: pinDefinition(
            initiative.evaluationGraph.current,
            initiative.evaluationGraph.document
          ),
          orderChoiceGraph: pinDefinition(
            initiative.orderChoiceGraph.current,
            initiative.orderChoiceGraph.document
          ),
          tieResolver: pinDefinition(
            initiative.selectedTie.current,
            initiative.selectedTie.document
          )
        })
  const optionalCombatSnapshot = encounterOptionalCombatSnapshotDtoSchema.parse({
    schemaVersion: 1,
    gameSystemId: campaign.gameSystemId,
    definitions: optionalCombat.map(({ current, document }) => pinDefinition(current, document))
  })
  return {
    automationMode: settings.automationMode,
    trackAmmunition: settings.trackAmmunition,
    zoneNoticing: settings.zoneNoticing,
    initiativePolicySnapshot,
    initiativePolicySnapshotChecksum:
      initiativePolicySnapshot === null ? null : checksumCanonicalJson(initiativePolicySnapshot),
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot)
  }
}

/** The Run command authorizes its Campaign before freezing these current policy sources. */
export async function snapshotEncounterOptionalCombatPolicies(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  userId: string,
  definitionIds: string[]
) {
  const { optionalCombat } = await resolveEncounterOptionalCombatSources(
    ctx,
    campaign,
    userId,
    definitionIds
  )
  const optionalCombatSnapshot = encounterOptionalCombatSnapshotDtoSchema.parse({
    schemaVersion: 1,
    gameSystemId: campaign.gameSystemId,
    definitions: optionalCombat.map(({ current, document }) => pinDefinition(current, document))
  })
  return {
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot)
  }
}
