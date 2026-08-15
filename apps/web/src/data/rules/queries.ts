import { queryOptions } from '@tanstack/react-query'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export const ruleQueries = {
  packs: () =>
    queryOptions({ queryKey: queryKeys.rules.packs(), queryFn: () => api.rules.listPacks() }),
  revisions: (packId: string) =>
    queryOptions({
      queryKey: queryKeys.rules.revisions(packId),
      queryFn: () => api.rules.listRevisions(packId)
    }),
  revision: (revisionId: string) =>
    queryOptions({
      queryKey: queryKeys.rules.revision(revisionId),
      queryFn: () => api.rules.getRevision(revisionId)
    })
}
