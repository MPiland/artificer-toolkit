import type { Api, AuthoredDetailRequestDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { createAuthoredContentQueries } from '#app/data/authoredContentQueries'

type DetailInput = string | AuthoredDetailRequestDto

const spellQueries = createAuthoredContentQueries(
  (client) => client.content.spells,
  queryKeys.content.spells
)

export function getSpellList(client?: Api) {
  return spellQueries.getList(client)
}

export function useGetSpellList() {
  return spellQueries.useList()
}

export function getSpell(input: DetailInput, client?: Api) {
  return spellQueries.getDetail(input, client)
}

export function useGetSpell(input: DetailInput) {
  return spellQueries.useDetail(input)
}

export function getSpellDraft(id: string, client?: Api) {
  return spellQueries.getDraft(id, client)
}
