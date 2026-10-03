import { api } from '@artificer-toolkit/apis/convex/api'
import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { RollHistoryEntryDto } from '@artificer-toolkit/schema/api/rolls'
import type { CharacterSheetCommandResponseDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  LiveSessionCommandDto,
  LiveSessionRecipientStateDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type {
  SceneCommandInputDto,
  SceneTransientEnvelopeDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { useConvex } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { betterAuthClient } from '#app/auth/betterAuthClient'
import { errorMessage } from '#app/lib/errorMessage'
import { LOCAL_SESSION_WORKER_URL } from '#app/lib/sessionWorkerOrigin'
import {
  createLiveSessionConnection,
  resolveLiveSessionWebSocketUrl,
  type LiveSessionCharacterSheetPush,
  type LiveSessionCommandCommit,
  type LiveSessionCommandRejection,
  type LiveSessionConnection,
  type LiveSessionConnectionStatus
} from './liveSessionClient'

export function useCampaignLiveSession({
  campaignId,
  characterSheetId = null,
  enabled,
  onCampaignChatEntry,
  onPrivateRoll,
  onTransient
}: {
  campaignId: string
  /** The held Character whose viewer-projected Sheet the room pushes (D73). */
  characterSheetId?: string | null
  enabled: boolean
  /** An entry the room pushed to this member's conversations; deduplicate by entry id. */
  onCampaignChatEntry?: (entry: CampaignChatEntryDto) => void
  /** The GM's retained roll as the room now holds it; deduplicate by roll id. */
  onPrivateRoll?: (roll: RollHistoryEntryDto) => void
  onTransient?: (message: { envelope: SceneTransientEnvelopeDto; userId: string }) => void
}) {
  const connection = useRef<LiveSessionConnection | null>(null)
  const onTransientRef = useRef(onTransient)
  const onCampaignChatEntryRef = useRef(onCampaignChatEntry)
  const onPrivateRollRef = useRef(onPrivateRoll)
  const convex = useConvex()
  const [characterSheet, setCharacterSheet] = useState<LiveSessionCharacterSheetPush | null>(null)
  const [commandReady, setCommandReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recipientState, setRecipientState] = useState<LiveSessionRecipientStateDto | null>(null)
  const [rejection, setRejection] = useState<LiveSessionCommandRejection | null>(null)
  const [sequence, setSequence] = useState<number | null>(null)
  const [status, setStatus] = useState<LiveSessionConnectionStatus>('DISCONNECTED')
  onTransientRef.current = onTransient
  onCampaignChatEntryRef.current = onCampaignChatEntry
  onPrivateRollRef.current = onPrivateRoll

  useEffect(() => {
    if (!enabled) {
      setCharacterSheet(null)
      setCommandReady(false)
      setRecipientState(null)
      setRejection(null)
      setSequence(null)
      setStatus('DISCONNECTED')
      return
    }
    setError(null)
    setRejection(null)
    const configuredUrl =
      import.meta.env.VITE_LIVE_SESSION_WEBSOCKET_URL ??
      (import.meta.env.DEV ? LOCAL_SESSION_WORKER_URL : null)
    if (!configuredUrl) {
      setError('Live play is not configured for this deployment.')
      return
    }
    const liveConnection = createLiveSessionConnection({
      getAccessToken: async () => {
        const result = await betterAuthClient.convex.token({ fetchOptions: { throw: false } })
        const accessToken = result.data?.token
        if (!accessToken) throw new Error('Unable to authenticate live play.')
        return accessToken
      },
      getTicket: () => convex.action(api.liveSessions.tickets.issue, { campaignId }),
      onError: (nextError) => setError(errorMessage(nextError)),
      onCampaignChatEntry: (entry) => onCampaignChatEntryRef.current?.(entry),
      onPrivateRoll: (roll) => onPrivateRollRef.current?.(roll),
      onCharacterSheet: setCharacterSheet,
      onCommandRejected: setRejection,
      onDurableState: (state) => {
        setCommandReady(state.commandReady)
        setRecipientState(state.recipientState)
        setSequence(state.sequence)
      },
      onStatus: setStatus,
      onTransient: (message) => onTransientRef.current?.(message),
      url: resolveLiveSessionWebSocketUrl(configuredUrl, campaignId)
    })
    connection.current = liveConnection
    return () => {
      if (connection.current === liveConnection) connection.current = null
      liveConnection.close()
    }
  }, [campaignId, convex, enabled])

  useEffect(() => {
    connection.current?.subscribeCharacterSheet(enabled ? characterSheetId : null)
    return () => setCharacterSheet(null)
  }, [campaignId, characterSheetId, enabled])

  const sendCommand = useCallback(
    (command: LiveSessionCommandDto): Promise<LiveSessionCommandCommit> => {
      const current = connection.current
      if (!current) return Promise.reject(new Error('Live play is not connected.'))
      setRejection(null)
      return current.submitCommand(command)
    },
    []
  )
  const sendSceneFog = useCallback(
    (
      command: Extract<SceneCommandInputDto, { type: 'PATCH_SCENE_FOG' }>
    ): Promise<LiveSessionCommandCommit> => {
      const current = connection.current
      if (!current) return Promise.reject(new Error('Live play is not connected.'))
      setRejection(null)
      return current.submitSceneFog(command)
    },
    []
  )
  // Every Encounter command enters through the room, which runs or forwards it (live-sessions.md).
  const sendEncounterCommand = useCallback(
    async (
      command: Extract<LiveSessionCommandDto, { scope: 'ENCOUNTER' }>['command']
    ): Promise<EncounterCommandResultDto> => {
      const commit = await sendCommand({ command, scope: 'ENCOUNTER' })
      if (commit.delta?.scope !== 'ENCOUNTER')
        throw new Error('Live play acknowledged the Encounter command without a result.')
      return commit.delta.result
    },
    [sendCommand]
  )
  const sendCharacterSheetCommand = useCallback(
    async (
      input: Omit<Extract<LiveSessionCommandDto, { scope: 'CHARACTER_SHEET' }>, 'scope'>
    ): Promise<CharacterSheetCommandResponseDto> => {
      const commit = await sendCommand({ ...input, scope: 'CHARACTER_SHEET' })
      if (commit.delta?.scope !== 'CHARACTER_SHEET')
        throw new Error('Live play acknowledged the Sheet command without a result.')
      return commit.delta.result
    },
    [sendCommand]
  )
  const sendTransient = useCallback((envelope: SceneTransientEnvelopeDto) => {
    return connection.current?.sendTransient(envelope) ?? false
  }, [])
  const synchronizeScene = useCallback(
    (sceneId: string, version: number, expectedPresentationVersion: number) => {
      connection.current?.synchronizeScene(sceneId, version, expectedPresentationVersion)
    },
    []
  )

  return {
    characterSheet,
    commandReady,
    error,
    recipientState,
    rejection,
    sendCharacterSheetCommand,
    sendCommand,
    sendEncounterCommand,
    sendSceneFog,
    sendTransient,
    sequence,
    status,
    synchronizeScene
  }
}
