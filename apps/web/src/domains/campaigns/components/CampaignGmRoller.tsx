import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useMemo, useState } from 'react'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { useDiscardRollMutation } from '#app/data/rolls'
import { useDicePresentationPreferences } from '#app/settings/dicePreferences'
import { CharacterSheetManualRoll } from '#domains/characters/sheet/dice/CharacterSheetManualRoll'
import { CharacterSheetRollPresentation } from '#domains/characters/sheet/dice/CharacterSheetRollPresentation'
import type {
  CharacterSheetRollController,
  CharacterSheetRollRequest
} from '#domains/characters/sheet/dice/dice.types'
import { CharacterSheetRollContext } from '#domains/characters/sheet/dice/rollContext'
import * as liveStyles from './campaignLive.css'

export function CampaignGmRoller({ campaignId }: { campaignId: string }) {
  const executePrivateRoll = useConvexMutation(convexApi.campaigns.rolls.executePrivate)
  const executeTableRoll = useConvexMutation(convexApi.campaigns.rolls.execute)
  const discard = useDiscardRollMutation()
  const [preferences] = useDicePresentationPreferences()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const [destination, setDestination] = useState<'PRIVATE' | 'TABLE'>('PRIVATE')
  const [roll, setRoll] = useState<RollRecordDto>()
  const [rollPrivate, setRollPrivate] = useState(true)
  const mutation = useMutation({
    mutationFn: async ({
      request,
      destination: target
    }: {
      request: CharacterSheetRollRequest
      destination: 'PRIVATE' | 'TABLE'
    }) => {
      const input = {
        campaignId,
        roll: { characterId: null, ...request }
      }
      if (target === 'PRIVATE') return executePrivateRoll(input)
      const entry = await executeTableRoll({
        ...input,
        room: 'TABLE',
        clientNonce: crypto.randomUUID()
      })
      if (!entry.roll) throw new Error('The table roll did not return roll evidence.')
      return entry.roll
    },
    onSuccess: (record, variables) => {
      setRollPrivate(variables.destination === 'PRIVATE')
      setRoll(record)
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
            void import('#domains/characters/sheet/dice/diceModelPreload')
              .then(({ preloadDiceModels }) => preloadDiceModels(request.expression))
              .catch(() => undefined)
          }
          return await mutation.mutateAsync({ request, destination })
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
      pendingRequest: mutation.variables?.request,
      presentationPending: false,
      presentedRoll: roll,
      presentedRollPrivate: rollPrivate,
      revealRoll: () => undefined,
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
      <CharacterSheetManualRoll className={liveStyles.gmDiceButton} />
    </CharacterSheetRollContext.Provider>
  )
}
