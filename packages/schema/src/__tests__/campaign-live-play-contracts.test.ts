import { describe, expect, it } from 'vitest'

import {
  campaignAnnouncementDtoSchema,
  campaignPlaySettingsDtoSchema,
  createCampaignAnnouncementInputSchema,
  inventoryOwnerRefDtoSchema,
  resetCampaignClockInputSchema
} from '../api/campaigns.js'
import {
  campaignAnnouncementNotificationDataSchema,
  notificationIntentDataSchema
} from '../api/notifications.js'

const uuid = '00000000-0000-4000-8000-000000000001'

describe('Campaign live-play contracts', () => {
  it('accepts Vehicle inventory ownership and bounded Campaign settings', () => {
    expect(inventoryOwnerRefDtoSchema.parse({ kind: 'VEHICLE', vehicleId: uuid })).toEqual({
      kind: 'VEHICLE',
      vehicleId: uuid
    })
    expect(
      campaignPlaySettingsDtoSchema.safeParse({
        campaignId: uuid,
        normalCadenceDays: 0,
        expectedDurationMinutes: null,
        quorum: null,
        absentCharacterPolicy: null,
        contentGuidance: null,
        allowedContentRules: null,
        tableConduct: null,
        contentBoundaries: null,
        safetyPractices: [],
        liveSafetyMethod: null,
        version: 0,
        updatedAt: '2026-08-12T17:00:00.000Z'
      }).success
    ).toBe(false)
  })

  it('defaults omitted automation settings and rejects invalid modes', () => {
    const base = {
      campaignId: uuid,
      normalCadenceDays: null,
      expectedDurationMinutes: null,
      quorum: null,
      absentCharacterPolicy: null,
      contentGuidance: null,
      allowedContentRules: null,
      tableConduct: null,
      contentBoundaries: null,
      safetyPractices: [],
      liveSafetyMethod: null,
      version: 0,
      updatedAt: '2026-08-12T17:00:00.000Z'
    }

    expect(campaignPlaySettingsDtoSchema.parse(base)).toMatchObject({
      automationMode: 'ASSISTED',
      manualReminderMode: 'OFF'
    })
    expect(
      campaignPlaySettingsDtoSchema.safeParse({ ...base, automationMode: 'SUGGESTIVE' }).success
    ).toBe(false)
    // Auto-rolling is a per-person preference now, not a Campaign automation mode.
    expect(
      campaignPlaySettingsDtoSchema.safeParse({ ...base, automationMode: 'AUTOMATIC' }).success
    ).toBe(false)
    expect(
      campaignPlaySettingsDtoSchema.safeParse({ ...base, manualReminderMode: 'LOUD' }).success
    ).toBe(false)
  })

  it('requires correction reasons for clock resets', () => {
    expect(
      resetCampaignClockInputSchema.safeParse({
        campaignId: uuid,
        commandId: uuid,
        expectedVersion: 1,
        day: 1,
        minuteOfDay: 0,
        correctionReason: 'Correct the calendar origin.'
      }).success
    ).toBe(true)
    expect(
      resetCampaignClockInputSchema.safeParse({
        campaignId: uuid,
        commandId: uuid,
        expectedVersion: 1,
        day: 1,
        minuteOfDay: 0,
        correctionReason: ''
      }).success
    ).toBe(false)
  })

  it('constrains announcement scope and keeps delivery payloads content-free', () => {
    expect(
      createCampaignAnnouncementInputSchema.safeParse({
        campaignId: uuid,
        commandId: uuid,
        scope: 'TABLE',
        partyId: uuid,
        title: 'Update',
        body: 'Details'
      }).success
    ).toBe(false)
    expect(
      campaignAnnouncementDtoSchema.safeParse({
        announcementPublicId: uuid,
        campaignId: uuid,
        authorUserId: uuid,
        scope: 'TABLE',
        partyId: null,
        title: 'Update',
        body: 'Details',
        createdAt: '2026-08-12T17:00:00.000Z'
      }).success
    ).toBe(true)
    const payload = {
      kind: 'CAMPAIGN_ANNOUNCEMENT',
      announcementPublicId: uuid,
      campaignPublicId: 'campaign-route',
      summary: 'A Campaign announcement was published.',
      scope: 'TABLE',
      occurredAt: '2026-08-12T17:00:00.000Z'
    }
    expect(notificationIntentDataSchema.parse(payload)).toEqual(payload)
    expect(
      campaignAnnouncementNotificationDataSchema.safeParse({
        ...payload,
        title: 'secret'
      }).success
    ).toBe(false)
  })
})
