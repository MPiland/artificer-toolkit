import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characterBuilder'
import type { CharacterBuilderPreviewOutput } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import type { ContentSnapshotKind } from '@artificer-toolkit/schema/api/contentSnapshots'
import {
  usePreviewCharacterSaveMutation,
  useResolveCharacterBuilderMutation
} from '#app/data/characters/mutations'
import { isContentSnapshotManifestUpdating } from '#app/data/contentSnapshots/manifestObjects'
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
  /** True when resolution and preview run in the browser worker. */
  local: boolean
  /** Null until the snapshot inputs are ready; the Builder keeps its current payload meanwhile. */
  resolve: ((values: CharacterFormValues) => Promise<CharacterBuilderPayloadDto>) | null
  preview: (values: CharacterFormValues) => Promise<CharacterBuilderPreviewOutput>
  status: CharacterBuilderContentStatus
  /** Refetches evaluation inputs (manifest, System) that failed to load. */
  refetchInputs: () => void
}

const IDLE_STATUS: CharacterBuilderContentStatus = {
  preparing: false,
  updating: false,
  loadingKinds: []
}

/**
 * Builder resolution and preview (ADR 0036 S6). A new Character evaluates in the browser worker
 * from content snapshots: the live manifest, the System (D67) and the open draft. Editing an active
 * Character still resolves on the server until the Builder has the active Character's record,
 * which the local evaluation needs as `previousCharacter`.
 */
export function useCharacterBuilderEvaluation(
  session: ReadyCharacterBuilderAuthoringSession
): CharacterBuilderEvaluation {
  const { draft } = session
  const { id: expectedDraftId, mode, userId, publicId } = draft
  const baseActiveUpdatedAt = draft.baseActiveUpdatedAt ?? null
  const { builderIntent } = draft.payload
  const local = mode === 'create'
  const manifest = useQuery({
    ...getContentSnapshotManifest(draft.systemId, draft.characterId),
    enabled: local
  })
  const system = useQuery({ ...getSystem(draft.systemId), enabled: local })
  const getToken = useContentSnapshotToken()
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken
  const [client, setClient] = useState<BuilderEvaluationClient | null>(null)
  const [loadingKinds, setLoadingKinds] = useState<readonly ContentSnapshotKind[]>([])
  const [failedKind, setFailedKind] = useState<ContentSnapshotKind | null | undefined>()

  useEffect(() => {
    if (!local) return
    // Created after mount only: no worker during SSR. The worker itself starts on first use.
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
    return () => created.terminate()
  }, [local])

  const evaluate = useMemo(() => {
    if (!client || !manifest.data || !system.data) return null
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
        previousCharacter: null
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
    publicId,
    system.data,
    userId
  ])

  const { mutateAsync: resolveOnServer } = useResolveCharacterBuilderMutation()
  const { mutateAsync: previewOnServer } = usePreviewCharacterSaveMutation()
  const toServerInput = useCallback(
    (values: CharacterFormValues) => ({
      character: normalizeCharacterForDraft(values),
      expectedDraftId,
      mode
    }),
    [expectedDraftId, mode]
  )

  const resolve = useMemo(() => {
    if (!local) return (values: CharacterFormValues) => resolveOnServer(toServerInput(values))
    if (!evaluate) return null
    return async (values: CharacterFormValues) => {
      const output = await evaluate('resolve', values)
      if (output.operation !== 'resolve') throw new Error('Unexpected Builder evaluation output.')
      return output.payload
    }
  }, [evaluate, local, resolveOnServer, toServerInput])

  const preview = useCallback(
    async (values: CharacterFormValues) => {
      if (!local) return previewOnServer(toServerInput(values))
      if (!evaluate) throw new Error('Character content is still loading.')
      const output = await evaluate('preview', values)
      if (output.operation !== 'preview') throw new Error('Unexpected Builder evaluation output.')
      return output.preview
    },
    [evaluate, local, previewOnServer, toServerInput]
  )

  const status = useMemo<CharacterBuilderContentStatus>(() => {
    if (!local) return IDLE_STATUS
    const inputsFailed = manifest.isError || system.isError || system.data === null
    return {
      preparing: !inputsFailed && !evaluate,
      updating: manifest.data ? isContentSnapshotManifestUpdating(manifest.data) : false,
      loadingKinds,
      ...(inputsFailed ? { failedKind: null } : failedKind === undefined ? {} : { failedKind })
    }
  }, [
    evaluate,
    failedKind,
    loadingKinds,
    local,
    manifest.data,
    manifest.isError,
    system.data,
    system.isError
  ])

  const { isError: manifestFailed, refetch: refetchManifest } = manifest
  const { isError: systemFailed, refetch: refetchSystem } = system
  const refetchInputs = useCallback(() => {
    if (manifestFailed) void refetchManifest()
    if (systemFailed) void refetchSystem()
  }, [manifestFailed, refetchManifest, refetchSystem, systemFailed])

  return { local, resolve, preview, status, refetchInputs }
}
