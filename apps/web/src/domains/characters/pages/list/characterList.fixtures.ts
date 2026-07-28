import { AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'
import type { CharacterListResponseDto } from '@artificer-toolkit/schema/api/characters'
import { characterFixture } from '../../builder/fixtures/characterBuilder.fixtures'

export const characterListFixture = {
  items: [
    {
      id: characterFixture.id,
      publicId: 'character-owned',
      label: characterFixture.label,
      status: AUTHORED_RECORD_STATUS.ACTIVE,
      systemId: characterFixture.systemId,
      streamVersion: 1
    },
    {
      id: 'character-draft',
      publicId: 'character-draft',
      label: '',
      status: AUTHORED_RECORD_STATUS.DRAFT,
      systemId: characterFixture.systemId,
      streamVersion: 0,
      draft: {
        characterId: 'character-draft',
        publicId: 'character-draft',
        userId: 'user-1',
        systemId: characterFixture.systemId,
        label: '',
        status: AUTHORED_RECORD_STATUS.DRAFT,
        draftState: 'DRAFT_ONLY',
        baseActiveUpdatedAt: null,
        createdAt: '2026-05-02T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z'
      }
    }
  ],
  meta: {}
} satisfies CharacterListResponseDto
