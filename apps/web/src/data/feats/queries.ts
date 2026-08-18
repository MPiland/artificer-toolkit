import type { Api, AuthoredDetailRequestDto, FeatListRequestDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { createAuthoredContentQueries } from '#app/data/authoredContentQueries'

type DetailInput = string | AuthoredDetailRequestDto

const featQueries = createAuthoredContentQueries(
  (client) => client.content.feats,
  queryKeys.content.feats
)

export function getFeatList(input: FeatListRequestDto, client?: Api) {
  return featQueries.getList(input, client)
}

export function useGetFeatList(input: FeatListRequestDto) {
  return featQueries.useList(input)
}

export function getFeat(input: DetailInput, client?: Api) {
  return featQueries.getDetail(input, client)
}

export function useGetFeat(input: DetailInput) {
  return featQueries.useDetail(input)
}

export function getFeatDraft(id: string, client?: Api) {
  return featQueries.getDraft(id, client)
}
