import { expect as playwrightExpect, type Page } from '@playwright/test'
import {
  LIVE_SESSION_PATH_PREFIX,
  liveSessionWebSocketClientMessageDtoSchema,
  liveSessionWebSocketServerMessageDtoSchema
} from '@artificer-toolkit/schema/api/liveSessions'
import type {
  EncounterCommandResultDto,
  MoveHeldEffectInputDto,
  RemoveAreaTargetInputDto,
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto,
  SetConcealmentObserversInputDto
} from '@artificer-toolkit/schema/api/encounters'

const expect = playwrightExpect.configure({ timeout: 90_000 })

type CapturedEncounterCommandInput =
  | ResolveEncounterActionInputDto
  | ResolveRuleOccurrenceInputDto
  | MoveHeldEffectInputDto
  | RemoveAreaTargetInputDto
  | SetConcealmentObserversInputDto

type CapturedEncounterCommand = {
  command: CapturedEncounterCommandInput
  result?: EncounterCommandResultDto
  error?: string
}

/**
 * Records the Encounter actions, decision answers, held-effect moves and GM concealment edits a page sends through its Session room socket
 * (the only door for Encounter commands), with the room's result or refusal, and Convex query
 * failures from its sync socket.
 */
export function captureEncounterCommands(
  page: Page,
  diagnostics: string[],
  stage: () => string
): Map<string, CapturedEncounterCommand> {
  const commands = new Map<string, CapturedEncounterCommand>()
  page.on('websocket', (socket) => {
    const url = new URL(socket.url())
    if (url.pathname.startsWith(LIVE_SESSION_PATH_PREFIX)) {
      socket.on('framesent', ({ payload }) => {
        const message = liveSessionWebSocketClientMessageDtoSchema.safeParse(
          parseFrame(payload.toString())
        )
        if (
          !message.success ||
          message.data.type !== 'COMMAND' ||
          message.data.command.scope !== 'ENCOUNTER'
        )
          return
        const command = message.data.command.command
        if (
          command.type !== 'RESOLVE_ACTION' &&
          command.type !== 'RESOLVE_RULE_OCCURRENCE' &&
          command.type !== 'MOVE_HELD_EFFECT' &&
          command.type !== 'REMOVE_AREA_TARGET' &&
          command.type !== 'SET_CONCEALMENT_OBSERVERS'
        )
          return
        if (!commands.has(command.commandId)) commands.set(command.commandId, { command })
      })
      socket.on('framereceived', ({ payload }) => {
        const message = liveSessionWebSocketServerMessageDtoSchema.safeParse(
          parseFrame(payload.toString())
        )
        if (!message.success) return
        if (
          message.data.type === 'COMMAND_COMMITTED' &&
          message.data.delta?.scope === 'ENCOUNTER'
        ) {
          const captured = commands.get(message.data.commandId)
          if (captured) captured.result = message.data.delta.result
        } else if (message.data.type === 'COMMAND_REJECTED') {
          const captured = commands.get(message.data.commandId)
          if (captured) captured.error = `${message.data.code}: ${message.data.message}`
        }
      })
      return
    }
    if (!/^\/api\/[^/]+\/sync$/.test(url.pathname)) return
    socket.on('framereceived', ({ payload }) => {
      const message = parseFrame(payload.toString())
      if (!message || typeof message !== 'object' || !('modifications' in message)) return
      if (!Array.isArray(message.modifications)) return
      const modifications: unknown[] = message.modifications
      for (const modification of modifications) {
        if (
          modification &&
          typeof modification === 'object' &&
          'type' in modification &&
          modification.type === 'QueryFailed' &&
          'errorMessage' in modification &&
          typeof modification.errorMessage === 'string'
        )
          diagnostics.push(stage() + ': ' + modification.errorMessage)
      }
    })
  })
  return commands
}

function parseFrame(frame: string): unknown {
  try {
    return JSON.parse(frame)
  } catch {
    return null
  }
}
export async function waitForCommand(
  commands: Map<string, CapturedEncounterCommand>,
  priorCount: number
): Promise<{
  command: CapturedEncounterCommandInput
  result: EncounterCommandResultDto
}> {
  await expect.poll(() => commands.size).toBe(priorCount + 1)
  const captured = [...commands.values()][priorCount]
  if (!captured) throw new Error('Browser did not submit an Encounter command.')
  await expect.poll(() => captured.result ?? captured.error).not.toBeUndefined()
  if (captured.error) throw new Error(captured.error)
  if (!captured.result) throw new Error('Browser did not receive an Encounter response.')
  return { command: captured.command, result: captured.result }
}
