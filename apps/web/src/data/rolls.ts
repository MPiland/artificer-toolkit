import { convexQuery } from '@convex-dev/react-query'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { RevealCampaignRollInput } from '@artificer-toolkit/schema/api/campaignCommunication'
import type {
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

export function useRevealCampaignRollMutation() {
  const reveal = useConvexMutation(api.campaigns.rolls.reveal)
  return useMutation({ mutationFn: (input: RevealCampaignRollInput) => reveal(input) })
}

export function useClearRollHistoryMutation() {
  const clearHistory = useConvexMutation(api.rolls.clearHistory)
  return useMutation({ mutationFn: () => clearHistory({}) })
}
