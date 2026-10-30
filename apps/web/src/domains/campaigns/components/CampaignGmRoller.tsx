import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type { OfferedRollModeDto } from '@artificer-toolkit/schema/shared/systemCoreCode'
import { useDicePresentationPreferences } from '#app/settings/dicePreferences'
import { useGmRollVisibilityPreference } from '#app/settings/useGmRollVisibilityPreference'
import { CharacterSheetManualRoll } from '#domains/characters/sheet/dice/CharacterSheetManualRoll'
import { DiceRollPresentation } from '#app/components/dice/DiceRollPresentation'
import type {
  CharacterSheetRollDestination,
  CharacterSheetRollDestinations,
  CharacterSheetRollRequest,
  CharacterSheetRolls
} from '#domains/characters/sheet/dice/dice.types'
import {
  gmRollDestination,
  gmRollDestinationOptions,
  gmRollVisibility,
  noRollDestinationOptions
} from '#domains/characters/sheet/dice/dice.utils'
import {
  CharacterSheetRollContext,
  CharacterSheetRollDestinationContext
} from '#domains/characters/sheet/dice/rollContext'
import { useCampaignChatRoom } from '../vtt/useCampaignChatRoom'
import * as liveStyles from './campaignLive.css'

export function CampaignGmRoller({
  campaignId,
  rollModes
}: {
  campaignId: string
  rollModes: readonly OfferedRollModeDto[]
}) {
  const { executePrivateRoll, executeRoll: executeTableRoll } = useCampaignChatRoom(campaignId)
  const [preferences] = useDicePresentationPreferences()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const { gmRollVisibility: visibility, setGmRollVisibility } = useGmRollVisibilityPreference()
  const destination = gmRollDestination(visibility)
  const [roll, setRoll] = useState<RollRecordDto>()
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
    onSuccess: setRoll
  })

  const destinations = useMemo<CharacterSheetRollDestinations>(
    () => ({
      destination,
      destinationOptions: gmRollDestinationOptions,
      setDestination: (next) => setGmRollVisibility(gmRollVisibility(next)),
      // Manual GM rolls never change Character state.
      stateRollDestination: destination,
      stateRollDestinationOptions: noRollDestinationOptions
    }),
    [destination, setGmRollVisibility]
  )

  const rolls = useMemo<CharacterSheetRolls>(
    () => ({
      clearManualRoll: () => setRoll(undefined),
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
      pendingRequest: mutation.variables?.request
    }),
    [destination, mutation, preferences.animate3d, reducedMotion, roll]
  )

  return (
    <CharacterSheetRollContext.Provider value={rolls}>
      <CharacterSheetRollDestinationContext.Provider value={destinations}>
        <DiceRollPresentation
          pending={mutation.isPending}
          roll={roll}
          onRollRevealed={() => undefined}
        />
        <CharacterSheetManualRoll className={liveStyles.gmDiceButton} rollModes={rollModes} />
      </CharacterSheetRollDestinationContext.Provider>
    </CharacterSheetRollContext.Provider>
  )
}
