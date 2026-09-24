import { api } from '@artificer-toolkit/apis/convex/api'
import type {
  LiveSessionCommandDto,
  LiveSessionRecipientStateDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { SceneTransientEnvelopeDto } from '@artificer-toolkit/schema/api/vttScenes'
import { useConvex } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { betterAuthClient } from '#app/auth/betterAuthClient'
import {
  createLiveSessionConnection,
  resolveLiveSessionWebSocketUrl,
  type LiveSessionCommandCommit,
  type LiveSessionCommandRejection,
  type LiveSessionConnection,
  type LiveSessionConnectionStatus
} from './liveSessionClient'

const localSessionHostUrl = 'ws://127.0.0.1:8787'

export function useCampaignLiveSession({
  campaignId,
  enabled,
  onTransient
}: {
  campaignId: string
  enabled: boolean
  onTransient: (message: { envelope: SceneTransientEnvelopeDto; userId: string }) => void
}) {
  const connection = useRef<LiveSessionConnection | null>(null)
  const onTransientRef = useRef(onTransient)
  const convex = useConvex()
  const [commandReady, setCommandReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recipientState, setRecipientState] = useState<LiveSessionRecipientStateDto | null>(null)
  const [rejection, setRejection] = useState<LiveSessionCommandRejection | null>(null)
  const [sequence, setSequence] = useState<number | null>(null)
  const [status, setStatus] = useState<LiveSessionConnectionStatus>('DISCONNECTED')
  onTransientRef.current = onTransient

  useEffect(() => {
    if (!enabled) {
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
      (import.meta.env.DEV ? localSessionHostUrl : null)
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
      onError: (nextError) => setError(nextError.message),
      onCommandRejected: setRejection,
      onDurableState: (state) => {
        setCommandReady(state.commandReady)
        setRecipientState(state.recipientState)
        setSequence(state.sequence)
      },
      onStatus: setStatus,
      onTransient: (message) => onTransientRef.current(message),
      url: resolveLiveSessionWebSocketUrl(configuredUrl, campaignId)
    })
    connection.current = liveConnection
    return () => {
      if (connection.current === liveConnection) connection.current = null
      liveConnection.close()
    }
  }, [campaignId, convex, enabled])

  const sendCommand = useCallback(
    (command: LiveSessionCommandDto): Promise<LiveSessionCommandCommit> => {
      const current = connection.current
      if (!current) return Promise.reject(new Error('Live play is not connected.'))
      setRejection(null)
      return current.submitCommand(command)
    },
    []
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
    commandReady,
    error,
    recipientState,
    rejection,
    sendCommand,
    sendTransient,
    sequence,
    status,
    synchronizeScene
  }
}
