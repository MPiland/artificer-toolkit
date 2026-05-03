import { useCallback, useEffect, useRef } from 'react'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import { useResolveCharacterBuilderMutation } from '#app/data/characters/mutations'
import {
  normalizeCharacterForDraft,
  type CharacterFormValues
} from '../characterBuilder.utils'

type CharacterBuilderMode = 'create' | 'edit'

export function useLatestCharacterResolution({
  mode,
  onResolved
}: {
  mode: CharacterBuilderMode
  onResolved: (payload: CharacterBuilderPayloadDto) => void
}) {
  const { mutateAsync } = useResolveCharacterBuilderMutation()
  const latestRequestIdRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => () => {
    mountedRef.current = false
    latestRequestIdRef.current += 1
  }, [])

  return useCallback(async (character: CharacterFormValues) => {
    const requestId = latestRequestIdRef.current + 1
    latestRequestIdRef.current = requestId

    try {
      const nextPayload = await mutateAsync({
        character: normalizeCharacterForDraft(character),
        mode
      })

      if (!mountedRef.current || requestId !== latestRequestIdRef.current) return
      onResolved(nextPayload)
    } catch {
      // Resolver failures are surfaced on explicit save/finalize actions.
    }
  }, [
    mode,
    mutateAsync,
    onResolved
  ])
}
