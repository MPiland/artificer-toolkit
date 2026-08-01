import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  ExecuteDiceConfigurationInputDto,
  ExecuteRollInputDto,
  RollRecordDto
} from '@artificer-toolkit/schema/api/rolls'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function getRollHistory() {
  return queryOptions({
    queryKey: queryKeys.rolls.history(),
    queryFn: () => api.rolls.history()
  })
}

export function useExecuteRollMutation() {
  return useMutation({
    mutationFn: (input: ExecuteRollInputDto) => api.rolls.execute(input)
  })
}

export function useExecuteDiceConfigurationMutation() {
  return useMutation({
    mutationFn: (input: ExecuteDiceConfigurationInputDto) => api.rolls.executeConfiguration(input)
  })
}

export function useDiscardRollMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (rollId: string) => api.rolls.discard(rollId),
    onMutate: (rollId) =>
      queryClient.setQueryData<RollRecordDto[]>(queryKeys.rolls.history(), (current) =>
        current?.filter((roll) => roll.id !== rollId)
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.rolls.history() })
  })
}

export function useClearRollHistoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.rolls.clearHistory(),
    onSuccess: () => queryClient.setQueryData(queryKeys.rolls.history(), [])
  })
}
