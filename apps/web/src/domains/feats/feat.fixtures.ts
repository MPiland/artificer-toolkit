import type { FeatAuthoredDto } from '@artificer-toolkit/schema/subjects/feat'
import type {
  FeatListResponseDto,
  FeatResponseDto
} from '@artificer-toolkit/schema/api/content'

export const ownedFeatFixture: FeatAuthoredDto = {
  id: 'battlefield-reader',
  label: 'Battlefield Reader',
  description: 'You have learned to read a dangerous room before the first blade is drawn.',
  detail: 'This feat rewards careful positioning and quick tactical reads.',
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
  description: 'You have developed the skills necessary to hold your own in close-quarters grappling.',
  detail: 'Prerequisite: Strength 13 or higher.',
  status: 'ACTIVE',
  userId: 'master'
}

export const featListResponseFixture: FeatListResponseDto = {
  items: [
    {
      id: masterFeatFixture.id,
      publicId: masterFeatFixture.id,
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
  meta: {}
}

export const ownedFeatResponseFixture: NonNullable<FeatResponseDto> = {
  publicId: ownedFeatFixture.id,
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
