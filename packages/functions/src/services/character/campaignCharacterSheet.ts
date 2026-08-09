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

export type CharacterSheetViewer = 'CHARACTER_OWNER' | 'CAMPAIGN_OWNER'

export interface CharacterSheetCampaignContext {
  viewer: CharacterSheetViewer
  campaignId: string | null
  campaignStatus: 'ACTIVE' | 'ARCHIVED' | null
  attunementSlotOverride: number | null
  adjustments: CharacterSheetAdjustment[]
  secretAdjustmentIds: Set<string>
  conditions: CampaignConditionDto[]
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
    return {
      ...projected,
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
    }
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
  if (!secretMaximumOverride && !secretMaximumModifier) return projected
  return {
    ...projected,
    overview: {
      ...projected.overview,
      ...(secretMaximumOverride ? { maxHitPointsOverride: null } : {}),
      ...(secretMaximumModifier
        ? { maxHitPointsModifier: 0, maxHitPointsModifierAdjustmentId: null }
        : {})
    }
  }
}

export function projectCharacterRestForViewer(
  preview: CharacterRestPreviewResponseDto,
  context: CharacterSheetCampaignContext
): CharacterRestPreviewResponseDto {
  if (
    context.viewer === 'CAMPAIGN_OWNER' ||
    !context.adjustments.some(
      (adjustment) =>
        adjustment.family === 'HIT_POINTS' &&
        adjustment.field === 'MAXIMUM_MODIFIER' &&
        context.secretAdjustmentIds.has(adjustment.id)
    )
  ) {
    return preview
  }
  return {
    ...preview,
    hitPoints: {
      ...preview.hitPoints,
      maximumHitPointModifier: 0,
      canResetMaximumHitPointModifier: false
    }
  }
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
