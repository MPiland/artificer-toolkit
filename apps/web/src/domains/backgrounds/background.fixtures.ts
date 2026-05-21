import type { BackgroundAuthoredDto } from '@artificer-toolkit/schema/subjects/background'
import type {
  BackgroundListResponseDto,
  BackgroundResponseDto
} from '@artificer-toolkit/schema/api/content'

export const ownedBackgroundFixture: BackgroundAuthoredDto = {
  kind: 'BACKGROUND',
  id: 'urban-investigator',
  label: 'Urban Investigator',
  description: 'You know how to read a city, follow a rumor, and turn a locked door into a conversation.',
  status: 'DRAFT',
  details: [
    {
      id: 'investigator-detail',
      label: 'City Contact',
      description: 'You have a reliable contact in one settlement where you have worked before.',
      order: 1
    }
  ],
  proficiencies: [],
  features: [
    {
      id: 'investigator-feature',
      label: 'Streetwise',
      description: 'You can quickly find local rumors and safe places to rest.',
      order: 1
    }
  ],
  startingEquipment: {
    id: 'investigator-equipment',
    sets: [
      {
        id: 'investigator-set',
        order: 1,
        groups: [
          {
            id: 'investigator-group',
            order: 1,
            options: [
              {
                id: 'investigator-option',
                order: 1,
                items: [
                  {
                    id: 'investigator-item',
                    order: 1,
                    startingEquipmentKind: 'EQUIPMENT',
                    selectionKind: 'GRANTED',
                    quantity: 1,
                    authoringModeKind: 'ALL'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  userId: 'user-1',
  systemId: 'dnd-5e-srd'
}

export const masterBackgroundFixture: BackgroundAuthoredDto = {
  ...ownedBackgroundFixture,
  id: 'acolyte',
  label: 'Acolyte',
  description: 'You have spent your life in service to a temple, learning sacred rites and local customs.',
  status: 'ACTIVE',
  userId: 'master'
}

export const backgroundListResponseFixture: BackgroundListResponseDto = {
  items: [
    {
      id: masterBackgroundFixture.id,
      publicId: masterBackgroundFixture.id,
      label: masterBackgroundFixture.label,
      description: masterBackgroundFixture.description,
      status: 'ACTIVE',
      userId: 'master',
      systemId: masterBackgroundFixture.systemId,
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
      id: ownedBackgroundFixture.id,
      publicId: ownedBackgroundFixture.id,
      label: ownedBackgroundFixture.label,
      description: ownedBackgroundFixture.description,
      status: 'DRAFT',
      userId: ownedBackgroundFixture.userId,
      systemId: ownedBackgroundFixture.systemId,
      provenance: {
        kind: 'OWNED',
        ownerUserId: ownedBackgroundFixture.userId
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

export const ownedBackgroundResponseFixture: NonNullable<BackgroundResponseDto> = {
  publicId: ownedBackgroundFixture.id,
  item: ownedBackgroundFixture,
  provenance: {
    kind: 'OWNED',
    ownerUserId: ownedBackgroundFixture.userId
  },
  permissions: {
    canView: true,
    canEdit: true,
    canCopy: true,
    canDelete: true
  }
}

export const masterBackgroundResponseFixture: NonNullable<BackgroundResponseDto> = {
  publicId: masterBackgroundFixture.id,
  item: masterBackgroundFixture,
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
