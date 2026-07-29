import { QueryClient } from '@tanstack/react-query'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import { refreshAuthoredDetailAfterDraftDiscard } from './useAuthoredDetailActions'

const draftKey = ['content', 'spells', 'draft', 'spell-id'] as const
const detailSubjectKey = ['content', 'spells', 'detail', 'spell-id'] as const
const optionedDetailKey = [
  ...detailSubjectKey,
  'draft',
  'with-draft',
  'classes,damageTypes,magicSchools'
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
    subjectKind: 'SPELL',
    subjectId: 'spell-id',
    publicId: '1',
    userId: 'user-id',
    systemId: 'system-id',
    label: 'Spell Draft',
    status: 'DRAFT',
    draftState: 'ACTIVE_WITH_DRAFT',
    revisionId: 'draft-revision-id',
    revisionNumber: 2,
    activeRevisionId: 'active-revision-id',
    baseActiveRevisionId: 'active-revision-id',
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

    queryClient.setQueryData(optionedDetailKey, { id: 'spell-id', label: 'Deleted draft spell' })
    draft = null

    await refreshAuthoredDetailAfterDraftDiscard({
      detailSubjectQueryKey: detailSubjectKey,
      domainQueryKey: domainKey,
      draftQueryKey: draftKey,
      hasActiveContent: false,
      queryClient
    })

    expect(queryClient.getQueryData(draftKey)).toBeNull()
    expect(queryClient.getQueryData(optionedDetailKey)).toBeUndefined()
  })

  it('refetches optioned active detail content when an active record exists', async () => {
    const queryClient = createQueryClient()
    let detail = { id: 'spell-id', label: 'Old active spell' }
    let draft: AuthoredDraftDto | null = createDraft()

    await queryClient.fetchQuery({
      queryKey: draftKey,
      queryFn: async () => draft
    })
    await queryClient.fetchQuery({
      queryKey: optionedDetailKey,
      queryFn: async () => detail
    })

    detail = { id: 'spell-id', label: 'Refetched active spell' }
    draft = null

    await refreshAuthoredDetailAfterDraftDiscard({
      detailSubjectQueryKey: detailSubjectKey,
      domainQueryKey: domainKey,
      draftQueryKey: draftKey,
      hasActiveContent: true,
      queryClient
    })

    expect(queryClient.getQueryData(draftKey)).toBeNull()
    expect(queryClient.getQueryData(optionedDetailKey)).toEqual({
      id: 'spell-id',
      label: 'Refetched active spell'
    })
  })
})
