import { convexQuery } from '@convex-dev/react-query'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { RollVisibilityDto } from '@artificer-toolkit/schema/api/rolls'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMutation as useConvexMutation } from 'convex/react'

/** The GM's remembered Public or Private choice for their rolls (Q14). New profiles start Public. */
export function useGmRollVisibilityPreference() {
  const queryClient = useQueryClient()
  const preferenceQuery = convexQuery(api.account.rollPreferences, {})
  const preference = useQuery(preferenceQuery)
  const setGmRollVisibility = useConvexMutation(api.account.setGmRollVisibility)
  const update = useMutation({
    mutationFn: (gmRollVisibility: RollVisibilityDto) => setGmRollVisibility({ gmRollVisibility }),
    onSuccess: (_result, gmRollVisibility) =>
      queryClient.setQueryData(preferenceQuery.queryKey, (current) =>
        current ? { ...current, gmRollVisibility } : current
      ),
    onError: () =>
      notifications.show({ color: 'red', message: 'The roll visibility could not be saved.' })
  })

  return {
    // The pending choice shows at once; rolls started meanwhile use it too.
    gmRollVisibility: update.isPending
      ? update.variables
      : (preference.data?.gmRollVisibility ?? 'PUBLIC'),
    setGmRollVisibility: update.mutate
  }
}
