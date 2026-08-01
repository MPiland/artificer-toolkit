import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMemo, useState } from 'react'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { useDiscardRollMutation, useExecuteRollMutation } from '#app/data/rolls'
import { useDicePresentationPreferences } from '#app/settings/dicePreferences'
import type { CharacterSheetRollController, CharacterSheetRollRequest } from './dice.types'

export function useCharacterSheetRollController(characterId: string): CharacterSheetRollController {
  const mutation = useExecuteRollMutation()
  const discardMutation = useDiscardRollMutation()
  const [preferences] = useDicePresentationPreferences()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const [manualRoll, setManualRoll] = useState<RollRecordDto>()
  const [transientRoll, setTransientRoll] = useState<RollRecordDto>()

  return useMemo(
    () => ({
      clearManualRoll: () => setManualRoll(undefined),
      dismissRoll: (discard = false) => {
        const roll = transientRoll ?? manualRoll
        setManualRoll(undefined)
        setTransientRoll(undefined)
        if (discard && roll) {
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
          const roll = await mutation.mutateAsync({ characterId, ...request })
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
      pending: mutation.isPending,
      pendingRequest: mutation.isPending ? mutation.variables : undefined,
      presentedRoll: transientRoll ?? manualRoll
    }),
    [
      characterId,
      discardMutation,
      manualRoll,
      mutation,
      preferences.animate3d,
      reducedMotion,
      transientRoll
    ]
  )
}
