import type { Api, AuthoredDetailRequestDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { createAuthoredContentQueries } from '#app/data/authoredContentQueries'

type DetailInput = string | AuthoredDetailRequestDto

const backgroundQueries = createAuthoredContentQueries(
  (client) => client.content.backgrounds,
  queryKeys.content.backgrounds
)

export function getBackgroundList(client?: Api) {
  return backgroundQueries.getList(client)
}

export function useGetBackgroundList() {
  return backgroundQueries.useList()
}

export function getBackground(input: DetailInput, client?: Api) {
  return backgroundQueries.getDetail(input, client)
}

export function useGetBackground(input: DetailInput) {
  return backgroundQueries.useDetail(input)
}

export function getBackgroundDraft(id: string, client?: Api) {
  return backgroundQueries.getDraft(id, client)
}
