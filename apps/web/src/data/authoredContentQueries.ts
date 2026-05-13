import {
  queryOptions,
  useSuspenseQuery
} from '@tanstack/react-query'
import {
  api,
  type Api,
  type AuthoredDetailRequestDto,
  type AuthoredDraftDto
} from '#app/lib/api'

type AuthoredDetailInput = string | AuthoredDetailRequestDto

type AuthoredContentApi<TList, TResponse> = {
  get: (input: AuthoredDetailInput) => Promise<TResponse>
  getDraft: (id: string) => Promise<AuthoredDraftDto | null>
  list: () => Promise<TList>
}

type AuthoredContentQueryKeys = {
  list: () => readonly unknown[]
  detail: (id: string, options?: Omit<AuthoredDetailRequestDto, 'id'>) => readonly unknown[]
  draft: (id: string) => readonly unknown[]
}

function normalizeDetailRequest(input: AuthoredDetailInput): AuthoredDetailRequestDto {
  return typeof input === 'string' ? { id: input } : input
}

export function createAuthoredContentQueries<TList, TResponse>(
  getDomain: (client: Api) => AuthoredContentApi<TList, TResponse>,
  keys: AuthoredContentQueryKeys
) {
  const getList = (client: Api = api) => queryOptions({
    queryKey: keys.list(),
    queryFn: async () => await getDomain(client).list()
  })
  const getDetail = (input: AuthoredDetailInput, client: Api = api) => {
    const request = normalizeDetailRequest(input)

    return queryOptions({
      queryKey: keys.detail(request.id, {
        includeDraft: request.includeDraft,
        meta: request.meta,
        view: request.view
      }),
      queryFn: async () => await getDomain(client).get(request)
    })
  }
  const getDraft = (id: string, client: Api = api) => queryOptions({
    queryKey: keys.draft(id),
    queryFn: async () => await getDomain(client).getDraft(id)
  })

  return {
    getList,

    useList() {
      return useSuspenseQuery(getList())
    },

    getDetail,

    useDetail(input: AuthoredDetailInput) {
      return useSuspenseQuery(getDetail(input))
    },

    getDraft
  }
}
