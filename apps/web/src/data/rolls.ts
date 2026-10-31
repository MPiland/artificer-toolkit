import { convexQuery } from '@convex-dev/react-query'
import { api } from '@artificer-toolkit/apis/convex/api'
import type {
  AddAfterRollDieInputDto,
  ExecuteDiceConfigurationInputDto,
  ExecuteRollInputDto
} from '@artificer-toolkit/schema/api/rolls'
import { useMutation as useConvexMutation } from 'convex/react'
import { useMutation } from '@tanstack/react-query'

export function getRollHistory(enabled = true) {
  return convexQuery(api.rolls.history, enabled ? {} : 'skip')
}

export function useExecuteRollMutation() {
  const execute = useConvexMutation(api.rolls.execute)
  return useMutation({ mutationFn: (input: ExecuteRollInputDto) => execute(input) })
}

/** D168: adds a die the Character held for after the roll to its latest retained roll. */
export function useAddAfterRollDieMutation() {
  const addAfterRollDie = useConvexMutation(api.rolls.addAfterRollDie)
  return useMutation({ mutationFn: (input: AddAfterRollDieInputDto) => addAfterRollDie(input) })
}

/** D168: keeps the latest retained roll as rolled. */
export function useDeclineAfterRollDiceMutation() {
  const declineAfterRollDice = useConvexMutation(api.rolls.declineAfterRollDice)
  return useMutation({ mutationFn: (rollId: string) => declineAfterRollDice({ id: rollId }) })
}

export function useExecuteDiceConfigurationMutation() {
  const executeConfiguration = useConvexMutation(api.rolls.executeConfiguration)
  return useMutation({
    mutationFn: (input: ExecuteDiceConfigurationInputDto) => executeConfiguration(input)
  })
}

export function useDiscardRollMutation() {
  const discard = useConvexMutation(api.rolls.discard).withOptimisticUpdate(
    (localStore, { id }) => {
      const history = localStore.getQuery(api.rolls.history, {})
      if (history === undefined) return
      localStore.setQuery(
        api.rolls.history,
        {},
        history.filter((record) => record.id !== id)
      )
    }
  )
  return useMutation({ mutationFn: (rollId: string) => discard({ id: rollId }) })
}

export function useClearRollHistoryMutation() {
  const clearHistory = useConvexMutation(api.rolls.clearHistory)
  return useMutation({ mutationFn: () => clearHistory({}) })
}
