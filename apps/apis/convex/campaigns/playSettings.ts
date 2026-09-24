import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignPlaySettingsDtoSchema,
  campaignPlaySettingsOptionsDtoSchema,
  getCampaignPlaySettingsInputSchema,
  saveCampaignPlaySettingsInputSchema,
  type CampaignPlaySettingsDto,
  type CampaignPlaySettingsOptionsDto
} from '@artificer-toolkit/schema/api/campaignSettings'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import { resolveEffectiveInitiativePolicySources } from '@artificer-toolkit/rules-runtime/initiativePolicySourceAccess'
import { resolveCurrentOptionalCombatSources } from '@artificer-toolkit/rules-runtime/optionalCombatSourceAccess'
import { validateOptionalCombatCheckDefinitions } from '@artificer-toolkit/authoring/reusableDefinitions'
import { presentCampaignPlaySettingsOptions } from '@artificer-toolkit/rules-runtime/campaignPlaySettingsOptions'
import { query, type QueryCtx } from '../_generated/server'
import { mutation } from '../lib/mutations'
import type { Doc } from '../_generated/dataModel'
import { requireIdentity } from '../lib/identity'
import { requireRulesCatalogueBinding } from '../content/catalogueBinding'
import { readCurrentSourceDefinitions, readDefinitionRoot } from '../content/definitionStore'
import { requireCampaignAuthority } from './authority'

export async function readSettings(ctx: QueryCtx, campaignId: string) {
  const record = await ctx.db
    .query('campaignPlaySettings')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .unique()
  if (!record) throw new Error('Campaign play settings are unavailable.')
  const { _id, _creationTime, ...stored } = record
  return { rowId: _id, settings: campaignPlaySettingsDtoSchema.parse(stored) }
}

async function readPlaySettingsSourceAccess(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  userId: string
) {
  const { system, sourceIds } = await requireRulesCatalogueBinding(ctx, {
    systemId: campaign.gameSystemId,
    primaryRulesCatalogueId: campaign.primaryRulesCatalogueId,
    additionalRulesCatalogueIds: campaign.additionalRulesCatalogueIds
  })
  const definitions = {
    requireCurrent: async (definitionId: string) => {
      const root = await readDefinitionRoot(ctx, definitionId, userId)
      if (
        !root?.current ||
        root.gameSystemId !== campaign.gameSystemId ||
        !sourceIds.has(root.contentSourceId)
      )
        throw new Error(
          `Rule definition is not enabled for this Campaign. Definition: ${definitionId}`
        )
      return root.current
    }
  }
  return { definitions, sourceIds, system }
}

async function resolveOptionalCombatSources(
  access: Awaited<ReturnType<typeof readPlaySettingsSourceAccess>>,
  gameSystemId: string,
  definitionIds: readonly string[]
) {
  try {
    return await resolveCurrentOptionalCombatSources({
      definitions: access.definitions,
      readSystemVocabulary: async () => access.system,
      validateCheckDefinitions: validateOptionalCombatCheckDefinitions,
      gameSystemId,
      definitionIds
    })
  } catch (cause) {
    throw new Error(
      `${cause instanceof Error ? cause.message : 'Optional combat definitions are unavailable.'} Campaign optional combat definitions: ${definitionIds.join(', ')}.`,
      { cause }
    )
  }
}

export async function resolveEncounterOptionalCombatSources(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  userId: string,
  definitionIds: readonly string[]
) {
  const access = await readPlaySettingsSourceAccess(ctx, campaign, userId)
  return {
    sourceIds: access.sourceIds,
    optionalCombat: await resolveOptionalCombatSources(access, campaign.gameSystemId, definitionIds)
  }
}

export async function resolvePlaySettingsSources(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  userId: string,
  settings: Pick<
    CampaignPlaySettingsDto,
    'initiativePolicyDefinitionId' | 'initiativeTieDefinitionId' | 'optionalCombatRuleDefinitionIds'
  >
) {
  const access = await readPlaySettingsSourceAccess(ctx, campaign, userId)
  let initiative: Awaited<ReturnType<typeof resolveEffectiveInitiativePolicySources>>
  try {
    initiative = await resolveEffectiveInitiativePolicySources({
      definitions: access.definitions,
      readSystem: async () => access.system,
      gameSystemId: campaign.gameSystemId,
      configuredPolicyDefinitionId: settings.initiativePolicyDefinitionId,
      configuredTieDefinitionId: settings.initiativeTieDefinitionId
    })
  } catch (cause) {
    const policyId =
      settings.initiativePolicyDefinitionId ??
      ('initiativePolicy' in access.system
        ? access.system.initiativePolicy?.defaultDefinitionId
        : undefined)
    throw new Error(
      `${cause instanceof Error ? cause.message : 'Initiative policy is unavailable.'} Campaign initiative policy: ${policyId ?? 'System default'}.`,
      { cause }
    )
  }
  const optionalCombat = await resolveOptionalCombatSources(
    access,
    campaign.gameSystemId,
    settings.optionalCombatRuleDefinitionIds
  )
  return { sourceIds: access.sourceIds, initiative, optionalCombat }
}

export const get = query({
  args: zodToConvexFields(getCampaignPlaySettingsInputSchema.shape),
  returns: zodToConvex(campaignPlaySettingsDtoSchema),
  handler: async (ctx, args): Promise<CampaignPlaySettingsDto> => {
    const { userId } = await requireIdentity(ctx)
    const { campaignId } = getCampaignPlaySettingsInputSchema.parse(args)
    const { campaign, membership } = await requireCampaignAuthority(ctx, campaignId, userId)
    const { settings } = await readSettings(ctx, campaign.id)
    if (membership.role === 'OWNER') return settings
    for (const field of [
      'absentCharacterPolicy',
      'contentGuidance',
      'allowedContentRules',
      'tableConduct',
      'contentBoundaries',
      'liveSafetyMethod'
    ] as const) {
      const value = settings[field]
      if (value !== null)
        settings[field] = presentCampaignPlainText(value, campaign.contentMaturity)
    }
    return campaignPlaySettingsDtoSchema.parse(settings)
  }
})

export const options = query({
  args: zodToConvexFields(getCampaignPlaySettingsInputSchema.shape),
  returns: zodToConvex(campaignPlaySettingsOptionsDtoSchema),
  handler: async (ctx, args): Promise<CampaignPlaySettingsOptionsDto> => {
    const { userId } = await requireIdentity(ctx)
    const { campaignId } = getCampaignPlaySettingsInputSchema.parse(args)
    const { campaign } = await requireCampaignAuthority(ctx, campaignId, userId)
    const { system, sources } = await requireRulesCatalogueBinding(ctx, {
      systemId: campaign.gameSystemId,
      primaryRulesCatalogueId: campaign.primaryRulesCatalogueId,
      additionalRulesCatalogueIds: campaign.additionalRulesCatalogueIds
    })
    const definitions = await readCurrentSourceDefinitions(ctx, sources, userId, system.userId)
    return presentCampaignPlaySettingsOptions(definitions)
  }
})

export const save = mutation({
  args: zodToConvexFields(saveCampaignPlaySettingsInputSchema.shape),
  returns: zodToConvex(campaignPlaySettingsDtoSchema),
  handler: async (ctx, args): Promise<CampaignPlaySettingsDto> => {
    const { userId } = await requireIdentity(ctx)
    const { expectedVersion, ...input } = saveCampaignPlaySettingsInputSchema.parse(args)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER') throw new Error('You cannot perform this Campaign action.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const { rowId, settings } = await readSettings(ctx, campaign.id)
    if (settings.version !== expectedVersion)
      throw new Error('Campaign play settings changed before saving.')

    await resolvePlaySettingsSources(ctx, campaign, userId, input)

    const next = campaignPlaySettingsDtoSchema.parse({
      ...input,
      version: settings.version + 1,
      updatedAt: new Date().toISOString()
    })
    await ctx.db.replace(rowId, next)
    return next
  }
})
