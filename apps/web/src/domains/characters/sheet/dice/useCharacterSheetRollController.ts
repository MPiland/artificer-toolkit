import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useMutation as useConvexMutation } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { useDiscardRollMutation, useExecuteRollMutation } from '#app/data/rolls'
import { useDicePresentationPreferences } from '#app/settings/dicePreferences'
import type { CharacterSheetRollController, CharacterSheetRollRequest } from './dice.types'

export function useCharacterSheetRollController(
  characterId: string,
  campaignId?: string
): CharacterSheetRollController {
  const executeTableRoll = useConvexMutation(convexApi.campaigns.rolls.execute)
  const executeCampaignPrivateRoll = useConvexMutation(
    convexApi.campaigns.characterSheet.executeRoll
  )
  const mutation = useExecuteRollMutation()
  const campaignPrivateMutation = useMutation({
    mutationFn: (request: CharacterSheetRollRequest) => {
      if (!campaignId) throw new Error('This Character is not assigned to a Campaign.')
      return executeCampaignPrivateRoll({ campaignId, characterId, ...request })
    }
  })
  const tableMutation = useMutation({
    mutationFn: async (request: CharacterSheetRollRequest) => {
      if (!campaignId) throw new Error('This Character is not assigned to a Campaign.')
      const entry = await executeTableRoll({
        campaignId,
        room: 'TABLE',
        clientNonce: crypto.randomUUID(),
        roll: { characterId, ...request }
      })
      if (!entry.roll) throw new Error('The Campaign roll did not return roll evidence.')
      return entry.roll
    }
  })
  const discardMutation = useDiscardRollMutation()
  const [preferences] = useDicePresentationPreferences()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const [manualRoll, setManualRoll] = useState<RollRecordDto>()
  const [transientRoll, setTransientRoll] = useState<RollRecordDto>()
  const [destination, setDestination] = useState<'PRIVATE' | 'TABLE'>('PRIVATE')
  const [presentedRollPrivate, setPresentedRollPrivate] = useState(true)
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

  discardPrivateRollRef.current = discardPrivateRoll

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

  return useMemo(
    () => ({
      canPublishToTable: Boolean(campaignId),
      clearManualRoll: () => setManualRoll(undefined),
      destination: campaignId ? destination : 'PRIVATE',
      dismissRoll: (discard = false) => {
        const discardedPendingRoll = settlePendingPresentation()
        const roll = transientRoll ?? manualRoll
        setManualRoll(undefined)
        setTransientRoll(undefined)
        if (discard && !discardedPendingRoll && roll && presentedRollPrivate)
          discardPrivateRoll(roll)
      },
      executeRoll: (request: CharacterSheetRollRequest) => {
        settlePendingPresentation()
        setManualRoll(undefined)
        setTransientRoll(undefined)
        const isPrivate = !campaignId || destination === 'PRIVATE'
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
              void import('./diceModelPreload')
                .then(({ preloadDiceModels }) => preloadDiceModels(request.expression))
                .catch(() => undefined)
            }
            const roll = isPrivate
              ? campaignId
                ? await campaignPrivateMutation.mutateAsync(request)
                : await mutation.mutateAsync({ characterId, ...request })
              : await tableMutation.mutateAsync(request)
            if (pendingPresentation.current !== pending) {
              if (isPrivate) discardPrivateRoll(roll)
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
      pending: mutation.isPending || campaignPrivateMutation.isPending || tableMutation.isPending,
      pendingRequest: mutation.isPending
        ? mutation.variables
        : campaignPrivateMutation.isPending
          ? campaignPrivateMutation.variables
          : tableMutation.isPending
            ? tableMutation.variables
            : undefined,
      presentationPending,
      presentedRoll: transientRoll ?? manualRoll,
      presentedRollPrivate,
      revealRoll: (rollId) => {
        const pending = pendingPresentation.current
        if (pending?.roll?.id === rollId) settlePendingPresentation(pending.roll)
      },
      setDestination: (nextDestination) => setDestination(campaignId ? nextDestination : 'PRIVATE')
    }),
    [
      campaignId,
      campaignPrivateMutation,
      characterId,
      destination,
      discardMutation,
      manualRoll,
      mutation,
      preferences.animate3d,
      presentationPending,
      presentedRollPrivate,
      reducedMotion,
      tableMutation,
      transientRoll
    ]
  )
}
