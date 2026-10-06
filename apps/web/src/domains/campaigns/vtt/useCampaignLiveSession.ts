import { api } from '@artificer-toolkit/apis/convex/api'
import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import { LIVE_SESSION_REAUTHENTICATION_LEAD_MS } from '@artificer-toolkit/schema/api/liveSessionIdentity'
import type { RollHistoryEntryDto } from '@artificer-toolkit/schema/api/rolls'
import type { CharacterSheetCommandResponseDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { EncounterReadDto } from '@artificer-toolkit/schema/api/encounterRead'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterSessionFrameDto,
  LiveCampaignSummaryDto,
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

/**
 * Reads `exp` from the access token's payload, or 0 when it has none, so the token is not reused. The
 * room verifies the token; the client only schedules reuse.
 */
function accessTokenExpiresAtMs(token: string): number {
  try {
    const payload = token.split('.')[1] ?? ''
    const claims: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    const exp = typeof claims === 'object' && claims !== null && 'exp' in claims ? claims.exp : null
    return typeof exp === 'number' ? exp * 1000 : 0
  } catch {
    return 0
  }
}

/** The Encounter session while the room holds the Campaign's Run; otherwise Convex is the source. */
export type HeldEncounterSession = Extract<EncounterSessionFrameDto, { held: true }>

export function useCampaignLiveSession({
  campaignId,
  campaignSummary: followsCampaignSummary = false,
  characterSheetId = null,
  enabled,
  encounterSession = null,
  onCampaignChatEntry,
  onPrivateRoll,
  onTransient
}: {
  campaignId: string
  /** Follows the room's live Campaign summary, which Pages outside the table read (ADR 0035 A19). */
  campaignSummary?: boolean
  /** The held Character whose viewer-projected Sheet the room pushes (D73). */
  characterSheetId?: string | null
  enabled: boolean
  /** Follows the room's Encounter session while it holds one; `timeline` adds the newest timeline page. */
  encounterSession?: { timeline: boolean } | null
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
  const [campaignSummary, setCampaignSummary] = useState<LiveCampaignSummaryDto | null>(null)
  const [characterSheet, setCharacterSheet] = useState<LiveSessionCharacterSheetPush | null>(null)
  const [heldEncounterSession, setHeldEncounterSession] = useState<HeldEncounterSession | null>(
    null
  )
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
      setCampaignSummary(null)
      setCharacterSheet(null)
      setHeldEncounterSession(null)
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
    // Reused until the room would challenge it again, so a woken room's re-challenge costs no fetch.
    let cachedToken: { expiresAtMs: number; value: string } | null = null
    const liveConnection = createLiveSessionConnection({
      getAccessToken: async () => {
        if (
          cachedToken &&
          cachedToken.expiresAtMs - Date.now() > LIVE_SESSION_REAUTHENTICATION_LEAD_MS
        ) {
          return cachedToken.value
        }
        const result = await betterAuthClient.convex.token({ fetchOptions: { throw: false } })
        const accessToken = result.data?.token
        if (!accessToken) throw new Error('Unable to authenticate live play.')
        cachedToken = { expiresAtMs: accessTokenExpiresAtMs(accessToken), value: accessToken }
        return accessToken
      },
      getTicket: () => convex.action(api.liveSessions.tickets.issue, { campaignId }),
      onError: (nextError) => setError(errorMessage(nextError)),
      onCampaignChatEntry: (entry) => onCampaignChatEntryRef.current?.(entry),
      onPrivateRoll: (roll) => onPrivateRollRef.current?.(roll),
      onCampaignSummary: setCampaignSummary,
      onCharacterSheet: setCharacterSheet,
      onEncounterSession: (session) => setHeldEncounterSession(session.held ? session : null),
      onCommandRejected: setRejection,
      onDurableState: (state) => {
        setCommandReady(state.commandReady)
        setRecipientState(state.recipientState)
        setSequence(state.sequence)
      },
      onStatus: (nextStatus) => {
        setStatus(nextStatus)
        // Without the room, Convex is the source again until the room pushes a fresh frame.
        if (nextStatus !== 'CONNECTED') {
          setCampaignSummary(null)
          setHeldEncounterSession(null)
        }
      },
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
    connection.current?.subscribeCampaignSummary(enabled && followsCampaignSummary)
    return () => setCampaignSummary(null)
  }, [campaignId, enabled, followsCampaignSummary])

  useEffect(() => {
    connection.current?.subscribeCharacterSheet(enabled ? characterSheetId : null)
    return () => setCharacterSheet(null)
  }, [campaignId, characterSheetId, enabled])

  const followsEncounterSession = enabled && encounterSession !== null
  const followsEncounterTimeline = encounterSession?.timeline ?? false
  useEffect(() => {
    connection.current?.subscribeEncounterSession(
      followsEncounterSession ? { timeline: followsEncounterTimeline } : null
    )
    return () => setHeldEncounterSession(null)
  }, [campaignId, followsEncounterSession, followsEncounterTimeline])

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
  const readEncounter = useCallback((read: EncounterReadDto) => {
    const current = connection.current
    return current
      ? current.readEncounter(read)
      : Promise.reject(new Error('Live play is not connected.'))
  }, [])
  const sendTransient = useCallback((envelope: SceneTransientEnvelopeDto) => {
    return connection.current?.sendTransient(envelope) ?? false
  }, [])

  return {
    campaignSummary,
    characterSheet,
    commandReady,
    encounterSession: heldEncounterSession,
    error,
    readEncounter,
    recipientState,
    rejection,
    sendCharacterSheetCommand,
    sendCommand,
    sendEncounterCommand,
    sendSceneFog,
    sendTransient,
    sequence,
    status
  }
}
