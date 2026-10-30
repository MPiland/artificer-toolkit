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
 * `onUnresolved` names the values whose latest request cannot produce a payload.
 */
export function useLatestCharacterResolution({
  generation,
  resolve,
  onResolved,
  onUnresolved
}: {
  generation: string
  resolve: ((character: CharacterFormValues) => Promise<CharacterBuilderPayloadDto>) | null
  onResolved: (payload: CharacterBuilderPayloadDto) => void
  onUnresolved: (fingerprint: string) => void
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
      const valuesFingerprint = getCharacterBuilderResolutionFingerprint(character)
      if (!resolve) {
        onUnresolved(valuesFingerprint)
        return Promise.resolve()
      }
      const fingerprint = `${generation}:${valuesFingerprint}`
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
          if (mountedRef.current && requestId === latestRequestIdRef.current)
            onUnresolved(valuesFingerprint)
        })
        .finally(() => {
          if (inFlightRef.current === inFlight) inFlightRef.current = null
        })

      inFlightRef.current = inFlight
      return inFlight.promise
    },
    [generation, onResolved, onUnresolved, resolve]
  )
}
