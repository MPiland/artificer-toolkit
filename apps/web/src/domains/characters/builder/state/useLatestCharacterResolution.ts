import { useCallback, useEffect, useRef } from 'react'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import type { CharacterFormValues } from '../core/characterBuilder.types'
import { getCharacterBuilderResolutionFingerprint } from './resolutionFingerprints'

type InFlightCharacterResolution = {
  fingerprint: string
  promise: Promise<void>
}

/**
 * Resolves Builder values through `resolve`, coalescing identical in-flight requests and applying
 * only the latest response of the current draft generation. Without `resolve` (evaluation inputs
 * still loading) a request does nothing; the Builder re-requests once `resolve` changes.
 */
export function useLatestCharacterResolution({
  generation,
  resolve,
  onResolved
}: {
  generation: string
  resolve: ((character: CharacterFormValues) => Promise<CharacterBuilderPayloadDto>) | null
  onResolved: (payload: CharacterBuilderPayloadDto) => void
}) {
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
  }, [generation])

  return useCallback(
    (character: CharacterFormValues) => {
      if (!resolve) return Promise.resolve()
      const fingerprint = `${generation}:${getCharacterBuilderResolutionFingerprint(character)}`
      const currentRequest = inFlightRef.current
      if (currentRequest?.fingerprint === fingerprint) return currentRequest.promise

      const requestId = latestRequestIdRef.current + 1
      latestRequestIdRef.current = requestId
      const inFlight: InFlightCharacterResolution = {
        fingerprint,
        promise: Promise.resolve()
      }

      inFlight.promise = resolve(character)
        .then((nextPayload) => {
          if (!mountedRef.current || requestId !== latestRequestIdRef.current) return
          onResolved(nextPayload)
        })
        .catch(() => {
          // Evaluation failures are surfaced by the Builder's content status and on finalize.
        })
        .finally(() => {
          if (inFlightRef.current === inFlight) inFlightRef.current = null
        })

      inFlightRef.current = inFlight
      return inFlight.promise
    },
    [generation, onResolved, resolve]
  )
}
