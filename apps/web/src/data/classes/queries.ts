import type { Api, AuthoredDetailRequestDto, ClassListRequestDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { createAuthoredContentQueries } from '#app/data/authoredContentQueries'

type DetailInput = string | AuthoredDetailRequestDto

const classQueries = createAuthoredContentQueries(
  (client) => client.content.classes,
  queryKeys.content.classes
)

export function getClassList(input: ClassListRequestDto, client?: Api) {
  return classQueries.getList(input, client)
}

export function useGetClassList(input: ClassListRequestDto) {
  return classQueries.useList(input)
}

export function getClass(input: DetailInput, client?: Api) {
  return classQueries.getDetail(input, client)
}

export function useGetClass(input: DetailInput) {
  return classQueries.useDetail(input)
}

export function getClassDraft(id: string, client?: Api) {
  return classQueries.getDraft(id, client)
}
