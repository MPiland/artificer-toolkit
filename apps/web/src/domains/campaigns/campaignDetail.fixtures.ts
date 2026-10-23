import {
  campaignDetailDtoSchema,
  type CampaignDetailDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { getCampaignCapabilities } from '@artificer-toolkit/shared/campaign/capabilities'

/**
 * A Campaign the viewer owns, parsed through the shared DTO schema. Capabilities come from the
 * real role and status rules, so overriding `role` or `status` keeps them consistent.
 */
export function createCampaignDetail(
  overrides: Partial<CampaignDetailDto> = {}
): CampaignDetailDto {
  const role = overrides.role ?? 'OWNER'
  const status = overrides.status ?? 'ACTIVE'
  return campaignDetailDtoSchema.parse({
    id: '11111111-1111-4111-8111-111111111111',
    publicId: 'ashen-road',
    name: 'The Ashen Road',
    description: null,
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    toneDetails: null,
    contentMaturity: 'STANDARD',
    gameSystemId: '00000000-0000-4000-8000-000000000001',
    primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
    additionalRulesCatalogueIds: [],
    version: 1,
    memberCount: 1,
    playerCount: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    attunementSlotOverride: null,
    rollModes: [
      { code: 'NORMAL', label: 'Normal', keep: 'FIRST' },
      { code: 'ADVANTAGE', label: 'Advantage', keep: 'HIGHER' },
      { code: 'DISADVANTAGE', label: 'Disadvantage', keep: 'LOWER' }
    ],
    assignedCharacter: null,
    memberships: [],
    capabilities: getCampaignCapabilities(status, role),
    ...overrides,
    role,
    status
  })
}
