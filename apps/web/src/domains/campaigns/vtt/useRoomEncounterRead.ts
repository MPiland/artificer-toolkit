import type {
  EncounterReadDto,
  EncounterReadResultDto
} from '@artificer-toolkit/schema/api/encounterRead'
import { useEffect, useRef, useState } from 'react'
import {
  LiveSessionReadRejectedError,
  type LiveSessionEncounterReadReply
} from './liveSessionClient'
import type { HeldEncounterSession } from './useCampaignLiveSession'

type ReadEncounter = (read: EncounterReadDto) => Promise<LiveSessionEncounterReadReply>

/**
 * A refusal the room gives as the answer, not for lack of state: Convex, which trails the room,
 * would only repeat it from older state, so it is shown instead of reading Convex.
 */
function authoritativeRefusal(error: unknown): LiveSessionReadRejectedError | null {
  return error instanceof LiveSessionReadRejectedError &&
    (error.code === 'DOMAIN_REJECTED' || error.code === 'FORBIDDEN')
    ? error
    : null
}

type RoomRead<Value> =
  | { routed: false }
  | { routed: true; value: Value | undefined; error: Error | null }

/**
 * While the room holds the Encounter session, asks it for `read` on every change of the session
 * version and ignores an answer older than the frame. A read the room cannot answer is
 * `{ routed: false }` and the caller reads Convex as it does without the room. `select` returns
 * the answer's value, or undefined when the answer is not the one asked for. A read that also
 * depends on state outside the Encounter session passes its revision as `refreshKey`.
 */
export function useRoomEncounterRead<Value>({
  read,
  readEncounter,
  refreshKey = '',
  room,
  select
}: {
  read: EncounterReadDto | null
  readEncounter: ReadEncounter
  refreshKey?: string
  room: HeldEncounterSession | null
  select: (result: EncounterReadResultDto) => Value | undefined
}): RoomRead<Value> {
  const key = room && read ? `${room.version}:${refreshKey}:${JSON.stringify(read)}` : null
  const request = useRef({ read, roomVersion: room?.version, select })
  request.current = { read, roomVersion: room?.version, select }
  const [answer, setAnswer] = useState<{
    key: string
    error: Error | null
    fallback: boolean
    value?: Value
  } | null>(null)

  useEffect(() => {
    const { read: asked, roomVersion, select: pick } = request.current
    if (key === null || !asked || roomVersion === undefined) return
    let current = true
    readEncounter(asked).then(
      (reply) => {
        if (!current || reply.version < roomVersion) return
        const value = pick(reply.result)
        setAnswer(
          value === undefined
            ? { key, error: null, fallback: true }
            : { key, error: null, fallback: false, value }
        )
      },
      (error: unknown) => {
        if (!current) return
        const refusal = authoritativeRefusal(error)
        setAnswer({ key, error: refusal, fallback: refusal === null })
      }
    )
    return () => {
      current = false
    }
  }, [key, readEncounter])

  if (key === null) return { routed: false }
  const held = answer?.key === key ? answer : null
  if (held?.fallback) return { routed: false }
  return { routed: true, value: held?.value, error: held?.error ?? null }
}

/** One-off form of {@link useRoomEncounterRead}: the room's answer, else `fallback`. */
export async function readFromRoomOrFallback<Value>({
  fallback,
  read,
  readEncounter,
  roomVersion,
  select
}: {
  fallback: () => Promise<Value>
  read: EncounterReadDto
  readEncounter: ReadEncounter
  /** The held session's version, or null when the room does not hold one. */
  roomVersion: number | null
  select: (result: EncounterReadResultDto) => Value | undefined
}): Promise<Value> {
  if (roomVersion !== null) {
    try {
      const reply = await readEncounter(read)
      const value = reply.version < roomVersion ? undefined : select(reply.result)
      if (value !== undefined) return value
    } catch (error) {
      const refusal = authoritativeRefusal(error)
      if (refusal !== null) throw refusal
    }
  }
  return fallback()
}
