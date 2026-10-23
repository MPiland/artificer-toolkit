import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type { OfferedRollModeDto } from '@artificer-toolkit/schema/shared/systemCoreCode'
import { useDiscardRollMutation } from '#app/data/rolls'
import { useDicePresentationPreferences } from '#app/settings/dicePreferences'
import { useGmRollVisibilityPreference } from '#app/settings/useGmRollVisibilityPreference'
import { CharacterSheetManualRoll } from '#domains/characters/sheet/dice/CharacterSheetManualRoll'
import { DiceRollPresentation } from '#app/components/dice/DiceRollPresentation'
import type {
  CharacterSheetRollController,
  CharacterSheetRollDestination,
  CharacterSheetRollRequest
} from '#domains/characters/sheet/dice/dice.types'
import {
  gmRollDestination,
  gmRollDestinationOptions,
  gmRollVisibility,
  noRollDestinationOptions
} from '#domains/characters/sheet/dice/dice.utils'
import { CharacterSheetRollContext } from '#domains/characters/sheet/dice/rollContext'
import { useCampaignChatRoom } from '../vtt/useCampaignChatRoom'
import * as liveStyles from './campaignLive.css'

export function CampaignGmRoller({
  campaignId,
  rollModes
}: {
  campaignId: string
  rollModes: readonly OfferedRollModeDto[]
}) {
  const {
    executePrivateRoll,
    executeRoll: executeTableRoll,
    revealRoll
  } = useCampaignChatRoom(campaignId)
  const discard = useDiscardRollMutation()
  const [preferences] = useDicePresentationPreferences()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const { gmRollVisibility: visibility, setGmRollVisibility } = useGmRollVisibilityPreference()
  const destination = gmRollDestination(visibility)
  const [roll, setRoll] = useState<RollRecordDto>()
  const [rollPrivate, setRollPrivate] = useState(true)
  const mutation = useMutation({
    mutationFn: async ({
      request,
      destination: target
    }: {
      request: CharacterSheetRollRequest
      destination: CharacterSheetRollDestination
    }): Promise<RollRecordDto | undefined> => {
      const roll = { characterId: null, ...request }
      if (target === 'PRIVATE')
        return executePrivateRoll({ campaignId, clientNonce: crypto.randomUUID(), roll })
      const entry = await executeTableRoll({
        campaignId,
        destination: 'TABLE',
        clientNonce: crypto.randomUUID(),
        roll
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
      clearManualRoll: () => setRoll(undefined),
      destination,
      destinationOptions: gmRollDestinationOptions,
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
            void import('#app/components/dice/diceModelPreload')
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
      revealPrivateRoll: revealRoll,
      revealRoll: () => undefined,
      setDestination: (next) => setGmRollVisibility(gmRollVisibility(next)),
      // Manual GM rolls never change Character state.
      stateRollDestination: destination,
      stateRollDestinationOptions: noRollDestinationOptions
    }),
    [
      destination,
      discard,
      mutation,
      preferences.animate3d,
      reducedMotion,
      revealRoll,
      roll,
      rollPrivate,
      setGmRollVisibility
    ]
  )

  return (
    <CharacterSheetRollContext.Provider value={controller}>
      <DiceRollPresentation
        pending={controller.pending}
        roll={controller.presentedRoll}
        onRollRevealed={() => undefined}
      />
      <CharacterSheetManualRoll className={liveStyles.gmDiceButton} rollModes={rollModes} />
    </CharacterSheetRollContext.Provider>
  )
}
