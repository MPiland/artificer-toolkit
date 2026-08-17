import {
  createCampaignAdjustmentsRepository,
  createCampaignContentRepository,
  type CampaignAdjustment,
  type DBLike
} from '@artificer-toolkit/db'
import {
  campaignConditionValueDtoSchema,
  type CampaignConditionDto
} from '@artificer-toolkit/schema/api/campaigns'
import {
  characterSheetAdjustmentCommandDtoSchema,
  type CharacterSheetAdjustmentCommandDto
} from '@artificer-toolkit/schema/api/characterSheet'
import type {
  CharacterRestPreviewResponseDto,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import type { CharacterSheetAdjustment } from '@artificer-toolkit/shared/character'
import type { CharacterEvent } from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  assertActiveCampaignMember,
  resolveCampaignAuthority
} from '../campaign/campaignService.js'
import { presentCampaignCharacterText } from './campaignCharacterPresentation.js'

export type CharacterSheetViewer = 'CHARACTER_OWNER' | 'CAMPAIGN_OWNER'

export interface CharacterSheetCampaignContext {
  viewer: CharacterSheetViewer
  campaignId: string | null
  campaignStatus: 'ACTIVE' | 'ARCHIVED' | null
  contentMaturity: 'STANDARD' | 'MATURE' | null
  attunementSlotOverride: number | null
  adjustments: CharacterSheetAdjustment[]
  secretAdjustmentIds: Set<string>
  conditions: CampaignConditionDto[]
}

export interface CharacterLiveSessionRuleContext {
  adjustments: CharacterSheetAdjustment[]
  additionalConditions: Array<{ conditionTypeId: string; notes?: string }>
  attunementSlotOverride: number | null
}

function accessError(characterId: string): Error {
  const error = new Error(`Character "${characterId}" cannot be viewed by the current user.`)
  error.name = 'AuthoredContentOwnershipError'
  return error
}

function toSheetAdjustment(record: CampaignAdjustment): CharacterSheetAdjustment {
  const adjustment = characterSheetAdjustmentCommandDtoSchema.parse(record.payload)
  return {
    ...adjustment,
    id: record.id,
    characterId: record.characterId,
    createdBy: record.createdBy,
    updatedBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }
}

function toCondition(record: CampaignAdjustment): CampaignConditionDto {
  return {
    id: record.id,
    campaignId: record.campaignId,
    characterId: record.characterId,
    ...campaignConditionValueDtoSchema.parse(record.payload),
    visibility: record.visibility,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }
}

export async function resolveCharacterLiveSessionRuleContext(
  db: DBLike,
  characterId: string,
  campaign: { id: string; attunementSlotOverride: number | null }
): Promise<CharacterLiveSessionRuleContext | null> {
  const assignment = await createCampaignContentRepository(db).findAssignedCampaign(characterId)
  if (assignment?.campaignId !== campaign.id) return null

  const records = await createCampaignAdjustmentsRepository(db).listAdjustments(
    campaign.id,
    characterId
  )
  return {
    adjustments: records.filter((record) => record.family !== 'CONDITION').map(toSheetAdjustment),
    additionalConditions: records
      .filter((record) => record.family === 'CONDITION')
      .map(toCondition)
      .map(({ conditionTypeId, notes }) => ({
        conditionTypeId,
        ...(notes ? { notes } : {})
      })),
    attunementSlotOverride: campaign.attunementSlotOverride
  }
}

export async function resolveCharacterSheetCampaignContext(
  db: DBLike,
  character: CharacterAuthored,
  userId: string
): Promise<CharacterSheetCampaignContext> {
  const assignment = await createCampaignContentRepository(db).findAssignedCampaign(character.id)
  if (!assignment) {
    if (character.userId !== userId) throw accessError(character.id)
    return {
      viewer: 'CHARACTER_OWNER',
      campaignId: null,
      campaignStatus: null,
      contentMaturity: null,
      attunementSlotOverride: null,
      adjustments: [],
      secretAdjustmentIds: new Set(),
      conditions: []
    }
  }

  const authority = await resolveCampaignAuthority(db, assignment.campaignId, userId)
  assertActiveCampaignMember(authority)
  const viewer =
    character.userId === userId
      ? 'CHARACTER_OWNER'
      : authority.membership.role === 'OWNER'
        ? 'CAMPAIGN_OWNER'
        : null
  if (!viewer) throw accessError(character.id)

  const records = await createCampaignAdjustmentsRepository(db).listAdjustments(
    assignment.campaignId,
    character.id
  )
  return {
    viewer,
    campaignId: assignment.campaignId,
    campaignStatus: authority.campaign.status,
    contentMaturity: authority.campaign.contentMaturity,
    attunementSlotOverride: authority.campaign.attunementSlotOverride,
    adjustments: records.filter((record) => record.family !== 'CONDITION').map(toSheetAdjustment),
    secretAdjustmentIds: new Set(
      records
        .filter((record) => record.family !== 'CONDITION' && record.visibility === 'SECRET')
        .map((record) => record.id)
    ),
    conditions: records.filter((record) => record.family === 'CONDITION').map(toCondition)
  }
}

export function sameCharacterSheetAdjustmentSlot(
  adjustment: CharacterSheetAdjustment,
  input: CharacterSheetAdjustment | CharacterSheetAdjustmentCommandDto
): boolean {
  if (adjustment.family !== input.family) return false
  switch (input.family) {
    case 'ABILITY':
      return (
        adjustment.family === 'ABILITY' &&
        input.family === 'ABILITY' &&
        adjustment.ability === input.ability &&
        adjustment.field === input.field
      )
    case 'SAVING_THROW':
      return (
        adjustment.family === 'SAVING_THROW' &&
        input.family === 'SAVING_THROW' &&
        adjustment.ability === input.ability &&
        adjustment.field === input.field
      )
    case 'SKILL':
      return (
        adjustment.family === 'SKILL' &&
        input.family === 'SKILL' &&
        adjustment.skillId === input.skillId &&
        adjustment.field === input.field
      )
    case 'PASSIVE':
      return (
        adjustment.family === 'PASSIVE' &&
        input.family === 'PASSIVE' &&
        adjustment.skillId === input.skillId
      )
    case 'SENSE':
      return (
        adjustment.family === 'SENSE' &&
        input.family === 'SENSE' &&
        adjustment.senseId === input.senseId
      )
    case 'MOVEMENT':
      return (
        adjustment.family === 'MOVEMENT' &&
        input.family === 'MOVEMENT' &&
        adjustment.speedId === input.speedId
      )
    case 'HIT_POINTS':
      return (
        adjustment.family === 'HIT_POINTS' &&
        input.family === 'HIT_POINTS' &&
        adjustment.field === input.field
      )
    case 'SPELL':
      return (
        adjustment.family === 'SPELL' &&
        input.family === 'SPELL' &&
        adjustment.source.spellId === input.source?.spellId &&
        adjustment.source.sourceKind === input.source?.sourceKind &&
        adjustment.source.sourceInstanceId === input.source?.sourceInstanceId &&
        adjustment.field === input.field
      )
    case 'ITEM':
      return (
        adjustment.family === 'ITEM' &&
        input.family === 'ITEM' &&
        adjustment.itemInstanceId === input.itemInstanceId &&
        adjustment.field === input.field
      )
    case 'COMPANION':
      return (
        adjustment.family === 'COMPANION' &&
        input.family === 'COMPANION' &&
        adjustment.companionInstanceId === input.companionInstanceId &&
        adjustment.field === input.field
      )
    case 'DEFENSE':
      return (
        adjustment.family === 'DEFENSE' &&
        input.family === 'DEFENSE' &&
        adjustment.defenseKind === input.defenseKind &&
        adjustment.damageTypeId === input.damageTypeId
      )
    case 'PROFICIENCY':
      return (
        adjustment.family === 'PROFICIENCY' &&
        input.family === 'PROFICIENCY' &&
        adjustment.proficiencyKind === input.proficiencyKind &&
        adjustment.targetId === input.targetId
      )
  }
}

export function getCharacterSheetAdjustmentSlotKey(
  adjustment: CharacterSheetAdjustment | CharacterSheetAdjustmentCommandDto
): string {
  switch (adjustment.family) {
    case 'ABILITY':
    case 'SAVING_THROW':
      return JSON.stringify([adjustment.family, adjustment.ability, adjustment.field])
    case 'SKILL':
      return JSON.stringify([adjustment.family, adjustment.skillId, adjustment.field])
    case 'PASSIVE':
      return JSON.stringify([adjustment.family, adjustment.skillId])
    case 'SENSE':
      return JSON.stringify([adjustment.family, adjustment.senseId])
    case 'MOVEMENT':
      return JSON.stringify([adjustment.family, adjustment.speedId])
    case 'HIT_POINTS':
      return JSON.stringify([adjustment.family, adjustment.field])
    case 'SPELL':
      return JSON.stringify([
        adjustment.family,
        adjustment.source.spellId,
        adjustment.source.sourceKind,
        adjustment.source.sourceInstanceId,
        adjustment.field
      ])
    case 'ITEM':
      return JSON.stringify([adjustment.family, adjustment.itemInstanceId, adjustment.field])
    case 'COMPANION':
      return JSON.stringify([adjustment.family, adjustment.companionInstanceId, adjustment.field])
    case 'DEFENSE':
      return JSON.stringify([adjustment.family, adjustment.defenseKind, adjustment.damageTypeId])
    case 'PROFICIENCY':
      return JSON.stringify([adjustment.family, adjustment.proficiencyKind, adjustment.targetId])
  }
}

export function mergeCampaignSheetAdjustments(
  characterAdjustments: readonly CharacterSheetAdjustment[],
  campaignAdjustments: readonly CharacterSheetAdjustment[]
): CharacterSheetAdjustment[] {
  return [
    ...characterAdjustments.filter(
      (adjustment) =>
        !campaignAdjustments.some((campaign) =>
          sameCharacterSheetAdjustmentSlot(adjustment, campaign)
        )
    ),
    ...campaignAdjustments
  ]
}

export function getCharacterSheetDisplayAdjustments(
  characterAdjustments: readonly CharacterSheetAdjustment[],
  context: CharacterSheetCampaignContext
): CharacterSheetAdjustment[] {
  if (context.viewer === 'CAMPAIGN_OWNER') {
    return mergeCampaignSheetAdjustments(characterAdjustments, context.adjustments)
  }
  const visible = context.adjustments.filter((adjustment) => {
    return !context.secretAdjustmentIds.has(adjustment.id)
  })
  return [
    ...characterAdjustments.filter(
      (adjustment) =>
        !context.adjustments.some((campaign) =>
          sameCharacterSheetAdjustmentSlot(adjustment, campaign)
        )
    ),
    ...visible
  ]
}

export function getVisibleCampaignConditions(
  context: CharacterSheetCampaignContext
): Array<{ conditionTypeId: string; notes?: string }> {
  return context.conditions
    .filter(
      (condition) => context.viewer === 'CAMPAIGN_OWNER' || condition.visibility === 'VISIBLE'
    )
    .map(({ conditionTypeId, notes }) => ({
      conditionTypeId,
      ...(notes ? { notes } : {})
    }))
}

export function projectCharacterSheetForViewer(
  sheet: CharacterSheetResponseDto,
  context: CharacterSheetCampaignContext
): CharacterSheetResponseDto {
  const projected = {
    ...sheet,
    meta: {
      ...sheet.meta,
      campaignId: context.campaignId,
      viewer: context.viewer,
      capabilities:
        context.viewer === 'CHARACTER_OWNER'
          ? {
              managePlayState: true,
              managePrivateNotes: true,
              manageInventory: true,
              openBuilder: true
            }
          : {
              managePlayState: context.campaignStatus === 'ACTIVE',
              managePrivateNotes: false,
              manageInventory: context.campaignStatus === 'ACTIVE',
              openBuilder: false
            }
    }
  }
  if (context.viewer === 'CAMPAIGN_OWNER') {
    const inventoryItems = projected.inventory.items.map((item) => {
      const sanitized = {
        ...item,
        label: item.equipmentLabel ?? item.label
      }
      delete sanitized.customName
      delete sanitized.notes
      return sanitized
    })
    const extras = projected.extras.items.map((extra) => {
      const sanitized = {
        ...extra,
        displayName: extra.authoredName
      }
      delete sanitized.customName
      delete sanitized.notes
      return sanitized
    })
    const spells = projected.spells.spells.map((spell) => ({
      ...spell,
      sources: spell.sources?.map((source) => {
        const sanitized = { ...source }
        delete sanitized.customName
        delete sanitized.notes
        return sanitized
      })
    }))
    const activeGroups = projected.spells.activeGroups.map((group) => ({
      ...group,
      entries: group.entries.map((entry) => ({
        ...entry,
        displayName: spells.find((spell) => spell.id === entry.spellId)?.label ?? entry.displayName
      }))
    }))
    const resources = projected.resources.items.map((resource) => {
      if (!('itemInstanceId' in resource.owner)) return resource
      const itemInstanceId = resource.owner.itemInstanceId
      const item = inventoryItems.find((candidate) => candidate.id === itemInstanceId)
      if (!item) return resource
      return {
        ...resource,
        label: `${item.label} charges`,
        sourceLabel: item.label
      }
    })
    const actions = projected.actions.items.map((action) => {
      const item = projected.inventory.items.find(
        (candidate) =>
          candidate.customName !== undefined &&
          (candidate.customName === action.sourceLabel ||
            action.sourceLabel?.startsWith(`${candidate.customName} #`))
      )
      if (!item?.equipmentLabel || !item.customName || !action.sourceLabel) return action
      return {
        ...action,
        sourceLabel: `${item.equipmentLabel}${action.sourceLabel.slice(item.customName.length)}`
      }
    })
    const referenceFeatures = projected.reference.features.map((feature) => {
      if (feature.source.kind !== 'EQUIPMENT_INSTANCE') return feature
      const itemInstanceId = feature.source.itemInstanceId
      const item = inventoryItems.find((candidate) => candidate.id === itemInstanceId)
      return item ? { ...feature, sourceLabel: item.label } : feature
    })
    return presentCampaignCharacterText(
      {
        ...projected,
        inventory: {
          ...projected.inventory,
          items: inventoryItems,
          containers: projected.inventory.containers?.map((container) => ({
            ...container,
            label: inventoryItems.find((item) => item.id === container.id)?.label ?? container.label
          }))
        },
        extras: {
          ...projected.extras,
          items: extras
        },
        actions: {
          ...projected.actions,
          items: actions
        },
        reference: {
          ...projected.reference,
          features: referenceFeatures
        },
        resources: {
          ...projected.resources,
          items: resources
        },
        spells: {
          ...projected.spells,
          activeGroups,
          spells
        },
        notes: {
          ...projected.notes,
          notes: undefined,
          groups: undefined,
          items: undefined
        },
        meta: {
          ...projected.meta,
          hasBuilderDraft: false
        }
      },
      context.contentMaturity
    )
  }
  const secretMaximumOverride = context.adjustments.some(
    (adjustment) =>
      adjustment.family === 'HIT_POINTS' &&
      adjustment.field === 'MAXIMUM_OVERRIDE' &&
      context.secretAdjustmentIds.has(adjustment.id)
  )
  const secretMaximumModifier = context.adjustments.some(
    (adjustment) =>
      adjustment.family === 'HIT_POINTS' &&
      adjustment.field === 'MAXIMUM_MODIFIER' &&
      context.secretAdjustmentIds.has(adjustment.id)
  )
  if (!secretMaximumOverride && !secretMaximumModifier) {
    return presentCampaignCharacterText(projected, context.contentMaturity)
  }
  return presentCampaignCharacterText(
    {
      ...projected,
      overview: {
        ...projected.overview,
        ...(secretMaximumOverride ? { maxHitPointsOverride: null } : {}),
        ...(secretMaximumModifier
          ? { maxHitPointsModifier: 0, maxHitPointsModifierAdjustmentId: null }
          : {})
      }
    },
    context.contentMaturity
  )
}

export function projectCharacterRestForViewer(
  preview: CharacterRestPreviewResponseDto,
  context: CharacterSheetCampaignContext
): CharacterRestPreviewResponseDto {
  if (context.viewer === 'CAMPAIGN_OWNER') {
    return presentCampaignCharacterText(
      {
        ...preview,
        hitPoints: {
          ...preview.hitPoints,
          maximumHitPointModifier: 0,
          canResetMaximumHitPointModifier: false
        }
      },
      context.contentMaturity
    )
  }
  if (
    !context.adjustments.some(
      (adjustment) =>
        adjustment.family === 'HIT_POINTS' &&
        adjustment.field === 'MAXIMUM_MODIFIER' &&
        context.secretAdjustmentIds.has(adjustment.id)
    )
  )
    return presentCampaignCharacterText(preview, context.contentMaturity)
  return presentCampaignCharacterText(
    {
      ...preview,
      hitPoints: {
        ...preview.hitPoints,
        maximumHitPointModifier: 0,
        canResetMaximumHitPointModifier: false
      }
    },
    context.contentMaturity
  )
}

export function filterCharacterHistoryForViewer(
  events: readonly CharacterEvent[],
  characterOwnerId: string,
  viewer: CharacterSheetViewer
): CharacterEvent[] {
  return viewer === 'CAMPAIGN_OWNER'
    ? [...events]
    : events.filter((event) => event.actorId === characterOwnerId)
}
