import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useMutation as useConvexMutation } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { useDiscardRollMutation, useExecuteRollMutation } from '#app/data/rolls'
import { useDicePresentationPreferences } from '#app/settings/dicePreferences'
import { useGmRollVisibilityPreference } from '#app/settings/useGmRollVisibilityPreference'
import { useCampaignChatRoom } from '#domains/campaigns/vtt/useCampaignChatRoom'
import type {
  CharacterSheetRollController,
  CharacterSheetRollDestination,
  CharacterSheetRollDestinations,
  CharacterSheetRollPresentation,
  CharacterSheetRollRequest,
  CharacterSheetRolls
} from './dice.types'
import {
  gmRollDestination,
  gmRollDestinationOptions,
  gmRollVisibility,
  gmStateRollDestinationOptions,
  noRollDestinationOptions,
  playerRollDestinationOptions,
  playerStateRollDestinationOptions
} from './dice.utils'

export function useCharacterSheetRollController(
  characterId: string,
  campaign?: { id: string; isGm: boolean }
): CharacterSheetRollController {
  const campaignId = campaign?.id
  const isGm = campaign?.isGm ?? false
  const {
    executePrivateRoll: executeGmPrivateRoll,
    executeRoll: executeCampaignRoll,
    revealRoll: revealPrivateRoll
  } = useCampaignChatRoom(campaignId)
  const { gmRollVisibility: gmChoice, setGmRollVisibility } = useGmRollVisibilityPreference()
  const executeCampaignPrivateRoll = useConvexMutation(
    convexApi.campaigns.characterSheet.executeRoll
  )
  const mutation = useExecuteRollMutation()
  const campaignMutation = useMutation({
    mutationFn: async ({
      request,
      destination: target
    }: {
      request: CharacterSheetRollRequest
      destination: CharacterSheetRollDestination
    }): Promise<RollRecordDto | undefined> => {
      if (!campaignId) throw new Error('This Character is not assigned to a Campaign.')
      const roll = { characterId, ...request }
      if (target === 'TABLE' || target === 'GM') {
        const entry = await executeCampaignRoll({
          campaignId,
          destination: target,
          clientNonce: crypto.randomUUID(),
          roll
        })
        if (!entry.roll) throw new Error('The Campaign roll did not return roll evidence.')
        return entry.roll
      }
      if (!isGm) return executeCampaignPrivateRoll({ campaignId, ...roll })
      return executeGmPrivateRoll({ campaignId, clientNonce: crypto.randomUUID(), roll })
    }
  })
  const discardMutation = useDiscardRollMutation()
  const [preferences] = useDicePresentationPreferences()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const [manualRoll, setManualRoll] = useState<RollRecordDto>()
  const [transientRoll, setTransientRoll] = useState<RollRecordDto>()
  const [playerDestination, setPlayerDestination] = useState<CharacterSheetRollDestination>('TABLE')
  // The GM's choice is their remembered Public/Private preference, not local state.
  const destination = isGm ? gmRollDestination(gmChoice) : playerDestination
  const [presentedRollPrivate, setPresentedRollPrivate] = useState(true)
  const stateRollDestinationOptions = !campaignId
    ? noRollDestinationOptions
    : isGm
      ? gmStateRollDestinationOptions
      : playerStateRollDestinationOptions
  // A destination the state-changing subset lacks (Just me) falls back to Table.
  const stateRollDestination = !campaignId
    ? 'PRIVATE'
    : stateRollDestinationOptions.some((option) => option.value === destination)
      ? destination
      : 'TABLE'
  const [presentationPending, setPresentationPending] = useState(false)
  const discardPrivateRollRef = useRef<(roll: RollRecordDto) => void>(() => undefined)
  const pendingPresentation = useRef<
    | {
        isPrivate: boolean
        resolve: (roll: RollRecordDto | undefined) => void
        roll?: RollRecordDto
      }
    | undefined
  >(undefined)

  function discardPrivateRoll(roll: RollRecordDto) {
    void discardMutation.mutateAsync(roll.id).catch(() =>
      notifications.show({
        color: 'red',
        message: 'The canceled roll could not be removed from history.'
      })
    )
  }

  useEffect(() => {
    discardPrivateRollRef.current = discardPrivateRoll
  })

  function settlePendingPresentation(roll?: RollRecordDto) {
    const pending = pendingPresentation.current
    if (!pending) return false
    pendingPresentation.current = undefined
    setPresentationPending(false)
    const pendingPrivateRoll = roll === undefined && pending.isPrivate ? pending.roll : undefined
    if (pendingPrivateRoll) discardPrivateRoll(pendingPrivateRoll)
    pending.resolve(roll)
    return pendingPrivateRoll !== undefined
  }

  useEffect(() => {
    return () => {
      const pending = pendingPresentation.current
      if (!pending) return
      pendingPresentation.current = undefined
      if (pending.isPrivate && pending.roll) discardPrivateRollRef.current(pending.roll)
      pending.resolve(undefined)
    }
  }, [])

  const destinations = useMemo<CharacterSheetRollDestinations>(
    () => ({
      destination: campaignId ? destination : 'PRIVATE',
      destinationOptions: !campaignId
        ? noRollDestinationOptions
        : isGm
          ? gmRollDestinationOptions
          : playerRollDestinationOptions,
      setDestination: (nextDestination) => {
        if (!campaignId) return
        if (isGm) setGmRollVisibility(gmRollVisibility(nextDestination))
        else setPlayerDestination(nextDestination)
      },
      stateRollDestination,
      stateRollDestinationOptions
    }),
    [
      campaignId,
      destination,
      isGm,
      setGmRollVisibility,
      stateRollDestination,
      stateRollDestinationOptions
    ]
  )

  const presentation = useMemo<CharacterSheetRollPresentation>(
    () => ({
      dismissRoll: (discard = false) => {
        const discardedPendingRoll = settlePendingPresentation()
        const roll = transientRoll ?? manualRoll
        setManualRoll(undefined)
        setTransientRoll(undefined)
        if (discard && !discardedPendingRoll && roll && presentedRollPrivate)
          discardPrivateRoll(roll)
      },
      presentationPending,
      presentedRoll: transientRoll ?? manualRoll,
      presentedRollPrivate,
      revealRoll: (rollId) => {
        const pending = pendingPresentation.current
        if (pending?.roll?.id === rollId) settlePendingPresentation(pending.roll)
      },
      revealPrivateRoll
    }),
    [
      discardMutation,
      manualRoll,
      presentationPending,
      presentedRollPrivate,
      revealPrivateRoll,
      transientRoll
    ]
  )

  const rolls = useMemo<CharacterSheetRolls>(
    () => ({
      clearManualRoll: () => setManualRoll(undefined),
      executeRoll: (request: CharacterSheetRollRequest) => {
        const target = request.source.kind === 'HIT_DIE' ? stateRollDestination : destination
        settlePendingPresentation()
        setManualRoll(undefined)
        setTransientRoll(undefined)
        const isPrivate = !campaignId || target === 'PRIVATE'
        let resolvePresentation!: (roll: RollRecordDto | undefined) => void
        const result = new Promise<RollRecordDto | undefined>((resolve) => {
          resolvePresentation = resolve
        })
        const pending: NonNullable<typeof pendingPresentation.current> = {
          isPrivate,
          resolve: resolvePresentation
        }
        pendingPresentation.current = pending
        setPresentationPending(true)
        void (async () => {
          try {
            if (preferences.animate3d && !reducedMotion) {
              void import('#app/components/dice/diceModelPreload')
                .then(({ preloadDiceModels }) => preloadDiceModels(request.expression))
                .catch(() => undefined)
            }
            const roll = campaignId
              ? await campaignMutation.mutateAsync({ request, destination: target })
              : await mutation.mutateAsync({ characterId, ...request })
            if (pendingPresentation.current !== pending) {
              if (isPrivate && roll) discardPrivateRoll(roll)
              return
            }
            if (!roll) {
              settlePendingPresentation()
              return
            }
            pending.roll = roll
            setPresentedRollPrivate(isPrivate)
            if (request.source.kind === 'MANUAL') {
              setTransientRoll(undefined)
              setManualRoll(roll)
            } else {
              setManualRoll(undefined)
              setTransientRoll(roll)
            }
          } catch (error) {
            if (pendingPresentation.current !== pending) return
            notifications.show({
              color: 'red',
              message: error instanceof Error ? error.message : 'The dice could not be rolled.'
            })
            settlePendingPresentation()
          }
        })()
        return result
      },
      hasManualRoll: Boolean(manualRoll),
      pending: mutation.isPending || campaignMutation.isPending,
      pendingRequest: mutation.isPending
        ? mutation.variables
        : campaignMutation.isPending
          ? campaignMutation.variables?.request
          : undefined
    }),
    [
      campaignId,
      campaignMutation,
      characterId,
      destination,
      discardMutation,
      manualRoll,
      mutation,
      preferences.animate3d,
      reducedMotion,
      stateRollDestination
    ]
  )

  return { destinations, presentation, rolls }
}
