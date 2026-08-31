import {
  type InfiniteData,
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useSuspenseQuery
} from '@tanstack/react-query'
import {
  api,
  type Api,
  type AuthoredCatalogCursorDto,
  type AuthoredDetailRequestDto,
  type AuthoredDraftDto
} from '#app/lib/api'

type AuthoredDetailInput = string | AuthoredDetailRequestDto

interface AuthoredCatalogPage {
  page: {
    nextCursor: AuthoredCatalogCursorDto | null
    previousCursor: AuthoredCatalogCursorDto | null
  }
}

type AuthoredCatalogPageParam = {
  cursor?: AuthoredCatalogCursorDto
  direction: 'BACKWARD' | 'FORWARD'
}

type AuthoredContentApi<TList extends AuthoredCatalogPage, TResponse, TListInput> = {
  get: (input: AuthoredDetailInput) => Promise<TResponse>
  getDraft: (id: string) => Promise<AuthoredDraftDto | null>
  list: (input: TListInput) => Promise<TList>
}

type AuthoredContentQueryKeys<TListInput> = {
  list: () => readonly unknown[]
  listPage: (input: TListInput) => readonly unknown[]
  detail: (id: string, options?: Omit<AuthoredDetailRequestDto, 'id'>) => readonly unknown[]
  draft: (id: string) => readonly unknown[]
}

function normalizeDetailRequest(input: AuthoredDetailInput): AuthoredDetailRequestDto {
  return typeof input === 'string' ? { id: input } : input
}

export function createAuthoredContentQueries<
  TList extends AuthoredCatalogPage,
  TResponse,
  TListInput extends { direction?: 'BACKWARD' | 'FORWARD'; limit?: number }
>(
  getDomain: (client: Api) => AuthoredContentApi<TList, TResponse, TListInput>,
  keys: AuthoredContentQueryKeys<TListInput>
) {
  const getList = (input: TListInput, client: Api = api) =>
    infiniteQueryOptions<
      TList,
      Error,
      InfiniteData<TList, AuthoredCatalogPageParam>,
      readonly unknown[],
      AuthoredCatalogPageParam
    >({
      queryKey: keys.listPage(input),
      queryFn: async ({ pageParam }) => await getDomain(client).list({ ...input, ...pageParam }),
      initialPageParam: { direction: 'FORWARD' } satisfies AuthoredCatalogPageParam,
      getNextPageParam: (page) =>
        page.page.nextCursor
          ? ({
              cursor: page.page.nextCursor,
              direction: 'FORWARD'
            } satisfies AuthoredCatalogPageParam)
          : undefined,
      getPreviousPageParam: (page) =>
        page.page.previousCursor
          ? ({
              cursor: page.page.previousCursor,
              direction: 'BACKWARD'
            } satisfies AuthoredCatalogPageParam)
          : undefined,
      maxPages: 5
    })
  const getDetail = (input: AuthoredDetailInput, client: Api = api) => {
    const request = normalizeDetailRequest(input)

    return queryOptions({
      queryKey: keys.detail(request.id, {
        meta: request.meta,
        view: request.view
      }),
      queryFn: async () => await getDomain(client).get(request)
    })
  }
  const getDraft = (id: string, client: Api = api) =>
    queryOptions({
      queryKey: keys.draft(id),
      queryFn: async () => await getDomain(client).getDraft(id)
    })

  return {
    getList,

    useList(input: TListInput) {
      return useInfiniteQuery(getList(input))
    },

    getDetail,

    useDetail(input: AuthoredDetailInput) {
      return useSuspenseQuery(getDetail(input))
    },

    getDraft
  }
}
