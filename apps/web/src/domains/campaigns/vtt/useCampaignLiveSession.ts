import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
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
import { errorMessage } from '#app/lib/errorMessage'
import { LOCAL_SESSION_WORKER_URL } from '#app/lib/sessionWorkerOrigin'
import { acquireCampaignLiveConnection, type LiveSessionLease } from './campaignLiveConnections'
import {
  resolveLiveSessionWebSocketUrl,
  type LiveSessionCharacterSheetPush,
  type LiveSessionCommandCommit,
  type LiveSessionCommandRejection,
  type LiveSessionConnectionStatus
} from './liveSessionClient'

/** Marks a command as this caller's until the room settles it, so only its sender shows a refusal. */
function trackSentCommand<T>(sent: Set<string>, commandId: string, result: Promise<T>): Promise<T> {
  sent.add(commandId)
  return result.finally(() => sent.delete(commandId))
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
  const lease = useRef<LiveSessionLease | null>(null)
  const sentCommandIds = useRef(new Set<string>())
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
  useEffect(() => {
    onTransientRef.current = onTransient
    onCampaignChatEntryRef.current = onCampaignChatEntry
    onPrivateRollRef.current = onPrivateRoll
  })

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
    const held = acquireCampaignLiveConnection({
      campaignId,
      characterSheetId,
      convex,
      listener: {
        onError: (nextError) => setError(errorMessage(nextError)),
        onCampaignChatEntry: (entry) => onCampaignChatEntryRef.current?.(entry),
        onPrivateRoll: (roll) => onPrivateRollRef.current?.(roll),
        onCampaignSummary: setCampaignSummary,
        onCharacterSheet: setCharacterSheet,
        onEncounterSession: (session) => setHeldEncounterSession(session.held ? session : null),
        // The connection is shared, so only the caller that sent a command shows its refusal.
        onCommandRejected: (nextRejection) => {
          if (sentCommandIds.current.has(nextRejection.commandId)) setRejection(nextRejection)
        },
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
        onTransient: (message) => onTransientRef.current?.(message)
      },
      url: resolveLiveSessionWebSocketUrl(configuredUrl, campaignId)
    })
    lease.current = held
    return () => {
      if (lease.current === held) lease.current = null
      held.release()
      setCharacterSheet(null)
    }
  }, [campaignId, characterSheetId, convex, enabled])

  const followsEncounterSession = enabled && encounterSession !== null
  const followsEncounterTimeline = encounterSession?.timeline ?? false
  useEffect(() => {
    lease.current?.follow({
      campaignSummary: enabled && followsCampaignSummary,
      encounterSession: followsEncounterSession ? { timeline: followsEncounterTimeline } : null
    })
    return () => {
      setCampaignSummary(null)
      setHeldEncounterSession(null)
    }
  }, [
    campaignId,
    characterSheetId,
    convex,
    enabled,
    followsCampaignSummary,
    followsEncounterSession,
    followsEncounterTimeline
  ])

  const sendCommand = useCallback(
    (command: LiveSessionCommandDto): Promise<LiveSessionCommandCommit> => {
      const current = lease.current
      if (!current) return Promise.reject(new Error('Live play is not connected.'))
      setRejection(null)
      return trackSentCommand(
        sentCommandIds.current,
        command.command.commandId,
        current.commands.submitCommand(command)
      )
    },
    []
  )
  const sendSceneFog = useCallback(
    (
      command: Extract<SceneCommandInputDto, { type: 'PATCH_SCENE_FOG' }>
    ): Promise<LiveSessionCommandCommit> => {
      const current = lease.current
      if (!current) return Promise.reject(new Error('Live play is not connected.'))
      setRejection(null)
      return trackSentCommand(
        sentCommandIds.current,
        command.commandId,
        current.commands.submitSceneFog(command)
      )
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
    const current = lease.current
    return current
      ? current.commands.readEncounter(read)
      : Promise.reject(new Error('Live play is not connected.'))
  }, [])
  const sendTransient = useCallback((envelope: SceneTransientEnvelopeDto) => {
    return lease.current?.commands.sendTransient(envelope) ?? false
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
