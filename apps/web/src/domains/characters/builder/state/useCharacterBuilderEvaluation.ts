import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characterBuilder'
import type { CharacterBuilderPreviewOutput } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import type { ContentSnapshotKind } from '@artificer-toolkit/schema/api/contentSnapshots'
import { getCharacterBuilderActiveCharacter } from '#app/data/characters/queries'
import { isContentSnapshotManifestUpdating } from '#app/data/contentSnapshots/manifestObjects'
import { holdPrivateContentSnapshots } from '#app/data/contentSnapshots/privateContent'
import {
  getContentSnapshotManifest,
  useContentSnapshotToken
} from '#app/data/contentSnapshots/queries'
import { getSystem } from '#app/data/systems/queries'
import type { CharacterFormValues } from '../core/characterBuilder.types'
import {
  createBuilderEvaluationClient,
  type BuilderEvaluationClient
} from '../evaluation/builderEvaluationClient'
import type { BuilderEvaluationRequest } from '../evaluation/builderEvaluation.types'
import { normalizeCharacterForDraft } from '../shared/formNormalization'
import type { ReadyCharacterBuilderAuthoringSession } from './characterBuilderAuthoringSession'

/** What the Builder shows about its content: still rebuilding, loading kinds, or a failure. */
export type CharacterBuilderContentStatus = {
  preparing: boolean
  updating: boolean
  loadingKinds: readonly ContentSnapshotKind[]
  /** `null` when evaluation failed without a content kind to blame; absent when it succeeded. */
  failedKind?: ContentSnapshotKind | null
}

export type CharacterBuilderEvaluation = {
  /** Null until the evaluation inputs are ready; the Builder keeps its current payload meanwhile. */
  resolve: ((values: CharacterFormValues) => Promise<CharacterBuilderPayloadDto>) | null
  preview: (values: CharacterFormValues) => Promise<CharacterBuilderPreviewOutput>
  status: CharacterBuilderContentStatus
  /** Refetches evaluation inputs that failed to load. */
  refetchInputs: () => void
}

/**
 * Builder resolution and preview in the browser worker (ADR 0036 S6), from content snapshots: the
 * live manifest, the System (D67), the open draft and, for an edit draft, the active Character it
 * replaces as the previous Character.
 */
export function useCharacterBuilderEvaluation(
  session: ReadyCharacterBuilderAuthoringSession
): CharacterBuilderEvaluation {
  const { draft } = session
  const { id: expectedDraftId, mode, userId, publicId } = draft
  const baseActiveUpdatedAt = draft.baseActiveUpdatedAt ?? null
  const { builderIntent } = draft.payload
  const manifest = useQuery(getContentSnapshotManifest(draft.systemId, draft.characterId))
  const system = useQuery(getSystem(draft.systemId))
  const active = useQuery({
    ...getCharacterBuilderActiveCharacter(draft.characterId),
    enabled: mode === 'edit'
  })
  // An edit draft needs its active Character; a missing one is a failed input, not a new Character.
  const previousCharacter = mode === 'edit' ? active.data : null
  const getToken = useContentSnapshotToken()
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken
  const [client, setClient] = useState<BuilderEvaluationClient | null>(null)
  const [loadingKinds, setLoadingKinds] = useState<readonly ContentSnapshotKind[]>([])
  const [failedKind, setFailedKind] = useState<ContentSnapshotKind | null | undefined>()

  useEffect(() => {
    // Created after mount only: no worker during SSR. The worker itself starts on first use, and
    // sign-out terminates it with the private objects it parsed.
    const created = createBuilderEvaluationClient({
      createWorker: () =>
        new Worker(new URL('../evaluation/builderEvaluation.worker.ts', import.meta.url), {
          type: 'module',
          name: 'character-builder-evaluation'
        }),
      getToken: (refresh) => getTokenRef.current(refresh),
      onLoading: setLoadingKinds
    })
    setClient(created)
    const release = holdPrivateContentSnapshots(created.terminate)
    return () => {
      release()
      created.terminate()
    }
  }, [])

  const evaluate = useMemo(() => {
    if (!client || !manifest.data || !system.data) return null
    if (mode === 'edit' && !previousCharacter) return null
    const manifestData = manifest.data
    const systemData = system.data
    const draftInput: BuilderEvaluationRequest['draft'] = {
      expectedDraftId,
      mode,
      userId,
      publicId,
      baseActiveUpdatedAt,
      builderIntent
    }
    return async (
      operation: BuilderEvaluationRequest['operation'],
      values: CharacterFormValues
    ) => {
      const result = await client.evaluate({
        operation,
        manifest: manifestData,
        system: systemData,
        draft: draftInput,
        character: normalizeCharacterForDraft(values),
        previousCharacter: previousCharacter ?? null
      })
      setFailedKind(result.ok ? undefined : result.failedKind)
      if (!result.ok) throw new Error('Character Builder evaluation failed.')
      return result.output
    }
  }, [
    baseActiveUpdatedAt,
    builderIntent,
    client,
    expectedDraftId,
    manifest.data,
    mode,
    previousCharacter,
    publicId,
    system.data,
    userId
  ])

  const resolve = useMemo(() => {
    if (!evaluate) return null
    return async (values: CharacterFormValues) => {
      const output = await evaluate('resolve', values)
      if (output.operation !== 'resolve') throw new Error('Unexpected Builder evaluation output.')
      return output.payload
    }
  }, [evaluate])

  const preview = useCallback(
    async (values: CharacterFormValues) => {
      if (!evaluate) throw new Error('Character content is still loading.')
      const output = await evaluate('preview', values)
      if (output.operation !== 'preview') throw new Error('Unexpected Builder evaluation output.')
      return output.preview
    },
    [evaluate]
  )

  const inputsFailed =
    manifest.isError ||
    system.isError ||
    system.data === null ||
    active.isError ||
    (mode === 'edit' && active.data === null)
  const status = useMemo<CharacterBuilderContentStatus>(
    () => ({
      preparing: !inputsFailed && !evaluate,
      updating: manifest.data ? isContentSnapshotManifestUpdating(manifest.data) : false,
      loadingKinds,
      ...(inputsFailed ? { failedKind: null } : failedKind === undefined ? {} : { failedKind })
    }),
    [evaluate, failedKind, inputsFailed, loadingKinds, manifest.data]
  )

  const { isError: manifestFailed, refetch: refetchManifest } = manifest
  const { isError: systemFailed, refetch: refetchSystem } = system
  const { isError: activeFailed, refetch: refetchActive } = active
  const refetchInputs = useCallback(() => {
    if (manifestFailed) void refetchManifest()
    if (systemFailed) void refetchSystem()
    if (activeFailed) void refetchActive()
  }, [activeFailed, manifestFailed, refetchActive, refetchManifest, refetchSystem, systemFailed])

  return { resolve, preview, status, refetchInputs }
}
