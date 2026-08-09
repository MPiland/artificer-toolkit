import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { useDiscardRollMutation } from '#app/data/rolls'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { useDicePresentationPreferences } from '#app/settings/dicePreferences'
import { CharacterSheetManualRoll } from '#domains/characters/sheet/dice/CharacterSheetManualRoll'
import { CharacterSheetRollPresentation } from '#domains/characters/sheet/dice/CharacterSheetRollPresentation'
import type {
  CharacterSheetRollController,
  CharacterSheetRollRequest
} from '#domains/characters/sheet/dice/dice.types'
import { CharacterSheetRollContext } from '#domains/characters/sheet/dice/rollContext'
import * as styles from '../campaigns.css'

export function CampaignGmRoller({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient()
  const discard = useDiscardRollMutation()
  const [preferences] = useDicePresentationPreferences()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const [destination, setDestination] = useState<'PRIVATE' | 'TABLE'>('PRIVATE')
  const [roll, setRoll] = useState<RollRecordDto>()
  const [rollPrivate, setRollPrivate] = useState(true)
  const mutation = useMutation({
    mutationFn: async (request: CharacterSheetRollRequest) => {
      const input = {
        campaignId,
        roll: { characterId: null, ...request }
      }
      if (destination === 'PRIVATE') return api.campaigns.chat.privateRoll(input)
      const entry = await api.campaigns.chat.roll({
        ...input,
        room: 'TABLE',
        clientNonce: crypto.randomUUID()
      })
      if (!entry.roll) throw new Error('The table roll did not return roll evidence.')
      return entry.roll
    },
    onSuccess: async (record) => {
      setRollPrivate(destination === 'PRIVATE')
      setRoll(record)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.rolls.history() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.chat(campaignId, 'TABLE') }),
        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.conversations(campaignId) })
      ])
    }
  })

  const controller = useMemo<CharacterSheetRollController>(
    () => ({
      canPublishToTable: true,
      clearManualRoll: () => setRoll(undefined),
      destination,
      dismissRoll: (removeFromHistory = false) => {
        const current = roll
        setRoll(undefined)
        if (removeFromHistory && current && rollPrivate) {
          discard.mutate(current.id, {
            onError: () =>
              notifications.show({
                color: 'red',
                message: 'The canceled roll could not be removed from history.'
              })
          })
        }
      },
      executeRoll: async (request) => {
        try {
          if (preferences.animate3d && !reducedMotion) {
            void import('#domains/characters/sheet/dice/DiceCanvas')
              .then(({ preloadDiceModels }) => preloadDiceModels(request.expression))
              .catch(() => undefined)
          }
          return await mutation.mutateAsync(request)
        } catch (error) {
          notifications.show({
            color: 'red',
            message: error instanceof Error ? error.message : 'The dice could not be rolled.'
          })
          return undefined
        }
      },
      hasManualRoll: Boolean(roll),
      pending: mutation.isPending,
      pendingRequest: mutation.variables,
      presentedRoll: roll,
      presentedRollPrivate: rollPrivate,
      setDestination
    }),
    [destination, discard, mutation, preferences.animate3d, reducedMotion, roll, rollPrivate]
  )

  return (
    <CharacterSheetRollContext.Provider value={controller}>
      <CharacterSheetRollPresentation
        pending={controller.pending}
        roll={controller.presentedRoll}
        onRollRevealed={() => undefined}
      />
      <CharacterSheetManualRoll className={styles.gmDiceButton} />
    </CharacterSheetRollContext.Provider>
  )
}
