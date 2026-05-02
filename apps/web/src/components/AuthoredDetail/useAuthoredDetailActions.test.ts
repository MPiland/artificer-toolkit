import { QueryClient } from '@tanstack/react-query'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema'
import { refreshAuthoredDetailAfterDraftDiscard } from './useAuthoredDetailActions'

const draftKey = [
  'content', 'spells', 'draft', 'spell-id'
] as const
const detailKey = [
  'content', 'spells', 'detail', 'spell-id'
] as const
const domainKey = ['content', 'spells'] as const

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })
}

function createDraft(): AuthoredDraftDto {
  return {
    id: 'draft-id',
    subjectKind: 'SPELL',
    subjectId: 'spell-id',
    userId: 'user-id',
    systemId: 'system-id',
    label: 'Spell Draft',
    status: 'DRAFT',
    draftState: 'ACTIVE_WITH_DRAFT',
    payload: {
      id: 'spell-id',
      label: 'Spell Draft'
    }
  }
}

describe('refreshAuthoredDetailAfterDraftDiscard', () => {
  it('refetches the exact draft query before the route reload can read cached data', async () => {
    const queryClient = createQueryClient()
    let draft: AuthoredDraftDto | null = createDraft()

    await queryClient.fetchQuery({
      queryKey: draftKey,
      queryFn: async () => draft
    })

    queryClient.setQueryData(detailKey, { id: 'spell-id' })
    draft = null

    await refreshAuthoredDetailAfterDraftDiscard({
      detailQueryKey: detailKey,
      domainQueryKey: domainKey,
      draftQueryKey: draftKey,
      hasActiveContent: false,
      queryClient
    })

    expect(queryClient.getQueryData(draftKey)).toBeNull()
    expect(queryClient.getQueryData(detailKey)).toBeUndefined()
  })

  it('refetches active detail content when an active record exists', async () => {
    const queryClient = createQueryClient()
    let detail = { id: 'spell-id', label: 'Old active spell' }
    let draft: AuthoredDraftDto | null = createDraft()

    await queryClient.fetchQuery({
      queryKey: draftKey,
      queryFn: async () => draft
    })
    await queryClient.fetchQuery({
      queryKey: detailKey,
      queryFn: async () => detail
    })

    detail = { id: 'spell-id', label: 'Refetched active spell' }
    draft = null

    await refreshAuthoredDetailAfterDraftDiscard({
      detailQueryKey: detailKey,
      domainQueryKey: domainKey,
      draftQueryKey: draftKey,
      hasActiveContent: true,
      queryClient
    })

    expect(queryClient.getQueryData(draftKey)).toBeNull()
    expect(queryClient.getQueryData(detailKey)).toEqual({
      id: 'spell-id',
      label: 'Refetched active spell'
    })
  })
})
