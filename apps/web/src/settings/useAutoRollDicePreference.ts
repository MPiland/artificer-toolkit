import { convexQuery } from '@convex-dev/react-query'
import { api } from '@artificer-toolkit/apis/convex/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMutation as useConvexMutation } from 'convex/react'

/** The signed-in user's server-side "Roll my dice automatically" preference. */
export function useAutoRollDicePreference() {
  const queryClient = useQueryClient()
  const preferenceQuery = convexQuery(api.account.rollPreferences, {})
  const preference = useQuery(preferenceQuery)
  const setAutoRollDice = useConvexMutation(api.account.setAutoRollDice)
  const update = useMutation({
    mutationFn: (autoRollDice: boolean) => setAutoRollDice({ autoRollDice }),
    onSuccess: (_result, autoRollDice) =>
      queryClient.setQueryData(preferenceQuery.queryKey, (current) =>
        current ? { ...current, autoRollDice } : current
      )
  })

  return {
    // New profiles default to automatic dice; this only fills the switch until the read lands.
    autoRollDice: preference.data?.autoRollDice ?? true,
    disabled: preference.isPending || preference.isError || update.isPending,
    loadFailed: preference.isError,
    updateError: update.error,
    setAutoRollDice: update.mutate
  }
}
