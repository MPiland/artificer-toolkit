import { useCallback, useEffect, useRef } from 'react'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import { useResolveCharacterBuilderMutation } from '#app/data/characters/mutations'
import type { CharacterFormValues } from '../core/characterBuilder.types'
import { normalizeCharacterForDraft } from '../shared/formNormalization'
import { getCharacterBuilderResolutionFingerprint } from './resolutionFingerprints'

type CharacterBuilderMode = 'create' | 'edit'

type InFlightCharacterResolution = {
  fingerprint: string
  promise: Promise<void>
}

export function useLatestCharacterResolution({
  expectedDraftId,
  mode,
  onResolved
}: {
  expectedDraftId: string
  mode: CharacterBuilderMode
  onResolved: (payload: CharacterBuilderPayloadDto) => void
}) {
  const { mutateAsync } = useResolveCharacterBuilderMutation()
  const inFlightRef = useRef<InFlightCharacterResolution | null>(null)
  const latestRequestIdRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      latestRequestIdRef.current += 1
      inFlightRef.current = null
    }
  }, [expectedDraftId, mode])

  return useCallback(
    (character: CharacterFormValues) => {
      const fingerprint = `${expectedDraftId}:${mode}:${getCharacterBuilderResolutionFingerprint(character)}`
      const currentRequest = inFlightRef.current
      if (currentRequest?.fingerprint === fingerprint) return currentRequest.promise

      const requestId = latestRequestIdRef.current + 1
      latestRequestIdRef.current = requestId
      const inFlight: InFlightCharacterResolution = {
        fingerprint,
        promise: Promise.resolve()
      }

      inFlight.promise = mutateAsync({
        character: normalizeCharacterForDraft(character),
        expectedDraftId,
        mode
      })
        .then((nextPayload) => {
          if (!mountedRef.current || requestId !== latestRequestIdRef.current) return
          onResolved(nextPayload)
        })
        .catch(() => {
          // Resolver failures are surfaced on explicit save/finalize actions.
        })
        .finally(() => {
          if (inFlightRef.current === inFlight) inFlightRef.current = null
        })

      inFlightRef.current = inFlight
      return inFlight.promise
    },
    [expectedDraftId, mode, mutateAsync, onResolved]
  )
}
