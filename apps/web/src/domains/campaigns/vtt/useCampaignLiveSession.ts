import type { LiveSessionCommandDto } from '@artificer-toolkit/schema/api/liveSessions'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { SceneTransientEnvelopeDto } from '@artificer-toolkit/schema/api/vttScenes'
import type {
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  createLiveSessionConnection,
  resolveLiveSessionWebSocketUrl,
  type LiveSessionConnection,
  type LiveSessionConnectionStatus
} from './liveSessionClient'
import {
  applyLiveSessionServerMessage,
  emptyLiveSessionSceneState,
  withLiveSessionAggregateVersion,
  type LiveSessionSceneState
} from './liveSessionSceneState'

const localSessionHostUrl = 'ws://127.0.0.1:2567'

export function useCampaignLiveSession({
  campaignId,
  enabled,
  onTransient,
  sessionId
}: {
  campaignId: string
  enabled: boolean
  onTransient: (message: { envelope: SceneTransientEnvelopeDto; userId: string }) => void
  sessionId: string
}) {
  const connection = useRef<LiveSessionConnection | null>(null)
  const aggregateVersions = useRef<LiveSessionSceneState['aggregateVersions']>([])
  const onTransientRef = useRef(onTransient)
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [pendingEncounterCommandIds, setPendingEncounterCommandIds] = useState<string[]>([])
  const [state, setState] = useState<LiveSessionSceneState>(emptyLiveSessionSceneState)
  const [status, setStatus] = useState<LiveSessionConnectionStatus>('DISCONNECTED')
  onTransientRef.current = onTransient

  useEffect(() => {
    if (!enabled) {
      aggregateVersions.current = []
      setPendingEncounterCommandIds([])
      setState(emptyLiveSessionSceneState)
      setStatus('DISCONNECTED')
      return
    }
    setError(null)
    setPendingEncounterCommandIds([])
    setState(emptyLiveSessionSceneState)
    const configuredUrl =
      import.meta.env.VITE_LIVE_SESSION_WEBSOCKET_URL ??
      (import.meta.env.DEV ? localSessionHostUrl : null)
    if (!configuredUrl) {
      setError('Live play is not configured for this deployment.')
      return
    }
    const liveConnection = createLiveSessionConnection({
      getTicket: () => api.campaigns.sessions.ticket({ campaignId, sessionId }),
      onError: (nextError) => setError(nextError.message),
      onMessage: (message) => {
        if (message.type === 'READY') {
          const previousAggregateVersions = aggregateVersions.current
          aggregateVersions.current = message.aggregateVersions
          if (previousAggregateVersions.length > 0) {
            const previousVersions = new Map(
              previousAggregateVersions.map((version) => [
                `${version.aggregateKind}:${version.aggregateId}`,
                version.version
              ])
            )
            const nextVersions = new Map(
              message.aggregateVersions.map((version) => [
                `${version.aggregateKind}:${version.aggregateId}`,
                version.version
              ])
            )
            const changed = new Set([...previousVersions.keys(), ...nextVersions.keys()])
            const changedCharacterIds = [...changed].flatMap((key) => {
              if (!key.startsWith('CHARACTER:')) return []
              return previousVersions.get(key) === nextVersions.get(key) ? [] : [key.slice(10)]
            })
            for (const characterId of changedCharacterIds) {
              void queryClient.invalidateQueries({
                queryKey: queryKeys.characters.sheet(characterId)
              })
              void queryClient.invalidateQueries({
                queryKey: queryKeys.characters.panels(characterId)
              })
              void queryClient.invalidateQueries({
                queryKey: queryKeys.characters.preparationOptions(characterId)
              })
              void queryClient.invalidateQueries({
                exact: true,
                queryKey: queryKeys.characters.detail(characterId)
              })
              void queryClient.invalidateQueries({
                queryKey: queryKeys.characters.draft(characterId)
              })
            }
            if (changedCharacterIds.length > 0) {
              void queryClient.invalidateQueries({ queryKey: queryKeys.characters.list() })
            }
            if (
              previousVersions.get(`CAMPAIGN:${campaignId}`) !==
              nextVersions.get(`CAMPAIGN:${campaignId}`)
            ) {
              void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all() })
            }
            if (
              [...changed].some(
                (key) =>
                  (key.startsWith('ENCOUNTER:') || key.startsWith('SCENE:')) &&
                  previousVersions.get(key) !== nextVersions.get(key)
              )
            ) {
              void queryClient.invalidateQueries({
                queryKey: queryKeys.encounters.list(campaignId)
              })
            }
          }
        } else if (message.type === 'COMMAND_COMMITTED') {
          aggregateVersions.current = withLiveSessionAggregateVersion(
            aggregateVersions.current,
            message.aggregateKind,
            message.aggregateId,
            message.version
          )
        }
        if (message.type === 'COMMAND_REJECTED') {
          setError(message.message)
          if (message.code === 'UNAUTHORIZED' && message.commandId === null) {
            void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all() })
          }
          if (message.commandId) {
            setPendingEncounterCommandIds((current) =>
              current.filter((commandId) => commandId !== message.commandId)
            )
          }
        } else if (message.type === 'COMMAND_COMMITTED' || message.type === 'READY') {
          setError(null)
        }
        if (message.type === 'COMMAND_COMMITTED') {
          setPendingEncounterCommandIds((current) =>
            current.filter((commandId) => commandId !== message.originCommandId)
          )
          if (message.aggregateKind === 'ENCOUNTER') {
            const queryKey = queryKeys.encounters.list(campaignId)
            const knownVersion =
              aggregateVersions.current.find(
                (candidate) =>
                  candidate.aggregateKind === 'ENCOUNTER' &&
                  candidate.aggregateId === message.aggregateId
              )?.version ?? message.version
            if (message.response && message.version >= knownVersion) {
              queryClient.setQueryData<
                Array<EncounterGmProjectionDto | EncounterPlayerProjectionDto>
              >(queryKey, (current) =>
                current?.map((encounter) =>
                  encounter.id === message.response!.projection.id
                    ? message.response!.projection
                    : encounter
                )
              )
            } else {
              void queryClient.invalidateQueries({ queryKey })
            }
          } else if (message.aggregateKind === 'CHARACTER') {
            const sheetKey = queryKeys.characters.sheet(message.aggregateId)
            const panelsKey = queryKeys.characters.panels(message.aggregateId)
            void queryClient.invalidateQueries({
              queryKey: queryKeys.characters.preparationOptions(message.aggregateId)
            })
            const cachedVersion =
              queryClient.getQueryData<CharacterSheetResponseDto>(sheetKey)?.meta.streamVersion ?? 0
            const knownVersion =
              aggregateVersions.current.find(
                (candidate) =>
                  candidate.aggregateKind === 'CHARACTER' &&
                  candidate.aggregateId === message.aggregateId
              )?.version ?? message.version
            if (
              message.response &&
              message.version >= knownVersion &&
              message.response.streamVersion >= cachedVersion
            ) {
              queryClient.setQueryData(sheetKey, message.response.sheet)
              for (const panel of message.response.panels ?? []) {
                queryClient.setQueryData(
                  queryKeys.characters.panel(message.aggregateId, panel.target),
                  panel
                )
              }
              void queryClient.invalidateQueries({ queryKey: panelsKey, refetchType: 'none' })
            } else {
              void queryClient.invalidateQueries({ queryKey: sheetKey })
              void queryClient.invalidateQueries({ queryKey: panelsKey })
            }
            void queryClient.invalidateQueries({
              exact: true,
              queryKey: queryKeys.characters.detail(message.aggregateId)
            })
            void queryClient.invalidateQueries({ queryKey: queryKeys.characters.list() })
          }
        }
        try {
          setState((current) => applyLiveSessionServerMessage(current, message))
        } catch (nextError) {
          setError(
            nextError instanceof Error ? nextError.message : 'Unable to apply the live update.'
          )
        }
      },
      onStatus: setStatus,
      onTransient: (message) => onTransientRef.current(message),
      url: resolveLiveSessionWebSocketUrl(configuredUrl, sessionId)
    })
    connection.current = liveConnection
    return () => {
      if (connection.current === liveConnection) connection.current = null
      liveConnection.close()
    }
  }, [campaignId, enabled, queryClient, sessionId])

  const sendCommand = useCallback((command: LiveSessionCommandDto) => {
    const sent = connection.current?.sendCommand(command) ?? false
    if (!sent) {
      setError('Live play is reconnecting. Try that action again in a moment.')
    } else if (command.aggregateKind === 'ENCOUNTER') {
      setPendingEncounterCommandIds((current) => [...current, command.command.commandId])
    }
    return sent
  }, [])

  const executeCommand = useCallback((command: LiveSessionCommandDto) => {
    const activeConnection = connection.current
    if (!activeConnection) {
      return Promise.reject(
        new Error('Live play is reconnecting. Try that action again in a moment.')
      )
    }
    return activeConnection.executeCommand(command)
  }, [])

  const getAggregateVersion = useCallback(
    (
      aggregateKind: LiveSessionSceneState['aggregateVersions'][number]['aggregateKind'],
      id: string
    ) =>
      aggregateVersions.current.find(
        (candidate) => candidate.aggregateKind === aggregateKind && candidate.aggregateId === id
      )?.version ?? null,
    []
  )

  const sendTransient = useCallback((envelope: SceneTransientEnvelopeDto) => {
    return connection.current?.sendTransient(envelope) ?? false
  }, [])

  return {
    encounterCommandPending: pendingEncounterCommandIds.length > 0,
    error,
    executeCommand,
    getAggregateVersion,
    sendCommand,
    sendTransient,
    state,
    status
  }
}
