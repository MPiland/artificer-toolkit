import { useCallback, useEffect, useRef } from 'react'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import { useResolveCharacterBuilderMutation } from '#app/data/characters/mutations'
import {
  getCharacterBuilderResolutionFingerprint,
  normalizeCharacterForDraft,
  type CharacterFormValues
} from '../characterBuilder.utils'

type CharacterBuilderMode = 'create' | 'edit'

type InFlightCharacterResolution = {
  controller: AbortController
  fingerprint: string
  promise: Promise<void>
}

export function useLatestCharacterResolution({
  mode,
  onResolved
}: {
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
      inFlightRef.current?.controller.abort()
      inFlightRef.current = null
    }
  }, [])

  return useCallback(
    (character: CharacterFormValues) => {
      const fingerprint = `${mode}:${getCharacterBuilderResolutionFingerprint(character)}`
      const currentRequest = inFlightRef.current
      if (currentRequest?.fingerprint === fingerprint) return currentRequest.promise

      currentRequest?.controller.abort()
      const requestId = latestRequestIdRef.current + 1
      latestRequestIdRef.current = requestId
      const controller = new AbortController()
      const inFlight: InFlightCharacterResolution = {
        controller,
        fingerprint,
        promise: Promise.resolve()
      }

      inFlight.promise = mutateAsync({
        request: {
          character: normalizeCharacterForDraft(character),
          mode
        },
        signal: controller.signal
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
    [mode, mutateAsync, onResolved]
  )
}
