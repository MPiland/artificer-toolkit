import {
  createCampaignSettingsRepository,
  createCampaignRepository,
  createReusableDefinitionRepository,
  withTransaction,
  type DBLike
} from '@artificer-toolkit/db'
import {
  campaignPlaySettingsOptionsDtoSchema,
  campaignPlaySettingsDtoSchema,
  saveCampaignPlaySettingsInputSchema,
  type CampaignPlaySettingsOptionsDto,
  type CampaignPlaySettingsDto,
  type SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaigns'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import { initiativePolicyReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/initiativePolicy'
import { dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/optionalCombat'
import {
  InitiativePolicySourceError,
  resolveEffectiveInitiativePolicySources
} from '../rules/initiativePolicySourceAccess.js'
import {
  OptionalCombatSourceError,
  resolveCurrentOptionalCombatSources
} from '../rules/optionalCombatSourceAccess.js'
import {
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  CampaignConflictError,
  CampaignNotFoundError,
  resolveCampaignAuthority
} from './campaignService.js'

function presentSettings(
  settings: CampaignPlaySettingsDto,
  maturity: 'STANDARD' | 'MATURE',
  privateOwnerView: boolean
): CampaignPlaySettingsDto {
  if (privateOwnerView) return settings
  const present = (value: string | null) =>
    value === null ? null : presentCampaignPlainText(value, maturity)
  return {
    ...settings,
    absentCharacterPolicy: present(settings.absentCharacterPolicy),
    contentGuidance: present(settings.contentGuidance),
    allowedContentRules: present(settings.allowedContentRules),
    tableConduct: present(settings.tableConduct),
    contentBoundaries: present(settings.contentBoundaries),
    liveSafetyMethod: present(settings.liveSafetyMethod)
  }
}

export async function getCampaignPlaySettings(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<CampaignPlaySettingsDto> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  const settings = await createCampaignSettingsRepository(db).find(campaignId)
  if (!settings) throw new CampaignNotFoundError()
  return presentSettings(
    campaignPlaySettingsDtoSchema.parse(settings),
    authority.campaign.contentMaturity,
    authority.membership.role === 'OWNER'
  )
}

export async function getCampaignPlaySettingsOptions(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<CampaignPlaySettingsOptionsDto> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  const definitions = await createReusableDefinitionRepository(db).listCurrentAvailableToCampaign({
    campaignId,
    gameSystemId: authority.campaign.gameSystemId
  })
  const byId = new Map(definitions.map((definition) => [definition.id, definition]))
  const initiativePolicies = definitions.flatMap((definition) => {
    const policy = initiativePolicyReusableDefinitionDocumentDtoSchema.safeParse(
      definition.document
    )
    if (!policy.success) return []
    const tieResolvers = policy.data.tieResolvers.flatMap((pin) => {
      const current = byId.get(pin.definitionId)
      return current ? [{ definitionId: current.id, label: current.label }] : []
    })
    if (tieResolvers.length !== policy.data.tieResolvers.length) return []
    return [
      {
        definitionId: definition.id,
        label: definition.label,
        defaultTieResolverDefinitionId: policy.data.defaultTieResolverDefinitionId,
        tieResolvers
      }
    ]
  })
  const optionalCombatRules = definitions.flatMap((definition) => {
    const rule = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.safeParse(
      definition.document
    )
    return rule.success
      ? [{ definitionId: definition.id, label: definition.label, kind: rule.data.kind }]
      : []
  })
  return campaignPlaySettingsOptionsDtoSchema.parse({ initiativePolicies, optionalCombatRules })
}

export async function saveCampaignPlaySettings(
  db: DBLike,
  userId: string,
  rawInput: SaveCampaignPlaySettingsInput
): Promise<CampaignPlaySettingsDto> {
  const input = saveCampaignPlaySettingsInputSchema.parse(rawInput)
  const settings = await withTransaction(db, async (trx) => {
    if (!(await createCampaignRepository(trx).lockCampaign(input.campaignId))) {
      throw new CampaignNotFoundError()
    }
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    {
      let sources: Awaited<ReturnType<typeof resolveEffectiveInitiativePolicySources>>
      try {
        sources = await resolveEffectiveInitiativePolicySources({
          db: trx,
          gameSystemId: authority.campaign.gameSystemId,
          configuredPolicyDefinitionId: input.initiativePolicyDefinitionId,
          configuredTieDefinitionId: input.initiativeTieDefinitionId
        })
      } catch (error) {
        if (error instanceof InitiativePolicySourceError) {
          throw new CampaignConflictError(error.message)
        }
        throw error
      }
      if (sources !== null) {
        const unavailableSourceIds = await createCampaignRepository(
          trx
        ).listContentSourceIdsNotEnabledForCampaign({
          campaignId: input.campaignId,
          contentSourceIds: sources.contentSourceIds
        })
        if (unavailableSourceIds.length > 0) {
          throw new CampaignConflictError(
            'Initiative policy sources are not enabled for this Campaign.'
          )
        }
      }
    }
    {
      let sources: Awaited<ReturnType<typeof resolveCurrentOptionalCombatSources>>
      try {
        sources = await resolveCurrentOptionalCombatSources({
          db: trx,
          gameSystemId: authority.campaign.gameSystemId,
          definitionIds: input.optionalCombatRuleDefinitionIds
        })
      } catch (error) {
        if (error instanceof OptionalCombatSourceError) {
          throw new CampaignConflictError(error.message)
        }
        throw error
      }
      const unavailableSourceIds = await createCampaignRepository(
        trx
      ).listContentSourceIdsNotEnabledForCampaign({
        campaignId: input.campaignId,
        contentSourceIds: [
          ...new Set(sources.map((source) => source.current.contentSourceId))
        ].sort((left, right) => left.localeCompare(right))
      })
      if (unavailableSourceIds.length > 0) {
        throw new CampaignConflictError(
          'Optional combat definition sources are not enabled for this Campaign.'
        )
      }
    }
    const saved = await createCampaignSettingsRepository(trx).save(input)
    if (!saved) throw new CampaignConflictError('Campaign play settings changed before saving.')
    return saved
  })
  return campaignPlaySettingsDtoSchema.parse(settings)
}
