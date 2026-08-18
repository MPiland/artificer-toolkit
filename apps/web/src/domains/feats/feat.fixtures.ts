import type { FeatAuthoredDto } from '@artificer-toolkit/schema/subjects/feat'
import type { FeatListResponseDto, FeatResponseDto } from '@artificer-toolkit/schema/api/content'

export const ownedFeatFixture: FeatAuthoredDto = {
  id: 'battlefield-reader',
  label: 'Battlefield Reader',
  description: 'You have learned to read a dangerous room before the first blade is drawn.',
  details: [
    {
      id: 'battlefield-reader-detail',
      label: 'Detail',
      description: 'This feat rewards careful positioning and quick tactical reads.',
      order: 1
    }
  ],
  status: 'DRAFT',
  effects: [],
  features: [
    {
      id: 'battlefield-reader-feature',
      label: 'Opening Read',
      description: 'When initiative is rolled, you can identify one nearby danger or advantage.',
      order: 1
    }
  ],
  userId: 'user-1',
  systemId: 'dnd-5e-srd'
}

export const masterFeatFixture: FeatAuthoredDto = {
  ...ownedFeatFixture,
  id: 'grappler',
  label: 'Grappler',
  description:
    'You have developed the skills necessary to hold your own in close-quarters grappling.',
  details: [
    {
      id: 'grappler-detail',
      label: 'Detail',
      description: 'Prerequisite: Strength 13 or higher.',
      order: 1
    }
  ],
  status: 'ACTIVE',
  userId: 'master'
}

export const featListResponseFixture: FeatListResponseDto = {
  items: [
    {
      id: masterFeatFixture.id,
      publicId: masterFeatFixture.id,
      activeUpdatedAt: '2026-01-01T00:00:00.000Z',
      label: masterFeatFixture.label,
      description: masterFeatFixture.description,
      status: 'ACTIVE',
      userId: 'master',
      systemId: masterFeatFixture.systemId,
      provenance: {
        kind: 'MASTER',
        ownerUserId: null
      },
      permissions: {
        canView: true,
        canEdit: false,
        canCopy: true,
        canDelete: false
      }
    },
    {
      id: ownedFeatFixture.id,
      publicId: ownedFeatFixture.id,
      activeUpdatedAt: '2026-01-01T00:00:00.000Z',
      label: ownedFeatFixture.label,
      description: ownedFeatFixture.description,
      status: 'DRAFT',
      userId: ownedFeatFixture.userId,
      systemId: ownedFeatFixture.systemId,
      provenance: {
        kind: 'OWNED',
        ownerUserId: ownedFeatFixture.userId
      },
      permissions: {
        canView: true,
        canEdit: true,
        canCopy: true,
        canDelete: true
      }
    }
  ],
  drafts: [],
  meta: {},
  page: { nextCursor: null, previousCursor: null, totalCount: 2 },
  summary: { activeCount: 2, masterCount: 1, ownedCount: 1 }
}

export const ownedFeatResponseFixture: NonNullable<FeatResponseDto> = {
  publicId: ownedFeatFixture.id,
  activeUpdatedAt: '2026-01-01T00:00:00.000Z',
  hasDraft: false,
  item: ownedFeatFixture,
  provenance: {
    kind: 'OWNED',
    ownerUserId: ownedFeatFixture.userId
  },
  permissions: {
    canView: true,
    canEdit: true,
    canCopy: true,
    canDelete: true
  }
}

export const masterFeatResponseFixture: NonNullable<FeatResponseDto> = {
  publicId: masterFeatFixture.id,
  activeUpdatedAt: '2026-01-01T00:00:00.000Z',
  hasDraft: false,
  item: masterFeatFixture,
  provenance: {
    kind: 'MASTER',
    ownerUserId: null
  },
  permissions: {
    canView: true,
    canEdit: false,
    canCopy: true,
    canDelete: false
  }
}
