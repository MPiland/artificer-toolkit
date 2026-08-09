import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { useDiscardRollMutation, useExecuteRollMutation } from '#app/data/rolls'
import { useDicePresentationPreferences } from '#app/settings/dicePreferences'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import type { CharacterSheetRollController, CharacterSheetRollRequest } from './dice.types'

export function useCharacterSheetRollController(
  characterId: string,
  campaignId?: string
): CharacterSheetRollController {
  const queryClient = useQueryClient()
  const mutation = useExecuteRollMutation()
  const tableMutation = useMutation({
    mutationFn: async (request: CharacterSheetRollRequest) => {
      if (!campaignId) throw new Error('This Character is not assigned to a Campaign.')
      const entry = await api.campaigns.chat.roll({
        campaignId,
        room: 'TABLE',
        clientNonce: crypto.randomUUID(),
        roll: { characterId, ...request }
      })
      if (!entry.roll) throw new Error('The Campaign roll did not return roll evidence.')
      return entry.roll
    },
    onSuccess: async () => {
      if (!campaignId) return
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.chat(campaignId, 'TABLE') }),
        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.conversations(campaignId) })
      ])
    }
  })
  const discardMutation = useDiscardRollMutation()
  const [preferences] = useDicePresentationPreferences()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const [manualRoll, setManualRoll] = useState<RollRecordDto>()
  const [transientRoll, setTransientRoll] = useState<RollRecordDto>()
  const [destination, setDestination] = useState<'PRIVATE' | 'TABLE'>('PRIVATE')
  const [presentedRollPrivate, setPresentedRollPrivate] = useState(true)

  return useMemo(
    () => ({
      canPublishToTable: Boolean(campaignId),
      clearManualRoll: () => setManualRoll(undefined),
      destination: campaignId ? destination : 'PRIVATE',
      dismissRoll: (discard = false) => {
        const roll = transientRoll ?? manualRoll
        setManualRoll(undefined)
        setTransientRoll(undefined)
        if (discard && roll && presentedRollPrivate) {
          discardMutation.mutate(roll.id, {
            onError: () =>
              notifications.show({
                color: 'red',
                message: 'The canceled roll could not be removed from history.'
              })
          })
        }
      },
      executeRoll: async (request: CharacterSheetRollRequest) => {
        try {
          if (preferences.animate3d && !reducedMotion) {
            void import('./DiceCanvas')
              .then(({ preloadDiceModels }) => preloadDiceModels(request.expression))
              .catch(() => undefined)
          }
          const isPrivate = !campaignId || destination === 'PRIVATE'
          const roll = isPrivate
            ? await mutation.mutateAsync({ characterId, ...request })
            : await tableMutation.mutateAsync(request)
          setPresentedRollPrivate(isPrivate)
          if (request.source.kind === 'MANUAL') {
            setTransientRoll(undefined)
            setManualRoll(roll)
          } else {
            setManualRoll(undefined)
            setTransientRoll(roll)
          }
          return roll
        } catch (error) {
          notifications.show({
            color: 'red',
            message: error instanceof Error ? error.message : 'The dice could not be rolled.'
          })
          return undefined
        }
      },
      hasManualRoll: Boolean(manualRoll),
      pending: mutation.isPending || tableMutation.isPending,
      pendingRequest: mutation.isPending
        ? mutation.variables
        : tableMutation.isPending
          ? tableMutation.variables
          : undefined,
      presentedRoll: transientRoll ?? manualRoll,
      presentedRollPrivate,
      setDestination: (nextDestination) => setDestination(campaignId ? nextDestination : 'PRIVATE')
    }),
    [
      campaignId,
      characterId,
      destination,
      discardMutation,
      manualRoll,
      mutation,
      preferences.animate3d,
      presentedRollPrivate,
      reducedMotion,
      tableMutation,
      transientRoll
    ]
  )
}
